import math
from backend.models.domain import LatLng
from backend.services.geo import haversine_km, eta_minutes, interpolate

def test_haversine_km():
    # Two points about 10km apart
    # 1 degree of latitude is ~111 km. 10km / 111 = ~0.09009 degrees
    p1 = LatLng(lat=12.97, lng=77.59)
    p2 = LatLng(lat=12.97 + 0.09009, lng=77.59)
    
    distance = haversine_km(p1, p2)
    assert math.isclose(distance, 10.0, rel_tol=0.05)
    
def test_eta_minutes():
    p = LatLng(lat=12.97, lng=77.59)
    eta = eta_minutes(p, p)
    assert eta == 2.0

def test_interpolate():
    p1 = LatLng(lat=10.0, lng=20.0)
    p2 = LatLng(lat=20.0, lng=40.0)
    
    start = interpolate(p1, p2, 0.0)
    assert start.lat == 10.0
    assert start.lng == 20.0
    
    end = interpolate(p1, p2, 1.0)
    assert end.lat == 20.0
    assert end.lng == 40.0
    
    mid = interpolate(p1, p2, 0.5)
    assert mid.lat == 15.0
    assert mid.lng == 30.0
    
    # Check clamping bounds
    clamped_low = interpolate(p1, p2, -1.0)
    assert clamped_low.lat == 10.0
    
    clamped_high = interpolate(p1, p2, 2.0)
    assert clamped_high.lat == 20.0
