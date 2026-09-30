"""Phase 4 resilience tests (P1-T1, P1-T2, P1-T3, P1-T4).

Verifies:
1. P1-T1: POST /scenario/reset and engine.reset() are safe at any moment and idempotent.
2. P1-T2: Debounce and idempotency for double clicks (same trigger within 1.0s is ignored/cached).
3. P1-T3: Error handling audit: unhandled errors return structured JSON {"error": ...} and raise alerts.
4. P1-T4: Full end-to-end scenario run with LLM_ENABLED=false.
"""

import time
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import (
    ApprovalRequest,
    ApprovalStatus,
    CrisisState,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    PlanDiff,
    ResourceType,
    TriggerKind,
)
from backend.orchestrator.orchestrator import Orchestrator, get_orchestrator
from backend.services.engine import SimulationEngine, get_engine
from backend.subagents.base import TriggerContext


from pathlib import Path


@pytest.fixture
def client():
    # Reset engine state before each test
    eng = get_engine()
    eng.seed_path = Path(__file__).resolve().parent.parent.parent / "contracts" / "mock_state.json"
    eng.reset()
    yield TestClient(app, raise_server_exceptions=False)
    eng.seed_path = None
    eng.reset()


def test_p1_t1_reset_safe_at_any_moment(client):
    """P1-T1: reset() is safe to call during pending approval, altered clock, or active constraints."""
    engine = get_engine()

    # 1. Modify state: advance clock, add pending approval, add constraints
    engine.advance_clock(35)
    test_plan = Plan(id="p_test", version=99)
    test_diff = PlanDiff(from_version=1, to_version=99, changes=[])
    engine.set_approval(
        ApprovalRequest(
            id="appr_pending_reset_test",
            status=ApprovalStatus.pending,
            reasons=["Pending review"],
            proposed_plan=test_plan,
            diff=test_diff,
        )
    )

    # 2. Call reset via endpoint
    resp = client.post("/api/scenario/reset")
    assert resp.status_code == 200
    data = resp.json()

    # Verify state is completely restored and clean
    assert data["clock_min"] == 20  # mock_state seed clock
    # Pending approval must be reset to the seed state approval
    assert data["approval"]["id"] == "appr_1"

    # Reset again immediately to test idempotency
    resp2 = client.post("/api/scenario/reset")
    assert resp2.status_code == 200
    assert resp2.json()["clock_min"] == 20


def test_p1_t2_debounce_and_idempotency_for_double_clicks():
    """P1-T2: Triggering the same action within 1.0 second returns cached result and avoids duplicate execution."""
    engine = SimulationEngine()
    engine.reset()
    orchestrator = Orchestrator(engine)

    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={
            "incident": Incident(
                id="I_DEBOUNCE_TEST",
                type=IncidentType.medical,
                severity=3,
                location=LatLng(lat=12.97, lng=77.59),
                required={ResourceType.ambulance: 1},
            )
        },
    )

    # First trigger execution
    state_1 = orchestrator.handle(ctx)
    trace_count_1 = len(state_1.traces)

    # Immediate second trigger (double-click within 1 second)
    state_2 = orchestrator.handle(ctx)
    trace_count_2 = len(state_2.traces)

    # The second trigger should be debounced: no new subagent execution traces appended
    assert trace_count_2 == trace_count_1
    assert any("Debounced duplicate trigger" in log for log in engine.get_state().event_log)


def test_p1_t3_error_handling_audit_returns_structured_json(client, monkeypatch):
    """P1-T3: Unhandled server errors return 500 JSON with {'error': str} and create an alert."""
    from backend.orchestrator import orchestrator as orch_module

    # Force Orchestrator.handle to throw an unexpected exception
    def broken_handle(*args, **kwargs):
        raise ZeroDivisionError("Unexpected math crash during dispatch")

    real_orch = get_orchestrator()
    monkeypatch.setattr(real_orch, "handle", broken_handle)

    resp = client.post(
        "/api/incidents",
        json={
            "id": "I_CRASH",
            "type": "medical",
            "severity": 3,
            "location": {"lat": 12.97, "lng": 77.59},
        },
    )

    # Must return 500 JSON with {"error": str}
    assert resp.status_code == 500
    body = resp.json()
    assert "error" in body
    assert "Unexpected math crash" in body["error"]

    # Verify a critical alert was recorded in state
    state = get_engine().get_state()
    assert any("Unexpected math crash" in alert.text for alert in state.alerts)


def test_p1_t4_full_scenario_run_deterministic(client):
    """P1-T4: Full end-to-end scenario pass with LLM_ENABLED=false."""
    # 1. Reset state
    resp = client.post("/api/scenario/reset")
    assert resp.status_code == 200

    # 2. Advance time to t=25
    resp = client.post("/api/time/advance", json={"minutes": 5})
    assert resp.status_code == 200
    assert resp.json()["clock_min"] == 25

    # 3. Simulate resource failure for Ambulance A1
    resp = client.post("/api/resources/A1/fail")
    assert resp.status_code == 200
    assert resp.json()["status"] == "unavailable"

    # 4. Check state remains valid
    resp = client.get("/api/state")
    assert resp.status_code == 200
    state = resp.json()
    assert state["current_plan"] is not None
    assert len(state["resources"]) > 0

    # 5. Restore resource
    resp = client.post("/api/resources/A1/restore")
    assert resp.status_code == 200
    assert resp.json()["status"] == "available"

    # 6. Test What-If simulation (never mutates live state)
    resp = client.post(
        "/api/whatif",
        json={"kind": "resource_failure", "payload": {"resource_id": "F1"}},
    )
    assert resp.status_code == 200
    what_if_res = resp.json()
    assert "scenario" in what_if_res

    # Live state must still have F1 available
    state_after = client.get("/api/state").json()
    f1 = next(r for r in state_after["resources"] if r["id"] == "F1")
    assert f1["status"] != "unavailable"
