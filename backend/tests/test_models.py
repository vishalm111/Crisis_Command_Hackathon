import pytest
from pydantic import ValidationError

from backend.models import (
    AgentMessage,
    Alert,
    AlertLevel,
    ApprovalDecisionRequest,
    ApprovalRequest,
    ApprovalStatus,
    Assignment,
    Constraint,
    ConstraintKind,
    CrisisState,
    DiffChange,
    DiffChangeKind,
    ErrorResponse,
    Explanation,
    Facility,
    FacilityKind,
    HealthResponse,
    Incident,
    IncidentCreateRequest,
    IncidentEscalateRequest,
    IncidentSource,
    IncidentStatus,
    IncidentType,
    LatLng,
    LLMStatus,
    Plan,
    PlanDiff,
    PlanMetrics,
    Resource,
    ResourceStatus,
    ResourceType,
    Tier,
    TimeAdvanceRequest,
    TraceEntry,
    TriggerKind,
    Unmet,
    WhatIfRequest,
    WhatIfResponse,
)


def test_models_import_cleanly():
    assert IncidentType.medical == "medical"
    assert ResourceType.ambulance == "ambulance"
    assert FacilityKind.hospital == "hospital"
    assert IncidentStatus.new == "new"
    assert ResourceStatus.available == "available"
    assert Tier.critical == "critical"
    assert TriggerKind.new_incident == "new_incident"
    assert ApprovalStatus.pending == "pending"


def test_incident_severity_validation():
    # Valid severities 1..5
    for s in [1, 2, 3, 4, 5]:
        inc = Incident(
            id=f"I{s}",
            type=IncidentType.medical,
            severity=s,
            location=LatLng(lat=12.97, lng=77.59),
        )
        assert inc.severity == s

    # Invalid severity: 0
    with pytest.raises(ValidationError):
        Incident(
            id="I0",
            type=IncidentType.medical,
            severity=0,
            location=LatLng(lat=12.97, lng=77.59),
        )

    # Invalid severity: 6
    with pytest.raises(ValidationError):
        Incident(
            id="I6",
            type=IncidentType.medical,
            severity=6,
            location=LatLng(lat=12.97, lng=77.59),
        )

    # Invalid severity: -1
    with pytest.raises(ValidationError):
        Incident(
            id="Ineg",
            type=IncidentType.medical,
            severity=-1,
            location=LatLng(lat=12.97, lng=77.59),
        )


def test_crisis_state_roundtrip():
    state = CrisisState(
        clock_min=20,
        incidents=[
            Incident(
                id="I1",
                type=IncidentType.medical,
                severity=3,
                description="Heart attack reported",
                location=LatLng(lat=12.971, lng=77.592, label="Central Park"),
                people_affected=2,
                required={ResourceType.ambulance: 1},
                status=IncidentStatus.assigned,
                reported_at_min=0,
                priority=49.5,
                tier=Tier.medium,
            ),
            Incident(
                id="I3",
                type=IncidentType.medical,
                severity=2,
                description="Collapse near flyover",
                location=LatLng(lat=12.975, lng=77.595),
                people_affected=1,
                required={ResourceType.ambulance: 1},
                status=IncidentStatus.new,
                reported_at_min=10,
                uncertain_fields=["location"],
                needs_confirmation=True,
                source=IncidentSource.free_text,
            ),
        ],
        resources=[
            Resource(
                id="A1",
                type=ResourceType.ambulance,
                name="Ambulance 1",
                base=LatLng(lat=12.970, lng=77.590),
                location=LatLng(lat=12.971, lng=77.591),
                status=ResourceStatus.en_route,
                assigned_incident_id="I1",
            ),
            Resource(
                id="F1",
                type=ResourceType.fire_engine,
                name="Fire Engine 1",
                base=LatLng(lat=12.980, lng=77.600),
                location=LatLng(lat=12.980, lng=77.600),
                status=ResourceStatus.available,
            ),
        ],
        facilities=[
            Facility(
                id="H1",
                kind=FacilityKind.hospital,
                name="City Hospital",
                location=LatLng(lat=12.974, lng=77.598),
                capacity=50,
                load=12,
            )
        ],
        current_plan=Plan(
            id="plan_1",
            version=1,
            assignments=[
                Assignment(
                    id="asg_1",
                    resource_id="A1",
                    incident_id="I1",
                    eta_min=6.5,
                    distance_km=3.2,
                    locked=False,
                    approved=False,
                    reason="Nearest available ambulance",
                )
            ],
            unmet=[],
            metrics=PlanMetrics(
                avg_eta_min=6.5,
                max_eta_min=6.5,
                coverage_pct=100.0,
                utilization_pct=50.0,
                unresolved_count=0,
            ),
        ),
        proposed_plan=None,
        approval=None,
        plan_history=[],
        constraints=[
            Constraint(
                resource_id="A1",
                incident_id="I1",
                kind=ConstraintKind.locked,
            )
        ],
        traces=[
            TraceEntry(
                agent="assessment",
                step="score_incidents",
                detail="Scored I1 with priority 49.5",
                used_llm=False,
                fallback_used=False,
                at_min=0,
            )
        ],
        explanations=[
            Explanation(
                id="exp_1",
                trigger="new_incident",
                bullets=["A1 dispatched to I1 (ETA 6.5m)"],
                trace_refs=[0],
            )
        ],
        alerts=[
            Alert(
                id="alt_1",
                level=AlertLevel.info,
                text="Dispatched A1 to incident I1",
                at_min=0,
            )
        ],
        messages=[
            AgentMessage(
                id="msg_1",
                agent="Orchestrator",
                text="Crisis Command initialized.",
                at_min=0,
            )
        ],
        event_log=["t=0: Dispatched A1 to I1"],
        llm_status=LLMStatus.disabled,
    )

    json_str = state.model_dump_json()
    restored = CrisisState.model_validate_json(json_str)

    assert restored.clock_min == 20
    assert len(restored.incidents) == 2
    assert restored.incidents[0].id == "I1"
    assert restored.incidents[0].required[ResourceType.ambulance] == 1
    assert restored.incidents[1].needs_confirmation is True
    assert restored.resources[0].status == ResourceStatus.en_route
    assert restored.current_plan.assignments[0].resource_id == "A1"
    assert restored.alerts[0].level == AlertLevel.info
    assert restored.traces[0].agent == "assessment"


