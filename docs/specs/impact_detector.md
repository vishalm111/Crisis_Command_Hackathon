# Agent spec card: Impact Detector
Owner: P3. Copy to `docs/specs/impact_detector.md`. One page.

## Behavior
- **What it decides:**
  - Identifies which active assignments in the current plan are invalidated when a resource fails or condition changes.
  - Generates clear, human-readable reasons explaining why each assignment was invalidated (e.g., "A3 unavailable while en route to I4").
  - Identifies assignments whose ETA now exceeds the incident tier's maximum acceptable ETA cutoff.
- **What it must never do:**
  - Never mutates shared state directly.
  - Never performs reassignments or replaces resources (that is the role of Allocation).
  - Never modifies incident definitions or statuses.

## Tools
- **Internal:**
  - `backend.models`: `CrisisState`, `Plan`, `Assignment`, `Resource`, `TraceEntry`, `TriggerKind`.
  - `backend.services.geo`: `eta_minutes` (for validating travel times).
  - Tier max ETA definitions.
- **External:**
  - None. Pure deterministic calculation. No LLM dependency.

## Workflow
1. Receive `CrisisState` and `TriggerContext`.
2. Inspect trigger type and payload (specifically `resource_failure` or updated conditions).
3. If trigger is `resource_failure`, extract failed resource ID from payload.
4. Scan current plan assignments for references to the failed resource.
5. For each matching assignment:
   - Mark assignment as invalidated.
   - Compose detailed explanation (e.g., `"{resource_id} unavailable while en route to {incident_id}"`).
6. Check remaining assignments to verify whether any assignment exceeds tier max ETA.
7. Record `TraceEntry` for each invalidated assignment.
8. Return `SubAgentResult(payload={"invalidated": [{"assignment_id": str, "reason": str}]}, traces=traces)`.

## Triggers
- `resource_failure`
- `time_advance`

## Logging
- Generates `TraceEntry` records:
  - `agent`: `"impact_detector"`
  - `step`: `"invalidation"`
  - `detail`: Description of affected assignment ID, resource ID, incident ID, and cause.
  - `used_llm`: `False`
  - `fallback_used`: `False`
  - `at_min`: `state.clock_min`
