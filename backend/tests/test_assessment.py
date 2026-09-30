import sys
from pathlib import Path
import pytest

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.models.domain import CrisisState, Incident, LatLng, Plan
from backend.models.enums import (
    IncidentSource,
    IncidentStatus,
    IncidentType,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.subagents.assessment import AssessmentSubAgent, parse_free_text_rule_based
from backend.subagents.base import SubAgent, TriggerContext


def _make_empty_state(clock_min: int = 0) -> CrisisState:
    return CrisisState(
        clock_min=clock_min,
        incidents=[],
        resources=[],
        facilities=[],
        current_plan=Plan(
            id="plan_0",
            version=1,
            assignments=[],
            unmet=[],
            metrics={
                "avg_eta_min": 0,
                "max_eta_min": 0,
                "coverage_pct": 0,
                "utilization_pct": 0,
                "unresolved_count": 0,
            },
        ),
    )


def test_subagent_protocol_conformance():
    """Verify AssessmentSubAgent conforms to SubAgent runtime protocol."""
    agent = AssessmentSubAgent()
    assert isinstance(agent, SubAgent)
    assert agent.name == "assessment"


def test_step3_acceptance_vague_location():
    """
    Contract Section 9 Step 3 Acceptance test:
    Free-text report: 'man collapsed near the flyover, maybe heart attack'
    Must yield: needs_confirmation = true, 'location' in uncertain_fields, type = medical.
    """
    state = _make_empty_state(clock_min=10)
    agent = AssessmentSubAgent()
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"free_text": "man collapsed near the flyover, maybe heart attack", "incident_id": "I3"},
    )

    result = agent.run(state, ctx)
    incidents = result.payload.get("incidents", [])

    assert len(incidents) == 1
    i3 = incidents[0]

    assert i3.id == "I3"
    assert i3.type == IncidentType.medical
    assert i3.status == IncidentStatus.assessed
    assert i3.source == IncidentSource.free_text
    assert i3.reported_at_min == 10

    # Acceptance criteria
    assert i3.needs_confirmation is True
    assert "location" in i3.uncertain_fields

    # Severity should be raised due to 'collapsed' / 'heart attack'
    assert i3.severity >= 4
    assert i3.people_affected == 1

    # Priority score calculated deterministically
    assert i3.priority > 0
    assert isinstance(i3.tier, Tier)

    # Decision trace logged with used_llm=False, fallback_used=True
    assert len(result.traces) >= 1
    assert result.traces[0].agent == "assessment"
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True


def test_structured_incident_assessment():
    """Verify structured incident sets default requirements, computes priority & tier, and transitions to assessed."""
    state = _make_empty_state(clock_min=5)
    agent = AssessmentSubAgent()

    inc = Incident(
        id="I1",
        type=IncidentType.medical,
        severity=3,
        description="Patient with acute trauma",
        location=LatLng(lat=12.9716, lng=77.5946, label="MG Road Metro"),
        people_affected=2,
        reported_at_min=5,
        status=IncidentStatus.new,
    )

    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"incident": inc},
    )

    result = agent.run(state, ctx)
    assessed = result.payload["incidents"][0]

    assert assessed.status == IncidentStatus.assessed
    # Default required for medical is 1 ambulance
    assert assessed.required == {ResourceType.ambulance: 1}
    # At t=5, waiting=0, sev 3 (30) + people 2 (2) + med (10) + waiting 0 = 42.0 (medium)
    assert assessed.priority == 42.0
    assert assessed.tier == Tier.medium
    assert assessed.needs_confirmation is False


def test_free_text_known_place_not_flagged():
    """When a specific known landmark is mentioned, location is verified and needs_confirmation is False."""
    text = "Commercial warehouse fire with heavy smoke near Shivajinagar Depot, 4 people trapped"
    inc, rules = parse_free_text_rule_based(text, clock_min=5, incident_id="I2")

    assert inc.type == IncidentType.fire
    assert inc.location.label == "Shivajinagar Depot"
    assert "location" not in inc.uncertain_fields
    assert inc.needs_confirmation is False
    assert inc.people_affected == 4
    assert inc.severity >= 4


def test_free_text_ambiguous_text_uncertainties():
    """When text lacks type, people, and location, uncertain_fields captures all missing attributes."""
    text = "Something unusual is happening over there"
    inc, rules = parse_free_text_rule_based(text, clock_min=0, incident_id="I_UNKNOWN")

    assert "type" in inc.uncertain_fields
    assert "location" in inc.uncertain_fields
    assert inc.needs_confirmation is True


