from backend.subagents.base import SubAgent, TriggerContext, SubAgentResult
from backend.models import CrisisState, TraceEntry, TriggerKind, ResourceStatus

class ImpactDetectorAgent(SubAgent):
    name = "impact_detector"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces = []
        invalidated = []
        if ctx.kind == TriggerKind.resource_failure:
            resource_id = ctx.payload.get("resource_id")
            if not resource_id: 
                return SubAgentResult(payload={"invalidated": invalidated}, traces=traces)
            
            if state.current_plan:
                for asg in state.current_plan.assignments:
                    if asg.resource_id == resource_id:
                        invalidated.append({
                            "assignment_id": asg.id,
                            "reason": f"Resource {asg.resource_id} is unavailable",
                        })
                        traces.append(TraceEntry(
                            agent=self.name,
                            step="detect_failure_impact",
                            detail=f"Identified failure of {resource_id} on active assignment to {asg.incident_id}.",
                            at_min=state.clock_min,
                            used_llm=False,
                            fallback_used=False
                        ))
        return SubAgentResult(payload={"invalidated": invalidated}, traces=traces)
