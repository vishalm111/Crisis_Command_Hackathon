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
)
from backend.models.enums import AlertLevel, Tier, TriggerKind
from backend.orchestrator.workflow import run_flow
from backend.services.engine import SimulationEngine, get_engine
from backend.subagents.base import TriggerContext


def diff_plans(old_plan: Plan, new_plan: Plan) -> PlanDiff:
    """Computes differences between two plans."""
    changes: List[DiffChange] = []
    old_by_res = {asg.resource_id: asg for asg in old_plan.assignments}
    new_by_res = {asg.resource_id: asg for asg in new_plan.assignments}

    all_resources = set(old_by_res.keys()).union(new_by_res.keys())

    for res_id in sorted(all_resources):
        old_asg = old_by_res.get(res_id)
        new_asg = new_by_res.get(res_id)

        if old_asg and not new_asg:
            changes.append(
                DiffChange(
                    resource_id=res_id,
                    kind=DiffChangeKind.removed,
                    old_incident_id=old_asg.incident_id,
                    new_incident_id=None,
                    old_eta_min=old_asg.eta_min,
                    new_eta_min=None,
                    reason=f"Unit {res_id} removed from incident {old_asg.incident_id}",
                )
            )
        elif not old_asg and new_asg:
            changes.append(
                DiffChange(
                    resource_id=res_id,
                    kind=DiffChangeKind.added,
                    old_incident_id=None,
                    new_incident_id=new_asg.incident_id,
                    old_eta_min=None,
                    new_eta_min=new_asg.eta_min,
                    reason=new_asg.reason or f"Unit {res_id} dispatched to incident {new_asg.incident_id}",
                )
            )
        elif old_asg and new_asg:
            if old_asg.incident_id != new_asg.incident_id:
                changes.append(
                    DiffChange(
                        resource_id=res_id,
                        kind=DiffChangeKind.reassigned,
                        old_incident_id=old_asg.incident_id,
                        new_incident_id=new_asg.incident_id,
                        old_eta_min=old_asg.eta_min,
                        new_eta_min=new_asg.eta_min,
                        reason=new_asg.reason or f"Unit {res_id} reassigned from {old_asg.incident_id} to {new_asg.incident_id}",
                    )
                )
            elif abs(old_asg.eta_min - new_asg.eta_min) >= 1.0:
                changes.append(
                    DiffChange(
                        resource_id=res_id,
                        kind=DiffChangeKind.eta_changed,
                        old_incident_id=old_asg.incident_id,
                        new_incident_id=new_asg.incident_id,
                        old_eta_min=old_asg.eta_min,
                        new_eta_min=new_asg.eta_min,
                        reason=f"ETA changed for {res_id} on {old_asg.incident_id}",
                    )
                )

    return PlanDiff(
        from_version=old_plan.version,
        to_version=new_plan.version,
        changes=changes,
    )


