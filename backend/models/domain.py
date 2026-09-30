from typing import Optional
from pydantic import BaseModel, Field

from backend.models.enums import (
    AlertLevel,
    ApprovalStatus,
    ConstraintKind,
    DiffChangeKind,
    FacilityKind,
    IncidentSource,
    IncidentStatus,
    IncidentType,
    LLMStatus,
    ResourceStatus,
    ResourceType,
    Tier,
)


class LatLng(BaseModel):
    lat: float
    lng: float
    label: Optional[str] = None


class Incident(BaseModel):
    id: str
    type: IncidentType
    severity: int = Field(ge=1, le=5, description="Severity from 1 (minor) to 5 (critical)")
    description: str = ""
    location: LatLng
    people_affected: int = 0
    required: dict[ResourceType, int] = Field(default_factory=dict)
    status: IncidentStatus = IncidentStatus.new
    reported_at_min: int = 0
    priority: float = 0.0
    tier: Tier = Tier.low
    uncertain_fields: list[str] = Field(default_factory=list)
    needs_confirmation: bool = False
    source: IncidentSource = IncidentSource.structured


class Resource(BaseModel):
    id: str
    type: ResourceType
    name: str
    base: LatLng
    location: LatLng
    status: ResourceStatus = ResourceStatus.available
    assigned_incident_id: Optional[str] = None


class Facility(BaseModel):
    id: str
    kind: FacilityKind
    name: str
    location: LatLng
    capacity: int
    load: int = 0


class Assignment(BaseModel):
    id: str
    resource_id: str
    incident_id: str
    eta_min: float
    distance_km: float = 0.0
    facility_id: Optional[str] = None
    locked: bool = False
    approved: bool = False
    reason: str = ""


class Unmet(BaseModel):
    incident_id: str
    missing: dict[ResourceType, int] = Field(default_factory=dict)


class PlanMetrics(BaseModel):
    avg_eta_min: float = 0.0
    max_eta_min: float = 0.0
    coverage_pct: float = 0.0
    utilization_pct: float = 0.0
    unresolved_count: int = 0


class Plan(BaseModel):
    id: str
    version: int = 1
    assignments: list[Assignment] = Field(default_factory=list)
    unmet: list[Unmet] = Field(default_factory=list)
    metrics: PlanMetrics = Field(default_factory=PlanMetrics)


class DiffChange(BaseModel):
    resource_id: str
    kind: DiffChangeKind = DiffChangeKind.reassigned
    old_incident_id: Optional[str] = None
    new_incident_id: Optional[str] = None
    old_eta_min: Optional[float] = None
    new_eta_min: Optional[float] = None
    reason: str = ""


class PlanDiff(BaseModel):
    from_version: int
    to_version: int
    changes: list[DiffChange] = Field(default_factory=list)


class TraceEntry(BaseModel):
    agent: str
    step: str
    detail: str
    used_llm: bool = False
    fallback_used: bool = False
    at_min: int = 0


class Explanation(BaseModel):
    id: str
    trigger: str
    bullets: list[str] = Field(default_factory=list)
    trace_refs: list[int] = Field(default_factory=list)


class Constraint(BaseModel):
    resource_id: str
    incident_id: str
    kind: ConstraintKind = ConstraintKind.locked


class ApprovalRequest(BaseModel):
    id: str
    status: ApprovalStatus = ApprovalStatus.pending
    reasons: list[str] = Field(default_factory=list)
    consequences: list[str] = Field(default_factory=list)
    proposed_plan: Plan
    diff: PlanDiff
    created_at_min: int = 0


class Alert(BaseModel):
    id: str
    level: AlertLevel = AlertLevel.info
    text: str
    at_min: int = 0


class AgentMessage(BaseModel):
    id: str
    agent: str
    text: str
    at_min: int = 0


class CrisisState(BaseModel):
    clock_min: int = 0
    incidents: list[Incident] = Field(default_factory=list)
    resources: list[Resource] = Field(default_factory=list)
    facilities: list[Facility] = Field(default_factory=list)
    current_plan: Plan = Field(default_factory=lambda: Plan(id="plan_0", version=0))
    proposed_plan: Optional[Plan] = None
    approval: Optional[ApprovalRequest] = None
    plan_history: list[Plan] = Field(default_factory=list)
    latest_diff: Optional[PlanDiff] = None
    constraints: list[Constraint] = Field(default_factory=list)
    traces: list[TraceEntry] = Field(default_factory=list)
    explanations: list[Explanation] = Field(default_factory=list)
    alerts: list[Alert] = Field(default_factory=list)
    messages: list[AgentMessage] = Field(default_factory=list)
    event_log: list[str] = Field(default_factory=list)
    llm_status: LLMStatus = LLMStatus.disabled
