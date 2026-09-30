"""Approval Gate evaluation module (Contract Section 8).

Implements evaluate(current_plan, proposed_plan, state) -> GateDecision.
Determines whether a proposed plan requires human confirmation before execution.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from backend.models.domain import (
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Plan,
    PlanDiff,
)
from backend.models.enums import Tier


class GateDecision(BaseModel):
    """Decision returned by the approval gate."""
    required: bool
    reasons: list[str] = Field(default_factory=list)
    consequences: list[str] = Field(default_factory=list)
    diff: Optional[PlanDiff] = None


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


def evaluate(
    current_plan: Plan,
    proposed_plan: Plan,
    state: CrisisState,
) -> GateDecision:
    """Evaluates Contract Section 8 approval gate rules.

    A proposed plan needs human approval if any of these hold:
    1. It preempts a resource from an incident with severity 4 or 5.
    2. It leaves a critical tier incident with any unmet slot.
    3. It changes 3 or more assignments compared with the current plan.
    4. It includes an incident with needs_confirmation = true that would receive resources.

    Otherwise, the orchestrator commits the plan automatically.
    """
    reasons: list[str] = []
    consequences: list[str] = []
    diff = diff_plans(current_plan, proposed_plan)

    # Identical plan requires no approval and has no consequences
    if len(diff.changes) == 0:
        return GateDecision(
            required=False,
            reasons=[],
            consequences=[],
            diff=diff,
        )

    incident_map = {inc.id: inc for inc in state.incidents}
    resource_map = {res.id: res for res in state.resources}
    unmet_incidents = {u.incident_id for u in proposed_plan.unmet if any(v > 0 for v in u.missing.values())}

    def _resource_label(rid: str) -> str:
        r = resource_map.get(rid)
        if r:
            return f"{r.type.value} {r.id}"
        return f"resource {rid}"

    # Rule 1: Preemption from an incident with severity 4 or 5
    for change in diff.changes:
        if change.kind == DiffChangeKind.reassigned and change.old_incident_id:
            old_inc = incident_map.get(change.old_incident_id)
            if old_inc and old_inc.severity in (4, 5):
                r_label = _resource_label(change.resource_id)
                reasons.append(
                    f"Preempts {r_label} from incident {change.old_incident_id} "
                    f"which has high severity (severity {old_inc.severity})."
                )

    # Consequence sentences for losing resources
    for change in diff.changes:
        if (change.kind in (DiffChangeKind.reassigned, DiffChangeKind.removed)) and change.old_incident_id:
            r_label = _resource_label(change.resource_id)
            if change.old_incident_id in unmet_incidents:
                consequences.append(
                    f"{change.old_incident_id} loses {r_label} and becomes unmet"
                )
            else:
                consequences.append(
                    f"{change.old_incident_id} loses {r_label} and risks coverage degradation"
                )

    # Rule 2: Leaves a critical tier incident with any unmet slot
    for unmet in proposed_plan.unmet:
        inc = incident_map.get(unmet.incident_id)
        if inc and inc.tier == Tier.critical and any(count > 0 for count in unmet.missing.values()):
            reasons.append(
                f"Proposed plan leaves critical incident {unmet.incident_id} with unmet resource slots."
            )
            consequences.append(
                f"Critical emergency at {unmet.incident_id} remains without required responder units."
            )

    # Rule 3: Changes 3 or more assignments compared with current plan
    if len(diff.changes) >= 3:
        reasons.append(
            f"Proposed plan changes {len(diff.changes)} assignments compared with current plan (major operational disruption)."
        )
        consequences.append(
            f"Reorganizes {len(diff.changes)} units simultaneously across active sectors."
        )

    # Rule 4: Incident with needs_confirmation = true receives resources
    for asg in proposed_plan.assignments:
        inc = incident_map.get(asg.incident_id)
        if inc and inc.needs_confirmation:
            r_label = _resource_label(asg.resource_id)
            reasons.append(
                f"Proposed plan dispatches {r_label} to incident {asg.incident_id}, "
                f"which has unconfirmed intake data (needs confirmation)."
            )
            consequences.append(
                f"Responder {asg.resource_id} committed to an unverified incident location."
            )

    # Plain sentence consequence for newly added or reassigned resources
    for change in diff.changes:
        if change.kind in (DiffChangeKind.added, DiffChangeKind.reassigned) and change.new_incident_id:
            r_label = _resource_label(change.resource_id)
            eta_str = f" (ETA {change.new_eta_min:.1f}m)" if change.new_eta_min is not None else ""
            consequences.append(
                f"{change.new_incident_id} receives {r_label}{eta_str}"
            )

    # De-duplicate consequences while preserving order
    unique_consequences: list[str] = []
    for c in consequences:
        if c not in unique_consequences:
            unique_consequences.append(c)

    required = len(reasons) > 0
    return GateDecision(
        required=required,
        reasons=reasons,
        consequences=unique_consequences,
        diff=diff,
    )
