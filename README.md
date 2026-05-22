# Warsaw Beauty Salon Explorer

Small full-stack app for exploring beauty salons in Warsaw.

The project includes:
- a Python script that collects salon data from Google Places API
- a FastAPI backend that serves the data from `salons.json`
- a React frontend with filters, map view, salon details, and admin editing mode

## Project structure

- `collect_google_places.py` - data collection script
- `salons.json` - collected salon dataset
- `backend/` - FastAPI API
- `frontend/` - React + Vite frontend

## What the app can do

- show a list of salons
- filter by district
- search by name or address
- filter by minimum rating
- filter by minimum review count
- filter salons that have a website
- sort by name, rating, or review count
- show salons on a map
- open salon website if available
- edit salon details in admin mode

## Requirements

You need:
- Python 3.11+
- Node.js + npm
- Google Places API key if you want to collect data again

## Environment variables

Create `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Example:

```env
GOOGLE_PLACES_API_KEY=your_google_api_key
ADMIN_TOKEN=admin
```

Variables:
- `GOOGLE_PLACES_API_KEY` - required only for the data collection script
- `ADMIN_TOKEN` - token for frontend admin mode and protected backend updates

## Quick start

### 1. Install Python dependencies

```powershell
python -m pip install -r requirements.txt
```

### 2. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 3. Start backend

```powershell
uvicorn backend.main:app --reload
```

Backend will be available at:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

### 4. Start frontend

Open another terminal:

```powershell
cd frontend
npm run dev
```

Frontend will be available at:
- `http://localhost:5173`

## How to use admin mode

The UI is read-only until you enter admin mode.

Default token:

```text
admin
```

If you change `ADMIN_TOKEN` in `.env`, use that value instead.

Admin flow:
1. Open the frontend
2. Click `Enter admin mode`
3. Enter the token
4. Open any salon
5. Click `Edit salon`
6. Save changes

The frontend sends the token in the `X-Admin-Token` header.

## API endpoints

### Basic endpoints

- `GET /api/health`
- `GET /api/salons`
- `GET /api/salons/{salon_id}`
- `PUT /api/salons/{salon_id}`
- `POST /api/admin/verify`

### Filter examples

- `GET /api/salons?district=Bemowo`
- `GET /api/salons?search=barber`
- `GET /api/salons?min_rating=4.5`
- `GET /api/salons?min_review_count=50`
- `GET /api/salons?has_website=true`
- `GET /api/salons?sort_by=name_asc`
- `GET /api/salons?sort_by=rating_desc`
- `GET /api/salons?sort_by=reviews_desc`

## Collecting data again

If you want to rebuild `salons.json`, run:

```powershell
python collect_google_places.py
```

Optional arguments:

```powershell
python collect_google_places.py --output salons.json --page-size 20 --max-pages-per-query 3
```

The script:
- searches across multiple Warsaw districts
- uses Google Places Text Search for discovery
- uses Place Details for enrichment
- removes duplicates by `place id`
- saves the result to `salons.json`

## Dataset fields

Each salon record may contain:
- `id`
- `name`
- `address`
- `district`
- `phone`
- `website`
- `rating`
- `review_count`
- `latitude`
- `longitude`
- `source`
- `services`
- `price_range`
- `notes`

## Notes

- `.env` is ignored by Git
- Google Places API may require billing depending on your Google Cloud configuration
- frontend edits are protected by the admin token, but this is still a lightweight demo-level auth flow, not a full production auth system
