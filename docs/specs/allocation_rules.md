# Allocation and Approval Rules (Contract Sections 7 & 8)

Source: `docs/actions/01_SHARED_CONTRACT_V0.md`

## Section 7: Allocation rules v0

1. **Priority Order:** Process incidents in priority order (highest first).
   - Tie-breaking: earlier `reported_at_min`, then alphabetical `id`.
   - Skip incidents with `needs_confirmation = True`.
2. **Nearest Eligible Resource:** For each required resource type and count, choose the nearest eligible resource by ETA.
   - Eligible = `available`, or currently assigned but preemptible (rule 4).
   - Among free candidates, prefer the smallest ETA (tie-break by resource id).
   - Only if no free candidate exists within acceptable limits, evaluate preemption, taking from the lowest-priority source incident first, then smallest ETA.
3. **Max ETA Threshold:** A resource that would exceed the incident's max ETA is not eligible; if no eligible resource exists, record the slot in `unmet`.
   - Critical: 15 min
   - High: 25 min
   - Medium: 40 min
   - Low: 60 min
4. **Preemption Rule:** A resource assigned to incident B may be taken for incident A only if:
   - `A.priority - B.priority >= 8`
   - The assignment is not `locked` or `approved`
   - B is not `on_scene`
   - Preemption chooses the lowest-priority source incident first.
5. **Stickiness Rule:** Keep an existing assignment unless:
   - The resource became `unavailable`
   - Rule 4 (preemption) applies
   - An alternative candidate improves ETA by at least 5 minutes.
6. **Trace Logging:** Every choice writes a `TraceEntry` with candidates considered, the winner, and the rule applied.

---

## Section 8: Approval gate v0

A proposed plan needs human approval if any of these hold:
- It preempts a resource from an incident with severity 4 or 5.
- It leaves a `critical` tier incident with any `unmet` slot.
- It changes 3 or more assignments compared with the current plan.
- It includes an incident with `needs_confirmation = true` that would receive resources.

Otherwise the orchestrator commits the plan automatically and logs it.
