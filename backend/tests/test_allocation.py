"""Unit tests for the Allocation subagent (P3-W1)."""

import math
from typing import Optional
import pytest

from backend.models.domain import (
    Assignment,
    Constraint,
    CrisisState,
    Incident,
    LatLng,
    Plan,
    Resource,
    TraceEntry,
)
from backend.models.enums import (
    ConstraintKind,
    IncidentStatus,
    IncidentType,
    ResourceStatus,
    ResourceType,
    Tier,
)
from backend.subagents.allocation import (
    TIER_MAX_ETA,
    AllocationSubAgent,
    allocate,
    allocation_agent,
)
import backend.services.geo as geo


# Private fallback haversine and eta_minutes until geo.py is merged by P4
def _fallback_haversine_km(a: LatLng, b: LatLng) -> float:
    """Calculates haversine distance in km."""
    r = 6371.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lng)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lng)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.asin(math.sqrt(max(0.0, min(1.0, h))))
    return round(r * c, 4)


def _fallback_eta_minutes(a: LatLng, b: LatLng) -> float:
    """Contract section 4: 2 + (haversine_km * 1.4 / 40) * 60."""
    dist_km = _fallback_haversine_km(a, b)
    return round(2.0 + (dist_km * 1.4 / 40.0) * 60.0, 2)


@pytest.fixture(autouse=True)
def setup_geo_fallback(monkeypatch):
    """Ensures eta_minutes is available for allocation tests."""
    if not hasattr(geo, "eta_minutes") or not callable(getattr(geo, "eta_minutes", None)):
        monkeypatch.setattr(geo, "eta_minutes", _fallback_eta_minutes, raising=False)
    if not hasattr(geo, "haversine_km") or not callable(getattr(geo, "haversine_km", None)):
        monkeypatch.setattr(geo, "haversine_km", _fallback_haversine_km, raising=False)


def _create_resource(
    res_id: str,
    res_type: ResourceType,
    lat: float,
    lng: float,
    status: ResourceStatus = ResourceStatus.available,
) -> Resource:
    loc = LatLng(lat=lat, lng=lng)
    return Resource(
        id=res_id,
        type=res_type,
        name=f"Resource {res_id}",
        base=loc,
        location=loc,
        status=status,
    )


def _create_incident(
    inc_id: str,
    lat: float,
    lng: float,
    priority: float,
    tier: Tier,
    required: dict[ResourceType, int],
    needs_confirmation: bool = False,
    status: IncidentStatus = IncidentStatus.new,
    reported_at_min: int = 0,
) -> Incident:
    return Incident(
        id=inc_id,
        type=IncidentType.medical,
        severity=4,
        description=f"Incident {inc_id}",
        location=LatLng(lat=lat, lng=lng),
        people_affected=2,
        required=required,
        status=status,
        reported_at_min=reported_at_min,
        priority=priority,
        tier=tier,
        needs_confirmation=needs_confirmation,
    )


