# Agent spec card: What-If
Owner: P3. Copy to `docs/specs/whatif.md`. One page.

## Behavior
- **What it decides:**
  - Evaluates hypothetical emergency scenarios without altering live state.
  - Takes a simulated trigger (e.g., fail resource, new incident, escalate severity) and executes hypothetical impact assessment and allocation.
  - Detects resource conflicts (double-booking or conflicting demands).
  - Determines whether human approval would be required under contract Section 8 rules.
  - Computes plan diff (`from_version` to `to_version`) and compares performance metrics before and after the hypothetical change.
- **What it must never do:**
  - Never mutates live `CrisisState`. Must execute exclusively on an isolated snapshot/copy.
  - Never bypasses approval gate logic when projecting approval necessity.

## Tools
- **Internal:**
  - `CrisisState` snapshot / deep copy mechanism.
  - `ImpactDetector` subagent (`backend.subagents.impact_detector`).
  - `Allocation` subagent (`backend.subagents.allocation`).
  - `diff_plans` and `compute_metrics` (`backend.services.diff`).
  - `approval_gate` evaluation logic (`backend.orchestrator.approval_gate`).
- **External:**
  - None.

## Workflow
1. Receive speculative `TriggerKind` and `payload` (e.g., `resource_failure` with `{"resource_id": "F2"}`).
2. Create an isolated deep copy of `CrisisState`.
3. Capture baseline metrics from `state.current_plan`.
4. Apply the hypothetical event to the cloned state (e.g. set resource status to `unavailable` or add incident).
5. If trigger is `resource_failure`, execute `ImpactDetector` to identify invalidated assignments.
6. Execute `Allocation` on the cloned state to produce the proposed plan.
7. Identify `affected_incidents` (incidents with altered assignments or unmet status) and `affected_resources`.
8. Detect any conflicting assignments (multiple incidents claiming the same resource).
9. Check Section 8 approval criteria (preemption of severity 4-5 incident, critical tier unmet, >= 3 changes).
10. Calculate `diff` using `diff_plans(current_plan, proposed_plan, reasons)`.
11. Calculate `metrics_after` using `compute_metrics(proposed_plan, cloned_state)`.
12. Return `SubAgentResult` / `WhatIfResponse` containing scenario, affected entities, conflicts, approval requirements, proposed plan, diff, and before/after metrics.

## Triggers
- `what_if`

## Logging
- Generates `TraceEntry` records:
  - `agent`: `"whatif"`
  - `step`: `"simulation"`
  - `detail`: Summary of simulated trigger, affected entities, and outcome.
  - `used_llm`: `False`
  - `fallback_used`: `False`
  - `at_min`: `state.clock_min`
