"""Unit tests for Workflow runner (LangGraph and Sequential Fallback).

Acceptance criteria for P1-A3:
- Build the same flows as a LangGraph graph.
- Wrap import langgraph in try/except; if unavailable or on error, fallback to sequential runner.
- A test runs the scenario through both runners and compares final plans (identical results).
"""

import pytest

from backend.models import (
    CrisisState,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.orchestrator.workflow import (
    FLOW_DEFINITIONS,
    LANGGRAPH_AVAILABLE,
    run_flow,
    run_flow_langgraph,
    run_flow_sequential,
)
from backend.services.engine import SimulationEngine
from backend.subagents.base import TriggerContext


@pytest.fixture
def workflow_test_state():
    engine = SimulationEngine()
    engine.reset()
    return engine.get_state()


def test_langgraph_and_sequential_produce_identical_results_across_flows(workflow_test_state):
    """Verifies each flow produces identical payload and plan on LangGraph and Sequential."""
    assert LANGGRAPH_AVAILABLE, "LangGraph should be available in the test environment."

    test_triggers = [
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={
                "incident": Incident(
                    id="I_NEW",
                    type=IncidentType.medical,
                    severity=3,
                    location=LatLng(lat=12.97, lng=77.59),
                    required={ResourceType.ambulance: 1},
                )
            },
        ),
        TriggerContext(
            kind=TriggerKind.resource_failure,
            payload={"resource_id": "A1"},
        ),
        TriggerContext(
            kind=TriggerKind.escalation,
            payload={"incident_id": "I1", "severity": 5},
        ),
        TriggerContext(
            kind=TriggerKind.approval_decision,
            payload={"decision": "approved"},
        ),
        TriggerContext(
            kind=TriggerKind.what_if,
            payload={"kind": "resource_failure", "payload": {"resource_id": "F1"}},
        ),
        TriggerContext(
            kind=TriggerKind.time_advance,
            payload={"minutes": 5},
        ),
    ]

    for ctx in test_triggers:
        flow_name = ctx.kind.value
        seq_payload, seq_traces, seq_alerts = run_flow_sequential(flow_name, workflow_test_state, ctx)
        lg_payload, lg_traces, lg_alerts = run_flow_langgraph(flow_name, workflow_test_state, ctx)

        # Compare plans if produced
        if "plan" in seq_payload and "plan" in lg_payload:
            seq_plan: Plan = seq_payload["plan"]
            lg_plan: Plan = lg_payload["plan"]
            assert len(seq_plan.assignments) == len(lg_plan.assignments), f"Flow {flow_name} assignment count mismatch"
            for a_seq, a_lg in zip(seq_plan.assignments, lg_plan.assignments):
                assert a_seq.resource_id == a_lg.resource_id
                assert a_seq.incident_id == a_lg.incident_id
                assert a_seq.eta_min == a_lg.eta_min

        # Compare trace steps and count
        assert len(seq_traces) == len(lg_traces), f"Flow {flow_name} trace count mismatch"
        for t_seq, t_lg in zip(seq_traces, lg_traces):
            assert t_seq.agent == t_lg.agent
            assert t_seq.step == t_lg.step

        # Compare alerts count
        assert len(seq_alerts) == len(lg_alerts), f"Flow {flow_name} alert count mismatch"


def test_scenario_run_through_both_runners(workflow_test_state):
    """Runs a multi-step scenario through both runners and compares final plans."""
    steps = [
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={
                "incident": Incident(
                    id="I1",
                    type=IncidentType.medical,
                    severity=3,
                    location=LatLng(lat=12.97, lng=77.59),
                    required={ResourceType.ambulance: 1},
                )
            },
        ),
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={
                "incident": Incident(
                    id="I2",
                    type=IncidentType.fire,
                    severity=4,
                    location=LatLng(lat=12.98, lng=77.60),
                    required={ResourceType.ambulance: 1, ResourceType.fire_engine: 1},
                )
            },
        ),
        TriggerContext(
            kind=TriggerKind.resource_failure,
            payload={"resource_id": "A1"},
        ),
    ]

    # Run through sequential runner
    seq_state = CrisisState.model_validate_json(workflow_test_state.model_dump_json())
    for step in steps:
        payload, traces, alerts = run_flow_sequential(step.kind.value, seq_state, step)
        if "plan" in payload and isinstance(payload["plan"], Plan):
            seq_state.current_plan = payload["plan"]
            if "assignments" in payload:
                seq_state.current_plan.assignments = payload["assignments"]

    # Run through LangGraph runner
    lg_state = CrisisState.model_validate_json(workflow_test_state.model_dump_json())
    for step in steps:
        payload, traces, alerts = run_flow_langgraph(step.kind.value, lg_state, step)
        if "plan" in payload and isinstance(payload["plan"], Plan):
            lg_state.current_plan = payload["plan"]
            if "assignments" in payload:
                lg_state.current_plan.assignments = payload["assignments"]

    # Compare final plans
    assert len(seq_state.current_plan.assignments) == len(lg_state.current_plan.assignments)
    for a_seq, a_lg in zip(seq_state.current_plan.assignments, lg_state.current_plan.assignments):
        assert a_seq.resource_id == a_lg.resource_id
        assert a_seq.incident_id == a_lg.incident_id
        assert a_seq.eta_min == a_lg.eta_min


def test_workflow_fallback_on_langgraph_failure(workflow_test_state, monkeypatch):
    """Verifies that run_flow falls back to sequential runner if LangGraph execution throws."""
    import backend.orchestrator.workflow as wf

    def mock_broken_langgraph(*args, **kwargs):
        raise RuntimeError("Simulated LangGraph internal graph error")

    monkeypatch.setattr(wf, "run_flow_langgraph", mock_broken_langgraph)

    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={
            "incident": Incident(
                id="I1",
                type=IncidentType.medical,
                severity=3,
                location=LatLng(lat=12.97, lng=77.59),
            )
        },
    )

    # run_flow should not raise, but log a warning and fallback to sequential
    payload, traces, alerts = run_flow("new_incident", workflow_test_state, ctx)
    assert len(traces) > 0
    assert "plan" in payload
