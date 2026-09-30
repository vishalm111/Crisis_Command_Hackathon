import logging
import time
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.models import (
    Alert,
    AlertLevel,
    ApprovalDecisionRequest,
    ApprovalStatus,
    Constraint,
    ConstraintKind,
    CrisisState,
    DiffChangeKind,
    ErrorResponse,
    HealthResponse,
    Incident,
    IncidentCreateRequest,
    IncidentEscalateRequest,
    IncidentSource,
    IncidentStatus,
    IncidentType,
    LatLng,
    Plan,
    PlanDiff,
    PlanMetrics,
    Resource,
    ResourceStatus,
    ResourceType,
    TimeAdvanceRequest,
    TriggerKind,
    WhatIfRequest,
    WhatIfResponse,
)
from backend.orchestrator.orchestrator import get_orchestrator
from backend.services.engine import SimulationEngine, get_engine
from backend.services.scenario import next_step, reset_scenario, run_all
from backend.subagents.base import TriggerContext
from backend.subagents.whatif import WhatIfAgent

app = FastAPI(
    title="Crisis Command API",
    description="Multi-agent emergency response and resource coordination assistant API",
    version="1.0.0",
)

settings = get_settings()

# Enable CORS
is_wildcard = "*" in (settings.cors_origins or ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


logger = logging.getLogger(__name__)


# Standardized error response handler: {"error": str}
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    first_error = exc.errors()[0] if exc.errors() else {"msg": "Validation error"}
    msg = f"{first_error.get('loc', ('body',))[-1]}: {first_error.get('msg', 'Invalid input')}"
    return JSONResponse(
        status_code=422,
        content={"error": msg},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error processing %s: %s", request.url.path, exc, exc_info=True)
    engine = get_engine()
    try:
        alert = Alert(
            id=f"alt_sys_{int(time.time() * 1000)}",
            level=AlertLevel.critical,
            text=f"System error in {request.url.path}: {str(exc)}",
            at_min=engine.get_state().clock_min,
        )
        engine.add_alert(alert)
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"error": f"Internal system error: {str(exc)}"},
    )


api_router = APIRouter(prefix="/api")


@api_router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    llm_status = "enabled_ok" if (settings.llm_enabled and settings.xai_api_key) else "disabled"
    return HealthResponse(ok=True, llm_status=llm_status)


@api_router.get("/state", response_model=CrisisState)
def get_state() -> CrisisState:
    engine = get_engine()
    return engine.get_state()


@api_router.post("/scenario/reset", response_model=CrisisState)
def scenario_reset() -> CrisisState:
    engine = get_engine()
    return reset_scenario(engine)


@api_router.post("/scenario/next", response_model=CrisisState)
def scenario_next() -> CrisisState:
    engine = get_engine()
    orchestrator = get_orchestrator()
    return next_step(engine, orchestrator)


@api_router.post("/scenario/run", response_model=CrisisState)
def scenario_run() -> CrisisState:
    engine = get_engine()
    orchestrator = get_orchestrator()
    return run_all(engine, orchestrator)


@api_router.post("/incidents", response_model=Incident)
def create_incident(req: IncidentCreateRequest) -> Incident:
    engine = get_engine()
    orchestrator = get_orchestrator()
    state = engine.get_state()

    incident_id = req.id or f"I{len(state.incidents) + 1}"

    if req.free_text:
        new_inc = Incident(
            id=incident_id,
            type=req.type or IncidentType.medical,
            severity=req.severity or 2,
            description=req.free_text,
            location=req.location or LatLng(lat=12.9716, lng=77.5946, label="Reported location"),
            people_affected=req.people_affected or 1,
            required=req.required or {ResourceType.ambulance: 1},
            status=IncidentStatus.new,
            reported_at_min=state.clock_min,
            uncertain_fields=["location", "severity"],
            needs_confirmation=True,
            source=IncidentSource.free_text,
        )
    else:
        new_inc = Incident(
            id=incident_id,
            type=req.type or IncidentType.medical,
            severity=req.severity or 3,
            description=req.description or "Emergency incident reported",
            location=req.location or LatLng(lat=12.9716, lng=77.5946),
            people_affected=req.people_affected or 1,
            required=req.required or {ResourceType.ambulance: 1},
            status=IncidentStatus.new,
            reported_at_min=state.clock_min,
            source=IncidentSource.structured,
        )

    # Route through orchestrator workflow
    ctx = TriggerContext(kind=TriggerKind.new_incident, payload={"incident": new_inc})
    orchestrator.handle(ctx)
    return new_inc


