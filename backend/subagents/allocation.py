"""Allocation subagent: matches emergency resources to incidents.

Pure deterministic function following Shared Contract v0 Section 7.
"""

from typing import Any, Callable, Optional, Protocol
from pydantic import BaseModel

from backend.models.domain import (
    Assignment,
    Constraint,
    CrisisState,
    Incident,
    LatLng,
    Plan,
    PlanMetrics,
    Resource,
    TraceEntry,
    Unmet,
)
from backend.models.enums import (
    ConstraintKind,
    IncidentStatus,
    ResourceStatus,
    ResourceType,
    Tier,
    TriggerKind,
)

# Optional import from base protocol (owned by P1)
try:
    from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext
except (ImportError, AttributeError):
    class TriggerContext(BaseModel):  # type: ignore[no-redef]
        kind: TriggerKind
        payload: dict[str, Any] = {}

    class SubAgentResult(BaseModel):  # type: ignore[no-redef]
        payload: dict[str, Any]
        traces: list[TraceEntry]

    class SubAgent(Protocol):  # type: ignore[no-redef]
        name: str

        def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
            ...

# Optional import from geo service (owned by P4)
try:
    from backend.services.geo import eta_minutes, haversine_km
except (ImportError, AttributeError):
    eta_minutes = None  # type: ignore[assignment]
    haversine_km = None  # type: ignore[assignment]


TIER_MAX_ETA: dict[Tier, float] = {
    Tier.critical: 15.0,
    Tier.high: 25.0,
    Tier.medium: 40.0,
    Tier.low: 60.0,
}


def _resolve_eta_fn(
    eta_fn: Optional[Callable[[LatLng, LatLng], float]] = None,
) -> Callable[[LatLng, LatLng], float]:
    """Resolves the ETA calculation function, prioritizing explicit eta_fn, then geo.eta_minutes."""
    if eta_fn is not None and callable(eta_fn):
        return eta_fn
    if eta_minutes is not None and callable(eta_minutes):
        return eta_minutes
    from backend.services import geo

    if hasattr(geo, "eta_minutes") and callable(geo.eta_minutes):
        return geo.eta_minutes
    raise RuntimeError(
        "geo.eta_minutes is not available. Please define eta_fn or ensure backend.services.geo is implemented."
    )


def _compute_plan_metrics(
    assignments: list[Assignment],
    unmet_list: list[Unmet],
    active_incidents: list[Incident],
    resources: list[Resource],
) -> PlanMetrics:
    """Computes plan metrics: avg/max ETA, coverage %, utilization %, unresolved count."""
    if assignments:
        etas = [a.eta_min for a in assignments]
        avg_eta = round(sum(etas) / len(etas), 2)
        max_eta = round(max(etas), 2)
    else:
        avg_eta = 0.0
        max_eta = 0.0

    total_required_slots = sum(
        sum(count for count in inc.required.values() if count > 0)
        for inc in active_incidents
    )
    assigned_slots = len(assignments)

    if total_required_slots > 0:
        coverage_pct = round((assigned_slots / total_required_slots) * 100.0, 1)
    else:
        coverage_pct = 100.0

    non_failed_resources = [
        r for r in resources if r.status != ResourceStatus.unavailable
    ]
    assigned_resource_ids = {a.resource_id for a in assignments}

    if non_failed_resources:
        utilization_pct = round(
            (len(assigned_resource_ids) / len(non_failed_resources)) * 100.0, 1
        )
    else:
        utilization_pct = 0.0

    unresolved_count = len([u for u in unmet_list if any(v > 0 for v in u.missing.values())])

    return PlanMetrics(
        avg_eta_min=avg_eta,
        max_eta_min=max_eta,
        coverage_pct=coverage_pct,
        utilization_pct=utilization_pct,
        unresolved_count=unresolved_count,
    )


