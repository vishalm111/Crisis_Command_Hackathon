import logging
from typing import Any, Dict, List, Tuple

from backend.models.domain import (
    Alert,
    CrisisState,
    Incident,
    Plan,
    TraceEntry,
)
from backend.models.enums import AlertLevel, TriggerKind
from backend.orchestrator.stubs import get_subagent
from backend.subagents.base import SubAgentResult, TriggerContext

logger = logging.getLogger(__name__)

# Trigger-to-flow mapping from docs/01_ARCHITECTURE.md
FLOW_DEFINITIONS: Dict[str, List[str]] = {
    "new_incident": ["assessment", "allocation", "logistics", "explainer"],
    "resource_failure": ["impact_detector", "allocation", "logistics", "explainer"],
    "escalation": ["assessment", "allocation", "logistics", "explainer"],
    "approval_decision": ["allocation", "logistics", "explainer"],
    "what_if": ["what_if"],
    "time_advance": ["logistics", "explainer"],
}


def run_flow(
    flow_name: str,
    state: CrisisState,
    ctx: TriggerContext,
) -> Tuple[Dict[str, Any], List[TraceEntry], List[Alert]]:
    """Runs a flow's sub-agents sequentially.
    
    Hard rule: A sub-agent exception becomes an alert and a trace, not a 500.
    Sub-agents never mutate shared state.
    """
    subagent_names = FLOW_DEFINITIONS.get(flow_name, ["allocation", "logistics", "explainer"])
    accumulated_payload: Dict[str, Any] = {}
    accumulated_traces: List[TraceEntry] = []
    generated_alerts: List[Alert] = []

    # Working copy of state for passing data along the chain without mutating the original
    working_state = CrisisState.model_validate_json(state.model_dump_json())

    for agent_name in subagent_names:
        try:
            agent = get_subagent(agent_name)
            result: SubAgentResult = agent.run(working_state, ctx)

            # Collect traces
            accumulated_traces.extend(result.traces)

            # Merge and propagate results into working state for subsequent sub-agents
            for key, val in result.payload.items():
                accumulated_payload[key] = val

            if "incidents" in result.payload and isinstance(result.payload["incidents"], list):
                working_state.incidents = result.payload["incidents"]

            if "plan" in result.payload and isinstance(result.payload["plan"], Plan):
                working_state.current_plan = result.payload["plan"]

            if "assignments" in result.payload and isinstance(result.payload["assignments"], list):
                working_state.current_plan.assignments = result.payload["assignments"]

        except Exception as exc:
            logger.error("Error executing sub-agent %s: %s", agent_name, exc, exc_info=True)
            alert = Alert(
                id=f"alt_err_{agent_name}_{state.clock_min}",
                level=AlertLevel.warning,
                text=f"Sub-agent '{agent_name}' encountered an error: {str(exc)}",
                at_min=state.clock_min,
            )
            generated_alerts.append(alert)

            trace = TraceEntry(
                agent=agent_name,
                step="exception",
                detail=f"Caught exception: {type(exc).__name__}: {str(exc)}",
                used_llm=False,
                fallback_used=True,
                at_min=state.clock_min,
            )
            accumulated_traces.append(trace)

    return accumulated_payload, accumulated_traces, generated_alerts
