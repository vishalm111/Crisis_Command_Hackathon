"""Logistics subagent (Contract Section 4 & P4).

Refines dispatch plan assignments with precise distances and ETAs,
interpolates en-route positions based on elapsed time, selects optimal
facilities (hospitals for medical, shelters for rescue) adhering to capacity limits,
and marks arrivals on-scene.
"""

from typing import Any, Optional
from backend.models.domain import Assignment, CrisisState, LatLng, TraceEntry
from backend.models.enums import FacilityKind, IncidentType, ResourceStatus, TriggerKind
from backend.services.geo import eta_minutes, haversine_km, interpolate
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext


class LogisticsAgent(SubAgent):
    """Logistics subagent refining routing, destination facilities, and movement."""

    name: str = "logistics"

    def run(self, state: CrisisState, ctx: Optional[TriggerContext] = None) -> SubAgentResult:
        traces: list[TraceEntry] = []
        assignments_out: list[Assignment] = []
        positions_out: dict[str, LatLng] = {}
        facility_loads: dict[str, int] = {f.id: f.load for f in state.facilities}

        plan = state.proposed_plan if state.proposed_plan else state.current_plan
        if not plan or not plan.assignments:
            trace = TraceEntry(
                agent=self.name,
                step="time_sync",
                detail=f"Synchronized logistics at t={state.clock_min}m (0 active assignments to route)",
                used_llm=False,
                fallback_used=False,
                at_min=state.clock_min,
            )
            return SubAgentResult(
                payload={"assignments": [], "positions": {}, "facility_loads": facility_loads},
                traces=[trace],
            )

        resource_map = {r.id: r for r in state.resources}
        incident_map = {inc.id: inc for inc in state.incidents}

        for a in plan.assignments:
            new_a = a.model_copy(deep=True)
            resource = resource_map.get(new_a.resource_id)
            incident = incident_map.get(new_a.incident_id)

            if resource and incident:
                # 1. Calculate distance and ETA from resource base/location to incident
                dist = haversine_km(resource.base, incident.location)
                eta = eta_minutes(resource.base, incident.location)

                new_a.distance_km = round(dist, 2)
                new_a.eta_min = round(eta, 2)

                traces.append(
                    TraceEntry(
                        agent=self.name,
                        step="routing",
                        detail=f"Calculated distance {dist:.1f}km and ETA {eta:.1f}min for unit {resource.id} to {incident.id}",
                        used_llm=False,
                        fallback_used=False,
                        at_min=state.clock_min,
                    )
                )

                # 2. Select appropriate facility
                # Hospitals for medical incidents
                if incident.type == IncidentType.medical and not new_a.facility_id:
                    best_hospital = None
                    best_dist = float("inf")
                    for fac in state.facilities:
                        current_load = facility_loads.get(fac.id, fac.load)
                        if fac.kind == FacilityKind.hospital and current_load < fac.capacity:
                            d = haversine_km(incident.location, fac.location)
                            if d < best_dist:
                                best_dist = d
                                best_hospital = fac

                    if best_hospital:
                        new_a.facility_id = best_hospital.id
                        facility_loads[best_hospital.id] = facility_loads.get(best_hospital.id, 0) + 1
                        traces.append(
                            TraceEntry(
                                agent=self.name,
                                step="facility_selection",
                                detail=(
                                    f"Selected hospital {best_hospital.id} ({best_hospital.name}) at "
                                    f"{best_dist:.1f}km for medical incident {incident.id}"
                                ),
                                used_llm=False,
                                fallback_used=False,
                                at_min=state.clock_min,
                            )
                        )

                # Shelters for rescue incidents
                elif incident.type == IncidentType.rescue and not new_a.facility_id:
                    best_shelter = None
                    best_dist = float("inf")
                    for fac in state.facilities:
                        current_load = facility_loads.get(fac.id, fac.load)
                        if fac.kind == FacilityKind.shelter and current_load < fac.capacity:
                            d = haversine_km(incident.location, fac.location)
                            if d < best_dist:
                                best_dist = d
                                best_shelter = fac

                    if best_shelter:
                        new_a.facility_id = best_shelter.id
                        facility_loads[best_shelter.id] = facility_loads.get(best_shelter.id, 0) + 1
                        traces.append(
                            TraceEntry(
                                agent=self.name,
                                step="facility_selection",
                                detail=(
                                    f"Selected shelter {best_shelter.id} ({best_shelter.name}) at "
                                    f"{best_dist:.1f}km for rescue incident {incident.id}"
                                ),
                                used_llm=False,
                                fallback_used=False,
                                at_min=state.clock_min,
                            )
                        )

                # 3. Position interpolation and arrival detection
                elapsed = max(0, state.clock_min - incident.reported_at_min)
                if eta > 0:
                    fraction = min(1.0, elapsed / eta)
                else:
                    fraction = 1.0

                if fraction >= 1.0:
                    # Resource has arrived on scene
                    positions_out[resource.id] = incident.location
                    if ctx.kind == TriggerKind.time_advance:
                        traces.append(
                            TraceEntry(
                                agent=self.name,
                                step="arrival",
                                detail=f"Unit {resource.id} arrived on-scene at {incident.id} (elapsed {elapsed}m >= ETA {eta:.1f}m)",
                                used_llm=False,
                                fallback_used=False,
                                at_min=state.clock_min,
                            )
                        )
                else:
                    # Resource is en route
                    curr_pos = interpolate(resource.base, incident.location, fraction)
                    positions_out[resource.id] = curr_pos

            assignments_out.append(new_a)

        if not traces:
            traces.append(
                TraceEntry(
                    agent=self.name,
                    step="time_sync",
                    detail=f"Synchronized logistics at t={state.clock_min}m",
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min,
                )
            )

        return SubAgentResult(
            payload={
                "assignments": assignments_out,
                "positions": positions_out,
                "facility_loads": facility_loads,
            },
            traces=traces,
        )


# Backward-compatible aliases
LogisticsSubAgent = LogisticsAgent
logistics_agent = LogisticsAgent()
