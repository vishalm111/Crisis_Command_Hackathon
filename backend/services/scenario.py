"""Scenario runner service (Contract Section 9 & P4).

Orchestrates the 7-step Hackathon demonstration scenario:
1. t=0: I1 medical (MG Road), severity 3, 2 people. Nearest ambulance dispatched.
2. t=5: I2 fire (Shivajinagar warehouse), severity 4, 6 people. Dispatches fire engine and ambulance.
3. t=10: I3 free-text vague report. Flagged with uncertain_fields, needs_confirmation=True, no dispatch.
4. t=15: I4 building collapse (Town Hall), severity 5, 20 people. Preempts A1 from I1 (severity 3, auto-committed).
5. t=20: A3 resource failure while en route to I4. Preemption of A2 from I2 (severity 4) triggers human approval gate!
6. t=22: Human coordinator approves pending request. Plan promoted and constraints locked.
7. What-If simulation: Hypothesizes F2 failure on snapshot without touching live state.
"""

from typing import Optional
from backend.models.domain import (
    CrisisState,
    Incident,
    LatLng,
)
from backend.models.enums import (
    ApprovalStatus,
    IncidentSource,
    IncidentStatus,
    IncidentType,
    ResourceStatus,
    ResourceType,
    TriggerKind,
)
from backend.orchestrator.orchestrator import Orchestrator, get_orchestrator
from backend.services.engine import SimulationEngine, get_engine
from backend.subagents.base import TriggerContext
from backend.subagents.whatif import WhatIfAgent

_current_step: int = 0


def get_scenario_step() -> int:
    global _current_step
    return _current_step


def reset_scenario(engine: Optional[SimulationEngine] = None) -> CrisisState:
    global _current_step
    _current_step = 0
    eng = engine or get_engine()
    return eng.reset()


def next_step(
    engine: Optional[SimulationEngine] = None,
    orchestrator: Optional[Orchestrator] = None,
) -> CrisisState:
    """Executes the next step in the demonstration scenario."""
    global _current_step
    eng = engine or get_engine()
    orch = orchestrator or get_orchestrator()

    _current_step += 1

    if _current_step == 1:
        # Step 1: t=0, Incident I1 Medical at MG Road
        i1 = Incident(
            id="I1",
            type=IncidentType.medical,
            severity=3,
            description="Motorcycle accident with pedestrian injury near MG Road Metro",
            location=LatLng(lat=12.9716, lng=77.5946, label="MG Road Metro"),
            people_affected=2,
            required={ResourceType.ambulance: 1},
            status=IncidentStatus.new,
            reported_at_min=eng.get_state().clock_min,
            source=IncidentSource.structured,
        )
        orch.handle(TriggerContext(kind=TriggerKind.new_incident, payload={"incident": i1}))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 1] Incident I1 registered and dispatched")
        return eng.get_state()

    elif _current_step == 2:
        # Step 2: t=5, Incident I2 Fire (Warehouse) at Shivajinagar
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
        i2 = Incident(
            id="I2",
            type=IncidentType.fire,
            severity=4,
            description="Commercial warehouse electrical fire with smoke inhalation casualties",
            location=LatLng(lat=12.9830, lng=77.6040, label="Shivajinagar Depot"),
            people_affected=6,
            required={ResourceType.fire_engine: 1, ResourceType.ambulance: 1},
            status=IncidentStatus.new,
            reported_at_min=eng.get_state().clock_min,
            source=IncidentSource.structured,
        )
        orch.handle(TriggerContext(kind=TriggerKind.new_incident, payload={"incident": i2}))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 2] Incident I2 registered and dispatched")
        return eng.get_state()

    elif _current_step == 3:
        # Step 3: t=10, Free-text vague report near Richmond Circle flyover
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
        raw_report = "Elderly man collapsed near the flyover, unconscious and possible heart attack"
        orch.handle(TriggerContext(
            kind=TriggerKind.new_incident,
            payload={"free_text": raw_report, "incident_id": "I3"},
        ))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 3] Unconfirmed free-text report I3 processed")
        return eng.get_state()

    elif _current_step == 4:
        # Step 4: t=15, Incident I4 Building collapse at Town Hall
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
        i4 = Incident(
            id="I4",
            type=IncidentType.rescue,
            severity=5,
            description="Multi-story commercial building collapse with trapped survivors",
            location=LatLng(lat=12.9630, lng=77.5830, label="Town Hall"),
            people_affected=20,
            required={
                ResourceType.rescue_team: 1,
                ResourceType.ambulance: 2,
                ResourceType.fire_engine: 1,
            },
            status=IncidentStatus.new,
            reported_at_min=eng.get_state().clock_min,
            source=IncidentSource.structured,
        )
        orch.handle(TriggerContext(kind=TriggerKind.new_incident, payload={"incident": i4}))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 4] Critical incident I4 registered; preemption evaluated")
        return eng.get_state()

    elif _current_step == 5:
        # Step 5: t=20, Resource failure: A3 fails while en route to I4
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
        try:
            eng.update_resource_status("A3", ResourceStatus.unavailable)
        except KeyError:
            pass
        orch.handle(TriggerContext(kind=TriggerKind.resource_failure, payload={"resource_id": "A3"}))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 5] Resource A3 failed; preemption requires approval")
        return eng.get_state()

    elif _current_step == 6:
        # Step 6: t=22, Human Coordinator approves pending gate request
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 2}))
        state = eng.get_state()
        if state.approval and state.approval.status == ApprovalStatus.pending:
            appr_id = state.approval.id
            eng.record_approval_decision(appr_id, ApprovalStatus.approved)
            state.approval.status = ApprovalStatus.approved
            if state.proposed_plan:
                proposed = state.proposed_plan.model_copy(deep=True)
                proposed.version = state.current_plan.version + 1
                for asg in proposed.assignments:
                    asg.approved = True
                eng.set_plan(proposed, archive_current=True, diff=state.approval.diff)
                eng.set_proposed_plan(None)
            orch.handle(TriggerContext(
                kind=TriggerKind.approval_decision,
                payload={"approval_id": appr_id, "decision": "approve"},
            ))
            eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 6] Approval {appr_id} approved by coordinator")
        return eng.get_state()

    elif _current_step == 7:
        # Step 7: Resource Restoration
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 3}))
        try:
            eng.update_resource_status("A3", ResourceStatus.available)
        except KeyError:
            pass
        orch.handle(TriggerContext(kind=TriggerKind.resource_restored, payload={"resource_id": "A3"}))
        eng.log(f"t={eng.get_state().clock_min}: [Scenario Step 7] Resource A3 restored to active service")
        return eng.get_state()

    else:
        # Further steps advance time by 5 minutes
        orch.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
        eng.log(f"t={eng.get_state().clock_min}: Scenario completed. Time advanced by 5 min.")
        return eng.get_state()


def run_all(
    engine: Optional[SimulationEngine] = None,
    orchestrator: Optional[Orchestrator] = None,
) -> CrisisState:
    """Resets to initial seed state and plays through the entire scenario to completion."""
    eng = engine or get_engine()
    orch = orchestrator or get_orchestrator()

    reset_scenario(eng)
    for _ in range(7):
        next_step(eng, orch)

    return eng.get_state()
