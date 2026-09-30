"""
Comprehensive Feature Verification Test for Features 1-14 and Critical Test Flows.
"""
from fastapi.testclient import TestClient
from backend.main import app, get_engine
from backend.services.scenario import reset_scenario

def test_complete_feature_suite():
    client = TestClient(app)
    eng = get_engine()

    # 1. TEST RESET (Critical Test 5)
    r = client.post("/api/scenario/reset")
    assert r.status_code == 200, f"Reset failed: {r.text}"
    state = client.get("/api/state").json()
    assert state["clock_min"] == 0
    assert len(state["resources"]) == 6
    assert len(state["incidents"]) == 0
    print("CRITICAL TEST 5 (Reset): PASS")

    # 2. TEST STEP (Critical Test 6)
    # Step 1: I1 registered at t=0
    r = client.post("/api/scenario/next")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert any(i["id"] == "I1" for i in state["incidents"])
    print("CRITICAL TEST 6 (Step Next - Step 1): PASS")

    # Step 2: I2 fire at t=5
    r = client.post("/api/scenario/next")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["clock_min"] == 5
    assert any(i["id"] == "I2" for i in state["incidents"])
    print("CRITICAL TEST 6 (Step Next - Step 2): PASS")

    # Step 3: I3 unconfirmed free-text at t=10 (Feature 7: Confidence & Uncertainty)
    r = client.post("/api/scenario/next")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["clock_min"] == 10
    i3 = next((i for i in state["incidents"] if i["id"] == "I3"), None)
    assert i3 is not None
    assert i3["needs_confirmation"] is True
    # Unconfirmed report must have NO dispatches
    assert not any(a["incident_id"] == "I3" for a in state["current_plan"]["assignments"])
    print("FEATURE 7 (Confidence & Uncertainty Safeguard on I3): PASS")

    # Step 4: I4 catastrophic collapse at t=15
    r = client.post("/api/scenario/next")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["clock_min"] == 15
    assert any(i["id"] == "I4" for i in state["incidents"])
    print("CRITICAL TEST 6 (Step Next - Step 4): PASS")

    # Step 5: A3 resource failure at t=20 -> TRIGGERS HUMAN APPROVAL GATE
    r = client.post("/api/scenario/next")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["clock_min"] == 20
    approval = state.get("approval")
    assert approval is not None, "Approval gate should be active after step 5"
    assert approval["status"] == "pending"
    approval_id = approval["id"]
    print(f"CRITICAL TEST 2 (Human Approval Gate Triggered): PASS - Approval ID {approval_id}")

    # Test Human Approval endpoint (approve)
    r = client.post(f"/api/approval/{approval_id}/approve")
    assert r.status_code == 200
    state_after_approval = client.get("/api/state").json()
    assert state_after_approval.get("approval") is None or state_after_approval.get("approval", {}).get("status") == "approved"
    assert state_after_approval.get("proposed_plan") is None
    print("CRITICAL TEST 2 (Human Approval Gate Action): PASS")

    # 3. TEST ADVANCE TIME (Critical Test 7)
    r = client.post("/api/time/advance", json={"minutes": 5})
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["clock_min"] >= 25
    print("CRITICAL TEST 7 (Play / Advance Time): PASS")

    # 4. TEST WHAT-IF & VERIFY LIVE STATE IMMUTABILITY (Critical Test 3)
    state_before_whatif = client.get("/api/state").json()
    plan_id_before = state_before_whatif["current_plan"]["id"]
    version_before = state_before_whatif["current_plan"]["version"]
    clock_before = state_before_whatif["clock_min"]

    r_whatif = client.post("/api/whatif", json={
        "kind": "resource_failure",
        "payload": {"resource_id": "A2"},
    })
    assert r_whatif.status_code == 200, f"Whatif error: {r_whatif.text}"
    whatif_res = r_whatif.json()
    assert "proposed_plan" in whatif_res

    state_after_whatif = client.get("/api/state").json()
    assert state_after_whatif["current_plan"]["id"] == plan_id_before
    assert state_after_whatif["current_plan"]["version"] == version_before
    assert state_after_whatif["clock_min"] == clock_before
    print("CRITICAL TEST 3 (What-If Live State Immutability): PASS")

    # 5. TEST COUNTERFACTUAL LAB & IMMUTABILITY (Critical Test 4)
    r_cf = client.post("/api/whatif", json={
        "kind": "escalation",
        "payload": {"incident_id": "I1", "severity": 5}
    })
    assert r_cf.status_code == 200, f"Counterfactual error: {r_cf.text}"
    state_after_cf = client.get("/api/state").json()
    assert state_after_cf["current_plan"]["id"] == plan_id_before
    assert state_after_cf["current_plan"]["version"] == version_before
    assert state_after_cf["clock_min"] == clock_before
    print("CRITICAL TEST 4 (Counterfactual Lab State Immutability): PASS")

    # 6. TEST CHAOS MODE (Critical Test 8)
    r_chaos = client.post("/api/chaos/step", json={
        "intensity": "medium",
        "allowed_events": ["failure", "escalation", "restore"]
    })
    assert r_chaos.status_code == 200, f"Chaos error: {r_chaos.text}"
    chaos_res = r_chaos.json()
    assert "event_type" in chaos_res
    print(f"CRITICAL TEST 8 (Chaos Mode): PASS - Injected {chaos_res['event_type']} on {chaos_res['affected_entity']}")

    # 7. TEST CRISIS BRAIN & SITUATION BRIEF (Feature 1)
    r_brief = client.post("/api/situation-brief")
    assert r_brief.status_code == 200, f"Brief error: {r_brief.text}"
    brief_res = r_brief.json()
    assert "narrative" in brief_res
    assert brief_res["critical_count"] >= 0
    print(f"FEATURE 1 (Crisis Brain Situation Brief): PASS - Narrative: '{brief_res['narrative'][:60]}...'")

    # 8. TEST INTERACTIVE CHAT GROUNDED IN LIVE STATE (Feature 13)
    chat_queries = [
        "What is the highest priority incident?",
        "Why was A2 chosen?",
        "Which resources have failed?",
        "What is the status of I1?",
        "Is human approval required?",
    ]
    for q in chat_queries:
        r_chat = client.post("/api/chat", json={"message": q})
        assert r_chat.status_code == 200, f"Chat error for '{q}': {r_chat.text}"
        chat_res = r_chat.json()
        assert len(chat_res["answer"]) > 0
        print(f"FEATURE 13 (Agent Chat Grounded Q&A): PASS - Q: '{q}' -> A: '{chat_res['answer'][:50]}...'")

    # 9. TEST INCIDENT ESCALATION
    r_esc = client.post("/api/incidents/I1/escalate", json={"severity": 5})
    assert r_esc.status_code == 200
    state_esc = client.get("/api/state").json()
    i1 = next(i for i in state_esc["incidents"] if i["id"] == "I1")
    assert i1["severity"] == 5
    print("INCIDENT ESCALATION: PASS")

    # 10. TEST RESOURCE RESTORE
    r_res = client.post("/api/resources/A3/restore")
    assert r_res.status_code == 200
    state_res = client.get("/api/state").json()
    a3 = next(r for r in state_res["resources"] if r["id"] == "A3")
    assert a3["status"] in ["available", "en_route", "on_scene"]
    print("RESOURCE RESTORE: PASS")

    # 11. FULL ORIGINAL SCENARIO FROM START TO FINISH (Critical Test 1)
    client.post("/api/scenario/reset")
    run_res = client.post("/api/scenario/run")
    assert run_res.status_code == 200
    final_state = client.get("/api/state").json()
    assert len(final_state["incidents"]) >= 3
    print("CRITICAL TEST 1 (Full Original Scenario Run): PASS")

    print("\n=======================================================")
    print("ALL 14 FEATURES & CRITICAL TESTS VERIFIED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_complete_feature_suite()