@api_router.post("/incidents/{incident_id}/escalate", response_model=Incident)
def escalate_incident(incident_id: str, req: IncidentEscalateRequest) -> Incident:
    engine = get_engine()
    orchestrator = get_orchestrator()
    state = engine.get_state()

    target_inc = next((inc for inc in state.incidents if inc.id == incident_id), None)
    if not target_inc:
        raise HTTPException(status_code=404, detail=f"Incident with id {incident_id} not found")

    target_inc.severity = req.severity
    ctx = TriggerContext(
        kind=TriggerKind.escalation,
        payload={"incident_id": incident_id, "severity": req.severity},
    )
    orchestrator.handle(ctx)

    updated_inc = next((inc for inc in engine.get_state().incidents if inc.id == incident_id), target_inc)
    return updated_inc


@api_router.post("/resources/{resource_id}/fail", response_model=Resource)
def fail_resource(resource_id: str) -> Resource:
    engine = get_engine()
    orchestrator = get_orchestrator()

    try:
        engine.update_resource_status(resource_id, ResourceStatus.unavailable)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Resource with id {resource_id} not found")

    ctx = TriggerContext(kind=TriggerKind.resource_failure, payload={"resource_id": resource_id})
    orchestrator.handle(ctx)

    state = engine.get_state()
    res = next(r for r in state.resources if r.id == resource_id)
    return res


@api_router.post("/resources/{resource_id}/restore", response_model=Resource)
def restore_resource(resource_id: str) -> Resource:
    engine = get_engine()
    orchestrator = get_orchestrator()

    try:
        engine.update_resource_status(resource_id, ResourceStatus.available)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Resource with id {resource_id} not found")

    ctx = TriggerContext(kind=TriggerKind.resource_restored, payload={"resource_id": resource_id})
    orchestrator.handle(ctx)

    state = engine.get_state()
    res = next(r for r in state.resources if r.id == resource_id)
    return res


@api_router.post("/time/advance")
def time_advance(req: TimeAdvanceRequest) -> dict:
    orchestrator = get_orchestrator()
    ctx = TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": req.minutes})
    orchestrator.handle(ctx)
    return {"clock_min": get_engine().get_state().clock_min}


@api_router.post("/approval/{approval_id}/approve")
def approve_request(approval_id: str, req: Optional[ApprovalDecisionRequest] = None) -> dict:
    engine = get_engine()
    orchestrator = get_orchestrator()
    state = engine.get_state()

    # Check if this approval was already decided
    past_decision = engine.get_approval_decision(approval_id)
    if past_decision is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Approval request {approval_id} has already been decided ({past_decision.value})"
        )

    if not state.approval or state.approval.id != approval_id:
        raise HTTPException(status_code=404, detail=f"Approval request {approval_id} not found")

    if state.approval.status != ApprovalStatus.pending:
        raise HTTPException(status_code=409, detail=f"Approval request {approval_id} has already been decided")

    # Record decision
    engine.record_approval_decision(approval_id, ApprovalStatus.approved)
    state.approval.status = ApprovalStatus.approved

    # Promote proposed_plan to current_plan with bumped version and locked constraints
    if state.proposed_plan:
        proposed = state.proposed_plan.model_copy(deep=True)
        proposed.version = state.current_plan.version + 1

        # Lock approved moves
        for asg in proposed.assignments:
            asg.approved = True
            engine.add_constraint(
                Constraint(
                    resource_id=asg.resource_id,
                    incident_id=asg.incident_id,
                    kind=ConstraintKind.approved,
                )
            )

        engine.set_plan(proposed, archive_current=True, diff=state.approval.diff)
        engine.set_proposed_plan(None)

    # Inform orchestrator of approval decision
    ctx = TriggerContext(
        kind=TriggerKind.approval_decision,
        payload={"approval_id": approval_id, "decision": "approve"},
    )
    orchestrator.handle(ctx)

    engine.log(f"t={state.clock_min}: Approval {approval_id} approved by coordinator")
    return {"status": "approved", "approval_id": approval_id}


