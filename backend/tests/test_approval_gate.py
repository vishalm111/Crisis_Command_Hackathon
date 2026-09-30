"""Unit tests for Contract Section 8 Approval Gate.

Tests each of the four triggers:
1. Preempts a resource from an incident with severity 4 or 5.
2. Leaves a critical tier incident with any unmet slot.
3. Changes 3 or more assignments compared with the current plan.
4. Includes an incident with needs_confirmation = true that would receive resources.

And tests the auto-commit path (including identical plan and non-critical standard changes).
"""

import pytest

from backend.models import (
    Assignment,
    CrisisState,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    Resource,
    ResourceStatus,
    ResourceType,
    Tier,
    Unmet,
)
from backend.orchestrator.approval_gate import evaluate, GateDecision


@pytest.fixture
def gate_state():
    return CrisisState(
        clock_min=15,
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
                id="I2_HIGH_SEV",
                type=IncidentType.fire,
                severity=4,
                location=LatLng(lat=12.98, lng=77.60),
                required={ResourceType.ambulance: 1, ResourceType.fire_engine: 1},
                priority=65.0,
                tier=Tier.high,
            ),
            Incident(
                id="I3_UNCONFIRMED",
                type=IncidentType.medical,
                severity=3,
                location=LatLng(lat=12.96, lng=77.58),
                required={ResourceType.ambulance: 1},
                priority=35.0,
                tier=Tier.medium,
                needs_confirmation=True,
                uncertain_fields=["location"],
            ),
            Incident(
                id="I4_CRITICAL",
                type=IncidentType.rescue,
                severity=5,
                location=LatLng(lat=12.99, lng=77.61),
                required={ResourceType.ambulance: 2, ResourceType.rescue_team: 1},
                priority=85.0,
                tier=Tier.critical,
            ),
        ],
        resources=[
            Resource(
                id="A1",
                type=ResourceType.ambulance,
                name="Ambulance 1",
                base=LatLng(lat=12.97, lng=77.59),
                location=LatLng(lat=12.97, lng=77.59),
                status=ResourceStatus.available,
            ),
            Resource(
                id="A2",
                type=ResourceType.ambulance,
                name="Ambulance 2",
                base=LatLng(lat=12.97, lng=77.59),
                location=LatLng(lat=12.97, lng=77.59),
                status=ResourceStatus.available,
            ),
            Resource(
                id="A3",
                type=ResourceType.ambulance,
                name="Ambulance 3",
                base=LatLng(lat=12.97, lng=77.59),
                location=LatLng(lat=12.97, lng=77.59),
                status=ResourceStatus.available,
            ),
            Resource(
                id="F1",
                type=ResourceType.fire_engine,
                name="Fire Engine 1",
                base=LatLng(lat=12.98, lng=77.60),
                location=LatLng(lat=12.98, lng=77.60),
                status=ResourceStatus.available,
            ),
            Resource(
                id="R1",
                type=ResourceType.rescue_team,
                name="Rescue Team 1",
                base=LatLng(lat=12.99, lng=77.61),
                location=LatLng(lat=12.99, lng=77.61),
                status=ResourceStatus.available,
            ),
        ],
        current_plan=Plan(
            id="plan_1",
            version=1,
            assignments=[
                Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
                Assignment(id="a2", resource_id="A2", incident_id="I2_HIGH_SEV", eta_min=6.0),
                Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            ],
        ),
    )


