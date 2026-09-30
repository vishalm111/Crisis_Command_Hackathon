"""What-If simulation subagent (Contract Section 3, 8 & P3).

Simulates hypothetical emergency scenarios (e.g. resource failure, new incident, escalation)
strictly on an isolated snapshot.
CRITICAL HARD RULE: Running What-If MUST NOT mutate live CrisisState.
"""

from typing import Any, Optional
from backend.models.domain import (
    CrisisState,
    Incident,
    Plan,
    PlanDiff,
    PlanMetrics,
    TraceEntry,
)
from backend.models.enums import (
    IncidentStatus,
    ResourceStatus,
    TriggerKind,
)
from backend.orchestrator.approval_gate import evaluate
from backend.orchestrator.orchestrator import detect_and_resolve_conflicts
from backend.services.diff import compute_metrics, diff_plans
from backend.subagents.allocation import allocate
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext
from backend.subagents.impact_detector import ImpactDetectorAgent
from backend.subagents.logistics import LogisticsAgent


class WhatIfAgent(SubAgent):
    """What-If scenario simulation agent."""

    name: str = "what_if"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        clock_min = state.clock_min

        # 1. Isolated deep snapshot of CrisisState - Never mutate live state
        snap = CrisisState.model_validate_json(state.model_dump_json())
        baseline_plan = snap.current_plan or Plan(id="plan_0", version=0)
        metrics_before = baseline_plan.metrics

        sim_kind = ctx.kind
        payload = ctx.payload or {}
        scenario_desc = {"kind": sim_kind.value, "payload": payload}

        affected_resources: set[str] = set()
        affected_incidents: set[str] = set()
        conflicts: list[str] = []

        # 2. Apply hypothetical event to the snapshot
        if sim_kind == TriggerKind.resource_failure or "resource_id" in payload and payload.get("status") == "unavailable":
            target_res_id = payload.get("resource_id", "F2")
            affected_resources.add(target_res_id)
            for r in snap.resources:
                if r.id == target_res_id:
                    r.status = ResourceStatus.unavailable
                    break

            # Execute Impact Detector to find invalidated assignments
            detector = ImpactDetectorAgent()
            impact_res = detector.run(snap, TriggerContext(kind=TriggerKind.resource_failure, payload={"resource_id": target_res_id}))
            traces.extend(impact_res.traces)
            for inv in impact_res.payload.get("invalidated", []):
                affected_incidents.add(inv["incident_id"])
                conflicts.append(inv["reason"])

        elif sim_kind == TriggerKind.resource_restored:
            target_res_id = payload.get("resource_id", "A1")
            affected_resources.add(target_res_id)
            for r in snap.resources:
                if r.id == target_res_id:
                    r.status = ResourceStatus.available
                    break

        elif sim_kind == TriggerKind.new_incident:
            raw_inc = payload.get("incident")
            if isinstance(raw_inc, dict):
                inc = Incident.model_validate(raw_inc)
            elif isinstance(raw_inc, Incident):
                inc = raw_inc
            else:
                inc = None

            if inc:
                affected_incidents.add(inc.id)
                # Replace or append in snapshot
                snap.incidents = [i for i in snap.incidents if i.id != inc.id] + [inc]

        elif sim_kind == TriggerKind.escalation:
            inc_id = payload.get("incident_id")
            new_sev = payload.get("severity", 5)
            if inc_id:
                affected_incidents.add(inc_id)
                for inc in snap.incidents:
                    if inc.id == inc_id:
                        inc.severity = new_sev
                        # Re-calculate priority score
                        inc.priority = round(inc.severity * 10.0 + min(inc.people_affected, 20) + 10.0, 2)
                        break

        elif sim_kind == TriggerKind.time_advance:
            minutes = payload.get("minutes", 5)
            snap.clock_min += minutes

        # 3. Execute Allocation on snapshot
        sim_plan, alloc_traces = allocate(snap, constraints=snap.constraints)
        traces.extend(alloc_traces)

        # 4. Refine logistics on snapshot
        snap.proposed_plan = sim_plan
        logistics_agent = LogisticsAgent()
        log_res = logistics_agent.run(snap, ctx)
        traces.extend(log_res.traces)
        if "assignments" in log_res.payload and log_res.payload["assignments"]:
            sim_plan.assignments = log_res.payload["assignments"]

        # 5. Detect and resolve conflicts
        sim_plan, conflict_traces = detect_and_resolve_conflicts(sim_plan, snap)
        traces.extend(conflict_traces)
        for ct in conflict_traces:
            conflicts.append(ct.detail)

        # 6. Evaluate approval gate requirements
        gate_decision = evaluate(baseline_plan, sim_plan, snap)

        # 7. Compute PlanDiff and performance metrics
        diff = diff_plans(baseline_plan, sim_plan)
        metrics_after = compute_metrics(sim_plan, snap)
        sim_plan.metrics = metrics_after

        # 8. Identify all affected entities from the diff
        for change in diff.changes:
            affected_resources.add(change.resource_id)
            if change.old_incident_id:
                affected_incidents.add(change.old_incident_id)
            if change.new_incident_id:
                affected_incidents.add(change.new_incident_id)

        # In case no incidents were affected from changes, check newly unmet
        for u in sim_plan.unmet:
            if any(v > 0 for v in u.missing.values()):
                affected_incidents.add(u.incident_id)

        traces.append(
            TraceEntry(
                agent=self.name,
                step="simulation",
                detail=(
                    f"What-If simulation of {sim_kind.value} completed: "
                    f"{len(diff.changes)} plan changes, approval_required={gate_decision.required}"
                ),
                used_llm=False,
                fallback_used=False,
                at_min=clock_min,
            )
        )

        whatif_payload = {
            "scenario": scenario_desc,
            "affected_incidents": sorted(list(affected_incidents)),
            "affected_resources": sorted(list(affected_resources)),
            "conflicts": conflicts,
            "approval_required": gate_decision.required,
            "reasons": gate_decision.reasons if gate_decision.required else ["Within normal autonomous operating bounds"],
            "approval_reasons": gate_decision.reasons if gate_decision.required else ["Within normal autonomous operating bounds"],
            "proposed_plan": sim_plan,
            "diff": diff,
            "metrics_before": metrics_before,
            "metrics_after": metrics_after,
        }

        return SubAgentResult(
            payload=whatif_payload,
            traces=traces,
        )


# Backward-compatible alias
WhatIfSubAgent = WhatIfAgent
whatif_agent = WhatIfAgent()