@api_router.post("/approval/{approval_id}/reject")
def reject_request(approval_id: str, req: Optional[ApprovalDecisionRequest] = None) -> dict:
    engine = get_engine()
    orchestrator = get_orchestrator()
    state = engine.get_state()

    # Check if this approval was already decided
    past_decision = engine.get_approval_decision(approval_id)
    if past_decision is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Approval request {approval_id} has already been decided ({past_decision.value})"
        )

    if not state.approval or state.approval.id != approval_id:
        raise HTTPException(status_code=404, detail=f"Approval request {approval_id} not found")

    if state.approval.status != ApprovalStatus.pending:
        raise HTTPException(status_code=409, detail=f"Approval request {approval_id} has already been decided")

    # Record decision
    engine.record_approval_decision(approval_id, ApprovalStatus.rejected)
    state.approval.status = ApprovalStatus.rejected

    # Record constraints so rejected preemption move is not re-attempted
    if state.approval.diff:
        for change in state.approval.diff.changes:
            if change.kind == DiffChangeKind.reassigned and change.old_incident_id:
                engine.add_constraint(
                    Constraint(
                        resource_id=change.resource_id,
                        incident_id=change.old_incident_id,
                        kind=ConstraintKind.locked,
                    )
                )

    engine.set_proposed_plan(None)

    # Inform orchestrator of rejection decision
    ctx = TriggerContext(
        kind=TriggerKind.approval_decision,
        payload={"approval_id": approval_id, "decision": "reject"},
    )
    orchestrator.handle(ctx)

    engine.log(f"t={state.clock_min}: Approval {approval_id} rejected by coordinator")
    return {"status": "rejected", "approval_id": approval_id}


@api_router.post("/whatif", response_model=WhatIfResponse)
def what_if_analysis(req: WhatIfRequest) -> WhatIfResponse:
    engine = get_engine()
    state = engine.get_state()
    agent = WhatIfAgent()

    if req.kind == TriggerKind.what_if:
        raw_kind = req.payload.get("kind", TriggerKind.resource_failure.value)
        if isinstance(raw_kind, str):
            sim_kind = TriggerKind(raw_kind)
        else:
            sim_kind = raw_kind
        sim_payload = req.payload.get("payload", req.payload)
    else:
        sim_kind = req.kind
        sim_payload = req.payload

    ctx = TriggerContext(kind=sim_kind, payload=sim_payload)
    result = agent.run(state, ctx)
    return WhatIfResponse.model_validate(result.payload)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    referenced_entities: list[str] = Field(default_factory=list)
    used_llm: bool = False


class SituationBriefResponse(BaseModel):
    critical_count: int
    unresolved_count: int
    most_urgent_incident: Optional[str] = None
    bottleneck_resource: Optional[str] = None
    proposed_action: Optional[str] = None
    approval_required: bool = False
    narrative: str
    used_llm: bool = False


class ChaosRequest(BaseModel):
    intensity: str = "medium"
    allowed_events: list[str] = Field(default_factory=lambda: ["failure", "incident", "escalation", "restore"])


class ChaosResponse(BaseModel):
    event_type: str
    description: str
    affected_entity: str


