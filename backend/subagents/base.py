from typing import Any, Protocol, runtime_checkable
from pydantic import BaseModel, Field

from backend.models.domain import CrisisState, TraceEntry
from backend.models.enums import TriggerKind


class TriggerContext(BaseModel):
    kind: TriggerKind
    payload: dict[str, Any] = Field(default_factory=dict)


class SubAgentResult(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    traces: list[TraceEntry] = Field(default_factory=list)


@runtime_checkable
class SubAgent(Protocol):
    name: str

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        """Executes pure reasoning step on state with trigger context.
        
        Hard rule: Sub-agents never mutate shared state. They return a result;
        only the orchestrator applies results to state.
        """
        ...
