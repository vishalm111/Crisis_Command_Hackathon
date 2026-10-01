"""Comprehensive test suite for the emergency fleet resource lifecycle.

Verifies:
1. Full 6-state resource model: AVAILABLE, ASSIGNED, DISPATCHED / EN ROUTE, ON SCENE, COMPLETED, FAILED / OFFLINE.
2. Lifecycle endpoints: assign, dispatch, arrive, complete, fail, restore.
3. State count summation: Ready + Assigned + Dispatched + On Scene + Completed + Offline == Total units.
4. Transitions during scenario progression.
"""

from fastapi.testclient import TestClient
from backend.main import app
from backend.models.enums import ResourceStatus


def test_resource_lifecycle_endpoints():
    client = TestClient(app)
    # Reset
    res = client.post("/api/scenario/reset")
    assert res.status_code == 200
    state = res.json()
    assert all(r["status"] == "available" for r in state["resources"])

    # 1. Assign A1
    res = client.post("/api/resources/A1/assign", json={"incident_id": "I1"})
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "assigned"
    assert r["assigned_incident_id"] == "I1"

    # 2. Dispatch A1 (en_route)
    res = client.post("/api/resources/A1/dispatch")
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "en_route"
    assert r["assigned_incident_id"] == "I1"

    # 3. Arrive A1 (on_scene)
    res = client.post("/api/resources/A1/arrive")
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "on_scene"
    assert r["assigned_incident_id"] == "I1"

    # 4. Complete A1 (completed -> returns available)
    res = client.post("/api/resources/A1/complete")
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "available"
    assert r["assigned_incident_id"] is None

    # 5. Fail A1 (unavailable)
    res = client.post("/api/resources/A1/fail")
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "unavailable"

    # 6. Restore A1 (available)
    res = client.post("/api/resources/A1/restore")
    assert res.status_code == 200
    r = res.json()
    assert r["status"] == "available"


def test_resource_status_summary_summation():
    client = TestClient(app)
    client.post("/api/scenario/reset")

    # Run step 1
    client.post("/api/scenario/next")
    # Run step 2
    res = client.post("/api/scenario/next")
    state = res.json()

    resources = state["resources"]
    total = len(resources)
    avail = sum(1 for r in resources if r["status"] == "available")
    assigned = sum(1 for r in resources if r["status"] == "assigned")
    en_route = sum(1 for r in resources if r["status"] == "en_route")
    on_scene = sum(1 for r in resources if r["status"] == "on_scene")
    completed = sum(1 for r in resources if r["status"] == "completed")
    unavailable = sum(1 for r in resources if r["status"] == "unavailable")

    assert total == 6
    assert avail + assigned + en_route + on_scene + completed + unavailable == total
    assert en_route >= 1
    assert avail < total  # Assigned/en-route units are NOT counted as ready/available
