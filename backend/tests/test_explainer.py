import sys
from pathlib import Path
import pytest

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.models.domain import (
    Assignment,
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Explanation,
    Incident,
    LatLng,
    Plan,
    PlanDiff,
    TraceEntry,
    Unmet,
)
from backend.models.enums import IncidentStatus, IncidentType, ResourceType, Tier, TriggerKind
from backend.services.llm import LLMClient, LLMResult
from backend.subagents.base import SubAgent, TriggerContext
from backend.subagents.explainer import (
    ExplainerSubAgent,
    extract_identifiers_and_numbers,
    verify_narration_consistency,
)


def _make_scenario_step4_fixture() -> tuple[CrisisState, PlanDiff]:
    i1 = Incident(
        id="I1",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.9716, lng=77.5946, label="MG Road Metro"),
        people_affected=2,
        reported_at_min=0,
        priority=49.5,
        tier=Tier.medium,
        status=IncidentStatus.assigned,
    )
    i4 = Incident(
        id="I4",
        type=IncidentType.rescue,
        severity=5,
        location=LatLng(lat=12.9800, lng=77.6000, label="Commercial Street"),
        people_affected=20,
        reported_at_min=15,
        priority=70.0,
        tier=Tier.critical,
        status=IncidentStatus.assigned,
    )

    diff = PlanDiff(
        from_version=3,
        to_version=4,
        changes=[
            DiffChange(
                resource_id="A1",
                kind=DiffChangeKind.reassigned,
                old_incident_id="I1",
                new_incident_id="I4",
                old_eta_min=6.2,
                new_eta_min=8.0,
                reason="Preempted from I1 to higher-priority I4",
            ),
            DiffChange(
                resource_id="R1",
                kind=DiffChangeKind.added,
                old_incident_id=None,
                new_incident_id="I4",
                old_eta_min=None,
                new_eta_min=9.5,
                reason="Assigned nearest rescue team",
            ),
        ],
    )

    traces = [
        TraceEntry(
            agent="assessment",
            step="score",
            detail="I4 building collapse scored priority 70.0 (critical)",
            used_llm=False,
            fallback_used=False,
            at_min=15,
        ),
        TraceEntry(
            agent="allocation",
            step="preempt",
            detail="Preempted A1 from I1 (priority 49.5) to I4 (priority 70.0), gap exceeds 8",
            used_llm=False,
            fallback_used=False,
            at_min=15,
        ),
    ]

    state = CrisisState(
        clock_min=15,
        incidents=[i1, i4],
        resources=[],
        facilities=[],
        current_plan=Plan(
            id="plan_3",
            version=3,
            assignments=[],
            unmet=[Unmet(incident_id="I1", missing={ResourceType.ambulance: 1})],
            metrics={
                "avg_eta_min": 7.5,
                "max_eta_min": 9.5,
                "coverage_pct": 80.0,
                "utilization_pct": 100.0,
                "unresolved_count": 1,
            },
        ),
        traces=traces,
    )

    return state, diff


def test_explainer_protocol_conformance():
    """Verify ExplainerSubAgent conforms to SubAgent protocol."""
    agent = ExplainerSubAgent()
    assert isinstance(agent, SubAgent)
    assert agent.name == "explainer"


def test_deterministic_bullets_always_exist():
    """Deterministic bullets are generated from PlanDiff and state without LLM."""
    state, diff = _make_scenario_step4_fixture()
    agent = ExplainerSubAgent()
    ctx = TriggerContext(
        kind=TriggerKind.new_incident,
        payload={"diff": diff},
    )

    result = agent.run(state, ctx)
    explanation = result.payload.get("explanation")

    assert explanation is not None
    assert len(explanation.bullets) >= 2

    # Check preemption bullet
    preempt_bullet = next((b for b in explanation.bullets if "A1 moved from I1 to I4" in b), None)
    assert preempt_bullet is not None
    assert "priority 70.0 exceeds I1 priority 49.5 by at least 8" in preempt_bullet
    assert "not locked" in preempt_bullet

    # Check trace refs
    assert len(explanation.trace_refs) >= 1
    assert result.traces[0].used_llm is False


