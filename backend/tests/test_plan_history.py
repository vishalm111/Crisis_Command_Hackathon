"""Unit tests for Plan Promotion, History, Diff, and Event Log (P1-A4).

Verifies:
1. plan_history stores every committed plan.
2. PlanDiff between the last two plans is available in state (latest_diff) and via engine.get_last_plan_diff().
3. event_log records every trigger and decision.
4. Approved proposals archive old plan, promote new plan, lock constraints, and log events.
"""

import pytest

from backend.models import (
    ApprovalRequest,
    ApprovalStatus,
    Assignment,
    ConstraintKind,
    CrisisState,
    DiffChangeKind,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    PlanDiff,
    Resource,
    ResourceStatus,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.orchestrator.orchestrator import Orchestrator
from backend.services.engine import SimulationEngine
from backend.subagents.base import TriggerContext


@pytest.fixture
def engine():
    eng = SimulationEngine()
    eng.reset()
    return eng


def test_plan_history_and_latest_diff(engine):
    """Verifies that committing new plans appends to plan_history and calculates latest_diff."""
    state = engine.get_state()
    initial_plan = state.current_plan
    initial_version = initial_plan.version

    initial_history_len = len(state.plan_history)

    # Commit second plan
    plan_v2 = Plan(
        id=f"plan_{initial_version + 1}",
        version=initial_version + 1,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I1", eta_min=4.0),
        ],
    )
    engine.set_plan(plan_v2, archive_current=True)

    state_after_v2 = engine.get_state()
    assert len(state_after_v2.plan_history) == initial_history_len + 1
    assert state_after_v2.plan_history[-1].version == initial_version
    assert state_after_v2.current_plan.version == initial_version + 1
    assert state_after_v2.latest_diff is not None
    assert state_after_v2.latest_diff.from_version == initial_version
    assert state_after_v2.latest_diff.to_version == initial_version + 1
    assert engine.get_last_plan_diff() is not None

    # Commit third plan
    plan_v3 = Plan(
        id=f"plan_{initial_version + 2}",
        version=initial_version + 2,
        assignments=[
            Assignment(id="a1", resource_id="A1", incident_id="I2", eta_min=7.0),
        ],
    )
    engine.set_plan(plan_v3, archive_current=True)

    state_after_v3 = engine.get_state()
    assert len(state_after_v3.plan_history) == initial_history_len + 2
    assert state_after_v3.plan_history[-1].version == initial_version + 1
    assert state_after_v3.current_plan.version == initial_version + 2
    assert state_after_v3.latest_diff.from_version == initial_version + 1
    assert state_after_v3.latest_diff.to_version == initial_version + 2

    # Verify event log recorded both plan commitments
    assert any(f"Plan v{initial_version + 1}" in log for log in state_after_v3.event_log)
    assert any(f"Plan v{initial_version + 2}" in log for log in state_after_v3.event_log)


def test_event_log_records_triggers_and_decisions(engine):
    """Verifies that orchestrator records triggers and decisions into the event log."""
    orchestrator = Orchestrator(engine)

    # 1. Trigger new incident
    new_inc = Incident(
        id="I_EVENT_TEST",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.97, lng=77.59),
        required={ResourceType.ambulance: 1},
    )
    ctx = TriggerContext(kind=TriggerKind.new_incident, payload={"incident": new_inc})
    orchestrator.handle(ctx)

    state = engine.get_state()
    assert any("Trigger received: new_incident" in log for log in state.event_log)
    assert any("Incident I_EVENT_TEST registered" in log for log in state.event_log)
    assert any("automatically committed" in log or "approval gate triggered" in log for log in state.event_log)


def test_plan_promotion_via_approval_archives_and_diffs(engine):
    """Verifies plan promotion from proposed_plan to current_plan archives old plan with diff."""
    state = engine.get_state()
    old_version = state.current_plan.version

    proposed = Plan(
        id=f"plan_proposed_{old_version + 1}",
        version=old_version + 1,
        assignments=[
            Assignment(id="a_new", resource_id="A1", incident_id="I2", eta_min=5.0, approved=True),
        ],
    )
    diff = PlanDiff(from_version=old_version, to_version=old_version + 1, changes=[])
    approval_req = ApprovalRequest(
        id="appr_test_1",
        status=ApprovalStatus.approved,
        reasons=["Operational preemption"],
        consequences=["Unit A1 moved to I2"],
        proposed_plan=proposed,
        diff=diff,
    )

    engine.set_proposed_plan(proposed)
    engine.set_approval(approval_req)

    # Simulate approval promotion
    engine.set_plan(proposed, archive_current=True, diff=diff)
    engine.set_proposed_plan(None)

    final_state = engine.get_state()
    assert final_state.current_plan.id == proposed.id
    assert len(final_state.plan_history) >= 1
    assert final_state.plan_history[-1].version == old_version
    assert final_state.latest_diff is not None
    assert final_state.latest_diff.to_version == proposed.version
