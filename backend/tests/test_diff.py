"""Unit tests for plan diffing and metrics computation (services/diff.py)."""

import pytest
from backend.models.domain import (
    Assignment,
    Incident,
    LatLng,
    Plan,
    Resource,
)
from backend.models.enums import (
    DiffChangeKind,
    IncidentType,
    ResourceStatus,
    ResourceType,
    Tier,
)
from backend.services.diff import compute_metrics, diff_plans


def test_diff_plans_all_change_kinds():
    """Verifies that added, removed, reassigned, and eta_changed are detected accurately."""
    p1 = Plan(
        id="p1",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
            Assignment(id="a2", resource_id="A2", incident_id="I1", eta_min=6.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2", eta_min=10.0),
            Assignment(id="r1", resource_id="R1", incident_id="I3", eta_min=8.0),
        ],
    )

    p2 = Plan(
        id="p2",
        version=2,
        assignments=[
            # a1: ETA changed by >= 1.0 (5.0 -> 8.0)
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=8.0),
            # a2: reassigned to I2
            Assignment(id="a2", resource_id="A2", incident_id="I2", eta_min=6.0),
            # f1: unchanged (eta diff < 1.0)
            Assignment(id="f1", resource_id="F1", incident_id="I2", eta_min=10.2),
            # r1: removed (not in p2)
            # a3: newly added
            Assignment(id="a3", resource_id="A3", incident_id="I3", eta_min=4.0),
        ],
    )

    diff = diff_plans(p1, p2)
    assert diff.from_version == 1
    assert diff.to_version == 2

    by_res = {c.resource_id: c for c in diff.changes}
    assert len(by_res) == 4

    assert by_res["A1"].kind == DiffChangeKind.eta_changed
    assert by_res["A1"].old_eta_min == 5.0
    assert by_res["A1"].new_eta_min == 8.0

    assert by_res["A2"].kind == DiffChangeKind.reassigned
    assert by_res["A2"].old_incident_id == "I1"
    assert by_res["A2"].new_incident_id == "I2"

    assert by_res["R1"].kind == DiffChangeKind.removed
    assert by_res["R1"].old_incident_id == "I3"

    assert by_res["A3"].kind == DiffChangeKind.added
    assert by_res["A3"].new_incident_id == "I3"


def test_diff_plans_identical():
    """Identical plans produce an empty diff."""
    p1 = Plan(
        id="p1",
        version=1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=5.0),
        ],
    )
    diff = diff_plans(p1, p1)
    assert len(diff.changes) == 0


def test_compute_metrics():
    """Verifies PlanMetrics computation for coverage, utilization, and ETAs."""
    incidents = [
        Incident(
            id="I1",
            type=IncidentType.medical,
            severity=3,
            location=LatLng(lat=12.97, lng=77.59),
            required={ResourceType.ambulance: 2},
            tier=Tier.medium,
        ),
        Incident(
            id="I2",
            type=IncidentType.fire,
            severity=4,
            location=LatLng(lat=12.98, lng=77.60),
            required={ResourceType.fire_engine: 1},
            tier=Tier.high,
        ),
    ]

    resources = [
        Resource(id="A1", type=ResourceType.ambulance, name="Amb 1", base=LatLng(lat=12.97, lng=77.59), location=LatLng(lat=12.97, lng=77.59)),
        Resource(id="A2", type=ResourceType.ambulance, name="Amb 2", base=LatLng(lat=12.97, lng=77.59), location=LatLng(lat=12.97, lng=77.59)),
        Resource(id="F1", type=ResourceType.fire_engine, name="Fire 1", base=LatLng(lat=12.98, lng=77.60), location=LatLng(lat=12.98, lng=77.60)),
        Resource(id="F2", type=ResourceType.fire_engine, name="Fire 2", base=LatLng(lat=12.98, lng=77.60), location=LatLng(lat=12.98, lng=77.60), status=ResourceStatus.unavailable),
    ]

    from backend.models.domain import Unmet

    # Assign A1 to I1 (1 of 2 needed) and F1 to I2 (1 of 1 needed)
    plan = Plan(
        id="p1",
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=4.0),
            Assignment(id="f1", resource_id="F1", incident_id="I2", eta_min=8.0),
        ],
        unmet=[
            Unmet(incident_id="I1", missing={ResourceType.ambulance: 1}),
        ],
    )

    from backend.models.domain import CrisisState

    state = CrisisState(incidents=incidents, resources=resources)
    metrics = compute_metrics(plan, state)

    # avg ETA = (4 + 8) / 2 = 6.0
    assert metrics.avg_eta_min == 6.0
    assert metrics.max_eta_min == 8.0

    # Total required = 2 (I1) + 1 (I2) = 3; assigned = 2; coverage = 2/3 * 100 = 66.7%
    assert metrics.coverage_pct == 66.7

    # Non-failed resources = A1, A2, F1 (3 total); assigned = A1, F1 (2 total); utilization = 2/3 * 100 = 66.7%
    assert metrics.utilization_pct == 66.7

    # I1 is missing 1 ambulance, so unresolved count is 1
    assert metrics.unresolved_count == 1
