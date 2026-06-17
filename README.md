# ELD Trip Planner — Spotter AI Assessment

Full-stack ELD (Electronic Logging Device) trip planning app.
Takes trip inputs and generates HOS-compliant route plans + FMCSA daily log sheets.

## Stack
- **Backend:** Django + Django REST Framework
- **Frontend:** React + Vite + Tailwind CSS + Leaflet
- **APIs:** OSRM (routing), Nominatim (geocoding) — both free, no key required

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL
npm run dev
```

## Deployment
- **Frontend:** Vercel (`npm run build` → deploy)
- **Backend:** Railway or Render (free tier)

## Features
- Geocoding via Nominatim (free)
- Route planning via OSRM (free)
- HOS rule engine: 11-hr driving, 14-hr window, 30-min break, 70hr/8-day cycle
- Auto fuel stops every 1,000 miles
- Canvas-drawn FMCSA log sheets (multi-day)
- PDF + PNG download of log sheets
- Interactive Leaflet map with stop markers

## API
- `POST /api/v1/trip/plan` — plan a trip
- `GET /api/v1/trip/{id}` — retrieve trip
- `POST /api/v1/geocode` — geocode a location
