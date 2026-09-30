import sys
from pathlib import Path
import pytest

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.models.domain import Incident, LatLng
from backend.models.enums import IncidentType, Tier
from backend.services.scoring import (
    priority_score,
    tier_for,
    max_eta_for,
    priority_sort_key,
    sort_incidents,
)


def _make_incident(
    id: str,
    type: IncidentType,
    severity: int,
    people_affected: int,
    reported_at_min: int = 0,
) -> Incident:
    return Incident(
        id=id,
        type=type,
        severity=severity,
        location=LatLng(lat=12.97, lng=77.59),
        people_affected=people_affected,
        reported_at_min=reported_at_min,
    )


def test_acceptance_i1_at_t15():
    """I1: medical, severity 3, 2 people, reported at t=0. At t=15 scores 49.5 (medium)."""
    i1 = _make_incident("I1", IncidentType.medical, severity=3, people_affected=2, reported_at_min=0)
    score = priority_score(i1, clock_min=15)
    assert score == 49.5
    assert tier_for(score) == Tier.medium


def test_acceptance_i4_at_t15():
    """I4: rescue, severity 5, 20 people, reported at t=15. At t=15 scores 70.0 (critical)."""
    i4 = _make_incident("I4", IncidentType.rescue, severity=5, people_affected=20, reported_at_min=15)
    score = priority_score(i4, clock_min=15)
    assert score == 70.0
    assert tier_for(score) == Tier.critical


def test_tier_boundaries():
    """Verify tier assignment across exact boundaries: 29.99, 30, 49.99, 50, 69.99, 70."""
    assert tier_for(29.99) == Tier.low
    assert tier_for(30.0) == Tier.medium
    assert tier_for(49.99) == Tier.medium
    assert tier_for(50.0) == Tier.high
    assert tier_for(69.99) == Tier.high
    assert tier_for(70.0) == Tier.critical
    assert tier_for(85.5) == Tier.critical


def test_max_eta_for_tiers():
    """Verify max acceptable ETA: critical 15, high 25, medium 40, low 60."""
    assert max_eta_for(Tier.critical) == 15.0
    assert max_eta_for(Tier.high) == 25.0
    assert max_eta_for(Tier.medium) == 40.0
    assert max_eta_for(Tier.low) == 60.0

    # Also supports string inputs
    assert max_eta_for("critical") == 15.0
    assert max_eta_for("HIGH") == 25.0

    with pytest.raises(ValueError):
        max_eta_for("invalid_tier")


def test_tie_breaking():
    """Ties break by earlier report then id."""
    # Two incidents with same score: severity 4 (40) + rescue (0) + 10 people (10) = 50
    # inc_early reported at t=2
    # inc_late reported at t=5, evaluated at clock_min=5 so minutes_waiting=0 for both?
    # Let's hold minutes_waiting=0 by evaluating at their reported time
    inc1 = _make_incident("I_B", IncidentType.rescue, severity=4, people_affected=10, reported_at_min=2)
    inc2 = _make_incident("I_A", IncidentType.rescue, severity=4, people_affected=10, reported_at_min=5)

    # At clock_min=5:
    # inc1 has waiting = 3 -> score = 40 + 10 + 0 + 1.5 = 51.5
    # inc2 has waiting = 0 -> score = 40 + 10 + 0 + 0 = 50.0
    # Let's test exact equal score with different reported_at_min
    # e.g., inc_x has 8 people, waiting 4 min -> 40 + 8 + 2 = 50, reported at t=1
    # inc_y has 10 people, waiting 0 min -> 40 + 10 + 0 = 50, reported at t=5
    inc_x = _make_incident("I2", IncidentType.rescue, severity=4, people_affected=8, reported_at_min=1)
    inc_y = _make_incident("I1", IncidentType.rescue, severity=4, people_affected=10, reported_at_min=5)

    # At clock_min=5:
    # inc_x waiting = 4 -> 4 * 0.5 = 2.0 -> score = 40 + 8 + 2.0 = 50.0
    # inc_y waiting = 0 -> 0 * 0.5 = 0.0 -> score = 40 + 10 + 0 = 50.0
    assert priority_score(inc_x, clock_min=5) == 50.0
    assert priority_score(inc_y, clock_min=5) == 50.0

    # inc_x was reported at t=1, inc_y at t=5. inc_x should come first!
    sorted_incs = sort_incidents([inc_y, inc_x], clock_min=5)
    assert [i.id for i in sorted_incs] == ["I2", "I1"]

    # Now exact equal score AND equal reported_at_min: ties break by id alphabetically
    inc_alpha = _make_incident("I1", IncidentType.rescue, severity=4, people_affected=10, reported_at_min=5)
    inc_beta = _make_incident("I2", IncidentType.rescue, severity=4, people_affected=10, reported_at_min=5)
    sorted_alpha = sort_incidents([inc_beta, inc_alpha], clock_min=5)
    assert [i.id for i in sorted_alpha] == ["I1", "I2"]


def test_caps_people_and_waiting():
    """Verify people_affected capped at 20 and minutes_waiting capped at 30 (15 pts)."""
    # 50 people affected -> min(50, 20) = 20
    inc_many_people = _make_incident("I10", IncidentType.rescue, severity=1, people_affected=50, reported_at_min=0)
    assert priority_score(inc_many_people, clock_min=0) == 10.0 + 20.0  # 30.0

    # Waiting 60 minutes -> min(60, 30) * 0.5 = 15.0
    inc_long_wait = _make_incident("I11", IncidentType.rescue, severity=1, people_affected=0, reported_at_min=0)
    assert priority_score(inc_long_wait, clock_min=60) == 10.0 + 15.0  # 25.0


def test_type_bonuses():
    """Medical and fire get +10 bonus, rescue and hazmat do not."""
    med = _make_incident("M1", IncidentType.medical, severity=1, people_affected=0, reported_at_min=0)
    fire = _make_incident("F1", IncidentType.fire, severity=1, people_affected=0, reported_at_min=0)
    res = _make_incident("R1", IncidentType.rescue, severity=1, people_affected=0, reported_at_min=0)
    haz = _make_incident("H1", IncidentType.hazmat, severity=1, people_affected=0, reported_at_min=0)

    assert priority_score(med, clock_min=0) == 20.0
    assert priority_score(fire, clock_min=0) == 20.0
    assert priority_score(res, clock_min=0) == 10.0
    assert priority_score(haz, clock_min=0) == 10.0
