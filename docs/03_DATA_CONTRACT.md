# Data contract (DRAFT outline; P1 publishes the real models by 3:00 PM)

This is an entity outline only, so teammates and coding agents share vocabulary. The Pydantic models in `backend/models/` and `contracts/mock_state.json` are the source of truth once published.

- **Incident:** id, type, severity, location (lat/lng), status, required resources, uncertain fields, reported time
- **Resource:** id, type, capabilities, location, status (available, en route, busy, failed), current assignment
- **Assignment:** resource id, incident id, ETA, reason, locked, approved
- **Plan:** assignments, unmet incidents, metrics (response time, coverage, utilization, unresolved)
- **PlanDiff:** per changed assignment, old, new, reason
- **DecisionTrace:** sub-agent, inputs considered, rule or LLM used, outcome, whether fallback was used
- **ApprovalRequest:** proposed change, consequences, status (pending, approved, rejected)
- **Trigger:** new_incident, resource_failure, escalation, time_advance, approval_decision, what_if
- **SubAgent I/O:** every sub-agent takes state plus trigger context and returns result plus trace

Not in this bundle: the priority formula and allocation rules from Part 1. P2 and P3 should add them as `docs/specs/priority_formula.md` and `docs/specs/allocation_rules.md` before the Agent phase.
