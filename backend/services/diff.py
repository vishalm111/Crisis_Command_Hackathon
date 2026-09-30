"""Plan diffing and performance metrics service (Contract Section 4 & P3).

Provides pure, deterministic diff calculation and metric computation.
"""

from typing import Optional
from backend.models.domain import (
    CrisisState,
    DiffChange,
    DiffChangeKind,
    Plan,
    PlanDiff,
    PlanMetrics,
)
from backend.models.enums import IncidentStatus, ResourceStatus


def diff_plans(
    old_plan: Optional[Plan],
    new_plan: Plan,
    reasons: Optional[dict[str, str]] = None,
) -> PlanDiff:
    """Computes difference between two dispatch plans.
    
    Identifies added, removed, reassigned, and eta_changed assignments.
    Attaches human-readable reason strings to each change.
    """
    changes: list[DiffChange] = []
    from_version = old_plan.version if old_plan else 0
    to_version = new_plan.version

    old_by_res = {a.resource_id: a for a in (old_plan.assignments if old_plan else [])}
    new_by_res = {a.resource_id: a for a in new_plan.assignments}

    all_res_ids = sorted(set(old_by_res.keys()).union(new_by_res.keys()))
    explicit_reasons = reasons or {}

    for res_id in all_res_ids:
        old_asg = old_by_res.get(res_id)
        new_asg = new_by_res.get(res_id)
        custom_reason = explicit_reasons.get(res_id)

        if old_asg and not new_asg:
            # Removed from plan
            reason = custom_reason or f"Unit {res_id} removed from incident {old_asg.incident_id}"
            changes.append(
                DiffChange(
                    resource_id=res_id,
                    kind=DiffChangeKind.removed,
                    old_incident_id=old_asg.incident_id,
                    new_incident_id=None,
                    old_eta_min=old_asg.eta_min,
                    new_eta_min=None,
                    reason=reason,
                )
            )
        elif not old_asg and new_asg:
            # Newly added
            reason = custom_reason or new_asg.reason or f"Unit {res_id} dispatched to incident {new_asg.incident_id}"
            changes.append(
                DiffChange(
                    resource_id=res_id,
                    kind=DiffChangeKind.added,
                    old_incident_id=None,
                    new_incident_id=new_asg.incident_id,
                    old_eta_min=None,
                    new_eta_min=new_asg.eta_min,
                    reason=reason,
                )
            )
        elif old_asg and new_asg:
            if old_asg.incident_id != new_asg.incident_id:
                # Reassigned to another incident
                reason = custom_reason or new_asg.reason or (
                    f"Unit {res_id} reassigned from {old_asg.incident_id} to {new_asg.incident_id}"
                )
                changes.append(
                    DiffChange(
                        resource_id=res_id,
                        kind=DiffChangeKind.reassigned,
                        old_incident_id=old_asg.incident_id,
                        new_incident_id=new_asg.incident_id,
                        old_eta_min=old_asg.eta_min,
                        new_eta_min=new_asg.eta_min,
                        reason=reason,
                    )
                )
            elif abs(old_asg.eta_min - new_asg.eta_min) >= 1.0:
                # Same incident, but significant ETA shift (>= 1.0 min)
                reason = custom_reason or (
                    f"ETA updated for unit {res_id} on {old_asg.incident_id} from {old_asg.eta_min:.1f}m to {new_asg.eta_min:.1f}m"
                )
                changes.append(
                    DiffChange(
                        resource_id=res_id,
                        kind=DiffChangeKind.eta_changed,
                        old_incident_id=old_asg.incident_id,
                        new_incident_id=new_asg.incident_id,
                        old_eta_min=old_asg.eta_min,
                        new_eta_min=new_asg.eta_min,
                        reason=reason,
                    )
                )

    return PlanDiff(
        from_version=from_version,
        to_version=to_version,
        changes=changes,
    )


def compute_metrics(plan: Plan, state: CrisisState) -> PlanMetrics:
    """Computes standard dispatch plan metrics according to Contract Section 2:
    - avg_eta_min: Mean ETA across all active assignments
    - max_eta_min: Maximum ETA across all active assignments
    - coverage_pct: Percentage of required resource slots fulfilled across confirmed incidents
    - utilization_pct: Percentage of available (non-failed) resources actively assigned
    - unresolved_count: Count of active incidents with unmet resource demands
    """
    assignments = plan.assignments
    if assignments:
        etas = [a.eta_min for a in assignments]
        avg_eta = round(sum(etas) / len(etas), 2)
        max_eta = round(max(etas), 2)
    else:
        avg_eta = 0.0
        max_eta = 0.0

    active_incidents = [
        inc for inc in state.incidents
        if inc.status != IncidentStatus.resolved and not inc.needs_confirmation
    ]

    total_required_slots = sum(
        sum(count for count in inc.required.values() if count > 0)
        for inc in active_incidents
    )
    assigned_slots = len(assignments)

    if total_required_slots > 0:
        coverage_pct = round(min(100.0, (assigned_slots / total_required_slots) * 100.0), 1)
    else:
        coverage_pct = 100.0

    non_failed_resources = [
        r for r in state.resources if r.status != ResourceStatus.unavailable
    ]
    assigned_resource_ids = {a.resource_id for a in assignments}

    if non_failed_resources:
        utilization_pct = round(
            min(100.0, (len(assigned_resource_ids) / len(non_failed_resources)) * 100.0), 1
        )
    else:
        utilization_pct = 0.0

    unresolved_count = sum(
        1 for u in plan.unmet if any(v > 0 for v in u.missing.values())
    )

    return PlanMetrics(
        avg_eta_min=avg_eta,
        max_eta_min=max_eta,
        coverage_pct=coverage_pct,
        utilization_pct=utilization_pct,
        unresolved_count=unresolved_count,
    )
