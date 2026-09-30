from backend.models.domain import CrisisState, TraceEntry, LatLng, Assignment
from backend.models.enums import TriggerKind, FacilityKind, IncidentType, ResourceStatus
from backend.subagents.base import SubAgent, TriggerContext, SubAgentResult
from backend.services.geo import haversine_km, eta_minutes, interpolate

class LogisticsAgent(SubAgent):
    name: str = "logistics"

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces = []
        assignments_out = []
        positions_out = {}
        
        plan = state.proposed_plan if state.proposed_plan else state.current_plan

        if not plan or not plan.assignments:
            return SubAgentResult(payload={"assignments": [], "positions": {}}, traces=[])

        for a in plan.assignments:
            new_a = a.model_copy()
            resource = next((r for r in state.resources if r.id == new_a.resource_id), None)
            incident = next((i for i in state.incidents if i.id == new_a.incident_id), None)
            
            if resource and incident:
                dist = haversine_km(resource.base, incident.location)
                eta = eta_minutes(resource.base, incident.location)
                
                new_a.distance_km = dist
                new_a.eta_min = eta
                
                traces.append(TraceEntry(
                    agent=self.name,
                    step="routing",
                    detail=f"Calculated distance {dist:.1f}km and ETA {eta:.1f}min for {resource.id} to {incident.id}",
                    used_llm=False,
                    fallback_used=False,
                    at_min=state.clock_min
                ))
                
                if incident.type == IncidentType.medical and not new_a.facility_id:
                    best_hospital = None
                    best_dist = float('inf')
                    for fac in state.facilities:
                        if fac.kind == FacilityKind.hospital and fac.load < fac.capacity:
                            d = haversine_km(incident.location, fac.location)
                            if d < best_dist:
                                best_dist = d
                                best_hospital = fac
                    
                    if best_hospital:
                        new_a.facility_id = best_hospital.id
                        traces.append(TraceEntry(
                            agent=self.name,
                            step="facility_selection",
                            detail=f"Selected hospital {best_hospital.id} at {best_dist:.1f}km for medical incident {incident.id}",
                            used_llm=False,
                            fallback_used=False,
                            at_min=state.clock_min
                        ))

                if resource.status == ResourceStatus.en_route:
                    elapsed = max(0, state.clock_min - incident.reported_at_min)
                    fraction = elapsed / eta if eta > 0 else 1.0
                    fraction = min(1.0, fraction)
                    positions_out[resource.id] = interpolate(resource.base, incident.location, fraction)
                
            assignments_out.append(new_a)
            
        return SubAgentResult(
            payload={"assignments": assignments_out, "positions": positions_out},
            traces=traces
        )
