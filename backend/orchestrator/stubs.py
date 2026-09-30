from typing import Any, Dict
from backend.models.domain import (
    Assignment,
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Explanation,
    Incident,
    Plan,
    PlanDiff,
    PlanMetrics,
    TraceEntry,
    Unmet,
)
from backend.models.enums import (
    IncidentType,
    ResourceStatus,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext


class StubAssessmentSubAgent:
    name: str = "assessment"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        updated_incidents: list[Incident] = []
        traces: list[TraceEntry] = []

        # If trigger contains an incident, process it
        target_incidents = list(state.incidents)
        raw_inc = ctx.payload.get("incident")
        if isinstance(raw_inc, dict):
            new_inc = Incident.model_validate(raw_inc)
            # Replace or append
            found = False
            for i, existing in enumerate(target_incidents):
                if existing.id == new_inc.id:
                    target_incidents[i] = new_inc
                    found = True
                    break
            if not found:
                target_incidents.append(new_inc)
        elif isinstance(raw_inc, Incident):
            target_incidents.append(raw_inc)

        for inc in target_incidents:
            # v0 priority rule: severity*10 + min(people, 20) + (10 if med/fire else 0) + min(waiting, 30)*0.5
            waiting = max(0, state.clock_min - inc.reported_at_min)
            med_fire_bonus = 10.0 if inc.type in (IncidentType.medical, IncidentType.fire) else 0.0
            people_score = float(min(inc.people_affected, 20))
            score = inc.severity * 10.0 + people_score + med_fire_bonus + min(waiting, 30) * 0.5

            if score >= 70.0:
                tier = Tier.critical
            elif score >= 50.0:
                tier = Tier.high
            elif score >= 30.0:
                tier = Tier.medium
            else:
                tier = Tier.low

            scored_inc = inc.model_copy(update={"priority": round(score, 2), "tier": tier})
            updated_incidents.append(scored_inc)

            traces.append(
                TraceEntry(
                    agent=self.name,
                    step="score_incident",
                    detail=f"Scored {inc.id}: priority={score:.1f}, tier={tier.value}",
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min,
                )
            )

        return SubAgentResult(
            payload={"incidents": updated_incidents},
            traces=traces,
        )


class StubImpactDetectorSubAgent:
    name: str = "impact_detector"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        invalidated: list[dict[str, str]] = []
        traces: list[TraceEntry] = []

        failed_resource_id = ctx.payload.get("resource_id")
        for asg in state.current_plan.assignments:
            # Check if this assignment's resource is failed
            is_target_failed = (failed_resource_id and asg.resource_id == failed_resource_id)
            matching_res = next((r for r in state.resources if r.id == asg.resource_id), None)
            res_unavailable = matching_res and matching_res.status == ResourceStatus.unavailable

            if is_target_failed or res_unavailable:
                invalidated.append({
                    "assignment_id": asg.id,
                    "reason": f"Resource {asg.resource_id} is unavailable",
                })
                traces.append(
                    TraceEntry(
                        agent=self.name,
                        step="detect_impact",
                        detail=f"Assignment {asg.id} invalidated: resource {asg.resource_id} unavailable",
                        used_llm=False,
                        fallback_used=False,
                        at_min=state.clock_min,
                    )
                )

        return SubAgentResult(
            payload={"invalidated": invalidated},
            traces=traces,
        )


class StubAllocationSubAgent:
    name: str = "allocation"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        assignments: list[Assignment] = []
        unmet: list[Unmet] = []

        # Maintain existing assignments that are valid and not failed
        failed_res = ctx.payload.get("resource_id")
        available_resources = [r for r in state.resources if r.status != ResourceStatus.unavailable and r.id != failed_res]
        res_pool = {r.id: r for r in available_resources}

        # Keep non-impacted current assignments
        for asg in state.current_plan.assignments:
            if asg.resource_id in res_pool:
                assignments.append(asg)
                del res_pool[asg.resource_id]

        # Allocate for unmet incidents in priority order
        sorted_incidents = sorted(
            [inc for inc in state.incidents if not inc.needs_confirmation],
            key=lambda x: (x.priority, -x.reported_at_min),
            reverse=True,
        )

        for inc in sorted_incidents:
            for res_type, needed_count in inc.required.items():
                assigned_count = sum(
                    1 for a in assignments if a.incident_id == inc.id
                    and any(r.id == a.resource_id and r.type == res_type for r in state.resources)
                )
                missing = needed_count - assigned_count
                if missing > 0:
                    candidates = [r for r in res_pool.values() if r.type == res_type]
                    if candidates:
                        winner = candidates[0]
                        del res_pool[winner.id]
                        new_asg = Assignment(
                            id=f"asg_{winner.id}_{inc.id}",
                            resource_id=winner.id,
                            incident_id=inc.id,
                            eta_min=6.5,
                            distance_km=3.0,
                            reason=f"Allocated {winner.id} to {inc.id}",
                        )
                        assignments.append(new_asg)
                        traces.append(
                            TraceEntry(
                                agent=self.name,
                                step="assign_resource",
                                detail=f"Assigned {winner.id} to {inc.id} (ETA 6.5m)",
                                used_llm=False,
                                fallback_used=False,
                                at_min=state.clock_min,
                            )
                        )
                    else:
                        unmet.append(Unmet(incident_id=inc.id, missing={res_type: missing}))

        new_plan = Plan(
            id=f"plan_{state.current_plan.version + 1}",
            version=state.current_plan.version + 1,
            assignments=assignments,
            unmet=unmet,
            metrics=PlanMetrics(
                avg_eta_min=6.8,
                max_eta_min=8.5,
                coverage_pct=75.0 if unmet else 100.0,
                utilization_pct=round(len(assignments) / max(1, len(state.resources)) * 100.0, 1),
                unresolved_count=len(unmet),
            ),
        )

        return SubAgentResult(
            payload={"plan": new_plan},
            traces=traces,
        )


class StubLogisticsSubAgent:
    name: str = "logistics"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        refined_assignments: list[Assignment] = []
        positions: dict[str, Any] = {}

        # Default hospital ID for medical incidents
        default_hospital = next((f.id for f in state.facilities if f.kind.value == "hospital"), "H1")

        for asg in state.current_plan.assignments:
            inc = next((i for i in state.incidents if i.id == asg.incident_id), None)
            fac_id = asg.facility_id
            if inc and inc.type == IncidentType.medical and not fac_id:
                fac_id = default_hospital

            refined_asg = asg.model_copy(update={"facility_id": fac_id})
            refined_assignments.append(refined_asg)

            res = next((r for r in state.resources if r.id == asg.resource_id), None)
            if res:
                positions[res.id] = res.location

        traces.append(
            TraceEntry(
                agent=self.name,
                step="refine_logistics",
                detail=f"Refined {len(refined_assignments)} assignments with facility routes",
                used_llm=False,
                fallback_used=False,
                at_min=state.clock_min,
            )
        )

        return SubAgentResult(
            payload={"assignments": refined_assignments, "positions": positions},
            traces=traces,
        )


class StubExplainerSubAgent:
    name: str = "explainer"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        bullets = [
            f"Evaluated scenario trigger '{ctx.kind.value}' at simulation time t={state.clock_min}m.",
            f"Maintained {len(state.current_plan.assignments)} active unit assignments across incidents.",
        ]
        if state.current_plan.unmet:
            bullets.append(f"Recorded unmet capacity slots across {len(state.current_plan.unmet)} incident(s).")

        explanation = Explanation(
            id=f"exp_{state.clock_min}",
            trigger=ctx.kind.value,
            bullets=bullets,
            trace_refs=list(range(min(2, len(state.traces)))),
        )

        trace = TraceEntry(
            agent=self.name,
            step="generate_explanation",
            detail=f"Synthesized decision rationale for trigger {ctx.kind.value}",
            used_llm=False,
            fallback_used=False,
            at_min=state.clock_min,
        )

        return SubAgentResult(
            payload={"explanation": explanation},
            traces=[trace],
        )


class StubWhatIfSubAgent:
    name: str = "what_if"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        target_res_id = ctx.payload.get("resource_id", "F2")
        affected_incidents = [asg.incident_id for asg in state.current_plan.assignments if asg.resource_id == target_res_id]
        if not affected_incidents and state.incidents:
            affected_incidents = [state.incidents[0].id]

        conflicts = [f"What-If: Resource {target_res_id} simulated offline affecting {', '.join(affected_incidents)}"]
        
        diff = PlanDiff(
            from_version=state.current_plan.version,
            to_version=state.current_plan.version + 1,
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

        before_metrics = state.current_plan.metrics
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


_STUB_REGISTRY: Dict[str, SubAgent] = {
    "assessment": StubAssessmentSubAgent(),
    "impact_detector": StubImpactDetectorSubAgent(),
    "allocation": StubAllocationSubAgent(),
    "logistics": StubLogisticsSubAgent(),
    "explainer": StubExplainerSubAgent(),
    "what_if": StubWhatIfSubAgent(),
}


def get_subagent(name: str) -> SubAgent:
    """Returns a SubAgent instance, preferring the real implementation if available,
    falling back to canned deterministic stubs.
    """
    # 1. Try real implementation
    if name == "assessment":
        try:
            from backend.subagents.assessment import AssessmentAgent  # type: ignore
            return AssessmentAgent()
        except (ImportError, AttributeError):
            pass
    elif name == "impact_detector":
        try:
            from backend.subagents.impact_detector import ImpactDetectorAgent  # type: ignore
            return ImpactDetectorAgent()
        except (ImportError, AttributeError):
            pass
    elif name == "allocation":
        try:
            from backend.subagents.allocation import AllocationAgent  # type: ignore
            return AllocationAgent()
        except (ImportError, AttributeError):
            pass
    elif name == "logistics":
        try:
            from backend.subagents.logistics import LogisticsAgent  # type: ignore
            return LogisticsAgent()
        except (ImportError, AttributeError):
            pass
    elif name == "explainer":
        try:
            from backend.subagents.explainer import ExplainerAgent  # type: ignore
            return ExplainerAgent()
        except (ImportError, AttributeError):
            pass
    elif name in ("what_if", "whatif"):
        try:
            from backend.subagents.whatif import WhatIfAgent  # type: ignore
            return WhatIfAgent()
        except (ImportError, AttributeError):
            pass

    # 2. Fall back to stub
    normalized = "what_if" if name == "whatif" else name
    if normalized in _STUB_REGISTRY:
        return _STUB_REGISTRY[normalized]

    raise KeyError(f"Unknown sub-agent name '{name}'. Registered: {list(_STUB_REGISTRY.keys())}")