def allocate(
    state: CrisisState,
    constraints: Optional[list[Constraint]] = None,
    eta_fn: Optional[Callable[[LatLng, LatLng], float]] = None,
) -> tuple[Plan, list[TraceEntry]]:
    """Pure, deterministic allocation function.
    
    Assigns nearest eligible resources to active incidents in priority order.
    Enforces tier max-ETA cutoffs and respects locked/approved constraints.
    Returns a new Plan and list of decision TraceEntry objects without mutating input state.
    """
    calc_eta = _resolve_eta_fn(eta_fn)
    traces: list[TraceEntry] = []
    clock_min = state.clock_min

    # 1. Collect constraints (from argument or state)
    active_constraints = constraints if constraints is not None else state.constraints
    locked_resources: dict[str, tuple[str, bool, bool]] = {}
    for c in active_constraints:
        is_locked = c.kind == ConstraintKind.locked
        is_approved = c.kind == ConstraintKind.approved
        locked_resources[c.resource_id] = (c.incident_id, is_locked, is_approved)

    # Also respect locked/approved flags on existing assignments in current_plan
    if state.current_plan:
        for asgn in state.current_plan.assignments:
            if (asgn.locked or asgn.approved) and asgn.resource_id not in locked_resources:
                locked_resources[asgn.resource_id] = (asgn.incident_id, asgn.locked, asgn.approved)

    # 2. Map resources, discarding unavailable
    resources_by_id = {r.id: r for r in state.resources}
    available_resources = [r for r in state.resources if r.status != ResourceStatus.unavailable]
    assigned_resource_ids: set[str] = set()
    assignments: list[Assignment] = []
    incident_fulfilled: dict[str, dict[ResourceType, int]] = {}

    # 3. Filter incidents
    # Skip resolved incidents and incidents requiring confirmation
    active_incidents: list[Incident] = []
    for inc in state.incidents:
        if inc.status == IncidentStatus.resolved:
            continue
        if inc.needs_confirmation:
            traces.append(
                TraceEntry(
                    agent="allocation",
                    step="skip_confirmation",
                    detail=f"Incident {inc.id} skipped: needs human confirmation before resource dispatch",
                    used_llm=False,
                    fallback_used=False,
                    at_min=clock_min,
                )
            )
            continue
        active_incidents.append(inc)

    # Sort incidents by priority descending, tie-break by reported_at_min, then incident ID
    active_incidents.sort(key=lambda inc: (-inc.priority, inc.reported_at_min, inc.id))

    # 4. Pass 1: Handle locked and approved constraints
    for res_id, (inc_id, is_locked, is_approved) in sorted(locked_resources.items()):
        if res_id not in resources_by_id:
            continue
        res = resources_by_id[res_id]
        if res.status == ResourceStatus.unavailable:
            traces.append(
                TraceEntry(
                    agent="allocation",
                    step="constrained_resource_unavailable",
                    detail=f"Resource {res_id} locked to incident {inc_id} is unavailable; constraint ignored",
                    used_llm=False,
                    fallback_used=False,
                    at_min=clock_min,
                )
            )
            continue

        target_inc = next((inc for inc in active_incidents if inc.id == inc_id), None)
        if target_inc is None:
            continue

        required_count = target_inc.required.get(res.type, 0)
        current_fulfilled = incident_fulfilled.setdefault(inc_id, {}).get(res.type, 0)
        if current_fulfilled >= required_count:
            continue

        eta = calc_eta(res.location, target_inc.location)
        dist = 0.0
        if haversine_km is not None and callable(haversine_km):
            try:
                dist = round(haversine_km(res.location, target_inc.location), 2)
            except Exception:
                dist = max(0.0, round((eta - 2.0) * 40.0 / (1.4 * 60.0), 2))
        else:
            dist = max(0.0, round((eta - 2.0) * 40.0 / (1.4 * 60.0), 2))

        asgn = Assignment(
            id=f"asgn_{res.id}_{inc_id}",
            resource_id=res.id,
            incident_id=inc_id,
            eta_min=round(eta, 2),
            distance_km=dist,
            locked=is_locked,
            approved=is_approved,
            reason=f"Retained existing {'locked' if is_locked else 'approved'} assignment to {inc_id}",
        )
        assignments.append(asgn)
        assigned_resource_ids.add(res.id)
        incident_fulfilled[inc_id][res.type] = current_fulfilled + 1

        traces.append(
            TraceEntry(
                agent="allocation",
                step="constrained_assignment",
                detail=f"Resource {res.id} bound to {inc_id} by constraint (locked={is_locked}, approved={is_approved}, ETA={round(eta, 1)}m)",
                used_llm=False,
                fallback_used=False,
                at_min=clock_min,
            )
        )

    # 5. Pass 2: Allocate remaining slots for active incidents in priority order
    unmet_list: list[Unmet] = []

    for inc in active_incidents:
        max_eta = TIER_MAX_ETA.get(inc.tier, 60.0)
        missing_for_inc: dict[ResourceType, int] = {}

        # Process resource types in deterministic order (by name)
        for res_type in sorted(inc.required.keys(), key=lambda t: t.value):
            total_needed = inc.required[res_type]
            already_filled = incident_fulfilled.setdefault(inc.id, {}).get(res_type, 0)
            remaining_slots = total_needed - already_filled

            for _ in range(remaining_slots):
                # Search for eligible candidate resources
                candidates: list[tuple[Resource, float]] = []
                for res in available_resources:
                    if res.id in assigned_resource_ids:
                        continue
                    if res.type != res_type:
                        continue
                    # Cannot allocate a resource constrained to another incident
                    if res.id in locked_resources and locked_resources[res.id][0] != inc.id:
                        continue

                    eta = calc_eta(res.location, inc.location)
                    candidates.append((res, eta))

                # Filter by max acceptable ETA for the incident tier
                eligible = [(r, eta) for (r, eta) in candidates if eta <= max_eta]

                if not eligible:
                    missing_for_inc[res_type] = missing_for_inc.get(res_type, 0) + 1
                    if candidates:
                        cand_desc = ", ".join(
                            f"{r.id} (ETA {round(eta, 1)}m > max {max_eta}m)"
                            for r, eta in sorted(candidates, key=lambda x: (x[1], x[0].id))
                        )
                        detail_msg = (
                            f"No eligible {res_type.value} within max ETA {max_eta}m for incident {inc.id} "
                            f"(tier {inc.tier.value}). Candidates exceeded limit: [{cand_desc}]"
                        )
                    else:
                        detail_msg = f"No available {res_type.value} for incident {inc.id}. Slot unmet."

                    traces.append(
                        TraceEntry(
                            agent="allocation",
                            step="unmet_requirement",
                            detail=detail_msg,
                            used_llm=False,
                            fallback_used=False,
                            at_min=clock_min,
                        )
                    )
                else:
                    # Select nearest eligible candidate, break ties deterministically by resource ID
                    eligible.sort(key=lambda item: (item[1], item[0].id))
                    winner, winner_eta = eligible[0]

                    assigned_resource_ids.add(winner.id)
                    incident_fulfilled[inc.id][res_type] = incident_fulfilled[inc.id].get(res_type, 0) + 1

                    dist = 0.0
                    if haversine_km is not None and callable(haversine_km):
                        try:
                            dist = round(haversine_km(winner.location, inc.location), 2)
                        except Exception:
                            dist = max(0.0, round((winner_eta - 2.0) * 40.0 / (1.4 * 60.0), 2))
                    else:
                        dist = max(0.0, round((winner_eta - 2.0) * 40.0 / (1.4 * 60.0), 2))

                    asgn = Assignment(
                        id=f"asgn_{winner.id}_{inc.id}",
                        resource_id=winner.id,
                        incident_id=inc.id,
                        eta_min=round(winner_eta, 2),
                        distance_km=dist,
                        locked=False,
                        approved=False,
                        reason=f"Assigned nearest available {res_type.value} {winner.id} (ETA {round(winner_eta, 1)}m) to incident {inc.id}",
                    )
                    assignments.append(asgn)

                    cand_summary = ", ".join(f"{r.id}:{round(e, 1)}m" for r, e in eligible)
                    traces.append(
                        TraceEntry(
                            agent="allocation",
                            step="assignment",
                            detail=(
                                f"Assigned {winner.id} to {inc.id} (ETA: {round(winner_eta, 1)}m, limit: {max_eta}m). "
                                f"Considered: [{cand_summary}]. Rule: nearest eligible by ETA."
                            ),
                            used_llm=False,
                            fallback_used=False,
                            at_min=clock_min,
                        )
                    )

        if missing_for_inc:
            unmet_list.append(Unmet(incident_id=inc.id, missing=missing_for_inc))

    # 6. Sort assignments deterministically by incident priority then resource id
    incident_order = {inc.id: idx for idx, inc in enumerate(active_incidents)}
    assignments.sort(key=lambda a: (incident_order.get(a.incident_id, 999), a.resource_id))

    # 7. Compute plan metrics
    metrics = _compute_plan_metrics(assignments, unmet_list, active_incidents, state.resources)

    # 8. Create Plan
    current_version = state.current_plan.version if state.current_plan else 0
    new_version = current_version + 1
    plan = Plan(
        id=f"plan_{new_version}",
        version=new_version,
        assignments=assignments,
        unmet=unmet_list,
        metrics=metrics,
    )

    return plan, traces


class AllocationSubAgent:
    """Allocation subagent adhering to the SubAgent protocol."""

    name: str = "allocation"

    def run(
        self, state: CrisisState, ctx: Optional[TriggerContext] = None
    ) -> SubAgentResult:
        plan, traces = allocate(state, constraints=state.constraints)
        return SubAgentResult(payload={"plan": plan}, traces=traces)


# Module-level agent instance
allocation_agent = AllocationSubAgent()
