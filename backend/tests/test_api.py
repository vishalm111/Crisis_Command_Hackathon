import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import CrisisState
from backend.services.engine import get_engine

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_simulation_state():
    engine = get_engine()
    engine.reset()


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "llm_status" in data

    # Root health endpoint
    root_res = client.get("/health")
    assert root_res.status_code == 200


def test_get_state():
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()
    state = CrisisState.model_validate(data)
    assert state.clock_min == 20
    assert len(state.incidents) >= 3


def test_scenario_endpoints():
    res_reset = client.post("/api/scenario/reset")
    assert res_reset.status_code == 200
    state_reset = CrisisState.model_validate(res_reset.json())
    assert state_reset.clock_min == 20

    res_next = client.post("/api/scenario/next")
    assert res_next.status_code == 200
    state_next = CrisisState.model_validate(res_next.json())
    assert state_next.clock_min == 25

    res_run = client.post("/api/scenario/run")
    assert res_run.status_code == 200


def test_create_incident():
    # Structured incident
    req_body = {
        "description": "Chemical spill near lab",
        "type": "hazmat",
        "severity": 4,
        "location": {"lat": 12.98, "lng": 77.61, "label": "Science Block"},
        "people_affected": 3,
    }
    response = client.post("/api/incidents", json=req_body)
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "hazmat"
    assert data["severity"] == 4
    assert data["needs_confirmation"] is False

    # Free text incident
    free_req = {
        "free_text": "Smoke observed coming from parking basement"
    }
    response2 = client.post("/api/incidents", json=free_req)
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["needs_confirmation"] is True
    assert data2["source"] == "free_text"


def test_escalate_incident():
    # Valid escalation
    response = client.post("/api/incidents/I1/escalate", json={"severity": 5})
    assert response.status_code == 200
    assert response.json()["severity"] == 5

    # Unknown incident -> 404 with {"error": str}
    res_404 = client.post("/api/incidents/UNKNOWN_ID/escalate", json={"severity": 4})
    assert res_404.status_code == 404
    assert "error" in res_404.json()

    # Invalid severity -> 422 with {"error": str}
    res_422 = client.post("/api/incidents/I1/escalate", json={"severity": 0})
    assert res_422.status_code == 422
    assert "error" in res_422.json()


def test_resource_status_endpoints():
    # Fail resource
    res_fail = client.post("/api/resources/F1/fail")
    assert res_fail.status_code == 200
    assert res_fail.json()["status"] == "unavailable"

    # Restore resource
    res_restore = client.post("/api/resources/F1/restore")
    assert res_restore.status_code == 200
    assert res_restore.json()["status"] == "available"

    # Unknown resource -> 404
    res_unknown = client.post("/api/resources/NONEXISTENT_RES/fail")
    assert res_unknown.status_code == 404
    assert "error" in res_unknown.json()


def test_advance_time():
    res = client.post("/api/time/advance", json={"minutes": 12})
    assert res.status_code == 200
    assert res.json()["clock_min"] == 32


def test_approval_flow():
    # Approve pending request
    res_appr = client.post("/api/approval/appr_1/approve")
    assert res_appr.status_code == 200
    assert res_appr.json()["status"] == "approved"

    # Double approve -> 409 conflict
    res_double = client.post("/api/approval/appr_1/approve")
    assert res_double.status_code == 409
    assert "error" in res_double.json()

    # Unknown approval id -> 404
    res_unknown = client.post("/api/approval/NOT_FOUND_APPR/approve")
    assert res_unknown.status_code == 404
    assert "error" in res_unknown.json()


def test_approval_reject_flow():
    # Fresh reset to get pending approval back
    client.post("/api/scenario/reset")

    res_rej = client.post("/api/approval/appr_1/reject")
    assert res_rej.status_code == 200
    assert res_rej.json()["status"] == "rejected"

    # Second decision -> 409
    res_double = client.post("/api/approval/appr_1/reject")
    assert res_double.status_code == 409
    assert "error" in res_double.json()


def test_whatif_endpoint_isolation():
    initial_clock = client.get("/api/state").json()["clock_min"]

    whatif_payload = {
        "kind": "resource_failure",
        "payload": {"resource_id": "F2"}
    }
    response = client.post("/api/whatif", json=whatif_payload)
    assert response.status_code == 200
    data = response.json()
    assert "proposed_plan" in data
    assert "diff" in data
    assert "metrics_before" in data
    assert "metrics_after" in data
    assert data["approval_required"] is True

    # State must not be mutated
    after_clock = client.get("/api/state").json()["clock_min"]
    assert after_clock == initial_clock
