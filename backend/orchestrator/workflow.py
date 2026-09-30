"""Workflow runner for sub-agent execution pipelines.

Supports both LangGraph StateGraph execution and a robust sequential runner fallback.
Implements graceful error handling: subagent exceptions become alerts and traces, never 500s.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple, TypedDict

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

# LangGraph availability check with try/except
try:
    from langgraph.graph import END, START, StateGraph

    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    StateGraph = None  # type: ignore
    START = None  # type: ignore
    END = None  # type: ignore


class WorkflowState(TypedDict):
    flow_name: str
    ctx: TriggerContext
    state: CrisisState
    accumulated_payload: Dict[str, Any]
    accumulated_traces: List[TraceEntry]
    generated_alerts: List[Alert]


def run_flow_sequential(
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
                existing_map = {inc.id: inc for inc in working_state.incidents}
                for inc in result.payload["incidents"]:
                    existing_map[inc.id] = inc
                working_state.incidents = list(existing_map.values())

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


_COMPILED_GRAPHS: Dict[str, Any] = {}


def _make_agent_node(agent_name: str):
    def node_fn(wf_state: WorkflowState) -> WorkflowState:
        working_state = wf_state["state"]
        ctx = wf_state["ctx"]
        try:
            agent = get_subagent(agent_name)
            result: SubAgentResult = agent.run(working_state, ctx)

            # Append traces and merge payload
            wf_state["accumulated_traces"].extend(result.traces)
            for k, v in result.payload.items():
                wf_state["accumulated_payload"][k] = v

            # Propagate updates to working state
            if "incidents" in result.payload and isinstance(result.payload["incidents"], list):
                existing_map = {inc.id: inc for inc in working_state.incidents}
                for inc in result.payload["incidents"]:
                    existing_map[inc.id] = inc
                working_state.incidents = list(existing_map.values())

            if "plan" in result.payload and isinstance(result.payload["plan"], Plan):
                working_state.current_plan = result.payload["plan"]

            if "assignments" in result.payload and isinstance(result.payload["assignments"], list):
                working_state.current_plan.assignments = result.payload["assignments"]

        except Exception as exc:
            logger.error("Error executing sub-agent %s in LangGraph: %s", agent_name, exc, exc_info=True)
            alert = Alert(
                id=f"alt_err_{agent_name}_{working_state.clock_min}",
                level=AlertLevel.warning,
                text=f"Sub-agent '{agent_name}' encountered an error: {str(exc)}",
                at_min=working_state.clock_min,
            )
            wf_state["generated_alerts"].append(alert)

            trace = TraceEntry(
                agent=agent_name,
                step="exception",
                detail=f"Caught exception: {type(exc).__name__}: {str(exc)}",
                used_llm=False,
                fallback_used=True,
                at_min=working_state.clock_min,
            )
            wf_state["accumulated_traces"].append(trace)

        return wf_state

    return node_fn


def get_compiled_graph(flow_name: str):
    """Builds and compiles a LangGraph StateGraph for the requested flow."""
    if flow_name in _COMPILED_GRAPHS:
        return _COMPILED_GRAPHS[flow_name]

    if not LANGGRAPH_AVAILABLE:
        raise RuntimeError("LangGraph is not installed or available.")

    subagent_names = FLOW_DEFINITIONS.get(flow_name, ["allocation", "logistics", "explainer"])
    builder = StateGraph(WorkflowState)

    prev_node = START
    for name in subagent_names:
        builder.add_node(name, _make_agent_node(name))
        builder.add_edge(prev_node, name)
        prev_node = name
    builder.add_edge(prev_node, END)

    compiled = builder.compile()
    _COMPILED_GRAPHS[flow_name] = compiled
    return compiled


def run_flow_langgraph(
    flow_name: str,
    state: CrisisState,
    ctx: TriggerContext,
) -> Tuple[Dict[str, Any], List[TraceEntry], List[Alert]]:
    """Runs a flow's sub-agents via LangGraph StateGraph."""
    compiled = get_compiled_graph(flow_name)
    working_state = CrisisState.model_validate_json(state.model_dump_json())

    initial_wf_state: WorkflowState = {
        "flow_name": flow_name,
        "ctx": ctx,
        "state": working_state,
        "accumulated_payload": {},
        "accumulated_traces": [],
        "generated_alerts": [],
    }

    result_wf_state = compiled.invoke(initial_wf_state)
    return (
        result_wf_state["accumulated_payload"],
        result_wf_state["accumulated_traces"],
        result_wf_state["generated_alerts"],
    )


def run_flow(
    flow_name: str,
    state: CrisisState,
    ctx: TriggerContext,
    force_sequential: bool = False,
) -> Tuple[Dict[str, Any], List[TraceEntry], List[Alert]]:
    """Primary flow execution entrypoint.
    
    Prefers LangGraph if available, falling back safely to the sequential runner
    if LangGraph is disabled, unavailable, or raises an execution failure.
    """
    if LANGGRAPH_AVAILABLE and not force_sequential:
        try:
            return run_flow_langgraph(flow_name, state, ctx)
        except Exception as exc:
            logger.warning(
                "LangGraph execution failed for flow '%s'; falling back to sequential runner: %s",
                flow_name,
                exc,
                exc_info=True,
            )
            return run_flow_sequential(flow_name, state, ctx)

    return run_flow_sequential(flow_name, state, ctx)
