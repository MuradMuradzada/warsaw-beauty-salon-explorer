# Warsaw Accelerator Home Task Plan

## What they want

Build one end-to-end web application for Warsaw beauty salons with:

1. Data collection for at least 100 salons.
2. A backend REST API.
3. A frontend UI that reads and updates salon data.

## Minimum requirements

### Part 1: Data collection

Collect at least 100 Warsaw hair/beauty salons from a public source.

Required fields:
- `name`
- `address`
- `district`

Nice to have:
- `phone`
- `website_or_social`
- `services`
- `price_range`
- `rating`
- `review_count`

Allowed storage:
- SQLite
- JSON
- CSV
- any database

### Part 2: Backend API

Need REST endpoints for:
- list all salons with summary fields
- get one salon with full details
- update one salon and persist the changes

### Part 3: Frontend UI

Need a simple UI with:
- salon listing page
- search or filter by district or service type
- salon detail page
- edit form that saves changes through the API

## Deliverables

Repository should include:
- application code
- `README.md`

README should explain:
- how to run the app
- technical solution and tools used
- what you would improve with more time

## What they care about

- data quality
- code quality
- product thinking
- documentation

They explicitly said they care more about your thinking than hitting exactly 100 records.

## Best practical approach

For a 4-8 hour task, aim for a clean MVP:

### Suggested stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Storage: SQLite

This is fast to build, easy to demo, and easy to run locally.

If you are stronger in Python:
- Frontend: React + Vite
- Backend: FastAPI
- Storage: SQLite

If you want to optimize for their "plus" note:
- Backend: Kotlin + Spring Boot
- Frontend: React or Next.js

Only choose Kotlin if you are already comfortable with it, because speed matters here.

## Smart MVP scope

### Data model

Use one `salons` table with fields like:

- `id`
- `name`
- `address`
- `district`
- `phone`
- `website_or_social`
- `services`
- `price_range`
- `rating`
- `review_count`
- `source`
- `updated_at`

### API routes

- `GET /api/salons`
- `GET /api/salons/:id`
- `PUT /api/salons/:id`

Optional:
- `GET /api/salons?district=Mokotow`
- `GET /api/salons?service=haircut`

### Frontend screens

- salon list page
- district filter or service filter
- salon details page
- edit form with save button

## Recommended build order

1. Create project structure.
2. Collect and clean the salon data.
3. Save it in SQLite or JSON.
4. Build the backend API.
5. Build the frontend list and detail pages.
6. Add editing and persistence.
7. Write README and prepare demo.

## How to discuss it in the interview

Be ready to explain:
- why you chose the data source
- how you handled missing values
- how you removed duplicates
- how you mapped salons to Warsaw districts
- how you would scale from Warsaw to all of Poland

Good scaling answer:
- use a more stable source or provider API
- add scheduled imports
- normalize categories and districts
- add background jobs and validation rules

## Git workflow

### Start a repository

```powershell
git init
git branch -M main
```

### Good commit sequence

```powershell
git add .
git commit -m "chore: initialize project structure"
```

```powershell
git add .
git commit -m "feat: add salon data collection and cleaned dataset"
```

```powershell
git add .
git commit -m "feat: implement salon REST API"
```

```powershell
git add .
git commit -m "feat: build salon listing and detail UI"
```

```powershell
git add .
git commit -m "feat: add salon editing and persistence"
```

```powershell
git add .
git commit -m "docs: add setup instructions and project notes"
```

### Push to GitHub

After creating an empty GitHub repo:

```powershell
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Important things not to commit

Do not commit:
- `node_modules`
- build output like `dist` or `.next`
- secrets in `.env`
- temporary scraper outputs you do not need

Add a `.gitignore` early.

## Definition of done

You are done when:
- app runs locally
- at least 100 salon records exist
- list page works
- filter works
- detail page works
- editing works and saves
- README lets another person run it
