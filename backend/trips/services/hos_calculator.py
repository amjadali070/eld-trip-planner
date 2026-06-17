"""
HOS (Hours of Service) Calculator
Implements FMCSA 70hr/8-day property-carrier rules.
49 CFR Part 395
"""
from datetime import datetime, timedelta
from typing import List, Dict


# HOS Constants
MAX_DRIVING_HOURS = 11.0          # § 395.3(a)(3)
MAX_DUTY_WINDOW_HOURS = 14.0      # § 395.3(a)(2)
MIN_OFF_DUTY_HOURS = 10.0         # § 395.3(a)(1)
BREAK_TRIGGER_HOURS = 8.0         # § 395.3(a)(3)(ii) — cumulative driving
BREAK_DURATION_HOURS = 0.5        # 30-minute break
MAX_CYCLE_HOURS = 70.0            # § 395.3(b) — 70hr/8-day
RESTART_HOURS = 34.0              # § 395.3(c) — 34-hour restart
PRE_TRIP_DURATION = 0.5           # 30 min pre-trip inspection
PICKUP_DURATION = 1.0             # 1 hr pickup
DROPOFF_DURATION = 1.0            # 1 hr dropoff
FUEL_STOP_DURATION = 0.5          # 30 min fuel stop
FUEL_INTERVAL_MILES = 1000.0      # Fuel every 1000 miles