class TestAllocationCore:
    """Acceptance tests for P3-W1 allocation functionality."""

    def test_single_incident_gets_nearest_ambulance(self):
        """Single incident gets the nearest ambulance by ETA."""
        inc = _create_incident(
            inc_id="I1",
            lat=12.9716,
            lng=77.5946,
            priority=50.0,
            tier=Tier.high,
            required={ResourceType.ambulance: 1},
        )
        # A1 is very close (~0.06 km), A2 is farther (~3.5 km)
        a1 = _create_resource("A1", ResourceType.ambulance, 12.9720, 77.5950)
        a2 = _create_resource("A2", ResourceType.ambulance, 12.9950, 77.6200)

        state = CrisisState(
            clock_min=0,
            incidents=[inc],
            resources=[a2, a1],  # intentionally unordered
        )

        plan, traces = allocate(state)

        assert len(plan.assignments) == 1
        assignment = plan.assignments[0]
        assert assignment.incident_id == "I1"
        assert assignment.resource_id == "A1"
        assert len(plan.unmet) == 0

        # Verify traces captured decision
        assert any(t.step == "assignment" and "A1" in t.detail for t in traces)

    def test_two_incidents_share_resources_without_double_booking(self):
        """Two incidents share resources without double booking any unit."""
        i1 = _create_incident(
            inc_id="I1",
            lat=12.9700,
            lng=77.5900,
            priority=70.0,
            tier=Tier.critical,
            required={ResourceType.ambulance: 1},
        )
        i2 = _create_incident(
            inc_id="I2",
            lat=12.9800,
            lng=77.6000,
            priority=55.0,
            tier=Tier.high,
            required={ResourceType.ambulance: 1},
        )
        a1 = _create_resource("A1", ResourceType.ambulance, 12.9705, 77.5905)
        a2 = _create_resource("A2", ResourceType.ambulance, 12.9805, 77.6005)

        state = CrisisState(
            clock_min=0,
            incidents=[i2, i1],
            resources=[a1, a2],
        )

        plan, traces = allocate(state)

        assert len(plan.assignments) == 2
        assigned_resources = {a.resource_id for a in plan.assignments}
        assert assigned_resources == {"A1", "A2"}

        # No double booking: each assignment resource_id is unique
        resource_ids = [a.resource_id for a in plan.assignments]
        assert len(resource_ids) == len(set(resource_ids))

        # Higher priority incident I1 gets nearest A1
        i1_asgn = next(a for a in plan.assignments if a.incident_id == "I1")
        assert i1_asgn.resource_id == "A1"

        # I2 gets remaining ambulance A2
        i2_asgn = next(a for a in plan.assignments if a.incident_id == "I2")
        assert i2_asgn.resource_id == "A2"
        assert len(plan.unmet) == 0

    def test_eta_over_tier_limit_becomes_unmet(self):
        """An ETA over the tier max limit becomes unmet and is not assigned."""
        # Tier critical max ETA is 15.0 minutes
        # Distance ~20 km yields ETA = 2 + 20*1.4/40*60 = 44 minutes >> 15.0
        inc = _create_incident(
            inc_id="I_CRIT",
            lat=12.9700,
            lng=77.5900,
            priority=85.0,
            tier=Tier.critical,
            required={ResourceType.ambulance: 1},
        )
        # Far resource (~20 km away)
        a_far = _create_resource("A_FAR", ResourceType.ambulance, 13.1500, 77.5900)

        state = CrisisState(
            clock_min=0,
            incidents=[inc],
            resources=[a_far],
        )

        plan, traces = allocate(state)

        # Far ambulance must not be assigned
        assert len(plan.assignments) == 0
        assert len(plan.unmet) == 1
        assert plan.unmet[0].incident_id == "I_CRIT"
        assert plan.unmet[0].missing[ResourceType.ambulance] == 1

        # Trace indicates limit breach
        unmet_trace = next(t for t in traces if t.step == "unmet_requirement")
        assert "exceeded limit" in unmet_trace.detail
        assert "15.0m" in unmet_trace.detail

    def test_determinism_same_input_same_output(self):
        """Deterministic: two runs on identical state yield identical plans and traces."""
        inc1 = _create_incident("I1", 12.9716, 77.5946, 60.0, Tier.high, {ResourceType.ambulance: 1})
        inc2 = _create_incident("I2", 12.9800, 77.6000, 75.0, Tier.critical, {ResourceType.fire_engine: 1, ResourceType.ambulance: 1})

        a1 = _create_resource("A1", ResourceType.ambulance, 12.9720, 77.5950)
        a2 = _create_resource("A2", ResourceType.ambulance, 12.9750, 77.5980)
        f1 = _create_resource("F1", ResourceType.fire_engine, 12.9780, 77.6010)

        state = CrisisState(
            clock_min=10,
            incidents=[inc1, inc2],
            resources=[a2, f1, a1],
        )

        plan1, traces1 = allocate(state)
        plan2, traces2 = allocate(state)

        assert plan1.model_dump() == plan2.model_dump()
        assert [t.model_dump() for t in traces1] == [t.model_dump() for t in traces2]

    def test_incident_with_needs_confirmation_skipped(self):
        """Incidents flagged needs_confirmation must not receive any resources."""
        inc_unconfirmed = _create_incident(
            "I_UNCONFIRMED", 12.9716, 77.5946, 90.0, Tier.critical,
            {ResourceType.ambulance: 1}, needs_confirmation=True,
        )
        inc_confirmed = _create_incident(
            "I_CONFIRMED", 12.9800, 77.6000, 40.0, Tier.medium,
            {ResourceType.ambulance: 1}, needs_confirmation=False,
        )
        a1 = _create_resource("A1", ResourceType.ambulance, 12.9720, 77.5950)

        state = CrisisState(
            clock_min=0,
            incidents=[inc_unconfirmed, inc_confirmed],
            resources=[a1],
        )

        plan, traces = allocate(state)

        # Unconfirmed incident should not receive resources
        assert len(plan.assignments) == 1
        assert plan.assignments[0].incident_id == "I_CONFIRMED"
        assert any(t.step == "skip_confirmation" and "I_UNCONFIRMED" in t.detail for t in traces)

    def test_unavailable_resources_ignored(self):
        """Unavailable resources are ignored during allocation."""
        inc = _create_incident("I1", 12.9716, 77.5946, 60.0, Tier.high, {ResourceType.ambulance: 1})
        # A1 is right next to incident, but unavailable
        a_broken = _create_resource("A1", ResourceType.ambulance, 12.9717, 77.5947, status=ResourceStatus.unavailable)
        # A2 is available farther away
        a_ok = _create_resource("A2", ResourceType.ambulance, 12.9800, 77.6000, status=ResourceStatus.available)

        state = CrisisState(clock_min=0, incidents=[inc], resources=[a_broken, a_ok])
        plan, _ = allocate(state)

        assert len(plan.assignments) == 1
        assert plan.assignments[0].resource_id == "A2"

    def test_locked_and_approved_constraints_respected(self):
        """Locked and approved assignments are preserved."""
        i1 = _create_incident("I1", 12.9700, 77.5900, 80.0, Tier.critical, {ResourceType.ambulance: 1})
        i2 = _create_incident("I2", 12.9800, 77.6000, 40.0, Tier.medium, {ResourceType.ambulance: 1})

        a1 = _create_resource("A1", ResourceType.ambulance, 12.9705, 77.5905)

        # A1 is locked to lower priority incident I2
        constraint = Constraint(resource_id="A1", incident_id="I2", kind=ConstraintKind.locked)

        state = CrisisState(
            clock_min=0,
            incidents=[i1, i2],
            resources=[a1],
            constraints=[constraint],
        )

        plan, traces = allocate(state)

        # A1 must stay with I2 due to constraint
        assert len(plan.assignments) == 1
        assert plan.assignments[0].resource_id == "A1"
        assert plan.assignments[0].incident_id == "I2"
        assert plan.assignments[0].locked is True

        # I1 has no remaining ambulance and becomes unmet
        assert len(plan.unmet) == 1
        assert plan.unmet[0].incident_id == "I1"

    def test_subagent_protocol_wrapper(self):
        """AllocationSubAgent wraps allocate and conforms to SubAgent protocol."""
        inc = _create_incident("I1", 12.9716, 77.5946, 50.0, Tier.high, {ResourceType.ambulance: 1})
        a1 = _create_resource("A1", ResourceType.ambulance, 12.9720, 77.5950)
        state = CrisisState(clock_min=5, incidents=[inc], resources=[a1])

        agent = AllocationSubAgent()
        assert agent.name == "allocation"

        result = agent.run(state)
        assert "plan" in result.payload
        plan = result.payload["plan"]
        assert isinstance(plan, Plan)
        assert len(plan.assignments) == 1
        assert len(result.traces) > 0

    def test_metrics_calculation(self):
        """Verify plan metrics (avg/max ETA, coverage, utilization, unresolved)."""
        i1 = _create_incident("I1", 12.9700, 77.5900, 60.0, Tier.high, {ResourceType.ambulance: 2})
        a1 = _create_resource("A1", ResourceType.ambulance, 12.9705, 77.5905)
        # Only 1 ambulance for 2 required slots, plus 1 fire engine available
        f1 = _create_resource("F1", ResourceType.fire_engine, 12.9800, 77.6000)

        state = CrisisState(clock_min=0, incidents=[i1], resources=[a1, f1])
        plan, _ = allocate(state)

        # 1 slot assigned out of 2 required -> coverage = 50.0%
        # 1 resource assigned out of 2 non-failed -> utilization = 50.0%
        # 1 incident has unmet slot -> unresolved = 1
        assert plan.metrics.coverage_pct == 50.0
        assert plan.metrics.utilization_pct == 50.0
        assert plan.metrics.unresolved_count == 1
        assert plan.metrics.avg_eta_min > 0.0
