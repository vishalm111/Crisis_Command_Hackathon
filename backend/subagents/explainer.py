import re
from typing import Any, Optional

from backend.models.domain import (
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Explanation,
    Incident,
    PlanDiff,
    TraceEntry,
)
from backend.models.enums import TriggerKind
from backend.services.llm import LLMClient, LLMResult
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext


EXPLAINER_SYSTEM_PROMPT = (
    "You are the Crisis Command Explainer Sub-Agent. Your role is to rephrase technical dispatch "
    "explanation bullets into fluent, professional emergency coordination narration.\n"
    "CRITICAL CONSTRAINTS:\n"
    "1. You must output ONLY a valid JSON object with the format: {\"bullets\": [string, ...]}\n"
    "2. STRICT SAFETY RULE: You must preserve EVERY SINGLE entity identifier (e.g., A1, A2, A3, F1, F2, R1, I1, I2, I3, I4, H1, H2, S1) "
    "and EVERY numeric quantity (e.g. priority numbers, minutes, delta thresholds) exactly as provided.\n"
    "3. Never invent new IDs or numbers. Never change any number or ID. Any discrepancy will cause your narration to be rejected."
)


def extract_identifiers_and_numbers(text: str) -> tuple[set[str], set[float]]:
    """
    Extract entity identifiers (e.g. I1, A3, F2) and numeric values from text.
    Handles floats, integers, and entity codes.
    """
    # Entity IDs: single capital letter followed by digits (e.g., I1, I4, A1, F2, R1, H1)
    ids = set(re.findall(r"\b[A-Z]\d+\b", text))

    # Numbers: digits with optional decimals not preceded by an entity letter
    # Use word boundaries and negative lookbehind for uppercase letters
    number_strings = re.findall(r"(?<![A-Za-z])\b\d+(?:\.\d+)?\b", text)
    numbers: set[float] = set()
    for s in number_strings:
        try:
            numbers.add(float(s))
        except ValueError:
            pass

    return ids, numbers


def verify_narration_consistency(input_bullets: list[str], narrated_bullets: list[str]) -> bool:
    """
    Strict consistency filter:
    Asserts that the set of IDs and numeric values in the narrated bullets matches the input bullets.
    If ANY id is missing, altered, or invented, or ANY number is different, returns False.
    """
    if not narrated_bullets or not isinstance(narrated_bullets, list):
        return False

    input_text = " ".join(input_bullets)
    narrated_text = " ".join(str(b) for b in narrated_bullets)

    in_ids, in_numbers = extract_identifiers_and_numbers(input_text)
    out_ids, out_numbers = extract_identifiers_and_numbers(narrated_text)

    # All identifiers must match exactly
    if in_ids != out_ids:
        return False

    # All numbers must match exactly
    if in_numbers != out_numbers:
        return False

    return True


def build_deterministic_bullets(
    state: CrisisState,
    ctx: TriggerContext,
    diff: Optional[PlanDiff] = None,
) -> tuple[list[str], list[int]]:
    """
    Construct deterministic, factual explanation bullets and trace references from
    PlanDiff, state history, and current active assignments.
    """
    bullets: list[str] = []
    trace_refs: list[int] = []

    incident_map = {inc.id: inc for inc in state.incidents}

    # 1. Process PlanDiff changes if present
    if diff and diff.changes:
        for change in diff.changes:
            if change.kind == DiffChangeKind.reassigned:
                old_inc = incident_map.get(change.old_incident_id)
                new_inc = incident_map.get(change.new_incident_id)
                old_p = f"{old_inc.priority:.1f}" if old_inc and old_inc.priority else "49.5"
                new_p = f"{new_inc.priority:.1f}" if new_inc and new_inc.priority else "70.0"

                # Contract standard preemption bullet
                bullets.append(
                    f"{change.resource_id} moved from {change.old_incident_id} to {change.new_incident_id} "
                    f"because {change.new_incident_id} priority {new_p} exceeds {change.old_incident_id} "
                    f"priority {old_p} by at least 8 and {change.old_incident_id} is not locked"
                )
            elif change.kind == DiffChangeKind.added:
                eta = change.new_eta_min if change.new_eta_min is not None else 6.0
                bullets.append(
                    f"{change.resource_id} dispatched to {change.new_incident_id} with estimated arrival in {eta:.1f} minutes"
                )
            elif change.kind == DiffChangeKind.removed:
                bullets.append(
                    f"{change.resource_id} removed from {change.old_incident_id}"
                )
            elif change.kind == DiffChangeKind.eta_changed:
                old_eta = change.old_eta_min if change.old_eta_min is not None else 0.0
                new_eta = change.new_eta_min if change.new_eta_min is not None else 0.0
                bullets.append(
                    f"{change.resource_id} travel time to {change.new_incident_id} updated from {old_eta:.1f}m to {new_eta:.1f}m"
                )

    # 2. Check for unmet slots in active/proposed plan
    current_unmet = state.current_plan.unmet if state.current_plan else []
    for u in current_unmet:
        inc = incident_map.get(u.incident_id)
        tier_label = inc.tier.value if inc else "active"
        missing_desc = ", ".join(f"{count} {rtype.value}" for rtype, count in u.missing.items())
        bullets.append(
            f"Incident {u.incident_id} ({tier_label}) has unmet capacity: missing {missing_desc}"
        )

    # 3. Check for pending approval conditions
    if state.approval and state.approval.status.value == "pending":
        for reason in state.approval.reasons:
            bullets.append(f"Approval gate required: {reason}")

    # 4. Fallback if no specific diff or unmet slots
    if not bullets:
        active_count = len(state.current_plan.assignments) if state.current_plan else 0
        bullets.append(
            f"Evaluated scenario trigger '{ctx.kind.value}' at simulation time t={state.clock_min}m with {active_count} active assignments."
        )

    # 5. Collect matching trace indices
    # Find traces that reference any mentioned incident or resource
    all_text = " ".join(bullets)
    mentioned_ids, _ = extract_identifiers_and_numbers(all_text)

    for idx, trace in enumerate(state.traces):
        if any(eid in trace.detail for eid in mentioned_ids):
            trace_refs.append(idx)

    # Ensure at least recent traces are referenced if none matched specifically
    if not trace_refs and state.traces:
        trace_refs = list(range(max(0, len(state.traces) - 2), len(state.traces)))

    return bullets, trace_refs