class HOSCalculator:
    def __init__(self, start_time: datetime, cycle_hours_used: float, start_location: dict = None):
        self.start_midnight = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
        self.current_time = start_time
        self.cycle_hours = cycle_hours_used
        self.daily_driving_hours = 0.0
        self.daily_duty_hours = 0.0
        self.cumulative_driving_since_break = 0.0
        self.miles_since_fuel = 0.0
        self.events: List[Dict] = []
        self.event_id = 1
        self.total_miles = 0.0

        # Prepend off-duty before trip starts if necessary
        gap_hours = (start_time - self.start_midnight).total_seconds() / 3600.0
        if gap_hours > 0.001:
            loc = start_location if start_location else {"name": "Start Location", "lat": 0.0, "lon": 0.0}
            self.events.append({
                "event_id": self.event_id,
                "day": 1,
                "start_time": self.start_midnight.isoformat(),
                "end_time": start_time.isoformat(),
                "duration_hours": round(gap_hours, 4),
                "duty_status": "off_duty",
                "event_type": "rest",
                "location": loc,
                "miles_driven": 0.0,
                "notes": "Off duty before trip start",
                "cycle_hours_after_event": round(cycle_hours_used, 2),
            })
            self.event_id += 1

    def _add_event(self, duty_status: str, event_type: str, duration_hours: float,
                   location: dict, notes: str = "", miles: float = 0):
        start = self.current_time
        end = start + timedelta(hours=duration_hours)

        # Track duty hours (driving + on_duty_not_driving) for cycle
        if duty_status in ("driving", "on_duty_not_driving"):
            self.daily_duty_hours += duration_hours
            self.cycle_hours += duration_hours

        temp_start = start
        remaining_duration = duration_hours

        while remaining_duration > 0.0001:
            # Find next midnight
            current_day_midnight = temp_start.replace(hour=0, minute=0, second=0, microsecond=0)
            next_midnight = current_day_midnight + timedelta(days=1)

            # Calculate hours until next midnight
            hours_to_midnight = (next_midnight - temp_start).total_seconds() / 3600.0

            if remaining_duration > hours_to_midnight + 0.0001:
                # Event crosses midnight. Split it.
                chunk_duration = hours_to_midnight
                temp_end = next_midnight
            else:
                # Event ends before or at midnight.
                chunk_duration = remaining_duration
                temp_end = temp_start + timedelta(hours=chunk_duration)

            chunk_miles = (chunk_duration / duration_hours) * miles if duration_hours > 0 else 0
            day_num = (temp_start - self.start_midnight).days + 1

            self.events.append({
                "event_id": self.event_id,
                "day": day_num,
                "start_time": temp_start.isoformat(),
                "end_time": temp_end.isoformat(),
                "duration_hours": round(chunk_duration, 4),
                "duty_status": duty_status,
                "event_type": event_type,
                "location": location,
                "miles_driven": round(chunk_miles, 2),
                "notes": notes,
                "cycle_hours_after_event": round(self.cycle_hours, 2),
            })
            self.event_id += 1

            remaining_duration -= chunk_duration
            temp_start = temp_end

        self.current_time = end
        return end

    def _do_rest(self, location: dict, hours: float = MIN_OFF_DUTY_HOURS):
        """Insert an off-duty rest period and reset daily limits."""
        self._add_event("off_duty", "rest", hours, location,
                        f"{int(hours)}-hour off duty rest")
        self.daily_driving_hours = 0.0
        self.daily_duty_hours = 0.0
        self.cumulative_driving_since_break = 0.0

    def _do_restart(self, location: dict):
        """Insert 34-hour restart and reset cycle."""
        self.cycle_hours = 0.0
        self._add_event("off_duty", "cycle_restart", RESTART_HOURS, location,
                        "34-hour cycle restart (70-hr limit reached)")
        self.daily_driving_hours = 0.0
        self.daily_duty_hours = 0.0
        self.cumulative_driving_since_break = 0.0

    def _check_and_insert_break(self, location: dict):
        """Insert 30-min break if 8 cumulative driving hours reached."""
        if self.cumulative_driving_since_break >= BREAK_TRIGGER_HOURS - 0.001:
            self._add_event("on_duty_not_driving", "rest_break", BREAK_DURATION_HOURS,
                            location, "Mandatory 30-min rest break (8hr driving)")
            self.cumulative_driving_since_break = 0.0

    def _check_and_insert_fuel(self, location: dict):
        """Insert fuel stop if 1,000 miles since last fuel."""
        if self.miles_since_fuel >= FUEL_INTERVAL_MILES - 0.01:
            self._add_event("on_duty_not_driving", "fuel_stop", FUEL_STOP_DURATION,
                            location, "Fuel stop (1,000 mile interval)")
            self.miles_since_fuel = 0.0

    def drive_segment(self, distance_miles: float, duration_hours: float,
                      from_location: dict, to_location: dict) -> None:
        """
        Drive a segment, inserting breaks, fuel stops, and rests as needed.
        Splits driving into chunks bounded by HOS constraints.
        """
        remaining_hours = duration_hours
        remaining_miles = distance_miles
        avg_speed = distance_miles / duration_hours if duration_hours > 0 else 55.0

        # Interpolate location between from and to based on progress
        def interpolate_location(progress: float) -> dict:
            lat = from_location["lat"] + (to_location["lat"] - from_location["lat"]) * progress
            lon = from_location["lon"] + (to_location["lon"] - from_location["lon"]) * progress
            if progress < 0.1:
                name = from_location["name"]
            elif progress > 0.9:
                name = to_location["name"]
            else:
                name = f"En route to {to_location['name']}"
            return {"name": name, "lat": round(lat, 4), "lon": round(lon, 4)}

        driven_so_far = 0.0

        while remaining_hours > 0.001:
            loc = interpolate_location(driven_so_far / distance_miles if distance_miles > 0 else 0)

            # Check if we need a restart (70 hours reached)
            if self.cycle_hours >= MAX_CYCLE_HOURS - 0.001:
                self._do_restart(loc)
                continue

            # Check if daily limit hit (11 hours driving or 14 hours duty)
            if (self.daily_driving_hours >= MAX_DRIVING_HOURS - 0.001 or
                    self.daily_duty_hours >= MAX_DUTY_WINDOW_HOURS - 0.001):
                self._do_rest(loc)
                continue

            # Check if cumulative driving break is needed
            if self.cumulative_driving_since_break >= BREAK_TRIGGER_HOURS - 0.001:
                self._check_and_insert_break(loc)
                continue

            # Check if fuel stop is needed
            if self.miles_since_fuel >= FUEL_INTERVAL_MILES - 0.01:
                self._check_and_insert_fuel(loc)
                continue

            # Calculate remaining hours before next constraint
            h_11hr = MAX_DRIVING_HOURS - self.daily_driving_hours
            h_14hr = MAX_DUTY_WINDOW_HOURS - self.daily_duty_hours
            h_break = BREAK_TRIGGER_HOURS - self.cumulative_driving_since_break
            h_fuel = (FUEL_INTERVAL_MILES - self.miles_since_fuel) / avg_speed if avg_speed > 0.01 else 9999.0
            h_cycle = MAX_CYCLE_HOURS - self.cycle_hours

            chunk = min(
                remaining_hours,
                h_11hr,
                h_14hr,
                h_break,
                h_fuel,
                h_cycle
            )

            if chunk <= 0.001:
                chunk = 0.001

            chunk_miles = chunk * avg_speed

            # Drive the chunk
            self._add_event("driving", "driving", chunk, loc,
                            f"Driving to {to_location['name']}", chunk_miles)
            self.daily_driving_hours += chunk
            self.cumulative_driving_since_break += chunk
            self.miles_since_fuel += chunk_miles
            self.total_miles += chunk_miles
            driven_so_far += chunk_miles
            remaining_hours -= chunk
            remaining_miles -= chunk_miles

    def add_stop(self, event_type: str, location: dict, duration: float, notes: str = ""):
        """Add a non-driving on-duty stop (pickup, dropoff, fuel, inspection)."""
        # Check if this stop pushes past 14-hr window
        if self.daily_duty_hours + duration > MAX_DUTY_WINDOW_HOURS:
            self._do_rest(location)
        self._add_event("on_duty_not_driving", event_type, duration, location, notes)

    def build_daily_logs(self) -> List[Dict]:
        """Group events by day and compute per-day summaries."""
        # Group events by day
        days: Dict[int, List] = {}
        for event in self.events:
            d = event["day"]
            days.setdefault(d, []).append(event)

        if not days:
            return []

        all_days = sorted(days.keys())
        min_day = all_days[0]
        max_day = all_days[-1]

        daily_logs = []

        for day_num in range(min_day, max_day + 1):
            day_start = self.start_midnight + timedelta(days=day_num - 1)
            day_end = day_start + timedelta(days=1)

            day_events = days.get(day_num, [])

            if not day_events:
                # Create a 24-hour off-duty event
                off_duty_ev = {
                    "event_id": self.event_id,
                    "day": day_num,
                    "start_time": day_start.isoformat(),
                    "end_time": day_end.isoformat(),
                    "duration_hours": 24.0,
                    "duty_status": "off_duty",
                    "event_type": "rest",
                    "location": self.events[-1]["location"] if self.events else {"name": "Unknown", "lat": 0.0, "lon": 0.0},
                    "miles_driven": 0.0,
                    "notes": "Off duty rest",
                    "cycle_hours_after_event": 0.0,
                }
                self.event_id += 1
                day_events = [off_duty_ev]

            day_events.sort(key=lambda e: e["start_time"])

            # 1. Check for gap at start of day
            first_ev_start = datetime.fromisoformat(day_events[0]["start_time"])
            start_gap = (first_ev_start - day_start).total_seconds() / 3600.0
            if start_gap > 0.01:
                pad_start_ev = {
                    "event_id": self.event_id,
                    "day": day_num,
                    "start_time": day_start.isoformat(),
                    "end_time": first_ev_start.isoformat(),
                    "duration_hours": round(start_gap, 4),
                    "duty_status": "off_duty",
                    "event_type": "rest",
                    "location": day_events[0]["location"],
                    "miles_driven": 0.0,
                    "notes": "Off duty before duty period",
                    "cycle_hours_after_event": day_events[0].get("cycle_hours_after_event", self.cycle_hours),
                }
                self.event_id += 1
                day_events.insert(0, pad_start_ev)

            # 2. Check for gap at end of day
            last_ev_end = datetime.fromisoformat(day_events[-1]["end_time"])
            end_gap = (day_end - last_ev_end).total_seconds() / 3600.0
            if end_gap > 0.01:
                pad_end_ev = {
                    "event_id": self.event_id,
                    "day": day_num,
                    "start_time": last_ev_end.isoformat(),
                    "end_time": day_end.isoformat(),
                    "duration_hours": round(end_gap, 4),
                    "duty_status": "off_duty",
                    "event_type": "rest",
                    "location": day_events[-1]["location"],
                    "miles_driven": 0.0,
                    "notes": "Off duty rest at end of day",
                    "cycle_hours_after_event": day_events[-1].get("cycle_hours_after_event", self.cycle_hours),
                }
                self.event_id += 1
                day_events.append(pad_end_ev)

            # 3. Check for any internal gaps between events
            i = 0
            while i < len(day_events) - 1:
                curr_end = datetime.fromisoformat(day_events[i]["end_time"])
                nxt_start = datetime.fromisoformat(day_events[i+1]["start_time"])
                gap = (nxt_start - curr_end).total_seconds() / 3600.0
                if gap > 0.01:
                    gap_ev = {
                        "event_id": self.event_id,
                        "day": day_num,
                        "start_time": curr_end.isoformat(),
                        "end_time": nxt_start.isoformat(),
                        "duration_hours": round(gap, 4),
                        "duty_status": "off_duty",
                        "event_type": "rest",
                        "location": day_events[i]["location"],
                        "miles_driven": 0.0,
                        "notes": "Off duty rest",
                        "cycle_hours_after_event": day_events[i].get("cycle_hours_after_event", self.cycle_hours),
                    }
                    self.event_id += 1
                    day_events.insert(i + 1, gap_ev)
                i += 1

            # Recalculate totals for the day
            driving_hrs = sum(e["duration_hours"] for e in day_events if e["duty_status"] == "driving")
            on_duty_hrs = sum(e["duration_hours"] for e in day_events if e["duty_status"] == "on_duty_not_driving")
            off_duty_hrs = sum(e["duration_hours"] for e in day_events if e["duty_status"] == "off_duty")
            miles = sum(e["miles_driven"] for e in day_events)

            # The cycle hours at the end of the day is the cycle hours after the last event
            cycle_end_val = day_events[-1].get("cycle_hours_after_event", self.cycle_hours)

            daily_logs.append({
                "day": day_num,
                "date": day_start.date().isoformat(),
                "total_miles": round(miles, 1),
                "total_driving_hours": round(driving_hrs, 2),
                "total_on_duty_hours": round(on_duty_hrs, 2),
                "total_off_duty_hours": round(off_duty_hrs, 2),
                "cycle_hours_end_of_day": round(cycle_end_val, 2),
                "hours_available_tomorrow": round(max(70.0 - cycle_end_val, 0.0), 2),
                "events": day_events,
            })

        # Update self.events with the fully split and padded list of events
        self.events = []
        for log in daily_logs:
            self.events.extend(log["events"])

        return daily_logs