@api_router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest) -> ChatResponse:
    engine = get_engine()
    state = engine.get_state()
    msg = req.message.lower().strip()

    referenced_entities: list[str] = []
    answer = ""

    # Check for highest priority / most critical
    if any(k in msg for k in ["highest priority", "most critical", "most urgent", "urgent"]):
        if state.incidents:
            sorted_incs = sorted(state.incidents, key=lambda i: (i.severity, i.priority), reverse=True)
            top = sorted_incs[0]
            referenced_entities.append(top.id)
            req_str = ", ".join(f"{cnt}x {rt.value}" for rt, cnt in top.required.items()) if top.required else "None"
            answer = f"The most critical active event is incident **{top.id}** ({top.type.value}, severity {top.severity}/5). Description: '{top.description}'. Location: {top.location.label or 'Central'}. Demands: {req_str}."
        else:
            answer = "There are currently no active incidents recorded in the system."

    # Check for why A2 was selected or considered
    elif "why" in msg and ("a2" in msg or "selected" in msg or "considered" in msg):
        a2_res = next((r for r in state.resources if r.id == "A2"), None)
        if a2_res:
            referenced_entities.append("A2")
            asg = next((a for a in state.current_plan.assignments if a.resource_id == "A2"), None)
            proposed_asg = next((a for a in (state.proposed_plan.assignments if state.proposed_plan else []) if a.resource_id == "A2"), None)
            if proposed_asg:
                referenced_entities.append(proposed_asg.incident_id)
                answer = f"**A2** is selected because it is an active ambulance with proximity to **{proposed_asg.incident_id}** (ETA {proposed_asg.eta_min:.1f}m). Unit A3 has failed, and other ambulances are either locked or farther away. However, reassignment from {a2_res.assigned_incident_id or 'previous base'} triggers a human approval gate."
            elif asg:
                referenced_entities.append(asg.incident_id)
                answer = f"**A2** was assigned to **{asg.incident_id}** (ETA {asg.eta_min:.1f}m) based on type matching ({a2_res.type.value}), route proximity, and availability."
            else:
                answer = f"**A2** is currently {a2_res.status.value} at {a2_res.location.label or 'base'}, available for rapid dispatch."
        else:
            answer = "Unit A2 was not found in the responder fleet."

    # Check for unavailable / failed resources
    elif any(k in msg for k in ["unavailable", "failed", "offline"]):
        failed = [r.id for r in state.resources if r.status == ResourceStatus.unavailable]
        if failed:
            referenced_entities.extend(failed)
            answer = f"The following resources are currently offline/failed: **{', '.join(failed)}**. Assignment invalidation and alternative rerouting have been evaluated."
        else:
            answer = "All fleet resources are operational. No units are currently flagged as failed or unavailable."

    # Check for why an incident is unresolved
    elif "unresolved" in msg or "i1" in msg:
        i1_unmet = next((u for u in state.current_plan.unmet if u.incident_id == "I1"), None)
        referenced_entities.append("I1")
        if i1_unmet and any(v > 0 for v in i1_unmet.missing.values()):
            missing = ", ".join(f"{cnt}x {rt.value}" for rt, cnt in i1_unmet.missing.items())
            answer = f"Incident **I1** is currently unresolved because it is missing {missing}. Its initially dispatched ambulance (A1) was preempted to cover catastrophic incident I4, which has higher severity (5 vs 3)."
        else:
            unresolved = [u.incident_id for u in state.current_plan.unmet if any(v > 0 for v in u.missing.values())]
            if unresolved:
                referenced_entities.extend(unresolved)
                answer = f"Currently, incident(s) **{', '.join(unresolved)}** have unresolved resource slots due to fleet capacity limits or higher-priority preemptions."
            else:
                answer = "All confirmed active incidents currently have their required resource allocations fulfilled in the active plan."

    # Check for latest plan changes / what changed
    elif any(k in msg for k in ["changed", "latest plan", "plan change", "diff"]):
        if state.latest_diff and state.latest_diff.changes:
            ch_desc = []
            for c in state.latest_diff.changes:
                referenced_entities.append(c.resource_id)
                if c.new_incident_id and c.old_incident_id:
                    ch_desc.append(f"{c.resource_id}: {c.old_incident_id} → {c.new_incident_id}")
                elif c.new_incident_id:
                    ch_desc.append(f"{c.resource_id} → {c.new_incident_id}")
                elif c.old_incident_id:
                    ch_desc.append(f"{c.resource_id} removed from {c.old_incident_id}")
            answer = f"Plan update v{state.latest_diff.from_version} → v{state.latest_diff.to_version} recorded {len(state.latest_diff.changes)} changes: {', '.join(ch_desc)}."
        else:
            answer = f"The active plan is v{state.current_plan.version} ({state.current_plan.id}) with {len(state.current_plan.assignments)} assignments and no pending diff discrepancies."

    # Check for approval gate
    elif "approval" in msg or "gate" in msg:
        if state.approval and state.approval.status == ApprovalStatus.pending:
            referenced_entities.append(state.approval.id)
            reasons = "; ".join(state.approval.reasons)
            answer = f"Approval gate **{state.approval.id}** is currently **PENDING**. Trigger reasons: {reasons}. Operator intervention is required before changes can be promoted."
        else:
            answer = "Approval gate is currently clear. No pending human coordinator intervention is required."

    # General summary
    else:
        act_inc = len([i for i in state.incidents if i.status != IncidentStatus.resolved])
        crit_inc = len([i for i in state.incidents if i.severity >= 5])
        unmet_cnt = len(state.current_plan.unmet)
        avail_res = len([r for r in state.resources if r.status == ResourceStatus.available])
        answer = f"System Status (t={state.clock_min}m): {act_inc} active incidents ({crit_inc} critical, {unmet_cnt} unresolved), {avail_res}/{len(state.resources)} units available. Plan v{state.current_plan.version} active with {len(state.current_plan.assignments)} dispatches."

    return ChatResponse(
        answer=answer,
        referenced_entities=list(dict.fromkeys(referenced_entities)),
        used_llm=False
    )


