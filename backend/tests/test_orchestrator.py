import pytest

from backend.models import (
    ApprovalStatus,
    CrisisState,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.orchestrator.orchestrator import Orchestrator, evaluate_approval_gate
from backend.services.engine import SimulationEngine
from backend.subagents.base import TriggerContext


@pytest.fixture
def test_engine():
    engine = SimulationEngine()
    engine.reset()
    return engine


def test_orchestrator_new_incident_flow(test_engine):
    orchestrator = Orchestrator(test_engine)
    new_inc = {
        "id": "I_TEST_1",
        "type": "medical",
        "severity": 3,
        "description": "Traffic accident near city center",
        "location": {"lat": 12.97, "lng": 77.59},
        "people_affected": 2,
        "required": {"ambulance": 1},
    }
    ctx = TriggerContext(kind=TriggerKind.new_incident, payload={"incident": new_inc})

    state = orchestrator.handle(ctx)
    assert isinstance(state, CrisisState)
    assert any(inc.id == "I_TEST_1" for inc in state.incidents)
    assert len(state.traces) > 0


def test_orchestrator_resource_failure_flow(test_engine):
    orchestrator = Orchestrator(test_engine)
    ctx = TriggerContext(
        kind=TriggerKind.resource_failure,
        payload={"resource_id": "A3"}
    )
    state = orchestrator.handle(ctx)
    assert isinstance(state, CrisisState)
    assert any(t.agent in ("impact_detector", "allocation") for t in state.traces)


def test_orchestrator_escalation_flow(test_engine):
    orchestrator = Orchestrator(test_engine)
    ctx = TriggerContext(
        kind=TriggerKind.escalation,
        payload={"incident_id": "I1", "severity": 5}
    )
    state = orchestrator.handle(ctx)
    assert isinstance(state, CrisisState)
    assert len(state.traces) > 0


def test_orchestrator_time_advance_flow(test_engine):
    orchestrator = Orchestrator(test_engine)
    initial_clock = test_engine.get_state().clock_min

    ctx = TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 10})
    state = orchestrator.handle(ctx)
    assert state.clock_min == initial_clock + 10
    assert any(t.agent == "logistics" for t in state.traces)


def test_orchestrator_whatif_isolation(test_engine):
    orchestrator = Orchestrator(test_engine)
    live_clock_before = test_engine.get_state().clock_min
    live_incidents_before = len(test_engine.get_state().incidents)

    ctx = TriggerContext(
        kind=TriggerKind.what_if,
        payload={"resource_id": "F2"}
    )
    whatif_result = orchestrator.handle(ctx)

    # What-If output is returned
    assert isinstance(whatif_result, CrisisState)

    # Live engine state was NOT modified
    assert test_engine.get_state().clock_min == live_clock_before
    assert len(test_engine.get_state().incidents) == live_incidents_before


def test_orchestrator_subagent_exception_graceful(test_engine, monkeypatch):
    orchestrator = Orchestrator(test_engine)

    # Force an exception in a sub-agent
    from backend.orchestrator import workflow

    def mock_broken_agent(*args, **kwargs):
        raise RuntimeError("Simulated network timeout in subagent")

    from backend.orchestrator.stubs import StubAssessmentSubAgent
    monkeypatch.setattr(StubAssessmentSubAgent, "run", mock_broken_agent)

    ctx = TriggerContext(kind=TriggerKind.new_incident, payload={})
    # Must NOT raise 500 / unhandled exception
    state = orchestrator.handle(ctx)

    assert isinstance(state, CrisisState)
    # Exception must surface as a warning alert and a trace
    assert any("Simulated network timeout" in a.text for a in state.alerts)
    assert any("Simulated network timeout" in t.detail for t in state.traces)


def test_approval_gate_rules(test_engine):
    state = test_engine.get_state()
    current_plan = state.current_plan

    # 1. Plan with no major changes -> auto-commit
    needs_appr, reasons, consequences, diff = evaluate_approval_gate(current_plan, current_plan, state)
    assert needs_appr is False
    assert len(reasons) == 0

    # 2. Preempts from severity 4/5 incident (e.g. I2 has severity 4)
    mutated_plan = current_plan.model_copy(deep=True)
    if mutated_plan.assignments:
        mutated_plan.assignments[0].incident_id = "I4"
        mutated_plan.version += 1
        # Set old assignment to high severity incident I2
        state.incidents.append(
            Incident(
                id="I2_HIGH",
                type=IncidentType.fire,
                severity=4,
                location=LatLng(lat=12.9, lng=77.6),
            )
        )
        current_plan.assignments[0].incident_id = "I2_HIGH"

        needs_appr, reasons, consequences, diff = evaluate_approval_gate(current_plan, mutated_plan, state)
        assert needs_appr is True
        assert any("severity 4" in r for r in reasons)
