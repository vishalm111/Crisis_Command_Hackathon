import pytest

from backend.models import (
    Assignment,
    Constraint,
    ConstraintKind,
    CrisisState,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    PlanMetrics,
    Resource,
    ResourceStatus,
    ResourceType,
    Tier,
)
from backend.orchestrator.orchestrator import detect_and_resolve_conflicts


@pytest.fixture
def conflict_test_state():
    return CrisisState(
        clock_min=10,
        incidents=[
            Incident(
                id="I1_LOW",
                type=IncidentType.medical,
                severity=2,
                location=LatLng(lat=12.97, lng=77.59),
                required={ResourceType.ambulance: 1},
                priority=35.0,
                tier=Tier.medium,
            ),
            Incident(
                id="I2_HIGH",
                type=IncidentType.medical,
                severity=5,
                location=LatLng(lat=12.98, lng=77.60),
                required={ResourceType.ambulance: 1},
                priority=75.0,
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
                id="A3_FAILED",
                type=ResourceType.ambulance,
                name="Ambulance 3 (Offline)",
                base=LatLng(lat=12.97, lng=77.59),
                location=LatLng(lat=12.97, lng=77.59),
                status=ResourceStatus.unavailable,
            ),
        ],
        constraints=[],
        current_plan=Plan(id="plan_0", version=0),
    )


def test_conflict_double_booking_priority_wins(conflict_test_state):
    # A1 double-booked to both I1_LOW (priority 35) and I2_HIGH (priority 75)
    plan = Plan(
        id="plan_test",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1_LOW", eta_min=5.0),
            Assignment(id="a2", resource_id="A1", incident_id="I2_HIGH", eta_min=6.0),
        ],
    )

    resolved, traces = detect_and_resolve_conflicts(plan, conflict_test_state)

    # Only one assignment for A1 remains
    assert len(resolved.assignments) == 1
    assert resolved.assignments[0].incident_id == "I2_HIGH"
    assert any("won over" in t.detail for t in traces)


def test_conflict_double_booking_locked_wins(conflict_test_state):
    # A1 locked to I1_LOW, but also assigned to higher priority I2_HIGH
    plan = Plan(
        id="plan_test",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1_LOW", eta_min=5.0, locked=True),
            Assignment(id="a2", resource_id="A1", incident_id="I2_HIGH", eta_min=6.0, locked=False),
        ],
    )

    resolved, traces = detect_and_resolve_conflicts(plan, conflict_test_state)

    # Locked assignment on I1_LOW wins over higher priority
    assert len(resolved.assignments) == 1
    assert resolved.assignments[0].incident_id == "I1_LOW"
    assert resolved.assignments[0].locked is True


def test_conflict_locked_constraint_enforced(conflict_test_state):
    # State has locked constraint for A1 to I1_LOW
    conflict_test_state.constraints.append(
        Constraint(resource_id="A1", incident_id="I1_LOW", kind=ConstraintKind.locked)
    )

    # Plan attempts to assign A1 to I2_HIGH instead
    plan = Plan(
        id="plan_test",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I2_HIGH", eta_min=4.0),
        ],
    )

    resolved, traces = detect_and_resolve_conflicts(plan, conflict_test_state)

    # A1 must be reverted back to locked incident I1_LOW
    assert len(resolved.assignments) == 1
    assert resolved.assignments[0].incident_id == "I1_LOW"
    assert resolved.assignments[0].locked is True
    assert any("Canceled conflicting move" in t.detail for t in traces)


def test_conflict_unavailable_resource_removed(conflict_test_state):
    # Plan assigns A3_FAILED which has status unavailable
    plan = Plan(
        id="plan_test",
        version=1,
        assignments=[
            Assignment(id="a3", resource_id="A3_FAILED", incident_id="I2_HIGH", eta_min=3.0),
        ],
    )

    resolved, traces = detect_and_resolve_conflicts(plan, conflict_test_state)

    # Unavailable assignment removed
    assert len(resolved.assignments) == 0
    assert any("Removed unavailable resource" in t.detail for t in traces)


def test_conflict_over_allocation_resolved(conflict_test_state):
    # I1_LOW requires only 1 ambulance. Plan assigns both A1 (ETA 8m) and A2 (ETA 4m).
    plan = Plan(
        id="plan_test",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1_LOW", eta_min=8.0),
            Assignment(id="a2", resource_id="A2", incident_id="I1_LOW", eta_min=4.0),
        ],
    )

    resolved, traces = detect_and_resolve_conflicts(plan, conflict_test_state)

    # Only 1 ambulance kept (the one with lower ETA: A2)
    assert len(resolved.assignments) == 1
    assert resolved.assignments[0].resource_id == "A2"
    assert any("Resolved over-allocation" in t.detail for t in traces)