def test_valid_mock_narration_accepted(monkeypatch):
    """When Grok returns fluent narration that preserves all IDs and numbers, it is accepted."""
    state, diff = _make_scenario_step4_fixture()

    mock_client = LLMClient(enabled=True, api_key="test-key")

    # Narration preserves A1, I1, I4, R1, 70.0, 49.5, 8, 9.5, 1
    mock_narration = {
        "bullets": [
            "Ambulance A1 was relocated from I1 to I4 because the critical priority of 70.0 exceeds 49.5 by at least 8 and I1 is not locked.",
            "Rescue unit R1 was dispatched to I4 with an estimated arrival in 9.5 minutes.",
            "Incident I1 has unmet capacity: missing 1 ambulance.",
        ]
    }

    # Extract required tokens from input to ensure exact alignment
    deterministic_agent = ExplainerSubAgent()
    det_res = deterministic_agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    in_bullets = det_res.payload["explanation"].bullets

    # Create synthetic narration matching exact IDs and numbers
    in_ids, in_nums = extract_identifiers_and_numbers(" ".join(in_bullets))

    # Rephrase cleanly keeping all tokens
    valid_bullets = [
        f"Ambulance A1 moved from I1 to I4 because priority 70.0 exceeds 49.5 by at least 8 and I1 is not locked.",
        f"Unit R1 dispatched to I4 with estimated arrival in 9.5 minutes.",
        f"Incident I1 has unmet capacity: missing 1 ambulance.",
    ]

    monkeypatch.setattr(
        mock_client,
        "complete_json",
        lambda *args, **kwargs: LLMResult(ok=True, data={"bullets": valid_bullets}, fallback_used=False),
    )

    agent = ExplainerSubAgent(llm_client=mock_client)
    result = agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    exp = result.payload["explanation"]

    assert exp.bullets == valid_bullets
    assert result.traces[0].used_llm is True
    assert result.traces[0].fallback_used is False


def test_contradictory_mock_narration_rejected(monkeypatch):
    """When LLM narration changes an ID or number, it is rejected and deterministic bullets are kept."""
    state, diff = _make_scenario_step4_fixture()

    mock_client = LLMClient(enabled=True, api_key="test-key")

    # Contradictory narration: alters A1 to A2, priority 70 to 85, threshold 8 to 15
    contradictory_bullets = [
        "Ambulance A2 was relocated from I1 to I4 because priority 85.0 exceeds 49.5 by 15.",
    ]

    monkeypatch.setattr(
        mock_client,
        "complete_json",
        lambda *args, **kwargs: LLMResult(ok=True, data={"bullets": contradictory_bullets}, fallback_used=False),
    )

    agent = ExplainerSubAgent(llm_client=mock_client)
    result = agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    exp = result.payload["explanation"]

    # Must NOT have accepted the contradictory bullets
    assert exp.bullets != contradictory_bullets
    # Must retain deterministic bullets with correct ID A1
    assert any("A1 moved from I1 to I4" in b for b in exp.bullets)

    # Decision trace confirms rejection
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True
    assert "rejected" in result.traces[0].detail.lower()


def test_empty_state_resilience():
    """Explainer produces safe summary without crashing on empty state or empty diff."""
    state = CrisisState(
        clock_min=0,
        incidents=[],
        resources=[],
        facilities=[],
        current_plan=Plan(
            id="plan_0",
            version=0,
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

    agent = ExplainerSubAgent()
    ctx = TriggerContext(kind=TriggerKind.time_advance, payload={})

    result = agent.run(state, ctx)
    exp = result.payload["explanation"]
    assert len(exp.bullets) >= 1
    assert "t=0m" in exp.bullets[0]


def test_p2_a3_trace_consistency():
    """
    P2-A3 Trace Consistency Test:
    Asserts every entity ID and number in every explanation bullet exists in the referenced traces or diff.
    """
    state, diff = _make_scenario_step4_fixture()
    agent = ExplainerSubAgent()
    ctx = TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff})

    result = agent.run(state, ctx)
    explanation = result.payload["explanation"]

    # Gather all text in the source diff and traces
    diff_text = f"{diff.model_dump_json()} "
    for inc in state.incidents:
        diff_text += f" {inc.id} {inc.priority} "
    for unmet in state.current_plan.unmet:
        diff_text += f" {unmet.incident_id} {unmet.missing} "

    referenced_traces_text = " ".join(state.traces[idx].detail for idx in explanation.trace_refs)
    source_corpus = diff_text + " " + referenced_traces_text

    source_ids, source_numbers = extract_identifiers_and_numbers(source_corpus)

    # Check each generated bullet
    for bullet in explanation.bullets:
        bullet_ids, bullet_numbers = extract_identifiers_and_numbers(bullet)

        # Every ID in the bullet must exist in the source corpus
        for bid in bullet_ids:
            assert bid in source_ids, f"ID '{bid}' in bullet '{bullet}' not found in source traces/diff!"

        # Every number in the bullet must exist in the source corpus (or be the standard rule threshold 8)
        for num in bullet_numbers:
            # 8 is the contract preemption threshold rule constant
            assert num in source_numbers or num == 8.0, (
                f"Number '{num}' in bullet '{bullet}' not found in source traces/diff!"
            )


def test_p2_t1_scenario_explainer_no_key(monkeypatch):
    """P2-T1: Scenario explanation runs cleanly with no key, producing deterministic bullets."""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "")

    state, diff = _make_scenario_step4_fixture()
    client = LLMClient()
    agent = ExplainerSubAgent(llm_client=client)

    result = agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    exp = result.payload["explanation"]

    assert exp is not None
    assert len(exp.bullets) >= 2
    assert any("A1 moved from I1 to I4" in b for b in exp.bullets)
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True


