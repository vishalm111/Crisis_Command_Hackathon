from typing import Any, Union
from backend.models.enums import IncidentType, Tier
from backend.models.domain import Incident


def priority_score(incident: Union[Incident, Any], clock_min: int = 0) -> float:
    """
    Calculate deterministic priority score for an incident at current clock time (rule v0).

    Formula (contract section 6):
    score = severity*10 + min(people_affected, 20) + (10 if type in {medical, fire} else 0) + min(minutes_waiting, 30)*0.5

    Tiers:
    >= 70 critical, 50 to 69.99 high, 30 to 49.99 medium, < 30 low.
    """
    severity = getattr(incident, "severity", None)
    if severity is None and isinstance(incident, dict):
        severity = incident.get("severity", 1)
    severity = int(severity) if severity is not None else 1

    people_affected = getattr(incident, "people_affected", None)
    if people_affected is None and isinstance(incident, dict):
        people_affected = incident.get("people_affected", 0)
    people_affected = int(people_affected) if people_affected is not None else 0

    inc_type = getattr(incident, "type", None)
    if inc_type is None and isinstance(incident, dict):
        inc_type = incident.get("type", "")

    # Normalize type to string value
    type_str = inc_type.value if hasattr(inc_type, "value") else str(inc_type)
    type_str = type_str.lower()

    type_bonus = 10.0 if type_str in (IncidentType.medical.value, IncidentType.fire.value, "medical", "fire") else 0.0

    reported_at = getattr(incident, "reported_at_min", None)
    if reported_at is None and isinstance(incident, dict):
        reported_at = incident.get("reported_at_min", 0)
    reported_at = int(reported_at) if reported_at is not None else 0

    minutes_waiting = max(0, clock_min - reported_at)

    score = (
        (severity * 10.0)
        + min(people_affected, 20)
        + type_bonus
        + (min(minutes_waiting, 30) * 0.5)
    )

    return round(float(score), 2)


def tier_for(score: float) -> Tier:
    """
    Determine tier for a priority score (rule v0).
    >= 70 critical, 50 to 69.99 high, 30 to 49.99 medium, < 30 low.
    """
    if score >= 70.0:
        return Tier.critical
    elif score >= 50.0:
        return Tier.high
    elif score >= 30.0:
        return Tier.medium
    else:
        return Tier.low


def max_eta_for(tier: Union[Tier, str]) -> float:
    """
    Return maximum acceptable ETA in minutes for a given tier (rule v0).
    critical: 15 min, high: 25 min, medium: 40 min, low: 60 min.
    """
    if isinstance(tier, str):
        tier_str = tier.lower()
    else:
        tier_str = tier.value.lower()

    if tier_str == Tier.critical.value:
        return 15.0
    elif tier_str == Tier.high.value:
        return 25.0
    elif tier_str == Tier.medium.value:
        return 40.0
    elif tier_str == Tier.low.value:
        return 60.0
    else:
        raise ValueError(f"Unknown tier: {tier}")


def priority_sort_key(incident: Union[Incident, Any], clock_min: int = 0) -> tuple[float, int, str]:
    """
    Sort key for incidents: highest priority first, then earlier reported_at_min, then id.
    Usage: sorted(incidents, key=lambda inc: priority_sort_key(inc, clock_min))
    """
    score = priority_score(incident, clock_min)
    reported_at = getattr(incident, "reported_at_min", 0)
    if reported_at is None and isinstance(incident, dict):
        reported_at = incident.get("reported_at_min", 0)

    inc_id = getattr(incident, "id", "")
    if not inc_id and isinstance(incident, dict):
        inc_id = incident.get("id", "")

    return (-score, int(reported_at), str(inc_id))


def sort_incidents(incidents: list[Union[Incident, Any]], clock_min: int = 0) -> list[Union[Incident, Any]]:
    """Sort incidents by priority rule v0 (highest score, earlier reported, id)."""
    return sorted(incidents, key=lambda inc: priority_sort_key(inc, clock_min))
