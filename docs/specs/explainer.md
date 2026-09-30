# Agent spec card: Explainer
Owner: P2. One page.

## Behavior
- **What it decides:**
  - Translates machine decision traces (`TraceEntry`) and plan modifications (`PlanDiff`) into concise, human-understandable explanation bullets.
  - Clarifies why specific assignments, preemptions, or re-routings occurred (e.g., *"A1 reassigned from I1 to I4 because I4 priority 70.0 exceeds I1 priority 49.5 by at least 8.0 and I1 is not on-scene"*).
  - Explicitly states why approval gates were triggered (e.g., preemption from a severity 4/5 incident or unmet critical slot).
  - References source trace indices (`trace_refs`) for every bullet so operators can inspect raw audit data.
  - Optionally uses xAI Grok to narrate bullets more fluently, subject to strict deterministic verification.
- **What it must never do:**
  - Must never mutate crisis state or modify assignments.
  - Must never contradict the underlying decision traces.
  - Must never accept an LLM narration that invents, alters, or drops any entity ID (`I1`, `A3`, `F2`) or numeric quantity (priority scores, ETAs, casualty counts). Any discrepancy triggers immediate rejection of LLM narration in favor of deterministic template bullets.
  - Must never fail or block dispatch when the LLM is disabled or unavailable.

## Tools
- **Internal:**
  - Pydantic models: `Explanation`, `TraceEntry`, `PlanDiff`, `DiffChange`, `CrisisState`.
  - Token/identifier regex verifier: extracts and verifies consistency of numbers and IDs between input bullets and LLM output.
- **External:**
  - `services/llm.py`: `LLMClient.complete_json` for optional fluent narration.
  - Fallback: deterministic bullet template engine.

## Workflow
1. **Receive Trigger:** Orchestrator calls Explainer with `TriggerContext`, current `CrisisState`, and latest `PlanDiff`.
2. **Build Deterministic Bullets:**
   - Scan `PlanDiff.changes`:
     - `reassigned`: format rationale stating resource, source incident, target incident, priority delta, and non-locked status.
     - `added`: format assignment rationale stating resource, destination incident, ETA, and priority.
     - `removed` / `unmet`: format reason for unmet need or resource loss.
   - Attach index references (`trace_refs`) pointing to corresponding entries in `state.traces`.
3. **Optional LLM Narration:**
   - If `LLM_ENABLED=true` and API key is present:
     - Request Grok to polish bullets for executive fluency while explicitly preserving every number and ID.
     - Run verification filter: assert set of IDs and numbers in the output matches the input. If invalid, discard narration.
   - If `LLM_ENABLED=false` or verification fails: use deterministic bullets directly.
4. **Trace Generation:** Record `TraceEntry` with `agent="explainer"`, detailing explanation ID, bullet count, and whether narration was accepted or rejected.
5. **Return Result:** Return `SubAgentResult(payload={"explanation": Explanation(...) }, traces=[...])`.

## Triggers
- `new_incident`, `resource_failure`, `resource_restored`, `escalation`, `approval_decision`, `what_if`: Evaluated on any event that produces or alters a dispatch plan.

## Logging
- **Trace Entry (`TraceEntry`):**
  - `agent`: `"explainer"`
  - `step`: `"generate_explanation"`
  - `detail`: Summary of bullets generated, count of trace references, and verification status of narration
  - `used_llm`: `true` if Grok narration was successfully verified and adopted; `false` otherwise
  - `fallback_used`: `true` if deterministic templates were used
  - `at_min`: Simulation clock minute
- **Audit:** All explanations are permanently appended to `state.explanations` for incident retrospective analysis.