def evaluate_approval_gate(
    current_plan: Plan,
    proposed_plan: Plan,
    state: CrisisState,
) -> Tuple[bool, List[str], List[str], PlanDiff]:
    """Evaluates Contract Section 8 approval gate rules.
    
    A proposed plan needs human approval if any of these hold:
    1. Preempts a resource from an incident with severity 4 or 5.
    2. Leaves a critical tier incident with any unmet slot.
    3. Changes 3 or more assignments compared with current plan.
    4. Includes an incident with needs_confirmation = true that would receive resources.
    """
    reasons: List[str] = []
    consequences: List[str] = []
    diff = diff_plans(current_plan, proposed_plan)

    # If no changes were proposed compared with current plan, approval is not needed
    if len(diff.changes) == 0:
        return False, [], [], diff

    incident_map = {inc.id: inc for inc in state.incidents}

    # Rule 1: Preemption from severity 4 or 5
    for change in diff.changes:
        if change.kind == DiffChangeKind.reassigned and change.old_incident_id:
            old_inc = incident_map.get(change.old_incident_id)
            if old_inc and old_inc.severity in (4, 5):
                reasons.append(
                    f"Preempts resource {change.resource_id} from Incident {change.old_incident_id} "
                    f"which has high severity (severity {old_inc.severity})."
                )
                consequences.append(
                    f"Incident {change.old_incident_id} loses unit {change.resource_id} and risks coverage degradation."
                )

    # Rule 2: Leaves a critical tier incident with any unmet slot
    for unmet in proposed_plan.unmet:
        inc = incident_map.get(unmet.incident_id)
        if inc and inc.tier == Tier.critical and any(c > 0 for c in unmet.missing.values()):
            reasons.append(
                f"Proposed plan leaves critical incident {unmet.incident_id} with unmet resource slots."
            )
            consequences.append(
                f"Critical emergency at {unmet.incident_id} remains without required responder units."
            )

    # Rule 3: Changes 3 or more assignments
    if len(diff.changes) >= 3:
        reasons.append(
            f"Proposed plan introduces major operational disruption with {len(diff.changes)} assignment changes."
        )
        consequences.append(
            f"Reorganizes {len(diff.changes)} units simultaneously across active sectors."
        )

    # Rule 4: Incident with needs_confirmation=True receives resources
    for asg in proposed_plan.assignments:
        inc = incident_map.get(asg.incident_id)
        if inc and inc.needs_confirmation:
            reasons.append(
                f"Proposed plan dispatches {asg.resource_id} to Incident {asg.incident_id}, "
                f"which has unconfirmed/uncertain intake data."
            )
            consequences.append(
                f"Responder {asg.resource_id} will be committed to an unverified incident location."
            )

    # Add general consequence for added units
    for change in diff.changes:
        if change.kind in (DiffChangeKind.added, DiffChangeKind.reassigned) and change.new_incident_id:
            consequences.append(
                f"Incident {change.new_incident_id} receives responder {change.resource_id} (ETA {change.new_eta_min:.1f}m)."
            )

    needs_approval = len(reasons) > 0
    return needs_approval, reasons, consequences, diff


class Orchestrator:
    """Top-level autonomous coordinator.
    
    Receives triggers, selects and runs sub-agent flows, evaluates approval gates,
    and applies state updates cleanly to the simulation engine.
    """

    def __init__(self, engine: Optional[SimulationEngine] = None) -> None:
        self.engine = engine or get_engine()

    def handle(self, ctx: TriggerContext) -> CrisisState:
        """Handles any crisis trigger and advances the state."""
        # Special Case 1: What-If simulation
        if ctx.kind == TriggerKind.what_if:
            # Hard rule: What-If runs on a deep snapshot and NEVER mutates live state
            snap = self.engine.snapshot()
            payload, traces, _ = run_flow("what_if", snap, ctx)
            for t in traces:
                snap.traces.append(t)
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
        new_plan: Optional[Plan] = payload.get("plan")
        if new_plan and isinstance(new_plan, Plan):
            # Check if logistics refined the assignments
            if "assignments" in payload and isinstance(payload["assignments"], list):
                new_plan.assignments = payload["assignments"]

            # Evaluate approval gate
            needs_approval, reasons, consequences, diff = evaluate_approval_gate(
                current_state.current_plan, new_plan, self.engine.get_state()
            )

            if needs_approval:
                # Set proposed plan and raise ApprovalRequest
                approval_req = ApprovalRequest(
                    id=f"appr_{self.engine.get_state().clock_min}_{new_plan.version}",
                    status=ApprovalStatus.pending,
                    reasons=reasons,
                    consequences=consequences,
                    proposed_plan=new_plan,
                    diff=diff,
                    created_at_min=self.engine.get_state().clock_min,
                )
                self.engine.set_proposed_plan(new_plan)
                self.engine.set_approval(approval_req)
                self.engine.log(
                    f"t={self.engine.get_state().clock_min}: Plan v{new_plan.version} generated; human approval gate triggered"
                )
            else:
                # Auto-commit plan
                self.engine.set_plan(new_plan, archive_current=True)
                self.engine.set_proposed_plan(None)
                self.engine.set_approval(None)
                self.engine.log(
                    f"t={self.engine.get_state().clock_min}: Plan v{new_plan.version} automatically committed"
                )

        return self.engine.get_state()


_orchestrator_instance: Optional[Orchestrator] = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = Orchestrator()
    return _orchestrator_instance
