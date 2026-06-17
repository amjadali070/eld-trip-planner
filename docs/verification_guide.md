# ELD Trip Planner — Verification & Testing Guide

This guide contains the test inputs, expected HOS results, and checklist items to verify that the ELD Trip Planner application is fully functional, HOS-compliant, and visually correct.

---

## 1. Scenario A: Short Haul (Single Day Trip)

Use this scenario to verify the baseline flow where the entire trip is completed within a single day without hitting HOS driving limits, duty windows, or fuel stops.

### Test Inputs
- **Current Location:** `Chicago, IL`
- **Pickup Location:** `Indianapolis, IN`
- **Dropoff Location:** `Cincinnati, OH`
- **Current Cycle Used:** `10.0` hours

### Expected Results
- **Total Distance:** ~300 miles.
- **Trip Duration:** ~5.5 hours driving.
- **Log Sheets:** Exactly 1 day (Day 1).
- **HOS Events Sequence:**
  1. **Day 1 (00:00 → Start time):** Pre-trip off-duty gap event (padded).
  2. **Pre-Trip Inspection:** 30 min (On Duty Not Driving).
  3. **Drive to Pickup:** ~3.0 hours (Driving).
  4. **Pickup Stop:** 1.0 hour (On Duty Not Driving) at Indianapolis, IN.
  5. **Drive to Dropoff:** ~2.5 hours (Driving).
  6. **Dropoff Stop:** 1.0 hour (On Duty Not Driving) at Cincinnati, OH.
  7. **Day 1 (End of dropoff → 24:00):** End-of-day off-duty padding (padded).
- **Enforced Rules Checked:**
  - [x] No 10-hour daily rests inserted (driving and duty hours are well within limits).
  - [x] No 30-min break inserted (driving hours since start is < 8).
  - [x] No fuel stops (distance is < 1,000 miles).
  - [x] Day 1 log totals sum to exactly 24.0 hours.

---

## 2. Scenario B: Mid Haul (Multi-Day Trip)

Use this scenario to verify midnight event splitting, 10-hour daily rest insertion, and the 30-minute mandatory rest break.

### Test Inputs
- **Current Location:** `Chicago, IL`
- **Pickup Location:** `St. Louis, MO`
- **Dropoff Location:** `Dallas, TX`
- **Current Cycle Used:** `24.0` hours

### Expected Results
- **Total Distance:** ~950 miles.
- **Trip Duration:** ~15.5 hours driving.
- **Log Sheets:** Exactly 2 days (Day 1 and Day 2).
- **HOS Events Sequence:**
  1. **Day 1 (00:00 → Start time):** Pre-trip off-duty gap event.
  2. **Pre-Trip Inspection:** 30 min (On Duty Not Driving).
  3. **Drive to Pickup:** ~5.0 hours (Driving).
  4. **Pickup Stop:** 1.0 hour (On Duty Not Driving) at St. Louis, MO.
  5. **Drive chunk (to Dallas):** Starts driving from St. Louis.
  6. **30-Min Rest Break:** Triggered after 8.0 cumulative driving hours (around 3 hours into the second segment, since 5.0h + 3.0h = 8.0h).
  7. **Drive chunk continues:** Drives until the 14-hour daily duty window or 11-hour driving limit is reached.
  8. **10-Hour Off-Duty Rest:** Triggered at the end of the day. This event crosses midnight and is **split at 00:00**:
     - Day 1 portion (e.g. from 21:00 to 24:00 - 3 hours).
     - Day 2 portion (from 00:00 to 07:00 - 7 hours).
  9. **Pre-Trip Inspection (Day 2):** 30 min (On Duty Not Driving).
  10. **Drive segment finishes:** Rest of the drive to Dallas.
  11. **Dropoff Stop:** 1.0 hour (On Duty Not Driving) at Dallas, TX.
  12. **Day 2 padding:** Padded with off-duty to midnight.
- **Enforced Rules Checked:**
  - [x] 10-hour daily rest inserted.
  - [x] 30-min break inserted after 8 hours of driving.
  - [x] Rest event split at midnight.
  - [x] Both Day 1 and Day 2 logs sum to exactly 24.0 hours.

---

## 3. Scenario C: Long Haul (Fuel & Cycle Restart)

Use this scenario to verify fuel stop insertion (every <= 1,000 miles) and the 34-hour cycle restart (triggered when cycle hours reach 70.0).

### Test Inputs
- **Current Location:** `Los Angeles, CA`
- **Pickup Location:** `Phoenix, AZ`
- **Dropoff Location:** `Houston, TX`
- **Current Cycle Used:** `35.0` hours

### Expected Results
- **Total Distance:** ~1,550 miles.
- **Trip Duration:** ~26 hours driving.
- **Log Sheets:** 4 days (Day 1 to Day 4).
- **HOS Events Sequence:**
  - **Pre-trip inspection** and **Pickup** at Phoenix.
  - **Fuel Stop:** 30 min (On Duty Not Driving) inserted at or before 1,000 miles of driving since start.
  - **30-Min Breaks:** Inserted every 8 hours of cumulative driving.
  - **10-Hour Rests:** Inserted at the end of Day 1 and Day 2.
  - **34-Hour Restart:** Triggered during the drive when cycle hours hit `70.0`. Since the driver started with `35.0` used, they only have `35.0` hours of available cycle time. The pre-trip inspections, driving, and pickups will deplete this. When cycle hours hit 70.0, a 34-hour off-duty restart is inserted. This restart crosses midnight and splits across days.
  - **Dropoff** at Houston, TX.
- **Enforced Rules Checked:**
  - [x] Fuel stop inserted.
  - [x] 34-hour restart inserted.
  - [x] Restart split across midnight boundaries.
  - [x] All daily logs sum to exactly 24.0 hours.

---

## 4. Visual Verification Checklist

When viewing the `/results` page in your browser, verify the following elements:

### Desktop Split-Pane Layout
- [ ] The page shows a split-pane layout on desktop screens.
- [ ] The left column displays the Leaflet interactive map and is **sticky** (does not scroll out of view when scrolling the right pane).
- [ ] The right column displays the log sheets and timeline.
- [ ] On mobile viewports, the map and logs stack vertically, and a "Route Map" tab button appears to toggle the map.

### Map Markers & Route
- [ ] Polyline is drawn in yellow/orange representing the route.
- [ ] Green marker `🟢` at Current Location.
- [ ] Blue marker `📦` at Pickup.
- [ ] Red marker `🏁` at Dropoff.
- [ ] Orange marker `⛽` at Fuel Stops (if applicable).
- [ ] Indigo/Purple marker `🛏️` at Rest locations.

### Log Sheets Canvas
- [ ] The 24-hour grid has 4 rows corresponding to Off Duty, Sleeper Berth (empty), Driving, and On Duty.
- [ ] Lines are drawn in the correct row for each segment.
- [ ] Vertical black lines connect the status transitions (no floating gaps).
- [ ] Grid lines are drawn continuously from left to right (from 0 to 24 hours).
- [ ] **No backwards lines** (which would look like horizontal lines stretching backward across the grid).
- [ ] The "RECAP" section totals sum to exactly 24 hours.
- [ ] The PDF download button exports all days into a multi-page PDF.
- [ ] The PNG download button saves the current day's log sheet.
