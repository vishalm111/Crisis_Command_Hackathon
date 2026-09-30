"""Impact Detector subagent (P3).

Identifies which active assignments in the current plan are invalidated
when a resource fails or operational conditions change. Pure deterministic calculation.
"""

from typing import Optional
from backend.models.domain import CrisisState, TraceEntry
from backend.models.enums import ResourceStatus, Tier, TriggerKind
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext

TIER_MAX_ETA: dict[Tier, float] = {
    Tier.critical: 15.0,
    Tier.high: 25.0,
    Tier.medium: 40.0,
    Tier.low: 60.0,
}


class ImpactDetectorAgent(SubAgent):
    """Subagent responsible for detecting impacted assignments upon failures or time advance."""

    name: str = "impact_detector"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        invalidated: list[dict[str, str]] = []
        clock_min = state.clock_min

        if not state.current_plan or not state.current_plan.assignments:
            trace = TraceEntry(
                agent=self.name,
                step="impact_check",
                detail=f"Evaluated impact for trigger {ctx.kind.value}: no active plan assignments to invalidate",
                used_llm=False,
                fallback_used=False,
                at_min=clock_min,
            )
            return SubAgentResult(payload={"invalidated": []}, traces=[trace])

        failed_resource_id = ctx.payload.get("resource_id") if ctx.payload else None
        
        # Set of resource IDs that are failed or marked unavailable
        failed_ids = set()
        if failed_resource_id:
            failed_ids.add(failed_resource_id)
        for r in state.resources:
            if r.status == ResourceStatus.unavailable:
                failed_ids.add(r.id)

        incident_map = {inc.id: inc for inc in state.incidents}

        for asg in state.current_plan.assignments:
            # 1. Check if assignment uses a failed / unavailable resource
            if asg.resource_id in failed_ids:
                reason = f"Unit {asg.resource_id} unavailable while assigned to incident {asg.incident_id}"
                invalidated.append({
                    "assignment_id": asg.id,
                    "resource_id": asg.resource_id,
                    "incident_id": asg.incident_id,
                    "reason": reason,
                })
                traces.append(
                    TraceEntry(
                        agent=self.name,
                        step="invalidation",
                        detail=f"Assignment {asg.id} invalidated: {reason}",
                        used_llm=False,
                        fallback_used=False,
                        at_min=clock_min,
                    )
                )
                continue

            # 2. Check if assignment ETA now exceeds incident tier max ETA
            inc = incident_map.get(asg.incident_id)
            if inc:
                max_eta = TIER_MAX_ETA.get(inc.tier, 60.0)
                if asg.eta_min > max_eta:
                    reason = (
                        f"Unit {asg.resource_id} ETA ({asg.eta_min:.1f}m) exceeds "
                        f"{inc.tier.value} tier maximum threshold ({max_eta:.1f}m) for {inc.id}"
                    )
                    invalidated.append({
                        "assignment_id": asg.id,
                        "resource_id": asg.resource_id,
                        "incident_id": asg.incident_id,
                        "reason": reason,
                    })
                    traces.append(
                        TraceEntry(
                            agent=self.name,
                            step="invalidation",
                            detail=f"Assignment {asg.id} invalidated: {reason}",
                            used_llm=False,
                            fallback_used=False,
                            at_min=clock_min,
                        )
                    )

        if not traces:
            traces.append(
                TraceEntry(
                    agent=self.name,
                    step="impact_check",
                    detail=f"Evaluated impact for trigger {ctx.kind.value}: no active assignments invalidated",
                    used_llm=False,
                    fallback_used=False,
                    at_min=clock_min,
                )
            )

        return SubAgentResult(
            payload={"invalidated": invalidated},
            traces=traces,
        )


# Backward-compatible alias
ImpactDetectorSubAgent = ImpactDetectorAgent
impact_detector_agent = ImpactDetectorAgent()
