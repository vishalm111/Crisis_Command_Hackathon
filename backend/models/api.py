from typing import Any, Optional
from pydantic import BaseModel, Field

from backend.models.domain import LatLng, Plan, PlanDiff, PlanMetrics
from backend.models.enums import IncidentType, ResourceType, TriggerKind


class HealthResponse(BaseModel):
    ok: bool = True
    llm_status: str = "disabled"


class IncidentCreateRequest(BaseModel):
    free_text: Optional[str] = None
    id: Optional[str] = None
    type: Optional[IncidentType] = None
    severity: Optional[int] = Field(default=None, ge=1, le=5)
    description: Optional[str] = None
    location: Optional[LatLng] = None
    people_affected: Optional[int] = None
    required: Optional[dict[ResourceType, int]] = None


class IncidentEscalateRequest(BaseModel):
    severity: int = Field(ge=1, le=5, description="Updated severity from 1 to 5")


class TimeAdvanceRequest(BaseModel):
    minutes: int = Field(ge=1, description="Minutes to advance the simulation clock")


class ApprovalDecisionRequest(BaseModel):
    notes: Optional[str] = None


class WhatIfRequest(BaseModel):
    kind: TriggerKind
    payload: dict[str, Any] = Field(default_factory=dict)


class WhatIfResponse(BaseModel):
    scenario: dict[str, Any] = Field(default_factory=dict)
    affected_incidents: list[str] = Field(default_factory=list)
    affected_resources: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    approval_required: bool = False
    reasons: list[str] = Field(default_factory=list)
    proposed_plan: Plan
    diff: PlanDiff
    metrics_before: PlanMetrics
    metrics_after: PlanMetrics


class ErrorResponse(BaseModel):
    error: str
