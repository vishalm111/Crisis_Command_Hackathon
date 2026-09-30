import pytest

from backend.models import CrisisState, TriggerKind
from backend.orchestrator.stubs import get_subagent
from backend.services.engine import SimulationEngine
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext


@pytest.fixture
def base_state():
    engine = SimulationEngine()
    return engine.get_state()


def test_subagent_registry_and_protocol(base_state):
    names = ["assessment", "impact_detector", "allocation", "logistics", "explainer", "what_if"]
    for name in names:
        agent = get_subagent(name)
        assert isinstance(agent, SubAgent), f"{name} does not conform to SubAgent protocol"
        assert hasattr(agent, "name")

    with pytest.raises(KeyError):
        get_subagent("non_existent_agent")


def test_stubs_execution_and_purity(base_state):
    original_dump = base_state.model_dump_json()

    # 1. Assessment
    assessment = get_subagent("assessment")
    ctx_new = TriggerContext(kind=TriggerKind.new_incident, payload={})
    res_ass = assessment.run(base_state, ctx_new)
    assert isinstance(res_ass, SubAgentResult)
    assert "incidents" in res_ass.payload
    assert len(res_ass.traces) > 0

    # 2. Impact Detector
    detector = get_subagent("impact_detector")
    ctx_fail = TriggerContext(kind=TriggerKind.resource_failure, payload={"resource_id": "A3"})
    res_det = detector.run(base_state, ctx_fail)
    assert isinstance(res_det, SubAgentResult)
    assert "invalidated" in res_det.payload

    # 3. Allocation
    allocation = get_subagent("allocation")
    res_alloc = allocation.run(base_state, ctx_fail)
    assert isinstance(res_alloc, SubAgentResult)
    assert "plan" in res_alloc.payload
    assert res_alloc.payload["plan"].id.startswith("plan_")

    # 4. Logistics
    logistics = get_subagent("logistics")
    res_log = logistics.run(base_state, ctx_new)
    assert isinstance(res_log, SubAgentResult)
    assert "assignments" in res_log.payload
    assert "positions" in res_log.payload

    # 5. Explainer
    explainer = get_subagent("explainer")
    res_exp = explainer.run(base_state, ctx_new)
    assert isinstance(res_exp, SubAgentResult)
    assert "explanation" in res_exp.payload

    # 6. What-If
    whatif = get_subagent("what_if")
    ctx_whatif = TriggerContext(kind=TriggerKind.what_if, payload={"resource_id": "F2"})
    res_wi = whatif.run(base_state, ctx_whatif)
    assert isinstance(res_wi, SubAgentResult)
    assert "proposed_plan" in res_wi.payload
    assert "diff" in res_wi.payload

    # Verification of state purity: incoming state was never mutated
    assert base_state.model_dump_json() == original_dump
