from enum import Enum


class IncidentType(str, Enum):
    medical = "medical"
    fire = "fire"
    rescue = "rescue"
    hazmat = "hazmat"


class ResourceType(str, Enum):
    ambulance = "ambulance"
    fire_engine = "fire_engine"
    rescue_team = "rescue_team"


class FacilityKind(str, Enum):
    hospital = "hospital"
    shelter = "shelter"


class IncidentStatus(str, Enum):
    new = "new"
    assessed = "assessed"
    assigned = "assigned"
    en_route = "en_route"
    on_scene = "on_scene"
    resolved = "resolved"


class ResourceStatus(str, Enum):
    available = "available"
    en_route = "en_route"
    on_scene = "on_scene"
    unavailable = "unavailable"


class Tier(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class TriggerKind(str, Enum):
    new_incident = "new_incident"
    resource_failure = "resource_failure"
    resource_restored = "resource_restored"
    escalation = "escalation"
    time_advance = "time_advance"
    approval_decision = "approval_decision"
    what_if = "what_if"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class DiffChangeKind(str, Enum):
    added = "added"
    removed = "removed"
    reassigned = "reassigned"
    eta_changed = "eta_changed"


class ConstraintKind(str, Enum):
    locked = "locked"
    approved = "approved"


class AlertLevel(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class LLMStatus(str, Enum):
    enabled_ok = "enabled_ok"
    enabled_fallback = "enabled_fallback"
    disabled = "disabled"


class IncidentSource(str, Enum):
    structured = "structured"
    free_text = "free_text"
