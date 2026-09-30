# Agent spec card: logistics
Owner: P4. 

## Behavior
Logistics refines resource assignments made by the Allocation agent. It sets precise ETAs and distances, interpolates current positions for en-route resources, and selects the nearest appropriate facilities (e.g., hospitals with free capacity for medical incidents, shelters for rescue incidents). It marks resources as `on_scene` when their travel is complete. It must never invent incidents, change incident priorities, or override the overall allocation logic (e.g. preemptions) set by the Allocation agent.

## Tools
- Internal: `geo.eta_minutes`, `geo.haversine_km`, `geo.interpolate`
- External: Map tiles (with a plain fallback layer when unavailable to ensure divIcon markers remain usable).

## Workflow
1. Receive the proposed plan (from Allocation) and the current `CrisisState`.
2. Rank candidate resources by ETA for given incidents.
3. For medical or rescue incidents, choose the nearest suitable facility with free capacity.
4. Calculate and set precise `eta_min` and `distance_km` for assignments.
5. Interpolate `positions` for en-route resources based on `fraction = elapsed / eta`.
6. Mark a resource `on_scene` when the elapsed time meets or exceeds ETA.
7. Return updated payload containing `assignments`, `positions`, and updated facility `load`.

## Triggers
- time_advance
- new_incident
- escalation
- resource_failure
- what_if

## Logging
- Traces state distances used to calculate ETAs and facility selection reasons.
- Records candidate facilities considered and the final selection based on distance and capacity.
