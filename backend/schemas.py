from pydantic import BaseModel


class SalonSummary(BaseModel):
    id: str
    name: str
    district: str | None = None
    rating: float | None = None
    review_count: int | None = None
    price_range: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class Salon(BaseModel):
    id: str
    name: str
    address: str | None = None
    district: str | None = None
    phone: str | None = None
    website: str | None = None
    rating: float | None = None
    review_count: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None
    services: list[str] | None = None
    price_range: str | None = None
    notes: str | None = None


class SalonUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    district: str | None = None
    phone: str | None = None
    website: str | None = None
    rating: float | None = None
    review_count: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None
    services: list[str] | None = None
    price_range: str | None = None
    notes: str | None = None
