import json
import time
from typing import Any, Dict, List, Optional, Tuple

from backend.models.domain import (
    Alert,
    ApprovalRequest,
    ApprovalStatus,
    Assignment,
    Constraint,
    ConstraintKind,
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Explanation,
    Incident,
    Plan,
    PlanDiff,
    TraceEntry,
    Unmet,
)
from backend.models.enums import AlertLevel, ResourceType, Tier, TriggerKind
from backend.orchestrator.workflow import run_flow
from backend.services.engine import SimulationEngine, get_engine
from backend.subagents.base import TriggerContext


from backend.orchestrator.approval_gate import (
    GateDecision,
    diff_plans,
    evaluate,
)


def evaluate_approval_gate(
    current_plan: Plan,
    proposed_plan: Plan,
    state: CrisisState,
) -> Tuple[bool, List[str], List[str], PlanDiff]:
    """Evaluates Contract Section 8 approval gate rules via approval_gate.evaluate()."""
    decision = evaluate(current_plan, proposed_plan, state)
    return (
        decision.required,
        decision.reasons,
        decision.consequences,
        decision.diff or diff_plans(current_plan, proposed_plan),
    )


def detect_and_resolve_conflicts(plan: Plan, state: CrisisState) -> Tuple[Plan, List[TraceEntry]]:
    """Detects and resolves plan conflicts per P1-A1 specification:
    1. A resource in two assignments (double-booking).
    2. A locked or approved assignment changed.
    3. A resource assigned while unavailable.
    4. An incident over-allocated.

    Resolution hierarchy:
    - Locked or approved always win.
    - Higher-priority incident wins.
    - Tie-break: earlier reported_at_min, then incident ID.
    - Every resolution records a TraceEntry.
    """
    traces: List[TraceEntry] = []
    clean_plan = plan.model_copy(deep=True)
    assignments = clean_plan.assignments

    resource_map = {r.id: r for r in state.resources}
    incident_map = {inc.id: inc for inc in state.incidents}
    constraint_map = {c.resource_id: c for c in state.constraints}

    # 1. Resolve unavailable resource assignments
    valid_status_assignments: List[Assignment] = []
    for asg in assignments:
        res = resource_map.get(asg.resource_id)
        if res and res.status.value == "unavailable":
            traces.append(
                TraceEntry(
                    agent="orchestrator",
                    step="resolve_conflict",
                    detail=f"Removed unavailable resource {asg.resource_id} from incident {asg.incident_id}.",
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min,
                )
            )
        else:
            valid_status_assignments.append(asg)
    assignments = valid_status_assignments

    # 2. Enforce locked / approved constraints
    enforced_assignments: List[Assignment] = []
    for asg in assignments:
        constraint = constraint_map.get(asg.resource_id)
        if constraint and constraint.incident_id != asg.incident_id:
            # Overriding a locked/approved constraint is forbidden
            traces.append(
                TraceEntry(
                    agent="orchestrator",
                    step="resolve_conflict",
                    detail=(
                        f"Assignment conflict: resource {asg.resource_id} has {constraint.kind.value} "
                        f"constraint to {constraint.incident_id}. Canceled conflicting move to {asg.incident_id}."
                    ),
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min,
                )
            )
            # Revert to constrained incident
            asg.incident_id = constraint.incident_id
            if constraint.kind.value == "locked":
                asg.locked = True
            elif constraint.kind.value == "approved":
                asg.approved = True
        enforced_assignments.append(asg)
    assignments = enforced_assignments

    # 3. Resolve double-booking (a resource in multiple assignments)
    by_resource: Dict[str, List[Assignment]] = {}
    for asg in assignments:
        by_resource.setdefault(asg.resource_id, []).append(asg)

    resolved_single_assignments: List[Assignment] = []
    for res_id, asg_list in by_resource.items():
        if len(asg_list) == 1:
            resolved_single_assignments.append(asg_list[0])
            continue

        # Multiple assignments for same resource: choose winner
        def candidate_key(a: Assignment):
            is_locked_approved = 1 if (a.locked or a.approved) else 0
            inc = incident_map.get(a.incident_id)
            priority = inc.priority if inc else 0.0
            reported = inc.reported_at_min if inc else 0
            inc_id = inc.id if inc else ""
            return (is_locked_approved, priority, -reported, inc_id)

        sorted_candidates = sorted(asg_list, key=candidate_key, reverse=True)
        winner = sorted_candidates[0]
        resolved_single_assignments.append(winner)

        losers = sorted_candidates[1:]
        for loser in losers:
            w_inc = incident_map.get(winner.incident_id)
            l_inc = incident_map.get(loser.incident_id)
            w_pri = w_inc.priority if w_inc else 0.0
            l_pri = l_inc.priority if l_inc else 0.0
            traces.append(
                TraceEntry(
                    agent="orchestrator",
                    step="resolve_conflict",
                    detail=(
                        f"Resolved double-booking for {res_id}: {winner.incident_id} (priority {w_pri:.1f}) "
                        f"won over {loser.incident_id} (priority {l_pri:.1f})."
                    ),
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min,
                )
            )
    assignments = resolved_single_assignments

    # 4. Resolve over-allocated incidents
    # For each incident and resource type, ensure assigned_count <= required_count
    final_assignments: List[Assignment] = []
    by_incident: Dict[str, List[Assignment]] = {}
    for asg in assignments:
        by_incident.setdefault(asg.incident_id, []).append(asg)

    for inc_id, asg_list in by_incident.items():
        inc = incident_map.get(inc_id)
        if not inc:
            final_assignments.extend(asg_list)
            continue

        # Group by resource type
        by_type: Dict[ResourceType, List[Assignment]] = {}
        for a in asg_list:
            res = resource_map.get(a.resource_id)
            if res:
                by_type.setdefault(res.type, []).append(a)
            else:
                final_assignments.append(a)

        for res_type, type_asgs in by_type.items():
            req_count = inc.required.get(res_type, 0)
            if len(type_asgs) <= req_count:
                final_assignments.extend(type_asgs)
            else:
                # Keep locked/approved first, then lowest ETA
                sorted_type = sorted(
                    type_asgs,
                    key=lambda a: (1 if (a.locked or a.approved) else 0, -a.eta_min),
                    reverse=True,
                )
                kept = sorted_type[:req_count]
                discarded = sorted_type[req_count:]
                final_assignments.extend(kept)

                for disc in discarded:
                    traces.append(
                        TraceEntry(
                            agent="orchestrator",
                            step="resolve_conflict",
                            detail=(
                                f"Resolved over-allocation for {inc_id}: removed excess "
                                f"{disc.resource_id} ({res_type.value}, req: {req_count})."
                            ),
                            used_llm=False,
                            fallback_used=False,
                            at_min=state.clock_min,
                        )
                    )

    clean_plan.assignments = final_assignments

    # Recalculate unmet slots based on resolved assignments
    unmet_list: List[Unmet] = []
    for inc in state.incidents:
        if inc.needs_confirmation:
            continue
        inc_asgs = [a for a in final_assignments if a.incident_id == inc.id]
        missing_dict: Dict[ResourceType, int] = {}
        for r_type, needed in inc.required.items():
            assigned_of_type = sum(
                1 for a in inc_asgs if resource_map.get(a.resource_id) and resource_map[a.resource_id].type == r_type
            )
            if assigned_of_type < needed:
                missing_dict[r_type] = needed - assigned_of_type
        if missing_dict:
            unmet_list.append(Unmet(incident_id=inc.id, missing=missing_dict))
    clean_plan.unmet = unmet_list

    # Recalculate metrics
    if clean_plan.assignments:
        clean_plan.metrics.avg_eta_min = round(
            sum(a.eta_min for a in clean_plan.assignments) / len(clean_plan.assignments), 1
        )
        clean_plan.metrics.max_eta_min = round(
            max(a.eta_min for a in clean_plan.assignments), 1
        )
    clean_plan.metrics.unresolved_count = len(clean_plan.unmet)

    return clean_plan, traces


