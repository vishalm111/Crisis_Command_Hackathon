from backend.models import Plan, PlanDiff, PlanMetrics, DiffChange, DiffChangeKind, CrisisState, ResourceStatus

def diff_plans(old: Plan, new: Plan, reasons: dict[str, str] = None) -> PlanDiff:
    if reasons is None:
        reasons = {}
        
    changes = []
    
    old_map = {a.resource_id: a for a in old.assignments} if old else {}
    new_map = {a.resource_id: a for a in new.assignments} if new else {}

    all_resources = set(old_map.keys()) | set(new_map.keys())

    for r_id in sorted(all_resources):
        o = old_map.get(r_id)
        n = new_map.get(r_id)

        if o and not n:
            changes.append(DiffChange(
                resource_id=r_id,
                kind=DiffChangeKind.removed,
                old_incident_id=o.incident_id,
                old_eta_min=o.eta_min,
                reason=reasons.get(r_id, f"Removed from {o.incident_id}")
            ))
        elif not o and n:
            changes.append(DiffChange(
                resource_id=r_id,
                kind=DiffChangeKind.added,
                new_incident_id=n.incident_id,
                new_eta_min=n.eta_min,
                reason=reasons.get(r_id, f"Added to {n.incident_id}")
            ))
        elif o and n:
            if o.incident_id != n.incident_id:
                changes.append(DiffChange(
                    resource_id=r_id,
                    kind=DiffChangeKind.reassigned,
                    old_incident_id=o.incident_id,
                    new_incident_id=n.incident_id,
                    old_eta_min=o.eta_min,
                    new_eta_min=n.eta_min,
                    reason=reasons.get(r_id, f"Reassigned from {o.incident_id} to {n.incident_id}")
                ))
            elif o.eta_min != n.eta_min:
                changes.append(DiffChange(
                    resource_id=r_id,
                    kind=DiffChangeKind.eta_changed,
                    old_incident_id=o.incident_id,
                    new_incident_id=n.incident_id,
                    old_eta_min=o.eta_min,
                    new_eta_min=n.eta_min,
                    reason=reasons.get(r_id, f"ETA changed from {o.eta_min} to {n.eta_min}")
                ))
                
    return PlanDiff(
        from_version=old.version if old else 0,
        to_version=new.version if new else 1,
        changes=changes
    )

def compute_metrics(plan: Plan, state: CrisisState) -> PlanMetrics:
    if not plan:
        return PlanMetrics(avg_eta_min=0.0, max_eta_min=0.0, coverage_pct=0.0, utilization_pct=0.0, unresolved_count=len(state.incidents))

    etas = [a.eta_min for a in plan.assignments if a.eta_min is not None]
    avg_eta = sum(etas) / len(etas) if etas else 0.0
    max_eta = max(etas) if etas else 0.0

    total_required = 0
    for inc in state.incidents:
        if inc.needs_confirmation: continue
        for rt, cnt in inc.required.items():
            total_required += cnt
            
    # Unmet items calculation
    unmet_count = sum(sum(u.missing.values()) for u in plan.unmet)
    total_filled = total_required - unmet_count
    
    coverage_pct = (total_filled / total_required * 100.0) if total_required > 0 else 100.0
    
    available_resources = [r for r in state.resources if r.status != ResourceStatus.unavailable]
    utilization_pct = (len(plan.assignments) / len(available_resources) * 100.0) if available_resources else 0.0
    
    unresolved_count = len(plan.unmet)

    return PlanMetrics(
        avg_eta_min=avg_eta,
        max_eta_min=max_eta,
        coverage_pct=coverage_pct,
        utilization_pct=utilization_pct,
        unresolved_count=unresolved_count
    )
