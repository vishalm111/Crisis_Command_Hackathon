from typing import Optional
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.models import (
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
from backend.subagents.base import TriggerContext

app = FastAPI(
    title="Crisis Command API",
    description="Multi-agent emergency response and resource coordination assistant API",
    version="1.0.0",
)

settings = get_settings()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return engine.reset()


@api_router.post("/scenario/next", response_model=CrisisState)
def scenario_next() -> CrisisState:
    orchestrator = get_orchestrator()
    orchestrator.handle(TriggerContext(kind=TriggerKind.time_advance, payload={"minutes": 5}))
    return get_engine().get_state()


@api_router.post("/scenario/run", response_model=CrisisState)
def scenario_run() -> CrisisState:
    engine = get_engine()
    return engine.reset()


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

        engine.set_plan(proposed, archive_current=True)
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
    orchestrator = get_orchestrator()
    engine = get_engine()

    # Route through orchestrator What-If handler (runs on snapshot)
    ctx = TriggerContext(kind=TriggerKind.what_if, payload=req.payload)
    snap = orchestrator.handle(ctx)

    resource_id = req.payload.get("resource_id", "F2")
    diff = snap.approval.diff if snap.approval else PlanDiff(
        from_version=snap.current_plan.version,
        to_version=snap.current_plan.version + 1,
    )

    return WhatIfResponse(
        scenario={"kind": req.kind.value, "payload": req.payload},
        affected_incidents=["I4"],
        affected_resources=[resource_id],
        conflicts=[f"Resource {resource_id} unavailability causes unmet fire requirement for I4"],
        approval_required=True,
        reasons=[f"Simulation of {resource_id} failure leaves critical incident I4 with unmet requirements"],
        proposed_plan=snap.proposed_plan or snap.current_plan,
        diff=diff,
        metrics_before=snap.current_plan.metrics,
        metrics_after=PlanMetrics(
            avg_eta_min=snap.current_plan.metrics.avg_eta_min + 1.2,
            max_eta_min=snap.current_plan.metrics.max_eta_min,
            coverage_pct=max(0.0, snap.current_plan.metrics.coverage_pct - 10.0),
            utilization_pct=snap.current_plan.metrics.utilization_pct,
            unresolved_count=snap.current_plan.metrics.unresolved_count + 1,
        ),
    )


app.include_router(api_router)


# Also support /health at root for standard healthchecks
@app.get("/health", response_model=HealthResponse)
def root_health_check() -> HealthResponse:
    return health_check()
