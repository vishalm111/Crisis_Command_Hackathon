import os
import pytest

from backend.config import Settings, get_settings
from backend.models import (
    Constraint,
    ConstraintKind,
    Incident,
    IncidentType,
    LatLng,
    Plan,
    ResourceStatus,
)
from backend.services.engine import SimulationEngine


def test_config_safety_and_defaults(monkeypatch):
    secret_key = "xai-super-secret-key-12345"
    monkeypatch.setenv("XAI_API_KEY", secret_key)
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("BACKEND_PORT", "9000")

    settings = Settings()
    assert settings.llm_enabled is True
    assert settings.xai_api_key == secret_key
    assert settings.backend_port == 9000

    # Hard rule: representation must NEVER contain the secret key
    repr_str = repr(settings)
    assert secret_key not in repr_str
    assert "***" in repr_str


def test_engine_reset_idempotent():
    engine = SimulationEngine()
    initial_clock = engine.get_state().clock_min

    # Mutate live state
    engine.advance_clock(15)
    engine.log("custom log event")
    assert engine.get_state().clock_min == initial_clock + 15

    # First reset
    s1 = engine.reset()
    assert s1.clock_min == initial_clock

    # Second reset (idempotence)
    s2 = engine.reset()
    assert s2.clock_min == initial_clock
    assert len(s1.incidents) == len(s2.incidents)
    assert len(s1.resources) == len(s2.resources)


def test_engine_snapshot_isolation():
    engine = SimulationEngine()
    engine.reset()

    original_clock = engine.get_state().clock_min
    original_incidents_count = len(engine.get_state().incidents)

    snapshot = engine.snapshot()

    # Mutate the snapshot heavily
    snapshot.clock_min = 999
    snapshot.incidents.append(
        Incident(
            id="I_TEST",
            type=IncidentType.fire,
            severity=5,
            location=LatLng(lat=0.0, lng=0.0),
        )
    )
    if snapshot.resources:
        snapshot.resources[0].status = ResourceStatus.unavailable

    # Verify live engine state was completely untouched
    live_state = engine.get_state()
    assert live_state.clock_min == original_clock
    assert len(live_state.incidents) == original_incidents_count
    assert not any(inc.id == "I_TEST" for inc in live_state.incidents)


def test_engine_advance_clock_monotonic():
    engine = SimulationEngine()
    engine.reset()

    base_time = engine.get_state().clock_min
    new_time = engine.advance_clock(5)
    assert new_time == base_time + 5
    assert engine.get_state().clock_min == base_time + 5

    # Negative advancement must be rejected
    with pytest.raises(ValueError, match="Clock can only move forward"):
        engine.advance_clock(-5)

    assert engine.get_state().clock_min == base_time + 5


def test_engine_mutators():
    engine = SimulationEngine()
    engine.reset()

    # Apply incident
    test_inc = Incident(
        id="I_NEW",
        type=IncidentType.medical,
        severity=3,
        location=LatLng(lat=12.97, lng=77.59),
        description="Initial description",
    )
    engine.apply_incident(test_inc)
    assert any(inc.id == "I_NEW" for inc in engine.get_state().incidents)

    # Update same incident
    updated_inc = Incident(
        id="I_NEW",
        type=IncidentType.medical,
        severity=4,
        location=LatLng(lat=12.97, lng=77.59),
        description="Updated description",
    )
    engine.apply_incident(updated_inc)
    matching = [inc for inc in engine.get_state().incidents if inc.id == "I_NEW"]
    assert len(matching) == 1
    assert matching[0].severity == 4
    assert matching[0].description == "Updated description"

    # Update resource status
    if engine.get_state().resources:
        target_res = engine.get_state().resources[0].id
        engine.update_resource_status(target_res, ResourceStatus.unavailable)
        res = next(r for r in engine.get_state().resources if r.id == target_res)
        assert res.status == ResourceStatus.unavailable

    # Set plan with history archiving
    init_plan = engine.get_state().current_plan
    new_plan = Plan(id="plan_next", version=init_plan.version + 1)
    engine.set_plan(new_plan, archive_current=True)
    assert engine.get_state().current_plan.id == "plan_next"
    assert engine.get_state().plan_history[-1].id == init_plan.id

    # Constraints
    engine.add_constraint(Constraint(resource_id="A1", incident_id="I1", kind=ConstraintKind.locked))
    assert any(c.resource_id == "A1" and c.incident_id == "I1" for c in engine.get_state().constraints)
    engine.remove_constraint("A1", "I1")
    assert not any(c.resource_id == "A1" and c.incident_id == "I1" for c in engine.get_state().constraints)
