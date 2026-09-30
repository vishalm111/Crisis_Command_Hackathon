# P3 actions: Allocation, Impact Detector, What-If

**May edit:** `backend/subagents/allocation.py`, `impact_detector.py`, `whatif.py`, `backend/services/diff.py`, `backend/tests/test_allocation.py`, `test_impact.py`, `test_whatif.py`, `test_diff.py`, `docs/specs/allocation.md`, `impact_detector.md`, `whatif.md`, `allocation_rules.md`, `frontend/src/components/ResourceTable.jsx`, `PlanDiff.jsx`, `WhatIfPanel.jsx`.
**Must not edit:** models, contract, orchestrator, `geo.py` (import it), other sub-agents.
**Branch prefix:** `p3/`.

## Kickoff prompt
> You are working for P3 on Crisis Command. Read AGENTS.md, docs/actions/00_AGENT_PROTOCOL.md, docs/actions/01_SHARED_CONTRACT_V0.md and docs/actions/P3_ACTIONS.md. Execute tasks in order starting with P3-W1. One branch and one PR per task, run Verify, stop after each PR and report. Implement allocation rules v0 from the contract exactly and write a decision trace for every choice. Allocation must be a pure, deterministic function.

## Phase 1: Web (2:00 to 6:00 PM)

### P3-W0: Spec cards (2:00 to 2:45 PM, 30 min)
Branch `p3/specs`. Cards for Allocation, Impact Detector, What-If; `allocation_rules.md` copying contract sections 7 and 8.

### P3-W1: Allocation as a pure function (120 min)
Branch `p3/allocation-core`. File: `subagents/allocation.py`. Depends on: models (P1) and `geo.eta_minutes` (P4). Until `geo.py` merges, define a private fallback haversine in your test file only; import the real one when available.
Steps: `allocate(state, constraints) -> (Plan, list[TraceEntry])` following contract section 7: priority order, nearest eligible by ETA, max-ETA per tier, unmet slots, and (in this task) no preemption yet. Skip incidents with `needs_confirmation`. Ignore `unavailable` resources. Wrap it in the `SubAgent` protocol (`name = "allocation"`). Locked and approved constraints are respected.
Acceptance: deterministic (same input, same output, run twice); unit tests on seed data: single incident gets the nearest ambulance; two incidents share resources without double booking; an ETA over the tier limit becomes unmet.
Verify: `pytest backend/tests/test_allocation.py -q`.

### P3-W2: diff and metrics (60 min)
Branch `p3/diff`. File: `services/diff.py`.
Steps: `diff_plans(old, new, reasons) -> PlanDiff` (added, removed, reassigned, eta_changed; reasons keyed by resource id); `compute_metrics(plan, state) -> PlanMetrics` per contract (avg and max ETA, coverage, utilization, unresolved).
Acceptance: identical plans give an empty diff; coverage is 100 when every required slot is filled; utilization ignores unavailable resources.
Verify: `pytest backend/tests/test_diff.py -q`.

### P3-W3: ResourceTable, PlanDiff, WhatIfPanel on mock data (90 min)
Branch `p3/plan-ui`. Depends on: P4's shell (else standalone with mock import).
Steps: ResourceTable shows each resource (type, status, assignment, ETA) with a status chip that has a text label. PlanDiff renders `PlanDiff.changes` as old to new rows with reasons, and a metrics before and after strip. WhatIfPanel: select a trigger (fail resource, new incident, escalate), pick the target, click Run, call `POST /api/whatif`, show affected incidents and resources, conflicts, whether approval would be required, and metrics before and after. Button disabled while in flight; error text on failure.
Acceptance: renders from mock state and a mock What-If payload; a clear "no changes" empty state.
Verify: `cd frontend && npm run build`.

## Phase 2: Integrate (6:00 to 10:00 PM)

### P3-I1: Allocation v0 in the workflow (30 min)
Branch `p3/allocation-wire`. Confirm the orchestrator registry picks up `allocation.py` instead of the stub and the scenario steps 1 and 2 produce real assignments. Fix contract mismatches by adapting your code, or file a contract request.

### P3-I2: Impact Detector (60 min)
Branch `p3/impact`. File: `subagents/impact_detector.py`.
Steps: given a `resource_failure` trigger, return `invalidated` assignments for that resource with reasons ("A3 unavailable while en route to I4"). Also flag an assignment whose ETA now exceeds its tier limit.
Acceptance: failing A3 in the step-5 state flags exactly the A3 to I4 assignment.
Verify: `pytest backend/tests/test_impact.py -q`.

### P3-I3: What-If skeleton (60 min)
Branch `p3/whatif-skeleton`. File: `subagents/whatif.py`.
Steps: takes a trigger, works on `state.snapshot()` supplied by the orchestrator (never touches live state), runs the flow through the workflow runner, returns the payload from contract section 3 with placeholder conflict and approval fields.
Acceptance: live state is byte-identical before and after a What-If call (assert in a test).

## Phase 3: Agent (10:00 PM to 2:00 AM)

### P3-A1: Preemption and stickiness (90 min)
Branch `p3/preemption`. File: `subagents/allocation.py`.
Steps: add rules 4 and 5 of contract section 7. Preempt from the lowest-priority source incident first; never preempt locked, approved or on-scene assignments; never reassign for less than a 5-minute ETA gain. Every preemption trace states priorities, gap and source incident.
Acceptance: the scenario step 4 outcome (A1 moved from I1 to I4, I1 unmet) and step 5 outcome (A2 proposed from I2, needs approval) come out exactly as the contract says.
Verify: extend `test_allocation.py` with both steps, plus a locked-assignment test that must not change.

### P3-A2: Full What-If (75 min)
Steps: fill `affected_incidents`, `affected_resources`, `conflicts` (from the orchestrator's conflict detector once P1-A1 merges; until then, your own duplicate-resource check), `approval_required` and `reasons` (call `approval_gate.evaluate` from P1; stub until merged), `metrics_before/after`, and `diff`.
Acceptance: scenario step 7 (fail F2) reports I4 affected, a conflict, approval flagged, and different before/after metrics.

### P3-A3: Diff reasons (45 min)
Every changed assignment in a `PlanDiff` carries a reason string built from the allocation traces (rule name, priorities, ETA numbers). No empty reasons.

### P3-A4: Approval trigger alignment (30 min)
Meet P1 (through the human) and confirm contract section 8 triggers with one example each. Record any change in `docs/actions/CONTRACT_REQUESTS.md`.

## Phase 4: Test flow (2:00 to 9:00 AM)
Edge-case matrix, one test each in `test_allocation.py` or `test_whatif.py`:
1. two critical incidents and one ambulance
2. two resources fail at once
3. approve path, reject path (rejected move is not re-proposed)
4. every resource of a type unavailable
5. incident with `needs_confirmation` (must not receive resources)
6. equal priority tie
7. What-If for each trigger kind leaves live state unchanged
8. determinism: 20 repeated runs give identical plans
9 to 11 AM: after every merge run `LLM_ENABLED=false pytest backend/tests -q` and the scenario.

## Definition of done
Web: allocation and diff tested, three panels render. Integrate: scenario steps 1 and 2 real. Agent: steps 4, 5, 7 match the contract.