@api_router.post("/situation-brief", response_model=SituationBriefResponse)
def situation_brief() -> SituationBriefResponse:
    engine = get_engine()
    state = engine.get_state()

    crit_incidents = [i for i in state.incidents if i.severity >= 5 or i.tier.value == "critical"]
    critical_count = len(crit_incidents)
    unmet_incidents = [u.incident_id for u in state.current_plan.unmet if any(v > 0 for v in u.missing.values())]
    unresolved_count = len(unmet_incidents)

    # Most urgent incident
    most_urgent = None
    if state.incidents:
        sorted_incs = sorted(state.incidents, key=lambda i: (i.severity, i.priority), reverse=True)
        most_urgent = f"{sorted_incs[0].id} — {sorted_incs[0].description[:35]}"

    # Main bottleneck
    ambulance_unmet = any(u.missing.get(ResourceType.ambulance, 0) > 0 for u in state.current_plan.unmet)
    fire_unmet = any(u.missing.get(ResourceType.fire_engine, 0) > 0 for u in state.current_plan.unmet)
    bottleneck = "Ambulance capacity" if ambulance_unmet else ("Fire engine capacity" if fire_unmet else "Fleet load balanced")

    # Proposed action
    proposed_action = None
    approval_required = False
    if state.approval and state.approval.status == ApprovalStatus.pending:
        approval_required = True
        reasons = "; ".join(state.approval.reasons[:2])
        proposed_action = f"Reallocation pending coordinator approval: {reasons}"
    elif state.latest_diff and state.latest_diff.changes:
        c = state.latest_diff.changes[0]
        proposed_action = f"Latest move: {c.resource_id} → {c.new_incident_id or 'base'}"
    else:
        proposed_action = "Maintain active baseline assignments"

    narrative = f"""### AI Situation Summary (t={state.clock_min}m)
- **Critical Incidents:** {critical_count} active
- **Unresolved Demands:** {unresolved_count} ({', '.join(unmet_incidents) if unmet_incidents else 'None'})
- **Most Urgent:** {most_urgent or 'None'}
- **Current Bottleneck:** {bottleneck}
- **Proposed Action:** {proposed_action}
- **Approval Gate:** {'⚠️ REQUIRED (Action Blocked)' if approval_required else '✅ Clear'}
"""
    return SituationBriefResponse(
        critical_count=critical_count,
        unresolved_count=unresolved_count,
        most_urgent_incident=most_urgent,
        bottleneck_resource=bottleneck,
        proposed_action=proposed_action,
        approval_required=approval_required,
        narrative=narrative,
        used_llm=False
    )


@api_router.post("/chaos/step", response_model=ChaosResponse)
def chaos_step(req: ChaosRequest) -> ChaosResponse:
    engine = get_engine()
    orchestrator = get_orchestrator()
    state = engine.get_state()

    avail_resources = [r for r in state.resources if r.status == ResourceStatus.available]
    unavail_resources = [r for r in state.resources if r.status == ResourceStatus.unavailable]

    event_type = "Resource Failure"
    desc = ""
    affected = ""

    if "failure" in req.allowed_events and avail_resources:
        target = avail_resources[0]
        engine.update_resource_status(target.id, ResourceStatus.unavailable)
        ctx = TriggerContext(kind=TriggerKind.resource_failure, payload={"resource_id": target.id})
        orchestrator.handle(ctx)
        event_type = "Resource Failure"
        desc = f"Simulated unexpected breakdown on unit {target.id} ({target.type.value})"
        affected = target.id
    elif "restore" in req.allowed_events and unavail_resources:
        target = unavail_resources[0]
        engine.update_resource_status(target.id, ResourceStatus.available)
        ctx = TriggerContext(kind=TriggerKind.resource_restored, payload={"resource_id": target.id})
        orchestrator.handle(ctx)
        event_type = "Resource Restored"
        desc = f"Rapid maintenance restored unit {target.id} to active service"
        affected = target.id
    elif "escalation" in req.allowed_events and state.incidents:
        target_inc = state.incidents[0]
        new_sev = min(5, target_inc.severity + 1)
        target_inc.severity = new_sev
        ctx = TriggerContext(kind=TriggerKind.escalation, payload={"incident_id": target_inc.id, "severity": new_sev})
        orchestrator.handle(ctx)
        event_type = "Incident Escalation"
        desc = f"Incident {target_inc.id} escalated to Severity {new_sev}/5"
        affected = target_inc.id
    else:
        engine.advance_clock(5)
        event_type = "Time Advance"
        desc = "Simulation clock advanced by 5 minutes under stress conditions"
        affected = f"t={state.clock_min}m"

    engine.log(f"t={state.clock_min}: [Chaos Mode] {event_type} - {desc}")
    return ChaosResponse(
        event_type=event_type,
        description=desc,
        affected_entity=affected
    )


app.include_router(api_router)


# Also support /health at root for standard healthchecks
@app.get("/health", response_model=HealthResponse)
def root_health_check() -> HealthResponse:
    return health_check()
