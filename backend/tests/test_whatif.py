"""Unit tests for What-If scenario simulations (subagents/whatif.py)."""

import pytest
from backend.models.domain import (
    Assignment,
    CrisisState,
    Incident,
    LatLng,
    Plan,
    Resource,
)
from backend.models.enums import (
    IncidentType,
    ResourceStatus,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.subagents.base import TriggerContext
from backend.subagents.whatif import WhatIfAgent


@pytest.fixture
def whatif_state():
    return CrisisState(
        clock_min=20,
        incidents=[
            Incident(
                id="I1",
                type=IncidentType.medical,
                severity=3,
                location=LatLng(lat=12.97, lng=77.59),
                required={ResourceType.ambulance: 1},
                priority=45.0,
                tier=Tier.medium,
            ),
            Incident(
                id="I2",
                type=IncidentType.fire,
                severity=4,
                location=LatLng(lat=12.98, lng=77.60),
                required={ResourceType.fire_engine: 1, ResourceType.ambulance: 1},
                priority=65.0,
                tier=Tier.high,
            ),
        ],
        resources=[
            Resource(id="A1", type=ResourceType.ambulance, name="Amb 1", base=LatLng(lat=12.97, lng=77.59), location=LatLng(lat=12.97, lng=77.59)),
            Resource(id="A2", type=ResourceType.ambulance, name="Amb 2", base=LatLng(lat=12.98, lng=77.60), location=LatLng(lat=12.98, lng=77.60)),
            Resource(id="F1", type=ResourceType.fire_engine, name="Fire 1", base=LatLng(lat=12.98, lng=77.60), location=LatLng(lat=12.98, lng=77.60)),
        ],
        current_plan=Plan(
            id="plan_1",
            version=1,
            assignments=[
                Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=4.0),
                Assignment(id="a2", resource_id="A2", incident_id="I2", eta_min=5.0),
                Assignment(id="f1", resource_id="F1", incident_id="I2", eta_min=6.0),
            ],
        ),
    )


def test_whatif_resource_failure_simulation(whatif_state):
    """Simulating failure of an assigned resource recalculates plan and metrics."""
    agent = WhatIfAgent()
    original_state_json = whatif_state.model_dump_json()

    ctx = TriggerContext(
        kind=TriggerKind.resource_failure,
        payload={"resource_id": "F1"},
    )
    result = agent.run(whatif_state, ctx)

    # 1. State isolation: original state unchanged
    assert whatif_state.model_dump_json() == original_state_json

    # 2. Result structure
    payload = result.payload
    assert "proposed_plan" in payload
    assert "diff" in payload
    assert "metrics_before" in payload
    assert "metrics_after" in payload
    assert "approval_required" in payload
    assert "approval_reasons" in payload

    # F1 should not be in the proposed plan
    proposed = payload["proposed_plan"]
    assert not any(a.resource_id == "F1" for a in proposed.assignments)


def test_whatif_incident_escalation_simulation(whatif_state):
    """Simulating incident escalation computes additional required resources."""
    agent = WhatIfAgent()
    original_state_json = whatif_state.model_dump_json()

    ctx = TriggerContext(
        kind=TriggerKind.escalation,
        payload={"incident_id": "I1", "severity": 5},
    )
    result = agent.run(whatif_state, ctx)

    assert whatif_state.model_dump_json() == original_state_json
    payload = result.payload
    assert payload["proposed_plan"] is not None
    assert payload["metrics_after"] is not None


def test_whatif_new_incident_simulation(whatif_state):
    """Simulating a new incident on snapshot evaluates dispatch feasibility."""
    agent = WhatIfAgent()
    original_state_json = whatif_state.model_dump_json()

    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={
            "incident": {
                "id": "I_HYPO",
                "type": "medical",
                "severity": 4,
                "location": {"lat": 12.96, "lng": 77.58, "label": "South Metro"},
                "people_affected": 3,
                "required": {"ambulance": 1},
            }
        },
    )
    result = agent.run(whatif_state, ctx)

    assert whatif_state.model_dump_json() == original_state_json
    payload = result.payload
    assert payload["proposed_plan"] is not None