def test_escalation_trigger_recalculation():
    """Escalating an incident updates severity and recomputes priority and tier."""
    state = _make_empty_state(clock_min=15)
    existing_inc = Incident(
        id="I1",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.97, lng=77.59),
        people_affected=2,
        reported_at_min=0,
        status=IncidentStatus.assigned,
    )
    state.incidents.append(existing_inc)

    agent = AssessmentSubAgent()
    ctx = TriggerContext(
        kind=TriggerKind.escalation,
        payload={"incident_id": "I1", "severity": 5},
    )

    result = agent.run(state, ctx)
    updated = result.payload["incidents"][0]

    assert updated.severity == 5
    # Severity 5 (50) + 2 + 10 + 15*0.5 (7.5) = 69.5 (High)
    assert updated.priority == 69.5
    assert updated.tier == Tier.high


def test_time_advance_trigger():
    """Advancing simulation time updates priority scores of active incidents."""
    state = _make_empty_state(clock_min=30)
    inc = Incident(
        id="I1",
        type=IncidentType.fire,
        severity=3,
        location=LatLng(lat=12.97, lng=77.59),
        people_affected=0,
        reported_at_min=0,
        status=IncidentStatus.assessed,
    )
    state.incidents.append(inc)

    agent = AssessmentSubAgent()
    ctx = TriggerContext(kind=TriggerKind.time_advance, payload={})

    result = agent.run(state, ctx)
    assessed = result.payload["incidents"][0]

    # At t=30, waiting = 30 -> 30*0.5 = 15.0; sev 3 (30) + 10 (fire) + 15 = 55.0
    assert assessed.priority == 55.0
    assert assessed.tier == Tier.high


def test_p2_a1_acceptance_llm_disabled_matches_fallback(monkeypatch):
    """P2-A1 Acceptance Case 1: with LLM_ENABLED=false, results equal rule-based behavior."""
    monkeypatch.setenv("LLM_ENABLED", "false")
    state = _make_empty_state(clock_min=10)
    agent = AssessmentSubAgent()
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"free_text": "man collapsed near the flyover, maybe heart attack", "incident_id": "I3"},
    )

    result = agent.run(state, ctx)
    inc = result.payload["incidents"][0]

    assert inc.needs_confirmation is True
    assert "location" in inc.uncertain_fields
    assert inc.type == IncidentType.medical
    assert inc.severity >= 4

    assert len(result.traces) >= 1
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True


def test_p2_a1_acceptance_llm_valid_mock_used(monkeypatch):
    """P2-A1 Acceptance Case 2: with mocked valid LLM response, the LLM values are used."""
    mock_data = {
        "type": "fire",
        "severity": 4,
        "people_affected": 6,
        "location_label": "Shivajinagar Depot",
        "required": {"fire_engine": 1, "ambulance": 1},
        "uncertain_fields": [],
        "confidence": 0.95,
    }

    from backend.services.llm import LLMClient, LLMResult
    mock_client = LLMClient()
    monkeypatch.setattr(mock_client, "complete_json", lambda *args, **kwargs: LLMResult(ok=True, data=mock_data, fallback_used=False))

    state = _make_empty_state(clock_min=5)
    agent = AssessmentSubAgent(llm_client=mock_client)
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"free_text": "commercial fire at depot with multiple victims", "incident_id": "I2"},
    )

    result = agent.run(state, ctx)
    inc = result.payload["incidents"][0]

    assert inc.type == IncidentType.fire
    assert inc.severity == 4
    assert inc.people_affected == 6
    assert inc.location.label == "Shivajinagar Depot"
    assert inc.needs_confirmation is False
    assert inc.required == {ResourceType.fire_engine: 1, ResourceType.ambulance: 1}

    # Trace verifies Grok was used without fallback
    assert len(result.traces) >= 1
    assert result.traces[0].used_llm is True
    assert result.traces[0].fallback_used is False


def test_p2_a1_acceptance_llm_garbage_triggers_fallback(monkeypatch):
    """P2-A1 Acceptance Case 3: with mocked garbage response, fallback is used and trace says so."""
    from backend.services.llm import LLMClient, LLMResult
    # Malformed data with illegal type and out-of-range severity
    mock_garbage = {
        "type": "alien_invasion",
        "severity": 999,
        "people_affected": -10,
    }

    mock_client = LLMClient()
    monkeypatch.setattr(mock_client, "complete_json", lambda *args, **kwargs: LLMResult(ok=True, data=mock_garbage, fallback_used=False))

    state = _make_empty_state(clock_min=10)
    agent = AssessmentSubAgent(llm_client=mock_client)
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"free_text": "man collapsed near the flyover, maybe heart attack", "incident_id": "I3"},
    )

    result = agent.run(state, ctx)
    inc = result.payload["incidents"][0]

    # Rule-based fallback correctly identified medical emergency and flagged vague location
    assert inc.type == IncidentType.medical
    assert inc.needs_confirmation is True
    assert "location" in inc.uncertain_fields

    # Trace confirms fallback was triggered
    assert len(result.traces) >= 1
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True
    assert "fallback" in result.traces[0].step


