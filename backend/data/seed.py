from backend.models.domain import CrisisState, Resource, Facility, LatLng
from backend.models.enums import ResourceType, FacilityKind

def build_seed_state() -> CrisisState:
    resources = [
        Resource(
            id="A1",
            type=ResourceType.ambulance,
            name="Ambulance A1 (Central)",
            base=LatLng(lat=12.9715, lng=77.5900, label="St. Martha's Base"),
            location=LatLng(lat=12.9715, lng=77.5900, label="St. Martha's Base"),
        ),
        Resource(
            id="A2",
            type=ResourceType.ambulance,
            name="Ambulance A2 (Shivajinagar)",
            base=LatLng(lat=12.9831, lng=77.6041, label="Bowring Base"),
            location=LatLng(lat=12.9831, lng=77.6041, label="Bowring Base"),
        ),
        Resource(
            id="A3",
            type=ResourceType.ambulance,
            name="Ambulance A3 (Malleswaram)",
            base=LatLng(lat=13.0068, lng=77.5816, label="Malleswaram Base"),
            location=LatLng(lat=13.0068, lng=77.5816, label="Malleswaram Base"),
        ),
        Resource(
            id="F1",
            type=ResourceType.fire_engine,
            name="Fire Engine F1 (Central)",
            base=LatLng(lat=12.9877, lng=77.5891, label="High Grounds Fire Station"),
            location=LatLng(lat=12.9877, lng=77.5891, label="High Grounds Fire Station"),
        ),
        Resource(
            id="F2",
            type=ResourceType.fire_engine,
            name="Fire Engine F2 (South)",
            base=LatLng(lat=12.9295, lng=77.5802, label="Jayanagar Fire Station"),
            location=LatLng(lat=12.9295, lng=77.5802, label="Jayanagar Fire Station"),
        ),
        Resource(
            id="R1",
            type=ResourceType.rescue_team,
            name="Rescue Team R1 (Central)",
            base=LatLng(lat=12.9750, lng=77.6100, label="NDRF Base Halasuru"),
            location=LatLng(lat=12.9750, lng=77.6100, label="NDRF Base Halasuru"),
        ),
    ]

    facilities = [
        Facility(
            id="H1",
            kind=FacilityKind.hospital,
            name="Victoria Hospital",
            location=LatLng(lat=12.9632, lng=77.5753, label="Victoria Hospital"),
            capacity=50,
            load=0,
        ),
        Facility(
            id="H2",
            kind=FacilityKind.hospital,
            name="Manipal Hospital HAL",
            location=LatLng(lat=12.9591, lng=77.6481, label="Manipal Hospital HAL"),
            capacity=30,
            load=0,
        ),
        Facility(
            id="S1",
            kind=FacilityKind.shelter,
            name="Kanteerava Stadium Shelter",
            location=LatLng(lat=12.9696, lng=77.5937, label="Kanteerava Stadium Shelter"),
            capacity=200,
            load=0,
        ),
    ]

    return CrisisState(
        clock_min=0,
        incidents=[],
        resources=resources,
        facilities=facilities
    )

get_seed_state = build_seed_state

