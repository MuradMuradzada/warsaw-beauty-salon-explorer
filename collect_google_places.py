"""Collect Warsaw beauty salon data from Google Places API.

Usage:
    1. Create a .env file with GOOGLE_PLACES_API_KEY=your_key
    2. Install dependencies from requirements.txt
    3. Run: python collect_google_places.py

The script searches Warsaw districts across multiple salon categories, deduplicates
results by place ID, enriches each place with Place Details, and writes salons.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

SEARCH_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "nextPageToken",
    ]
)

DETAILS_FIELD_MASK = ",".join(
    [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "addressComponents",
        "nationalPhoneNumber",
        "websiteUri",
        "rating",
        "userRatingCount",
    ]
)

WARSAW_DISTRICTS = [
    "Mokotów",
    "Śródmieście",
    "Wola",
    "Ochota",
    "Ursynów",
    "Żoliborz",
    "Bielany",
    "Bemowo",
    "Praga-Północ",
    "Praga-Południe",
]

SALON_CATEGORIES = [
    "hair salon",
    "beauty salon",
    "nail salon",
    "barber shop",
]

WARSAW_LOCATION_BIAS = {
    "circle": {
        "center": {"latitude": 52.2297, "longitude": 21.0122},
        "radius": 20000.0,
    }
}


@dataclass
class Config:
    api_key: str
    output_path: Path
    timeout: int = 30
    retries: int = 3
    search_delay: float = 0.4
    details_delay: float = 0.2
    page_token_delay: float = 2.0
    page_size: int = 20
    max_pages_per_query: int = 3


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_like = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return ascii_like.casefold()


DISTRICT_LOOKUP = {normalize_text(district): district for district in WARSAW_DISTRICTS}


def extract_district(*candidates: str | None) -> str | None:
    for candidate in candidates:
        normalized_candidate = normalize_text(candidate)
        for normalized_district, district in DISTRICT_LOOKUP.items():
            if normalized_district and normalized_district in normalized_candidate:
                return district
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect Warsaw beauty salon data with Google Places API."
    )
    parser.add_argument(
        "--output",
        default="salons.json",
        help="Output JSON file path. Default: salons.json",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=20,
        choices=range(1, 21),
        metavar="[1-20]",
        help="Number of results per Text Search page. Default: 20",
    )
    parser.add_argument(
        "--max-pages-per-query",
        type=int,
        default=3,
        help="Maximum number of pages to request for each district/category query. Default: 3",
    )
    return parser.parse_args()


def load_config(args: argparse.Namespace) -> Config:
    load_dotenv()
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GOOGLE_PLACES_API_KEY is not set. Add it to your .env file or environment."
        )

    return Config(
        api_key=api_key,
        output_path=Path(args.output),
        page_size=args.page_size,
        max_pages_per_query=args.max_pages_per_query,
    )


def request_with_retry(
    session: requests.Session,
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    json_body: dict[str, Any] | None = None,
    timeout: int,
    retries: int,
) -> dict[str, Any]:
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            response = session.request(
                method=method,
                url=url,
                headers=headers,
                json=json_body,
                timeout=timeout,
            )
            if response.status_code == 429 or response.status_code >= 500:
                response.raise_for_status()
            if not response.ok:
                try:
                    error_payload = response.json()
                except ValueError:
                    error_payload = response.text
                raise RuntimeError(
                    f"API request failed with status {response.status_code}: {error_payload}"
                )
            return response.json()
        except (requests.RequestException, RuntimeError) as exc:
            last_error = exc
            backoff = min(2 ** (attempt - 1), 8)
            print(
                f"Request failed (attempt {attempt}/{retries}): {exc}",
                file=sys.stderr,
            )
            if attempt < retries:
                time.sleep(backoff)

    raise RuntimeError(f"Request failed after {retries} attempts: {last_error}")


def search_places(
    session: requests.Session,
    config: Config,
    *,
    district: str,
    category: str,
) -> list[dict[str, Any]]:
    query = f"{category} in {district} Warsaw"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.api_key,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    }

    places: list[dict[str, Any]] = []
    next_page_token: str | None = None

    for page_number in range(1, config.max_pages_per_query + 1):
        if next_page_token:
            time.sleep(config.page_token_delay)

        payload: dict[str, Any] = {
            "textQuery": query,
            "pageSize": config.page_size,
            "languageCode": "pl",
            "regionCode": "PL",
            "locationBias": WARSAW_LOCATION_BIAS,
        }
        if next_page_token:
            payload["pageToken"] = next_page_token

        response = request_with_retry(
            session,
            "POST",
            TEXT_SEARCH_URL,
            headers=headers,
            json_body=payload,
            timeout=config.timeout,
            retries=config.retries,
        )

        page_places = response.get("places", [])
        next_page_token = response.get("nextPageToken")
        print(
            f"Search '{query}' page {page_number}: received {len(page_places)} places"
        )

        for place in page_places:
            place["_query_category"] = category
            place["_query_district"] = district
            places.append(place)

        if not next_page_token:
            break

        time.sleep(config.search_delay)

    return places


def get_place_details(
    session: requests.Session,
    config: Config,
    place_id: str,
) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.api_key,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    }
    url = PLACE_DETAILS_URL.format(place_id=place_id)
    return request_with_retry(
        session,
        "GET",
        url,
        headers=headers,
        timeout=config.timeout,
        retries=config.retries,
    )


def merge_search_result(
    existing: dict[str, Any] | None,
    place: dict[str, Any],
) -> dict[str, Any]:
    place_id = place["id"]
    display_name = place.get("displayName", {}).get("text")
    formatted_address = place.get("formattedAddress")
    location = place.get("location", {})
    district = extract_district(formatted_address, place.get("_query_district"))

    merged = existing or {
        "id": place_id,
        "name": display_name,
        "address": formatted_address,
        "district": district or place.get("_query_district"),
        "phone": None,
        "website": None,
        "rating": None,
        "review_count": None,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "source": "google_places_api",
    }

    if not merged.get("name") and display_name:
        merged["name"] = display_name
    if not merged.get("address") and formatted_address:
        merged["address"] = formatted_address
    if not merged.get("district"):
        merged["district"] = district or place.get("_query_district")
    if merged.get("latitude") is None and location.get("latitude") is not None:
        merged["latitude"] = location.get("latitude")
    if merged.get("longitude") is None and location.get("longitude") is not None:
        merged["longitude"] = location.get("longitude")

    return merged


def address_component_texts(details: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    for component in details.get("addressComponents", []):
        if component.get("longText"):
            texts.append(component["longText"])
        if component.get("shortText"):
            texts.append(component["shortText"])
    return texts


def enrich_with_details(base: dict[str, Any], details: dict[str, Any]) -> dict[str, Any]:
    display_name = details.get("displayName", {}).get("text")
    formatted_address = details.get("formattedAddress")
    location = details.get("location", {})
    component_candidates = address_component_texts(details)
    district = extract_district(
        formatted_address,
        base.get("district"),
        *component_candidates,
    )

    base["name"] = display_name or base.get("name")
    base["address"] = formatted_address or base.get("address")
    base["district"] = district or base.get("district")
    base["phone"] = details.get("nationalPhoneNumber") or base.get("phone")
    base["website"] = details.get("websiteUri") or base.get("website")
    base["rating"] = details.get("rating", base.get("rating"))
    base["review_count"] = details.get("userRatingCount", base.get("review_count"))
    base["latitude"] = location.get("latitude", base.get("latitude"))
    base["longitude"] = location.get("longitude", base.get("longitude"))
    return base


def collect_salons(config: Config) -> list[dict[str, Any]]:
    session = requests.Session()
    unique_places: dict[str, dict[str, Any]] = {}

    for district in WARSAW_DISTRICTS:
        for category in SALON_CATEGORIES:
            print(f"Searching: {category} / {district}")
            search_results = search_places(
                session,
                config,
                district=district,
                category=category,
            )
            for place in search_results:
                place_id = place["id"]
                unique_places[place_id] = merge_search_result(
                    unique_places.get(place_id),
                    place,
                )
            time.sleep(config.search_delay)

    print(f"Collected {len(unique_places)} unique places from Text Search.")

    for index, place_id in enumerate(unique_places, start=1):
        print(f"Fetching details {index}/{len(unique_places)}: {place_id}")
        details = get_place_details(session, config, place_id)
        unique_places[place_id] = enrich_with_details(unique_places[place_id], details)
        time.sleep(config.details_delay)

    salons = sorted(
        unique_places.values(),
        key=lambda item: (
            item.get("district") or "",
            item.get("name") or "",
            item["id"],
        ),
    )
    return salons


def write_output(output_path: Path, salons: list[dict[str, Any]]) -> None:
    output_path.write_text(
        json.dumps(salons, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()

    try:
        config = load_config(args)
        salons = collect_salons(config)
        write_output(config.output_path, salons)
    except Exception as exc:  # pragma: no cover - CLI level reporting
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Saved {len(salons)} unique salons to {config.output_path}")
    if len(salons) < 100:
        print(
            "Warning: fewer than 100 unique salons were collected. "
            "Consider increasing queries or reviewing API results.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
