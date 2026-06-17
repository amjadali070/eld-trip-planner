"""
Trip Planner Orchestrator
Ties together geocoding, routing, and HOS calculation.
"""
from datetime import datetime, timezone, timedelta
from .geocoding import geocode_all
from .routing import get_route
from .hos_calculator import HOSCalculator, PRE_TRIP_DURATION, PICKUP_DURATION, DROPOFF_DURATION


def plan_trip(current_location: str, pickup_location: str,
              dropoff_location: str, current_cycle_used: float,
              start_time=None) -> dict:
    """
    Main entry point. Returns full trip plan dict.
    """
    # 1. Geocode all locations
    current_geo, pickup_geo, dropoff_geo = geocode_all(
        current_location, pickup_location, dropoff_location
    )

    # 2. Get route: current → pickup → dropoff
    waypoints = [current_geo, pickup_geo, dropoff_geo]
    route_data = get_route(waypoints)

    leg1 = route_data["legs"][0]  # current → pickup
    leg2 = route_data["legs"][1]  # pickup → dropoff

    # 3. Initialize HOS calculator
    if not start_time:
        now_utc = datetime.now(timezone.utc)
        tomorrow_utc = now_utc + timedelta(days=1)
        start_time = tomorrow_utc.replace(hour=6, minute=0, second=0, microsecond=0)
    else:
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
    calc = HOSCalculator(start_time=start_time, cycle_hours_used=current_cycle_used, start_location=current_geo)

    # 4. Pre-trip inspection at current location
    calc.add_stop("pre_trip_inspection", current_geo, PRE_TRIP_DURATION,
                  "Pre-trip vehicle inspection")

    # 5. Drive current → pickup
    calc.drive_segment(
        distance_miles=leg1["distance_miles"],
        duration_hours=leg1["duration_hours"],
        from_location=current_geo,
        to_location=pickup_geo,
    )

    # 6. Pickup stop (1 hour on duty not driving)
    calc.add_stop("pickup", pickup_geo, PICKUP_DURATION,
                  f"Pickup at {pickup_geo['name']}")

    # 7. Drive pickup → dropoff
    calc.drive_segment(
        distance_miles=leg2["distance_miles"],
        duration_hours=leg2["duration_hours"],
        from_location=pickup_geo,
        to_location=dropoff_geo,
    )

    # 8. Dropoff stop (1 hour on duty not driving)
    calc.add_stop("dropoff", dropoff_geo, DROPOFF_DURATION,
                  f"Dropoff at {dropoff_geo['name']}")

    # 9. Build daily logs
    daily_logs = calc.build_daily_logs()

    # 10. Build stops list (for map markers)
    stops = _extract_stops(calc.events, pickup_geo, dropoff_geo)

    return {
        "total_distance_miles": round(route_data["distance_miles"], 1),
        "total_duration_hours": round(route_data["duration_hours"], 2),
        "estimated_arrival": calc.current_time.isoformat(),
        "route": {
            "geometry": route_data["geometry"],
            "waypoints": waypoints,
            "legs": route_data["legs"],
        },
        "stops": stops,
        "events": calc.events,
        "daily_logs": daily_logs,
    }


def _extract_stops(events: list, pickup_geo: dict, dropoff_geo: dict) -> list:
    """Extract significant stops from events for map display."""
    stop_types = {"pre_trip_inspection", "pickup", "dropoff", "fuel_stop",
                  "rest_break", "rest", "cycle_restart"}
    stops = []
    stop_id = 1
    for e in events:
        if e["event_type"] in stop_types:
            stops.append({
                "stop_id": stop_id,
                "stop_type": e["event_type"],
                "location": e["location"],
                "arrive_time": e["start_time"],
                "depart_time": e["end_time"],
                "duration_hours": e["duration_hours"],
                "day": e["day"],
                "notes": e["notes"],
            })
            stop_id += 1
    return stops
