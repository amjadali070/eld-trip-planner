import requests
import time


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "ELD-Trip-Planner/1.0 (assessment@spotter.ai)"}


def geocode(query: str) -> dict:
    """Convert a location string to lat/lon using Nominatim."""
    params = {"q": query, "format": "json", "limit": 1}
    try:
        response = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=10)
        response.raise_for_status()
        results = response.json()
        if not results:
            raise ValueError(f"Could not geocode location: '{query}'")
        r = results[0]
        return {
            "name": query,
            "display_name": r.get("display_name", query),
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
        }
    except requests.RequestException as e:
        raise ValueError(f"Geocoding failed for '{query}': {str(e)}")
    finally:
        time.sleep(1.0)  # Nominatim rate limit: 1 req/sec


def geocode_all(current: str, pickup: str, dropoff: str) -> tuple:
    """Geocode all three locations and return as a tuple."""
    current_geo = geocode(current)
    pickup_geo = geocode(pickup)
    dropoff_geo = geocode(dropoff)
    return current_geo, pickup_geo, dropoff_geo