def test_trigger_1_preempt_from_severity_4_or_5(gate_state):
    """Rule 1: Preempting a resource from severity 4 or 5 incident triggers approval."""
    # Preempt A2 from I2_HIGH_SEV (severity 4) to I4_CRITICAL
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            Assignment(id="a2", resource_id="A2", incident_id="I4_CRITICAL", eta_min=4.0),
        ],
        unmet=[
            Unmet(incident_id="I2_HIGH_SEV", missing={ResourceType.ambulance: 1}),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    assert decision.required is True
    assert any("Preempts" in r and "I2_HIGH_SEV" in r for r in decision.reasons)
    # Check plain sentence consequence
    assert any("I2_HIGH_SEV loses ambulance A2 and becomes unmet" in c for c in decision.consequences)


def test_preempt_from_severity_3_auto_commits_if_no_other_triggers(gate_state):
    """Preempting from severity 3 does NOT trigger Rule 1."""
    # Preempt A1 from I1 (severity 3) to I4_CRITICAL
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I4_CRITICAL", eta_min=4.0),
            Assignment(id="a2", resource_id="A2", incident_id="I2_HIGH_SEV", eta_min=6.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
        ],
        unmet=[
            Unmet(incident_id="I1", missing={ResourceType.ambulance: 1}),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    # 1 reassignment, 0 severity >= 4 preemption, no critical unmet -> auto commit
    assert decision.required is False
    assert len(decision.reasons) == 0
    # Consequence is still transparently recorded
    assert any("I1 loses ambulance A1 and becomes unmet" in c for c in decision.consequences)


def test_trigger_2_leaves_critical_incident_with_unmet(gate_state):
    """Rule 2: Leaving a critical tier incident with any unmet slot triggers approval."""
    # Assign A3 to I4_CRITICAL, but I4_CRITICAL needed 2 ambulances so 1 remains unmet
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
            Assignment(id="a2", resource_id="A2", incident_id="I2_HIGH_SEV", eta_min=6.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            Assignment(id="a3", resource_id="A3", incident_id="I4_CRITICAL", eta_min=5.0),
        ],
        unmet=[
            Unmet(incident_id="I4_CRITICAL", missing={ResourceType.ambulance: 1}),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    assert decision.required is True
    assert any("critical incident I4_CRITICAL" in r for r in decision.reasons)
    assert any("Critical emergency at I4_CRITICAL remains without required responder units" in c for c in decision.consequences)


def test_trigger_3_changes_three_or_more_assignments(gate_state):
    """Rule 3: Changing 3 or more assignments compared with current plan triggers approval."""
    # Current has A1->I1, A2->I2, F1->I2
    # Proposed reassigns A1->I4, A2->I4, and adds R1->I4 (3 changes total)
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            Assignment(id="a1", resource_id="A1", incident_id="I4_CRITICAL", eta_min=5.0),
            Assignment(id="a2", resource_id="A2", incident_id="I4_CRITICAL", eta_min=6.0),
            Assignment(id="r1", resource_id="R1", incident_id="I4_CRITICAL", eta_min=8.0),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    assert decision.required is True
    assert any("major operational disruption" in r or "changes 3 assignments" in r.lower() for r in decision.reasons)
    assert any("Reorganizes 3 units simultaneously" in c for c in decision.consequences)


def test_trigger_4_unconfirmed_incident_receives_resources(gate_state):
    """Rule 4: Incident with needs_confirmation = true receiving resources triggers approval."""
    # Assign A3 to I3_UNCONFIRMED
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
            Assignment(id="a2", resource_id="A2", incident_id="I2_HIGH_SEV", eta_min=6.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            Assignment(id="a3", resource_id="A3", incident_id="I3_UNCONFIRMED", eta_min=4.0),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    assert decision.required is True
    assert any("I3_UNCONFIRMED" in r and "needs confirmation" in r for r in decision.reasons)
    assert any("unverified incident location" in c for c in decision.consequences)


def test_auto_commit_path_identical_plan(gate_state):
    """Auto-commit: An identical plan requires no approval and has no consequences."""
    decision = evaluate(gate_state.current_plan, gate_state.current_plan, gate_state)
    assert decision.required is False
    assert decision.reasons == []
    assert decision.consequences == []
    assert len(decision.diff.changes) == 0


def test_auto_commit_path_routine_single_dispatch(gate_state):
    """Auto-commit: Dispatching a free resource to a verified medium incident requires no approval."""
    # Add A3 to I1
    proposed = Plan(
        id="plan_2",
        version=2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
            Assignment(id="a2", resource_id="A2", incident_id="I2_HIGH_SEV", eta_min=6.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2_HIGH_SEV", eta_min=7.0),
            Assignment(id="a3", resource_id="A3", incident_id="I1", eta_min=4.5),
        ],
    )

    decision = evaluate(gate_state.current_plan, proposed, gate_state)
    assert decision.required is False
    assert len(decision.reasons) == 0
    assert any("I1 receives ambulance A3 (ETA 4.5m)" in c for c in decision.consequences)
