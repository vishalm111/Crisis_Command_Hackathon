import math
from backend.models.domain import LatLng

def haversine_km(a: LatLng, b: LatLng) -> float:
    """Calculate the great circle distance between two points on the earth in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    
    lat1 = math.radians(a.lat)
    lon1 = math.radians(a.lng)
    lat2 = math.radians(b.lat)
    lon2 = math.radians(b.lng)
    
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    
    a_val = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a_val), math.sqrt(1 - a_val))
    
    return R * c

def eta_minutes(a: LatLng, b: LatLng) -> float:
    """Calculate the ETA in minutes, with 2 min dispatch delay, road factor 1.4, and 40 km/h."""
    distance = haversine_km(a, b)
    return 2.0 + (distance * 1.4 / 40.0) * 60.0

def interpolate(a: LatLng, b: LatLng, fraction: float) -> LatLng:
    """Interpolate linearly between two points by a fraction in [0, 1]."""
    fraction = max(0.0, min(1.0, fraction))
    lat = a.lat + (b.lat - a.lat) * fraction
    lng = a.lng + (b.lng - a.lng) * fraction
    return LatLng(lat=lat, lng=lng)
