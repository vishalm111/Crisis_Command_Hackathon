import logging
import time
from typing import Optional
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


app.include_router(api_router)


# Also support /health at root for standard healthchecks
@app.get("/health", response_model=HealthResponse)
def root_health_check() -> HealthResponse:
    return health_check()
