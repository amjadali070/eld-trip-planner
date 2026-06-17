import requests

OSRM_URL = "http://router.project-osrm.org/route/v1/driving"


def get_route(waypoints: list) -> dict:
    """
    Get route info from OSRM for a list of waypoints.
    waypoints: list of {"lat": float, "lon": float, "name": str}
    Returns: {distance_miles, duration_hours, geometry, legs}
    """
    coords = ";".join(f"{wp['lon']},{wp['lat']}" for wp in waypoints)
    url = f"{OSRM_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "annotations": "false",
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        if data.get("code") != "Ok":
            raise ValueError(f"OSRM error: {data.get('message', 'Unknown error')}")

        route = data["routes"][0]
        total_meters = route["distance"]
        total_seconds = route["duration"]
        geometry = route["geometry"]

        # Per-leg distances and durations
        legs = []
        for i, leg in enumerate(route["legs"]):
            legs.append({
                "from": waypoints[i]["name"],
                "to": waypoints[i + 1]["name"],
                "distance_miles": leg["distance"] * 0.000621371,
                "duration_hours": leg["duration"] / 3600,
            })

        return {
            "distance_miles": total_meters * 0.000621371,
            "duration_hours": total_seconds / 3600,
            "geometry": geometry,
            "legs": legs,
        }
    except requests.RequestException as e:
        raise ValueError(f"Routing failed: {str(e)}")