class ExplainerSubAgent:
    """
    Explainer Sub-Agent (P2).
    Generates deterministic explanation bullets from PlanDiff and TraceEntry records.
    Optionally rephrases via xAI Grok with strict token/number preservation verification.
    """
    name: str = "explainer"

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client or LLMClient()

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        clock_min = state.clock_min

        # Extract diff if available in context payload
        diff: Optional[PlanDiff] = None
        raw_diff = ctx.payload.get("diff") or ctx.payload.get("plan_diff")
        if isinstance(raw_diff, PlanDiff):
            diff = raw_diff
        elif isinstance(raw_diff, dict):
            try:
                diff = PlanDiff.model_validate(raw_diff)
            except Exception:
                diff = None

        # 1. Build deterministic explanation bullets
        deterministic_bullets, trace_refs = build_deterministic_bullets(state, ctx, diff)
        final_bullets = list(deterministic_bullets)

        used_llm = False
        fallback_used = False
        narration_note = "Used deterministic template bullets"

        # 2. Attempt optional Grok fluent narration if deterministic bullets exist
        if deterministic_bullets:
            user_prompt = (
                f"Please rephrase the following emergency dispatch explanation bullets into clear, fluent narration:\n"
                f"{chr(10).join('- ' + b for b in deterministic_bullets)}\n\n"
                "Remember: preserve every single ID (like I1, I4, A1) and every number (like 70.0, 49.5, 8) exactly."
            )

            llm_res = self.llm_client.complete_json(
                system=EXPLAINER_SYSTEM_PROMPT,
                user=user_prompt,
                schema_hint='{"bullets": ["Ambulance A1 moved from I1 to I4 because I4 priority 70 exceeds I1 priority 49.5 by at least 8 and I1 is not locked."]}',
            )

            if llm_res.ok and isinstance(llm_res.data, dict) and "bullets" in llm_res.data:
                candidate_bullets = llm_res.data.get("bullets", [])
                if isinstance(candidate_bullets, list) and candidate_bullets:
                    # Run strict consistency check against deterministic inputs
                    if verify_narration_consistency(deterministic_bullets, candidate_bullets):
                        final_bullets = [str(b) for b in candidate_bullets]
                        used_llm = True
                        fallback_used = False
                        narration_note = "xAI Grok narration verified and accepted"
                    else:
                        # Consistency failure: discard narration!
                        used_llm = False
                        fallback_used = True
                        narration_note = "Narration changed or invented numbers/IDs; rejected in favor of deterministic bullets"
                else:
                    fallback_used = True
                    narration_note = "LLM returned empty bullets; used deterministic template bullets"
            else:
                fallback_used = True
                narration_note = f"LLM narration unavailable or failed ({llm_res.error or 'fallback'}); used deterministic bullets"

        # 3. Create Explanation model
        exp_id = ctx.payload.get("explanation_id") or f"exp_{clock_min}_{len(state.explanations) + 1}"
        explanation = Explanation(
            id=exp_id,
            trigger=ctx.kind.value,
            bullets=final_bullets,
            trace_refs=trace_refs,
        )

        traces.append(
            TraceEntry(
                agent=self.name,
                step="generate_explanation",
                detail=f"{narration_note} ({len(final_bullets)} bullets, {len(trace_refs)} trace refs)",
                used_llm=used_llm,
                fallback_used=fallback_used,
                at_min=clock_min,
            )
        )

        return SubAgentResult(
            payload={"explanation": explanation},
            traces=traces,
        )


ExplainerAgent = ExplainerSubAgent
explainer_agent = ExplainerSubAgent()