def test_api_models():
    create_req = IncidentCreateRequest(
        description="Fire at warehouse",
        type=IncidentType.fire,
        severity=4,
        location=LatLng(lat=12.98, lng=77.60),
    )
    assert create_req.severity == 4

    escalate_req = IncidentEscalateRequest(severity=5)
    assert escalate_req.severity == 5

    with pytest.raises(ValidationError):
        IncidentEscalateRequest(severity=0)

    advance_req = TimeAdvanceRequest(minutes=10)
    assert advance_req.minutes == 10

    whatif_req = WhatIfRequest(
        kind=TriggerKind.resource_failure,
        payload={"resource_id": "F2"},
    )
    assert whatif_req.kind == TriggerKind.resource_failure


def test_mock_state_valid():
    from pathlib import Path

    mock_state_path = Path("contracts/mock_state.json")
    assert mock_state_path.exists(), "contracts/mock_state.json must exist"

    with open(mock_state_path, "r", encoding="utf-8") as f:
        data = f.read()

    state = CrisisState.model_validate_json(data)
    assert state.clock_min == 20

    # 3 to 4 incidents including one needs_confirmation
    assert len(state.incidents) >= 3
    has_needs_confirmation = any(inc.needs_confirmation for inc in state.incidents)
    assert has_needs_confirmation, "Must include at least one incident with needs_confirmation=True"

    # All seed resources (A1, A2, A3, F1, F2, R1)
    resource_ids = {r.id for r in state.resources}
    expected_resources = {"A1", "A2", "A3", "F1", "F2", "R1"}
    assert expected_resources.issubset(resource_ids)

    # Current plan with 4 assignments
    assert len(state.current_plan.assignments) == 4

    # Pending ApprovalRequest with a diff
    assert state.approval is not None
    assert state.approval.status == ApprovalStatus.pending
    assert state.approval.diff is not None
    assert len(state.approval.diff.changes) > 0

    # 2 explanations, 3 alerts, 6 traces
    assert len(state.explanations) == 2
    assert len(state.alerts) == 3
    assert len(state.traces) == 6

    # Verify ID references exist
    incident_ids = {inc.id for inc in state.incidents}
    facility_ids = {fac.id for fac in state.facilities}

    for asg in state.current_plan.assignments:
        assert asg.resource_id in resource_ids, f"Resource {asg.resource_id} not found"
        assert asg.incident_id in incident_ids, f"Incident {asg.incident_id} not found"
        if asg.facility_id:
            assert asg.facility_id in facility_ids, f"Facility {asg.facility_id} not found"

    for unmet in state.current_plan.unmet:
        assert unmet.incident_id in incident_ids, f"Unmet incident {unmet.incident_id} not found"

    for change in state.approval.diff.changes:
        assert change.resource_id in resource_ids
        if change.old_incident_id:
            assert change.old_incident_id in incident_ids
        if change.new_incident_id:
            assert change.new_incident_id in incident_ids