class Orchestrator:
    """Top-level autonomous coordinator.
    
    Receives triggers, selects and runs sub-agent flows, evaluates approval gates,
    and applies state updates cleanly to the simulation engine.
    """

    def __init__(self, engine: Optional[SimulationEngine] = None) -> None:
        self.engine = engine or get_engine()
        self._debounce_cache: Dict[str, Tuple[float, CrisisState]] = {}
        if hasattr(self.engine, "register_reset_listener"):
            self.engine.register_reset_listener(self._clear_debounce_cache)

    def _clear_debounce_cache(self) -> None:
        self._debounce_cache.clear()

    def _make_trigger_key(self, ctx: TriggerContext) -> str:
        try:
            payload_str = json.dumps(ctx.payload, default=str, sort_keys=True)
        except Exception:
            payload_str = str(ctx.payload)
        return f"{ctx.kind.value}:{payload_str}"

    def handle(self, ctx: TriggerContext) -> CrisisState:
        """Handles any crisis trigger and advances the state."""
        # Debounce check (P1-T2): same trigger within 1.0s is ignored / returns cached state
        now = time.time()
        trigger_key = self._make_trigger_key(ctx)
        if trigger_key in self._debounce_cache:
            last_time, cached_state = self._debounce_cache[trigger_key]
            if now - last_time < 1.0:
                self.engine.log(
                    f"t={self.engine.get_state().clock_min}: Debounced duplicate trigger '{ctx.kind.value}' within 1s"
                )
                return cached_state

        if ctx.kind != TriggerKind.what_if:
            self.engine.log(f"t={self.engine.get_state().clock_min}: Trigger received: {ctx.kind.value}")

        # Special Case 1: What-If simulation
        if ctx.kind == TriggerKind.what_if:
            # Hard rule: What-If runs on a deep snapshot and NEVER mutates live state
            snap = self.engine.snapshot()
            payload, traces, _ = run_flow("what_if", snap, ctx)
            for t in traces:
                snap.traces.append(t)
            self._debounce_cache[trigger_key] = (time.time(), snap)
            # Return the simulated state representation without engine side-effects
            return snap

        # Special Case 2: Time advance
        if ctx.kind == TriggerKind.time_advance:
            minutes = ctx.payload.get("minutes", 1)
            self.engine.advance_clock(minutes)
            state = self.engine.get_state()
            payload, traces, alerts = run_flow("time_advance", state, ctx)
            for t in traces:
                self.engine.add_trace(t)
            for a in alerts:
                self.engine.add_alert(a)
            if "explanation" in payload and isinstance(payload["explanation"], Explanation):
                self.engine.add_explanation(payload["explanation"])
            return self.engine.get_state()

        # Regular flows: new_incident, resource_failure, escalation, approval_decision
        current_state = self.engine.get_state()
        flow_name = ctx.kind.value
        payload, traces, alerts = run_flow(flow_name, current_state, ctx)

        # 1. Record decision traces and alerts
        for trace in traces:
            self.engine.add_trace(trace)
        for alert in alerts:
            self.engine.add_alert(alert)

        # 2. Apply updated incidents from assessment
        if "incidents" in payload and isinstance(payload["incidents"], list):
            for inc in payload["incidents"]:
                if isinstance(inc, Incident):
                    self.engine.apply_incident(inc)

        # 3. Apply explanation if generated
        if "explanation" in payload and isinstance(payload["explanation"], Explanation):
            self.engine.add_explanation(payload["explanation"])

        # 4. Handle Plan & Approval Gate
        if ctx.kind == TriggerKind.approval_decision and ctx.payload.get("decision") == "reject":
            self.engine.set_proposed_plan(None)
            self.engine.log(
                f"t={self.engine.get_state().clock_min}: Plan proposal rejected by human coordinator; current plan preserved"
            )
        else:
            new_plan: Optional[Plan] = payload.get("plan")
            if new_plan and isinstance(new_plan, Plan):
                # Check if logistics refined the assignments
                if "assignments" in payload and isinstance(payload["assignments"], list):
                    new_plan.assignments = payload["assignments"]

                # Conflict Detection and Plan Merge (P1-A1)
                new_plan, conflict_traces = detect_and_resolve_conflicts(new_plan, self.engine.get_state())
                for ct in conflict_traces:
                    self.engine.add_trace(ct)

                # Evaluate approval gate (P1-A2)
                gate_decision = evaluate(
                    current_state.current_plan, new_plan, self.engine.get_state()
                )

                if gate_decision.required:
                    # Set proposed plan and raise ApprovalRequest
                    approval_req = ApprovalRequest(
                        id=f"appr_{self.engine.get_state().clock_min}_{new_plan.version}",
                        status=ApprovalStatus.pending,
                        reasons=gate_decision.reasons,
                        consequences=gate_decision.consequences,
                        proposed_plan=new_plan,
                        diff=gate_decision.diff or diff_plans(current_state.current_plan, new_plan),
                        created_at_min=self.engine.get_state().clock_min,
                    )
                    self.engine.set_proposed_plan(new_plan)
                    self.engine.set_approval(approval_req)
                    self.engine.log(
                        f"t={self.engine.get_state().clock_min}: Plan v{new_plan.version} generated; human approval gate triggered"
                    )
                else:
                    # Auto-commit plan (P1-A4: archive old plan and record diff)
                    self.engine.set_plan(new_plan, archive_current=True, diff=gate_decision.diff)
                    self.engine.set_proposed_plan(None)
                    self.engine.set_approval(None)
                    self.engine.log(
                        f"t={self.engine.get_state().clock_min}: Plan v{new_plan.version} automatically committed"
                    )

        result_state = self.engine.get_state()
        self._debounce_cache[trigger_key] = (time.time(), result_state)
        return result_state


_orchestrator_instance: Optional[Orchestrator] = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = Orchestrator()
    return _orchestrator_instance
