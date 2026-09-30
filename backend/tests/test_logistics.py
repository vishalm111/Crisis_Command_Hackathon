import pytest
from backend.models.domain import CrisisState, Incident, Resource, Facility, LatLng, Plan, Assignment
from backend.models.enums import IncidentType, ResourceType, ResourceStatus, FacilityKind, TriggerKind, Tier
from backend.subagents.logistics import LogisticsAgent
from backend.subagents.base import TriggerContext

def test_logistics_v0():
    state = CrisisState(
        clock_min=10,
        incidents=[
            Incident(
                id="I1", type=IncidentType.medical, severity=3, location=LatLng(lat=12.97, lng=77.59),
                people_affected=1, reported_at_min=0, tier=Tier.medium
            )
        ],
        resources=[
            Resource(
                id="A1", type=ResourceType.ambulance, name="Amb 1",
                base=LatLng(lat=12.96, lng=77.58), location=LatLng(lat=12.96, lng=77.58),
                status=ResourceStatus.en_route, assigned_incident_id="I1"
            )
        ],
        facilities=[
            Facility(id="H1", kind=FacilityKind.hospital, name="Hosp 1", location=LatLng(lat=12.98, lng=77.60), capacity=10, load=0)
        ],
        current_plan=Plan(
            id="P1", assignments=[Assignment(id="A-I1", resource_id="A1", incident_id="I1", eta_min=0.0)]
        )
    )

    agent = LogisticsAgent()
    ctx = TriggerContext(kind=TriggerKind.new_incident)
    result = agent.run(state, ctx)

    assert len(result.payload["assignments"]) == 1
    a = result.payload["assignments"][0]
    
    assert a.eta_min > 0
    assert a.distance_km > 0
    assert a.facility_id == "H1"
    
    assert "A1" in result.payload["positions"]
    pos = result.payload["positions"]["A1"]
    assert pos.lat != 12.96 or pos.lng != 77.58 # should have moved

    assert len(result.traces) == 2