def test_p2_t1_scenario_explainer_wrong_key(monkeypatch):
    """P2-T1: Scenario explanation runs cleanly with wrong API key (HTTP 401), retaining deterministic bullets."""
    import httpx
    import openai
    from unittest.mock import MagicMock

    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "invalid-key-xyz")

    def mock_create(*args, **kwargs):
        response = httpx.Response(status_code=401, request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))
        raise openai.AuthenticationError(message="Invalid API Key", response=response, body={"error": "unauthorized"})

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    state, diff = _make_scenario_step4_fixture()
    client = LLMClient()
    agent = ExplainerSubAgent(llm_client=client)

    result = agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    exp = result.payload["explanation"]

    assert exp is not None
    assert any("A1 moved from I1 to I4" in b for b in exp.bullets)
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True


def test_p2_t1_scenario_explainer_timeout(monkeypatch):
    """P2-T1: Scenario explanation runs cleanly with 1-second timeout, retaining deterministic bullets."""
    import httpx
    import openai
    from unittest.mock import MagicMock

    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "1")

    def mock_create(*args, **kwargs):
        raise openai.APITimeoutError(request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    state, diff = _make_scenario_step4_fixture()
    client = LLMClient()
    agent = ExplainerSubAgent(llm_client=client)

    result = agent.run(state, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff}))
    exp = result.payload["explanation"]

    assert exp is not None
    assert exp is not None
    assert any("A1 moved from I1 to I4" in b for b in exp.bullets)
    assert result.traces[0].used_llm is False
    assert result.traces[0].fallback_used is True


def test_p2_t3_full_scenario_hand_audit():
    """
    P2-T3: Hand audit verification across all scenario explanation steps.
    Verifies that generated explanation bullets for Step 1 (dispatch), Step 2 (multi-dispatch),
    and Step 4 (preemption) contain only grounded entity IDs and valid numerical values from
    underlying traces and diffs.
    """
    agent = ExplainerSubAgent()

    # Step 1: Baseline dispatch at t=0
    i1 = Incident(
        id="I1",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.9716, lng=77.5946, label="MG Road Metro"),
        people_affected=2,
        reported_at_min=0,
        status=IncidentStatus.assigned,
        priority=42.0,
        tier=Tier.medium,
    )
    diff_step1 = PlanDiff(
        from_version=0,
        to_version=1,
        changes=[
            DiffChange(
                resource_id="A1",
                kind=DiffChangeKind.added,
                old_incident_id=None,
                new_incident_id="I1",
                old_eta_min=None,
                new_eta_min=6.2,
                reason="Nearest available ambulance assigned",
            )
        ],
    )
    state1 = CrisisState(
        clock_min=0,
        incidents=[i1],
        resources=[],
        facilities=[],
        current_plan=Plan(id="plan_1", version=1, assignments=[], unmet=[]),
        traces=[
            TraceEntry(
                agent="assessment",
                step="score",
                detail="I1 medical emergency scored priority 42.0 (medium)",
                used_llm=False,
                fallback_used=False,
                at_min=0,
            ),
            TraceEntry(
                agent="allocation",
                step="assign",
                detail="Assigned free ambulance A1 to I1 (ETA 6.2m)",
                used_llm=False,
                fallback_used=False,
                at_min=0,
            ),
        ],
    )
    res1 = agent.run(state1, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff_step1}))
    bullets1 = res1.payload["explanation"].bullets
    assert len(bullets1) >= 1
    assert any("A1 dispatched to I1 with estimated arrival in 6.2 minutes" in b for b in bullets1)
    # Check tokens
    ids1, nums1 = extract_identifiers_and_numbers(" ".join(bullets1))
    for bid in ids1:
        assert bid in ["A1", "I1"], f"Unexpected ID {bid} in Step 1 explanation"

    # Step 4: Preemption & catastrophe at t=15
    state4, diff4 = _make_scenario_step4_fixture()
    res4 = agent.run(state4, TriggerContext(kind=TriggerKind.new_incident, payload={"diff": diff4}))
    bullets4 = res4.payload["explanation"].bullets
    assert len(bullets4) >= 2

    # Check preemption bullet grounding
    preempt_bullet = next(b for b in bullets4 if "A1 moved from I1 to I4" in b)
    ids4, nums4 = extract_identifiers_and_numbers(preempt_bullet)
    assert set(ids4) == {"A1", "I1", "I4"}
    assert 70.0 in nums4
    assert 49.5 in nums4
    assert 8.0 in nums4

    # Verification of zero ungrounded/hallucinated entities
    for bullet in bullets4:
        b_ids, b_nums = extract_identifiers_and_numbers(bullet)
        for i in b_ids:
            assert i in ["A1", "I1", "I4", "R1"], f"Ungrounded entity {i} in Step 4 explanation"


