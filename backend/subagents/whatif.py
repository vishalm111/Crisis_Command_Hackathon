from backend.subagents.base import SubAgent, TriggerContext, SubAgentResult
from backend.models import CrisisState, TraceEntry, TriggerKind, PlanDiff, DiffChange, DiffChangeKind, PlanMetrics

class WhatIfAgent(SubAgent):
    name = "what_if"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        # What-If logic: mock implementation according to P3-I3
        target_res_id = ctx.payload.get("resource_id", "F2")
        affected_incidents = [asg.incident_id for asg in state.current_plan.assignments if asg.resource_id == target_res_id] if state.current_plan else []
        if not affected_incidents and state.incidents:
            affected_incidents = [state.incidents[0].id]

        conflicts = [f"What-If: Resource {target_res_id} simulated offline affecting {', '.join(affected_incidents)}"]
        
        diff = PlanDiff(
            from_version=state.current_plan.version if state.current_plan else 0,
            to_version=(state.current_plan.version + 1) if state.current_plan else 1,
            changes=[
                DiffChange(
                    resource_id=target_res_id,
                    kind=DiffChangeKind.removed,
                    old_incident_id=affected_incidents[0] if affected_incidents else None,
                    new_incident_id=None,
                    reason=f"Simulated failure of {target_res_id}",
                )
            ],
        )

        before_metrics = state.current_plan.metrics if state.current_plan else PlanMetrics(avg_eta_min=0, max_eta_min=0, coverage_pct=0, utilization_pct=0, unresolved_count=0)
        after_metrics = PlanMetrics(
            avg_eta_min=before_metrics.avg_eta_min + 1.5,
            max_eta_min=before_metrics.max_eta_min,
            coverage_pct=max(0.0, before_metrics.coverage_pct - 15.0),
            utilization_pct=before_metrics.utilization_pct,
            unresolved_count=before_metrics.unresolved_count + 1,
        )

        payload = {
            "scenario": {"kind": ctx.kind.value, "payload": ctx.payload},
            "affected_incidents": affected_incidents,
            "affected_resources": [target_res_id],
            "conflicts": conflicts,
            "approval_required": True,
            "reasons": [f"Simulated failure of unit {target_res_id} triggers human oversight gate"],
            "proposed_plan": state.current_plan,
            "diff": diff,
            "metrics_before": before_metrics,
            "metrics_after": after_metrics,
        }

        trace = TraceEntry(
            agent=self.name,
            step="simulate_whatif",
            detail=f"Completed What-If simulation for {ctx.kind.value}",
            used_llm=False,
            fallback_used=False,
            at_min=state.clock_min,
        )

        return SubAgentResult(
            payload=payload,
            traces=[trace],
        )
