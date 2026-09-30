from pathlib import Path
from typing import Optional

from backend.models.domain import (
    AgentMessage,
    Alert,
    ApprovalRequest,
    Constraint,
    CrisisState,
    Explanation,
    Incident,
    Plan,
    PlanDiff,
    Resource,
    TraceEntry,
)
from backend.models.enums import ApprovalStatus, LLMStatus, ResourceStatus


class SimulationEngine:
    """Simulation engine holding the single explicit crisis state.
    
    Sub-agents never mutate this state directly. Only the Orchestrator
    calls mutator methods on the engine.
    """

    def __init__(self, seed_path: Optional[Path] = None) -> None:
        self.seed_path = seed_path
        self._approval_history: dict[str, ApprovalStatus] = {}
        self._reset_listeners: list = []
        self._state: CrisisState = self._load_initial_state()

    def register_reset_listener(self, callback) -> None:
        """Registers a callback to be notified when reset() is invoked."""
        self._reset_listeners.append(callback)

    def _load_initial_state(self) -> CrisisState:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                return CrisisState.model_validate_json(f.read())

        try:
            from backend.data.seed import build_seed_state  # type: ignore
            return build_seed_state()
        except (ImportError, AttributeError):
            pass

        return CrisisState()

    def get_state(self) -> CrisisState:
        """Returns the live CrisisState."""
        return self._state

    def reset(self) -> CrisisState:
        """Resets the simulation to the initial seed state. Idempotent and safe at any moment."""
        self._approval_history.clear()
        self._state = self._load_initial_state()
        for cb in self._reset_listeners:
            try:
                cb()
            except Exception:
                pass
        self.log(f"t={self._state.clock_min}: Simulation reset to initial seed state")
        return self._state

    def record_approval_decision(self, approval_id: str, status: ApprovalStatus) -> None:
        """Records the decision on an approval request for idempotency/conflict detection."""
        self._approval_history[approval_id] = status

    def get_approval_decision(self, approval_id: str) -> Optional[ApprovalStatus]:
        """Returns the past decision for an approval request, if any."""
        return self._approval_history.get(approval_id)

    def snapshot(self) -> CrisisState:
        """Returns a deep copy of the current state for What-If scenario simulations.
        
        Mutations on the snapshot never affect the live engine state.
        """
        return CrisisState.model_validate_json(self._state.model_dump_json())

    def advance_clock(self, minutes: int) -> int:
        """Advances simulation clock forward by N minutes.
        
        Hard rule: Clock only moves forward (minutes >= 0).
        """
        if minutes < 0:
            raise ValueError(f"Clock can only move forward, received negative minutes: {minutes}")
        self._state.clock_min += minutes
        self.log(f"t={self._state.clock_min}: Clock advanced by {minutes} min")
        return self._state.clock_min

    def log(self, event: str) -> None:
        """Appends a timestamped or plain message to the event log."""
        self._state.event_log.append(event)

    # --- Orchestrator mutators ---

    def apply_incident(self, incident: Incident) -> None:
        """Adds or updates an incident by ID."""
        for idx, existing in enumerate(self._state.incidents):
            if existing.id == incident.id:
                self._state.incidents[idx] = incident
                self.log(f"t={self._state.clock_min}: Incident {incident.id} updated (status {incident.status.value}, priority {incident.priority:.1f})")
                return
        self._state.incidents.append(incident)
        self.log(f"t={self._state.clock_min}: Incident {incident.id} registered ({incident.type.value}, severity {incident.severity})")

    def update_resource(self, resource: Resource) -> None:
        """Updates a resource by ID."""
        for idx, existing in enumerate(self._state.resources):
            if existing.id == resource.id:
                self._state.resources[idx] = resource
                return
        self._state.resources.append(resource)

    def update_resource_status(
        self,
        resource_id: str,
        status: ResourceStatus,
        assigned_incident_id: Optional[str] = None,
    ) -> None:
        """Updates the status and optional assignment of a resource."""
        for r in self._state.resources:
            if r.id == resource_id:
                r.status = status
                if assigned_incident_id is not None or status == ResourceStatus.available:
                    r.assigned_incident_id = assigned_incident_id
                self.log(f"t={self._state.clock_min}: Resource {resource_id} status changed to {status.value}")
                return
        raise KeyError(f"Resource with id {resource_id} not found")

    def set_plan(
        self,
        plan: Plan,
        archive_current: bool = True,
        diff: Optional[PlanDiff] = None,
    ) -> None:
        """Promotes a new plan to current_plan. Archives previous to plan_history and updates latest_diff."""
        if archive_current and self._state.current_plan:
            old_plan = self._state.current_plan
            self._state.plan_history.append(old_plan)
            if diff is not None:
                self._state.latest_diff = diff
            else:
                from backend.orchestrator.approval_gate import diff_plans
                self._state.latest_diff = diff_plans(old_plan, plan)
        self._state.current_plan = plan
        self.log(f"t={self._state.clock_min}: Plan v{plan.version} ({plan.id}) committed as current plan")

    def get_last_plan_diff(self) -> Optional[PlanDiff]:
        """Returns the PlanDiff between the last two plans, if available."""
        if self._state.latest_diff:
            return self._state.latest_diff
        if self._state.plan_history and self._state.current_plan:
            from backend.orchestrator.approval_gate import diff_plans
            return diff_plans(self._state.plan_history[-1], self._state.current_plan)
        return None

    def set_proposed_plan(self, plan: Optional[Plan]) -> None:
        """Sets or clears the proposed plan."""
        self._state.proposed_plan = plan

    def set_approval(self, approval: Optional[ApprovalRequest]) -> None:
        """Sets or clears the active approval request."""
        self._state.approval = approval

    def add_constraint(self, constraint: Constraint) -> None:
        """Adds a constraint (locked or approved) if not already present."""
        for c in self._state.constraints:
            if c.resource_id == constraint.resource_id and c.incident_id == constraint.incident_id:
                c.kind = constraint.kind
                return
        self._state.constraints.append(constraint)

    def remove_constraint(self, resource_id: str, incident_id: str) -> None:
        """Removes a constraint for a resource-incident pair."""
        self._state.constraints = [
            c for c in self._state.constraints
            if not (c.resource_id == resource_id and c.incident_id == incident_id)
        ]

    def add_alert(self, alert: Alert) -> None:
        """Adds an alert to state."""
        self._state.alerts.append(alert)

    def add_trace(self, trace: TraceEntry) -> None:
        """Adds a decision trace entry to state."""
        self._state.traces.append(trace)

    def add_explanation(self, explanation: Explanation) -> None:
        """Adds an explanation to state."""
        self._state.explanations.append(explanation)

    def add_message(self, message: AgentMessage) -> None:
        """Adds an agent message to state."""
        self._state.messages.append(message)

    def set_llm_status(self, status: LLMStatus) -> None:
        """Updates the LLM system status."""
        self._state.llm_status = status


_engine_instance: Optional[SimulationEngine] = None


def get_engine() -> SimulationEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = SimulationEngine()
    return _engine_instance
