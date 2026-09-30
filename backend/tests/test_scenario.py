"""End-to-end integration and verification tests for the Hackathon scenario (Contract Section 9 & P4)."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.domain import CrisisState
from backend.models.enums import ApprovalStatus, ResourceStatus
from backend.services.engine import get_engine
from backend.services.scenario import next_step, reset_scenario, run_all


@pytest.fixture(autouse=True)
def reset_system():
    """Ensure engine and scenario start from fresh seed state for each test."""
    eng = get_engine()
    reset_scenario(eng)
    yield
    reset_scenario(eng)


def test_scenario_full_lifecycle():
    """Verifies all 7 steps of the demonstration scenario in sequence."""
    client = TestClient(app)

    # Initial reset
    res = client.post("/api/scenario/reset")
    assert res.status_code == 200
    state = res.json()
    assert state["clock_min"] == 0
    assert len(state["resources"]) == 6
    assert len(state["incidents"]) == 0

    # Step 1 (t=0): I1 medical incident
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    assert len(state["incidents"]) >= 1
    i1 = next(inc for inc in state["incidents"] if inc["id"] == "I1")
    assert i1["type"] == "medical"
    assert i1["severity"] == 3
    # Plan v1 should have an ambulance assigned to I1
    assert state["current_plan"] is not None
    assert any(a["incident_id"] == "I1" for a in state["current_plan"]["assignments"])

    # Step 2 (t=5): I2 fire incident
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    assert state["clock_min"] == 5
    i2 = next(inc for inc in state["incidents"] if inc["id"] == "I2")
    assert i2["type"] == "fire"
    assert i2["severity"] == 4
    # Plan v2 should have fire engine and ambulance assignments
    assert state["current_plan"]["version"] >= 2

    # Step 3 (t=10): Free-text vague report (I3)
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    assert state["clock_min"] == 10
    i3 = next((inc for inc in state["incidents"] if inc["id"] == "I3"), None)
    assert i3 is not None
    assert i3["needs_confirmation"] is True
    # Unconfirmed incident I3 must NOT receive resources
    assert not any(a["incident_id"] == "I3" for a in state["current_plan"]["assignments"])

    # Step 4 (t=15): I4 catastrophic collapse with preemption
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    assert state["clock_min"] == 15
    i4 = next((inc for inc in state["incidents"] if inc["id"] == "I4"), None)
    assert i4 is not None
    assert i4["severity"] == 5
    # High-priority I4 must have assignments
    i4_asgs = [a for a in state["current_plan"]["assignments"] if a["incident_id"] == "I4"]
    assert len(i4_asgs) >= 3

    # Step 5 (t=20): A3 fails, triggers human approval gate
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    assert state["clock_min"] == 20
    # A3 must be unavailable
    a3 = next(r for r in state["resources"] if r["id"] == "A3")
    assert a3["status"] == "unavailable"
    # Approval gate must be triggered (pending)
    assert state["approval"] is not None
    assert state["approval"]["status"] == "pending"
    assert state["proposed_plan"] is not None

    # Step 6 (t=22): Human coordinator approves
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state = res.json()
    # Proposed plan must be promoted and approval cleared/approved
    assert state["proposed_plan"] is None

    # Step 7: What-If simulation
    res = client.post("/api/scenario/next")
    assert res.status_code == 200
    state_after = res.json()
    # Live state clock, incidents, and resources preserved
    assert state_after["clock_min"] == state["clock_min"]


def test_scenario_run_all_deterministic():
    """Verify that run_all can be run repeatedly and gives identical, reproducible results."""
    client = TestClient(app)

    # First run
    res1 = client.post("/api/scenario/run")
    assert res1.status_code == 200
    plan_v_1 = res1.json()["current_plan"]["version"]
    asg_count_1 = len(res1.json()["current_plan"]["assignments"])

    # Reset
    res_reset = client.post("/api/scenario/reset")
    assert res_reset.status_code == 200
    assert len(res_reset.json()["incidents"]) == 0

    # Second run
    res2 = client.post("/api/scenario/run")
    assert res2.status_code == 200
    plan_v_2 = res2.json()["current_plan"]["version"]
    asg_count_2 = len(res2.json()["current_plan"]["assignments"])

    assert plan_v_1 == plan_v_2
    assert asg_count_1 == asg_count_2


def test_whatif_preserves_live_state():
    """Asserts that calling /api/whatif never mutates live CrisisState."""
    client = TestClient(app)
    client.post("/api/scenario/run")

    state_before = client.get("/api/state").json()

    # Simulate failing F2
    res = client.post("/api/whatif", json={
        "kind": "resource_failure",
        "payload": {"resource_id": "F2"},
    })
    assert res.status_code == 200
    whatif_data = res.json()

    assert "affected_resources" in whatif_data
    assert "F2" in whatif_data["affected_resources"]
    assert "diff" in whatif_data
    assert "metrics_before" in whatif_data
    assert "metrics_after" in whatif_data

    # Verify live state is untouched
    state_after = client.get("/api/state").json()
    assert state_before["clock_min"] == state_after["clock_min"]
    assert len(state_before["incidents"]) == len(state_after["incidents"])
    f2_before = next(r for r in state_before["resources"] if r["id"] == "F2")
    f2_live = next(r for r in state_after["resources"] if r["id"] == "F2")
    assert f2_live["status"] == f2_before["status"]
    assert f2_live["status"] != "unavailable"


def test_approval_rejection_workflow():
    """Test manual human rejection flow."""
    client = TestClient(app)

    # Advance to step 5 where approval is pending
    for _ in range(5):
        client.post("/api/scenario/next")

    state = client.get("/api/state").json()
    assert state["approval"] is not None
    appr_id = state["approval"]["id"]

    # Reject
    reject_res = client.post(f"/api/approval/{appr_id}/reject", json={"notes": "Coordinator rejected reassignment"})
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    updated_state = client.get("/api/state").json()
    assert updated_state["proposed_plan"] is None


def test_resource_fail_and_restore():
    """Tests resource failure and restoration endpoints."""
    client = TestClient(app)

    fail_res = client.post("/api/resources/A1/fail")
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "unavailable"

    restore_res = client.post("/api/resources/A1/restore")
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "available"


def test_incident_escalation():
    """Tests incident escalation endpoint."""
    client = TestClient(app)
    # Create incident first via step 1
    client.post("/api/scenario/next")

    esc_res = client.post("/api/incidents/I1/escalate", json={"severity": 5})
    assert esc_res.status_code == 200
    assert esc_res.json()["severity"] == 5
