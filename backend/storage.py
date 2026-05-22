import json
import threading
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parent.parent / "salons.json"
WRITE_LOCK = threading.Lock()


def load_salons() -> list[dict[str, Any]]:
    with DATA_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise ValueError("Expected salons.json to contain a list of salons.")
    return data


def save_salons(data: list[dict[str, Any]]) -> None:
    temp_path = DATA_PATH.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    temp_path.replace(DATA_PATH)


def find_salon_by_id(salon_id: str) -> dict[str, Any] | None:
    for salon in load_salons():
        if salon.get("id") == salon_id:
            return salon
    return None


def update_salon(salon_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    with WRITE_LOCK:
        salons = load_salons()
        for salon in salons:
            if salon.get("id") == salon_id:
                salon.update(updates)
                salon["id"] = salon_id
                save_salons(salons)
                return salon
    return None
