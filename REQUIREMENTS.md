# ELD Trip Planner — Full Requirements & Business Logic

**Client:** Spotter AI  
**Role:** Full Stack Developer Assessment  
**Stack:** Django (Backend) + React (Frontend)  
**Deadline:** 4 days / max 16 work hours  
**Reward:** $100 on successful completion

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Inputs](#2-user-inputs)
3. [System Outputs](#3-system-outputs)
4. [HOS Business Logic](#4-hos-business-logic)
5. [Trip Calculation Logic](#5-trip-calculation-logic)
6. [ELD Log Sheet Drawing Logic](#6-eld-log-sheet-drawing-logic)
7. [Map & Route Logic](#7-map--route-logic)
8. [API Design](#8-api-design)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Data Models](#10-data-models)
11. [Assumptions & Constraints](#11-assumptions--constraints)
12. [Tech Stack & Libraries](#12-tech-stack--libraries)
13. [Folder Structure](#13-folder-structure)
14. [Deployment](#14-deployment)
15. [Submission Checklist](#15-submission-checklist)

---

## 1. Project Overview

Build a full-stack ELD (Electronic Logging Device) Trip Planner that:

- Takes a truck driver's trip details as input
- Calculates a HOS-compliant (Hours of Service) trip schedule
- Outputs an interactive map with route, stops, and rest locations
- Generates filled-out FMCSA-format daily log sheets (drawn programmatically on the paper log grid)

The app must replicate the exact FMCSA Driver's Daily Log format and draw lines on the grid the same way a driver would fill out a paper log book — covering multiple days for longer trips.

---

## 2. User Inputs

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| Current Location | Text / Geocode | Driver's starting point | Required, must geocode to valid coordinates |
| Pickup Location | Text / Geocode | Where cargo is picked up | Required, must geocode |
| Dropoff Location | Text / Geocode | Final cargo destination | Required, must geocode |
| Current Cycle Used (Hrs) | Number (0–70) | Hours already used in the 8-day rolling cycle | Required, 0–70 |

### Input Notes
- All location fields use a geocoding API (e.g., OpenStreetMap Nominatim — free) to convert to lat/lon
- Cycle hours affect how much driving time is available before the 70-hr/8-day cap is hit
- Driver is assumed to begin the trip immediately (current time = trip start time)

---

## 3. System Outputs

### 3.1 Interactive Map
- Full route from Current Location → Pickup → Dropoff rendered on a map
- Markers for each stop type:
  - 🟢 Start (Current Location)
  - 🔵 Pickup Location
  - 🔴 Dropoff Location
  - ⛽ Fuel Stops (auto-calculated every ≤1,000 miles)
  - 🛏️ Rest Stops (auto-calculated per HOS rules)
- Route polyline drawn on map
- Info popup on each marker: location name, arrival time, stop type, duration

### 3.2 Daily ELD Log Sheets
- One log sheet per day of the trip
- Each sheet is a visual rendering of the standard FMCSA Driver's Daily Log
- The 24-hour grid has 4 rows — lines drawn on the correct row for each time segment:
  - Row 1: Off Duty
  - Row 2: Sleeper Berth
  - Row 3: Driving
  - Row 4: On Duty (Not Driving)
- Header fields filled: Date, Driver Name (placeholder), Carrier, Total Miles
- Remarks section filled: location + duty status change at each event
- Recap section: cumulative hours, hours available tomorrow
- Multiple sheets generated for multi-day trips (downloadable as PDF or PNG)

---

## 4. HOS Business Logic

> **Regulatory Basis:** 49 CFR Part 395, FMCSA Hours of Service for Property Carriers

### 4.1 Applicable Ruleset
- **Driver type:** Property-carrying CMV
- **Cycle:** 70-hour / 8-day rolling window
- **No adverse driving conditions** (no 2-hour extension applied)
- **No short-haul exception** (full HOS rules apply)
- **ELD not required** (paper log format used for output)

### 4.2 Core HOS Limits

| Rule | Limit | CFR Reference |
|------|-------|---------------|
| 11-Hour Driving Limit | Max 11 hours of driving after 10 consecutive hours off duty | § 395.3(a)(3) |
| 14-Hour Driving Window | Must not drive after 14th consecutive hour from start of work | § 395.3(a)(2) |
| 30-Minute Rest Break | Required after 8 cumulative driving hours (can be on-duty not driving or off-duty) | § 395.3(a)(3)(ii) |
| 10-Hour Off-Duty | Must take 10 consecutive hours off duty before next driving window | § 395.3(a)(1) |
| 70-Hour / 8-Day Limit | Cannot drive after accumulating 70 on-duty hours in any 8-consecutive-day period | § 395.3(b) |
| 34-Hour Restart (optional) | 34 consecutive hours off duty resets the 70-hr cycle to zero | § 395.3(c) |

### 4.3 Duty Status Definitions

| Status | Description |
|--------|-------------|
| **Driving** | At the wheel of a moving CMV |
| **On Duty Not Driving** | Working but not driving: pre-trip inspection, fueling, loading/unloading, paperwork |
| **Off Duty** | Fully relieved of work, free to pursue personal activities |
| **Sleeper Berth** | Resting in a qualifying sleeper berth (not used in this app — simplified to Off Duty) |

> **Simplification:** This app uses Off Duty for all rest periods (no sleeper berth splits). All rest periods are modeled as 10-hour consecutive off-duty blocks.

### 4.4 Driving Day Cycle (Per Day)

```
[Pre-trip Inspection: 30 min — On Duty Not Driving]
  ↓
[Drive segment — Driving]
  ↓
[30-min break after 8 cumulative driving hours — On Duty Not Driving or Off Duty]
  ↓
[Drive segment continues — Driving]
  ↓
[Fuel Stop if ≥1,000 miles since last fuel — On Duty Not Driving: 30 min]
  ↓
[Pickup/Dropoff stop — On Duty Not Driving: 1 hour each]
  ↓
[14-hour window expires OR 11 driving hours reached — whichever first]
  ↓
[10-hour Off Duty rest]
  ↓
[Repeat next day]
```

### 4.5 70-Hour Cycle Tracking

- Start with `current_cycle_used` hours already consumed from input
- Each on-duty hour (driving + not driving) increments the cycle counter
- When `cycle_hours_used >= 70`, driving must stop until enough off-duty time drops old hours off the 8-day rolling window
- For this app: if 70-hr cap is hit, a 34-hour restart is inserted (driver takes 34 hours off, cycle resets to 0)

---

## 5. Trip Calculation Logic

### 5.1 Distance & Duration Estimation

- Use OSRM (free, open-source routing) or OpenRouteService API for:
  - Total route distance (miles)
  - Estimated driving duration (hours) — NOT using straight-line math
- Average speed assumption: use OSRM's estimated duration directly
- Add buffer: driving duration from API is treated as actual drive time

### 5.2 Stop Types & Durations

| Stop Type | Duration | Duty Status | Trigger |
|-----------|----------|-------------|---------|
| Pre-trip Inspection | 30 min | On Duty Not Driving | Start of every driving day |
| Pickup | 1 hour | On Duty Not Driving | At pickup location |
| Dropoff | 1 hour | On Duty Not Driving | At dropoff location |
| Fuel Stop | 30 min | On Duty Not Driving | Every ≤1,000 miles driven |
| 30-Min Rest Break | 30 min | On Duty Not Driving | After 8 cumulative driving hours in a window |
| Daily Rest | 10 hours | Off Duty | End of each driving window |

### 5.3 Trip Event Sequence Algorithm

```
INPUTS:
  - start_location (lat, lon)
  - pickup_location (lat, lon)
  - dropoff_location (lat, lon)
  - cycle_hours_used (float, 0–70)

INITIALIZE:
  current_time = now()
  current_pos = start_location
  cycle_hours = cycle_hours_used
  daily_driving_hours = 0
  daily_duty_hours = 0
  cumulative_driving_since_break = 0
  miles_since_fuel = 0
  events = []

SEGMENT 1: current_pos → pickup_location
SEGMENT 2: pickup_location → dropoff_location

FOR EACH SEGMENT:
  1. Add pre-trip inspection event (30 min, On Duty Not Driving)
     - daily_duty_hours += 0.5

  2. If this is the pickup segment:
     - Add pickup stop (1 hr, On Duty Not Driving)
     - daily_duty_hours += 1

  3. Drive the segment in chunks:
     WHILE remaining_drive_time > 0:

       a. Calculate max driveable hours before next constraint:
          - hours_to_11hr_limit = 11 - daily_driving_hours
          - hours_to_14hr_window = 14 - daily_duty_hours
          - hours_to_break = 8 - cumulative_driving_since_break
          - hours_to_fuel = miles_to_next_fuel / avg_speed
          - drive_chunk = min(all above, remaining_drive_time)

       b. Drive drive_chunk hours:
          - daily_driving_hours += drive_chunk
          - daily_duty_hours += drive_chunk
          - cycle_hours += drive_chunk
          - miles_since_fuel += drive_chunk * avg_speed
          - cumulative_driving_since_break += drive_chunk
          - Add DRIVING event

       c. Check constraints after chunk:
          IF cumulative_driving_since_break >= 8:
            - Add 30-min break event (On Duty Not Driving)
            - cumulative_driving_since_break = 0
            - daily_duty_hours += 0.5

          IF miles_since_fuel >= 1000:
            - Add fuel stop event (30 min, On Duty Not Driving)
            - miles_since_fuel = 0
            - daily_duty_hours += 0.5

          IF daily_driving_hours >= 11 OR daily_duty_hours >= 14 OR cycle_hours >= 70:
            - Add 10-hour Off Duty rest event
            - Reset: daily_driving_hours = 0, daily_duty_hours = 0
            - cumulative_driving_since_break = 0
            - IF cycle_hours >= 70: trigger 34-hour restart, cycle_hours = 0
            - Continue driving next "day"

  4. If this is the dropoff segment:
     - Add dropoff stop (1 hr, On Duty Not Driving)

RETURN events[]  (ordered list of all events with timestamps, locations, durations, duty status)
```

### 5.4 Event Object Schema

```json
{
  "event_id": 1,
  "day": 1,
  "start_time": "2024-01-15T06:00:00",
  "end_time": "2024-01-15T06:30:00",
  "duration_hours": 0.5,
  "duty_status": "on_duty_not_driving",
  "event_type": "pre_trip_inspection",
  "location": {
    "name": "Chicago, IL",
    "lat": 41.8781,
    "lon": -87.6298
  },
  "miles_driven": 0,
  "odometer": 0,
  "notes": "Pre-trip inspection"
}
```

---

## 6. ELD Log Sheet Drawing Logic

### 6.1 Log Sheet Structure

The FMCSA Driver's Daily Log has the following sections:

**Header Fields:**
- Date (Month/Day/Year)
- Total Miles Driving Today
- Truck/Tractor Number (placeholder: "TRK-001")
- Name of Carrier (placeholder: "Driver Name Transportation")
- Main Office Address (placeholder)
- Home Terminal Address (placeholder)
- Driver's Signature (placeholder)

**The 24-Hour Grid:**
- X-axis: 24 hours (midnight to midnight), divided into 15-minute increments
- Y-axis: 4 rows
  - Row 1: Off Duty
  - Row 2: Sleeper Berth
  - Row 3: Driving
  - Row 4: On Duty (Not Driving)
- Each duty status period = horizontal line drawn on the correct row
- Vertical lines connect status changes

**Remarks Section:**
- One entry per duty status change
- Format: `HH:MM — [Event Type] — [City, State]`

**Recap Section (bottom):**
- Total hours for each status row (must sum to 24)
- Hours on duty today
- Hours available tomorrow (70 - cycle_total)

### 6.2 Grid Drawing Implementation

**Canvas-based approach (React `<canvas>` element):**

```
GRID DIMENSIONS (scaled to A4/Letter page):
  - Total width: 900px (representing 24 hours)
  - Per hour width: 900/24 = 37.5px
  - Per 15-min width: 37.5/4 = 9.375px
  - Row height: 40px each (4 rows = 160px total)
  - Grid starts at x=120px (left margin for row labels)

DRAWING A DUTY STATUS PERIOD:
  function drawSegment(ctx, row, startHour, endHour, color):
    x1 = GRID_LEFT + (startHour / 24) * GRID_WIDTH
    x2 = GRID_LEFT + (endHour / 24) * GRID_WIDTH
    y  = GRID_TOP + (row * ROW_HEIGHT) + (ROW_HEIGHT / 2)
    
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()

DRAWING VERTICAL CONNECTORS (status change):
  Draw a vertical line from previous row's y to current row's y at the x position of the change
```

**Row mapping:**
```
duty_status → row_index
"off_duty"           → 0
"sleeper_berth"      → 1
"driving"            → 2
"on_duty_not_driving"→ 3
```

### 6.3 Multi-Day Sheet Generation

- Group all events by `day` field
- For each day: render one complete log sheet
- If an event crosses midnight: split at midnight, carry remainder to next day's sheet
- Generate all sheets as a list, display in a scrollable/paginated view
- Provide "Download as PDF" button (uses `html2canvas` + `jsPDF`)

### 6.4 Recap Calculation (Per Sheet)

```
total_off_duty = sum(duration for events where duty_status == 'off_duty')
total_sleeper  = 0  (not used)
total_driving  = sum(duration for events where duty_status == 'driving')
total_on_duty  = sum(duration for events where duty_status == 'on_duty_not_driving')

validation: total_off_duty + total_driving + total_on_duty == 24 hours
            (pad with off_duty if needed at end of last day)

hours_available_tomorrow = 70 - cycle_hours_after_today
```

---

## 7. Map & Route Logic

### 7.1 Map Library
- **Leaflet.js** with React-Leaflet wrapper
- Free tile layer: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- No API key required

### 7.2 Routing API
- **OSRM Demo Server** (free, no key): `http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson`
- Returns: distance (meters), duration (seconds), route geometry (GeoJSON polyline)
- Convert distance to miles: `meters * 0.000621371`
- Convert duration to hours: `seconds / 3600`

### 7.3 Geocoding API
- **Nominatim (OpenStreetMap)**: `https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1`
- Free, no key required
- Rate limit: 1 request/second — add small delay between calls

### 7.4 Map Markers & Popups

| Marker | Icon Color | Popup Content |
|--------|------------|---------------|
| Current Location | Green | "Start: {location}, Depart: {time}" |
| Pickup | Blue | "Pickup: {location}, Arrive: {time}, Duration: 1hr" |
| Dropoff | Red | "Dropoff: {location}, Arrive: {time}, Duration: 1hr" |
| Fuel Stop | Orange | "Fuel Stop #{n}, {location}, Arrive: {time}, 30 min" |
| Rest Stop | Purple | "Rest Stop #{n}, {location}, {start_time} – {end_time}, 10 hrs" |

### 7.5 Route Polyline
- Draw the full route from Current → Pickup → Dropoff as a single connected blue polyline
- Fit map bounds to include all markers automatically (`map.fitBounds`)

---

## 8. API Design

### 8.1 Base URL
```
/api/v1/
```

### 8.2 Endpoints

#### POST `/api/v1/trip/plan`

**Request Body:**
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "St. Louis, MO",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used": 24.5
}
```

**Response Body:**
```json
{
  "trip_id": "uuid",
  "total_distance_miles": 847.3,
  "total_duration_hours": 14.2,
  "estimated_arrival": "2024-01-16T20:30:00",
  "route": {
    "geometry": { "type": "LineString", "coordinates": [[lon, lat], ...] },
    "waypoints": [
      { "name": "Chicago, IL", "lat": 41.8781, "lon": -87.6298 },
      { "name": "St. Louis, MO", "lat": 38.6270, "lon": -90.1994 },
      { "name": "Dallas, TX", "lat": 32.7767, "lon": -96.7970 }
    ]
  },
  "stops": [
    {
      "stop_id": 1,
      "stop_type": "pickup",
      "location": { "name": "St. Louis, MO", "lat": 38.6270, "lon": -90.1994 },
      "arrive_time": "2024-01-15T10:30:00",
      "depart_time": "2024-01-15T11:30:00",
      "duration_hours": 1.0
    }
  ],
  "events": [
    {
      "event_id": 1,
      "day": 1,
      "start_time": "2024-01-15T06:00:00",
      "end_time": "2024-01-15T06:30:00",
      "duration_hours": 0.5,
      "duty_status": "on_duty_not_driving",
      "event_type": "pre_trip_inspection",
      "location": { "name": "Chicago, IL", "lat": 41.8781, "lon": -87.6298 },
      "notes": "Pre-trip inspection"
    }
  ],
  "daily_logs": [
    {
      "day": 1,
      "date": "2024-01-15",
      "total_miles": 430.0,
      "total_driving_hours": 7.5,
      "total_on_duty_hours": 10.0,
      "total_off_duty_hours": 14.0,
      "cycle_hours_end_of_day": 34.5,
      "hours_available_tomorrow": 35.5,
      "events": [ ... ]
    }
  ]
}
```

#### GET `/api/v1/trip/{trip_id}`
- Returns previously planned trip by ID

#### POST `/api/v1/geocode`
**Request:** `{ "query": "Chicago, IL" }`  
**Response:** `{ "lat": 41.8781, "lon": -87.6298, "display_name": "Chicago, Illinois, US" }`

---

## 9. Frontend Architecture

### 9.1 Pages / Views

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `TripPlannerForm` | Input form for trip details |
| `/results` | `TripResults` | Map + log sheets side by side |

### 9.2 Component Tree

```
App
├── Header (logo, nav)
├── TripPlannerForm
│   ├── LocationInput (current, pickup, dropoff)
│   ├── CycleHoursInput (number slider)
│   └── SubmitButton (with loading state)
└── TripResults
    ├── TripSummaryBar (total miles, duration, days)
    ├── MapView (Leaflet map)
    │   ├── RoutePolyline
    │   └── StopMarkers (with popups)
    ├── LogSheetViewer
    │   ├── DaySelector (tabs/pagination)
    │   ├── LogSheetCanvas (canvas drawing)
    │   │   ├── HeaderSection
    │   │   ├── GridSection (24-hr grid with drawn lines)
    │   │   └── RemarksSection
    │   └── DownloadButton (PDF/PNG export)
    └── StopsTimeline (ordered list of all events)
```

### 9.3 State Management
- React `useState` + `useContext` for global trip state
- Axios for API calls
- Loading/error states on all async operations

### 9.4 UI Design Direction
- **Aesthetic:** Industrial/utilitarian — appropriate for trucking/logistics domain
- **Color Palette:**
  - Primary: `#1A2E4A` (navy)
  - Accent: `#F59E0B` (amber — trucking/warning yellow)
  - Surface: `#F8FAFC` (off-white)
  - Text: `#0F172A`
  - Success: `#10B981`
  - Danger: `#EF4444`
- **Font:** `IBM Plex Mono` (headings) + `IBM Plex Sans` (body) — techy, utilitarian
- **Layout:** Split-pane on desktop (map left, logs right), stacked on mobile

---

## 10. Data Models

### Django Models

```python
class TripPlan(models.Model):
    trip_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Inputs
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used = models.FloatField()
    
    # Computed
    total_distance_miles = models.FloatField()
    total_duration_hours = models.FloatField()
    estimated_arrival = models.DateTimeField()
    
    # Stored JSON
    route_geometry = models.JSONField()
    stops = models.JSONField()
    events = models.JSONField()
    daily_logs = models.JSONField()


class DailyLog(models.Model):
    trip = models.ForeignKey(TripPlan, on_delete=models.CASCADE, related_name='logs')
    day_number = models.IntegerField()
    date = models.DateField()
    total_miles = models.FloatField()
    total_driving_hours = models.FloatField()
    total_on_duty_hours = models.FloatField()
    total_off_duty_hours = models.FloatField()
    cycle_hours_end_of_day = models.FloatField()
    events = models.JSONField()
```

---

## 11. Assumptions & Constraints

| Assumption | Value | Source |
|------------|-------|--------|
| Driver type | Property-carrying CMV | Assessment spec |
| HOS cycle | 70 hours / 8 days | Assessment spec |
| Adverse conditions | None assumed | Assessment spec |
| Fuel stop interval | Every ≤1,000 miles | Assessment spec |
| Pickup duration | 1 hour | Assessment spec |
| Dropoff duration | 1 hour | Assessment spec |
| Pre-trip inspection | 30 minutes (On Duty Not Driving) | FMCSA standard |
| 30-min break trigger | After 8 cumulative driving hours | § 395.3(a)(3)(ii) |
| Daily rest | 10 consecutive hours off duty | § 395.3(a)(1) |
| Sleeper berth | Not used (simplified to off duty) | App simplification |
| Trip start time | Current datetime | App behavior |
| Driver name | Placeholder "John Driver" | App simplification |
| Carrier name | Placeholder "Driver Transportation Co." | App simplification |
| Average speed | From OSRM routing API | App behavior |
| 70-hr cap hit | Trigger 34-hour restart, reset to 0 | § 395.3(c) |

---

## 12. Tech Stack & Libraries

### Backend
| Library | Version | Purpose |
|---------|---------|---------|
| Django | 4.2+ | Web framework |
| djangorestframework | 3.14+ | REST API |
| django-cors-headers | 4.0+ | CORS for React frontend |
| requests | 2.31+ | HTTP calls to OSRM/Nominatim |
| python-decouple | 3.8+ | Environment variables |

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 18+ | UI framework |
| react-leaflet | 4+ | Interactive map |
| leaflet | 1.9+ | Map engine |
| axios | 1.6+ | HTTP client |
| html2canvas | 1.4+ | Log sheet screenshot |
| jspdf | 2.5+ | PDF export |
| tailwindcss | 3+ | Utility CSS |
| lucide-react | latest | Icons |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting (free) |
| Railway / Render | Django backend hosting (free tier) |
| OSRM Demo Server | Routing API (free, no key) |
| Nominatim | Geocoding API (free, no key) |
| SQLite | Database (development) / PostgreSQL (production) |

---

## 13. Folder Structure

```
eld-trip-planner/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── trips/
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── services/
│       │   ├── geocoding.py       # Nominatim wrapper
│       │   ├── routing.py         # OSRM wrapper
│       │   ├── hos_calculator.py  # Core HOS business logic
│       │   └── trip_planner.py    # Orchestrates all services
│       └── tests/
│           ├── test_hos_calculator.py
│           └── test_trip_planner.py
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── tripApi.js
│       ├── components/
│       │   ├── TripPlannerForm/
│       │   │   ├── index.jsx
│       │   │   └── LocationInput.jsx
│       │   ├── MapView/
│       │   │   ├── index.jsx
│       │   │   ├── RoutePolyline.jsx
│       │   │   └── StopMarker.jsx
│       │   ├── LogSheetViewer/
│       │   │   ├── index.jsx
│       │   │   ├── LogSheetCanvas.jsx   # Core canvas drawing
│       │   │   ├── GridDrawer.js        # Grid drawing utilities
│       │   │   └── DownloadButton.jsx
│       │   └── shared/
│       │       ├── Header.jsx
│       │       ├── LoadingSpinner.jsx
│       │       └── ErrorMessage.jsx
│       ├── context/
│       │   └── TripContext.jsx
│       └── utils/
│           ├── timeUtils.js
│           └── hosUtils.js
└── docs/
    ├── REQUIREMENTS.md        ← This file
    └── API.md
```

---

## 14. Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy via Vercel CLI or GitHub integration
vercel --prod
```

### Backend (Render / Railway)
```bash
# requirements.txt must include gunicorn
# Set env vars: SECRET_KEY, DEBUG=False, ALLOWED_HOSTS, DATABASE_URL
# Start command: gunicorn config.wsgi:application
```

### Environment Variables

**Backend `.env`:**
```
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=sqlite:///db.sqlite3
```

**Frontend `.env`:**
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 15. Submission Checklist

- [ ] GitHub repository is public with clean commit history
- [ ] README.md in repo explains how to run locally
- [ ] Backend deployed and accessible (not just localhost)
- [ ] Frontend deployed on Vercel (accessible URL)
- [ ] All 4 inputs work correctly
- [ ] Map renders route with all stop markers
- [ ] Log sheets render correctly for Day 1
- [ ] Log sheets render correctly for multi-day trips
- [ ] 30-min break logic fires after 8 hours of cumulative driving
- [ ] Fuel stop logic fires every ≤1,000 miles
- [ ] 10-hour rest inserted at end of each driving window
- [ ] 70-hour cap triggers 34-hour restart
- [ ] Pickup/dropoff each logged as 1 hour on duty not driving
- [ ] Remarks section lists all duty status changes with location
- [ ] Recap section shows correct hour totals (must sum to 24)
- [ ] PDF/PNG download works for log sheets
- [ ] UI is clean, polished, and professional
- [ ] 3–5 minute Loom video recorded
- [ ] Submission link filled at: https://careers.spotter.ai/questionnaires/ce635fe9-448c-400f-907e-48f53d827290/dd7776fc-1e0b-4b7e-bab6-362495271ce5
