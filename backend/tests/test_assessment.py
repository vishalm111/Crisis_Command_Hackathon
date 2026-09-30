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

    # Decision trace logged with used_llm=False
    assert len(result.traces) >= 1
    assert result.traces[0].agent == "assessment"
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is False


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
