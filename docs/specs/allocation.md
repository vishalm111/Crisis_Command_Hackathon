# Agent spec card: Allocation
Owner: P3. Copy to `docs/specs/allocation.md`. One page.

## Behavior
- **What it decides:**
  - Evaluates active incidents in strict priority order (highest score first).
  - For each incident requirement, selects the nearest eligible resource by estimated time of arrival (ETA).
  - Enforces tier max-ETA cutoffs (critical: 15 min, high: 25 min, medium: 40 min, low: 60 min); records unfulfillable requirements in `unmet`.
  - Determines preemption: allows taking an assigned resource from a lower-priority incident only if priority gap >= 8, source incident is not `on_scene`, and assignment is not `locked` or `approved`. Lowest priority source is preempted first.
  - Enforces stickiness: preserves existing valid assignments unless resource becomes unavailable, preemption applies, or a candidate offers an ETA improvement of >= 5 minutes.
  - Produces a deterministic `Plan` (assignments, unmet slots, metrics) and decision traces.
- **What it must never do:**
  - Never mutates shared state directly (pure function, returns a new `Plan`).
  - Never allocates resources to incidents with `needs_confirmation = True`.
  - Never assigns `unavailable` resources.
  - Never preempts `locked`, `approved`, or `on_scene` assignments.
  - Never invents priority scores or ETA values.

## Tools
- **Internal:**
  - `backend.models`: `CrisisState`, `Plan`, `Assignment`, `Unmet`, `Incident`, `Resource`, `TraceEntry`, `Tier`, `ResourceType`, `ResourceStatus`.
  - `backend.services.geo`: `eta_minutes` (distance and road-adjusted ETA function).
  - Tier max ETA definitions.
- **External:**
  - None. Pure deterministic calculation. No LLM dependency.

## Workflow
1. Receive `CrisisState` and optional `TriggerContext` / constraints.
2. Filter active incidents (exclude resolved incidents and those flagged with `needs_confirmation`).
3. Sort incidents by priority descending (tie-breaker: earlier `reported_at_min`, then incident ID).
4. Identify available resources and existing assignments, discarding `unavailable` units.
5. For each incident requirement:
   a. Check free/available resources of matching `ResourceType`.
   b. Identify the candidate with lowest ETA within the incident tier's max ETA threshold.
   c. If no free candidate satisfies the max ETA, check preemptible assignments from lower-priority incidents (gap >= 8, lowest source priority first, not locked/approved/on-scene).
   d. Apply stickiness check: retain current assignment unless ETA improves by >= 5 minutes or unit was preempted/failed.
   e. If no eligible candidate exists, record missing requirement in `unmet`.
   f. Record detailed `TraceEntry` for every decision (candidates evaluated, winner chosen, rule applied).
6. Construct new `Plan` object with updated assignments, unmet slots, and metrics.
7. Return `SubAgentResult(payload={"plan": plan}, traces=traces)`.

## Triggers
- `new_incident`
- `resource_failure`
- `resource_restored`
- `escalation`
- `time_advance`
- `approval_decision`
- `what_if`

## Logging
- Generates `TraceEntry` records:
  - `agent`: `"allocation"`
  - `step`: `"candidate_evaluation"`, `"assignment"`, `"preemption"`, `"unmet"`
  - `detail`: incident ID, resource ID, ETA, priority differential, rule applied, and rationale.
  - `used_llm`: `False`
  - `fallback_used`: `False`
  - `at_min`: `state.clock_min`