def test_p2_a1_never_invent_location(monkeypatch):
    """A null or vague location from LLM must never be invented: sets needs_confirmation=True."""
    mock_data = {
        "type": "medical",
        "severity": 3,
        "people_affected": 1,
        "location_label": None,
        "uncertain_fields": ["location"],
        "confidence": 0.8,
    }

    from backend.services.llm import LLMClient, LLMResult
    mock_client = LLMClient()
    monkeypatch.setattr(mock_client, "complete_json", lambda *args, **kwargs: LLMResult(ok=True, data=mock_data, fallback_used=False))

    state = _make_empty_state(clock_min=10)
    agent = AssessmentSubAgent(llm_client=mock_client)
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"free_text": "man collapsed somewhere", "incident_id": "I_NO_LOC"},
    )

    result = agent.run(state, ctx)
    inc = result.payload["incidents"][0]

    assert inc.needs_confirmation is True
    assert "location" in inc.uncertain_fields


def test_p2_t1_scenario_assessment_no_key(monkeypatch):
    """P2-T1: Scenario assessment runs cleanly with no key, falling back to rule parser."""
    import openai
    from backend.services.llm import LLMClient
    
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "")

    client = LLMClient()
    agent = AssessmentSubAgent(llm_client=client)

    # Step 1: I1 medical at t=0
    state0 = _make_empty_state(clock_min=0)
    i1 = Incident(
        id="I1",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.9716, lng=77.5946, label="MG Road Metro"),
        people_affected=2,
        reported_at_min=0,
        status=IncidentStatus.new,
    )
    r1 = agent.run(state0, TriggerContext(kind=TriggerKind.new_incident, payload={"incident": i1}))
    assessed_i1 = r1.payload["incidents"][0]
    assert assessed_i1.status == IncidentStatus.assessed
    assert assessed_i1.priority == 42.0

    # Step 3: I3 free-text report at t=10
    state10 = _make_empty_state(clock_min=10)
    r3 = agent.run(
        state10,
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={"free_text": "man collapsed near the flyover, maybe heart attack", "incident_id": "I3"},
        ),
    )
    assessed_i3 = r3.payload["incidents"][0]
    assert assessed_i3.needs_confirmation is True
    assert "location" in assessed_i3.uncertain_fields
    assert assessed_i3.type == IncidentType.medical
    assert r3.traces[0].used_llm is False
    assert r3.traces[0].fallback_used is True


def test_p2_t1_scenario_assessment_wrong_key(monkeypatch):
    """P2-T1: Scenario assessment runs cleanly with wrong API key (HTTP 401), falling back to rule parser."""
    import httpx
    import openai
    from unittest.mock import MagicMock
    from backend.services.llm import LLMClient

    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "invalid-key-xyz")

    def mock_create(*args, **kwargs):
        response = httpx.Response(status_code=401, request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))
        raise openai.AuthenticationError(message="Invalid API Key", response=response, body={"error": "unauthorized"})

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    agent = AssessmentSubAgent(llm_client=client)

    state10 = _make_empty_state(clock_min=10)
    res = agent.run(
        state10,
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={"free_text": "man collapsed near the flyover, maybe heart attack", "incident_id": "I3"},
        ),
    )
    assessed = res.payload["incidents"][0]
    assert assessed.needs_confirmation is True
    assert "location" in assessed.uncertain_fields
    assert assessed.type == IncidentType.medical
    assert res.traces[0].used_llm is False
    assert res.traces[0].fallback_used is True


def test_p2_t1_scenario_assessment_timeout(monkeypatch):
    """P2-T1: Scenario assessment runs cleanly with 1-second timeout, falling back safely."""
    import httpx
    import openai
    from unittest.mock import MagicMock
    from backend.services.llm import LLMClient

    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "1")

    def mock_create(*args, **kwargs):
        raise openai.APITimeoutError(request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    agent = AssessmentSubAgent(llm_client=client)

    state10 = _make_empty_state(clock_min=10)
    res = agent.run(
        state10,
        TriggerContext(
            kind=TriggerKind.new_incident,
            payload={"free_text": "commercial warehouse fire near Shivajinagar Depot, multiple trapped", "incident_id": "I2"},
        ),
    )
    assessed = res.payload["incidents"][0]
    assert assessed.type == IncidentType.fire
    assert assessed.location.label == "Shivajinagar Depot"
    assert res.traces[0].used_llm is False
    assert res.traces[0].fallback_used is True


