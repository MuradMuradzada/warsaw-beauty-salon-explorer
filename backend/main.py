import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import Salon, SalonSummary, SalonUpdate
from backend.storage import find_salon_by_id, load_salons, update_salon

load_dotenv()


app = FastAPI(
    title="Warsaw Beauty Salon Explorer API",
    version="0.1.0",
    description="REST API for browsing and updating Warsaw beauty salon data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_admin_token(x_admin_token: str | None) -> None:
    expected_token = os.getenv("ADMIN_TOKEN", "admin")
    if not x_admin_token or x_admin_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}


@app.post("/api/admin/verify")
def verify_admin(x_admin_token: str | None = Header(default=None)):
    require_admin_token(x_admin_token)
    return {"ok": True}


@app.get("/api/salons", response_model=list[SalonSummary])
def get_salons(
    district: str | None = None,
    search: str | None = None,
    min_rating: float | None = None,
    min_review_count: int | None = None,
    has_website: bool | None = None,
    sort_by: str = "name_asc",
):
    salons = load_salons()

    if district:
        district = district.casefold()
        salons = [
            salon
            for salon in salons
            if (salon.get("district") or "").casefold() == district
        ]

    if search:
        search = search.casefold()
        salons = [
            salon
            for salon in salons
            if search in (salon.get("name") or "").casefold()
            or search in (salon.get("address") or "").casefold()
        ]

    if min_rating is not None:
        salons = [
            salon
            for salon in salons
            if salon.get("rating") is not None and salon.get("rating") >= min_rating
        ]

    if min_review_count is not None:
        salons = [
            salon
            for salon in salons
            if salon.get("review_count") is not None
            and salon.get("review_count") >= min_review_count
        ]

    if has_website is not None:
        salons = [
            salon
            for salon in salons
            if bool(salon.get("website")) is has_website
        ]

    if sort_by == "rating_desc":
        salons.sort(
            key=lambda salon: (
                -(salon.get("rating") or 0),
                salon.get("name") or "",
            )
        )
    elif sort_by == "reviews_desc":
        salons.sort(
            key=lambda salon: (
                -(salon.get("review_count") or 0),
                salon.get("name") or "",
            )
        )
    else:
        salons.sort(key=lambda salon: (salon.get("name") or "", salon.get("district") or ""))

    return [
        SalonSummary(
            id=salon["id"],
            name=salon["name"],
            district=salon.get("district"),
            rating=salon.get("rating"),
            review_count=salon.get("review_count"),
            price_range=salon.get("price_range"),
            latitude=salon.get("latitude"),
            longitude=salon.get("longitude"),
        )
        for salon in salons
    ]


@app.get("/api/salons/{salon_id}", response_model=Salon)
def get_salon(salon_id: str):
    salon = find_salon_by_id(salon_id)
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found")
    return salon


@app.put("/api/salons/{salon_id}", response_model=Salon)
def put_salon(
    salon_id: str,
    payload: SalonUpdate,
    x_admin_token: str | None = Header(default=None),
):
    require_admin_token(x_admin_token)
    updates = payload.model_dump(exclude_unset=True)
    updated_salon = update_salon(salon_id, updates)
    if updated_salon is None:
        raise HTTPException(status_code=404, detail="Salon not found")
    return updated_salon
