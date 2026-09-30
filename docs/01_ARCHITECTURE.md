# Architecture: one orchestrator, sub-agents per flow

## Roles
- **Orchestrator (P1):** only top-level agent. Trigger routing, state ownership, conflict detection, plan merge, approval gate, replanning.
- **Sub-agents:** narrow and stateless. Input, then output plus decision trace.

| Sub-agent | Purpose | Owner |
|---|---|---|
| Assessment | Score priority, extract fields from incident reports (Grok with rule fallback) | P2 |
| Explainer | Build "because" bullets from decision traces, optional Grok narration | P2 |
| Allocation | Match resources to incidents, preemption and stickiness rules | P3 |
| Impact Detector | Find assignments invalidated by a failure | P3 |
| What-If | Run any flow on a copy of state and report the consequences | P3 |
| Logistics | Distance, ETA, en-route positions, shelter and hospital choice | P4 |

The PDF role names (Assessment, Allocation, Logistics) are kept as sub-agents so judges can map the system to the Round 1 document. Command/Planning became the Orchestrator.

## Trigger to flow
| Trigger | Flow |
|---|---|
| New incident | Assessment, Allocation, Logistics, Explainer, then Approval Gate if needed |
| Resource failure | Impact Detector, Allocation, Logistics, Explainer, Approval Gate |
| Escalation | Assessment (re-score), Allocation, Logistics, Explainer |
| Approval decision | Allocation (with new constraints), Logistics, Explainer |
| What-If | What-If sub-agent runs any flow above on a copy of state |
| Time advance | Engine advances clock and en-route positions, then re-checks triggers |

## LLM use (xAI Grok)
Two places only: parsing free-text incident reports, and narrating explanations. OpenAI-compatible endpoint `https://api.x.ai/v1`. Routing and allocation stay deterministic. Every call has a timeout (`LLM_TIMEOUT_SECONDS`) and falls back to rules. The model name in `.env.example` came from a community source; verify with `GET /v1/models`.

## Sub-agent spec card headings
Each sub-agent gets a card in `docs/specs/` with: Behavior, Tools (internal / external), Workflow, Triggers, Logging.
- Tools internal: engine state, scoring, geo functions. External: LLM API, map tiles.
- Triggers: new incident, resource failure, escalation, time advance, approval decision.
- Logging: decision trace and agent messages.

## Gap versus the Round 1 document
Round 1 lists a Priority Engine, Response Planner and Scenario Simulator. In this build: Priority Engine = `scoring.py` (P2); Response Planner = Allocation plus Orchestrator plan merge; Scenario Simulator = What-If sub-agent plus plan metrics. The metrics (response time, coverage, utilization, unresolved incidents) should be computed for every plan so alternatives can be compared. Confirm this is in P3's scope (`OPEN_ITEMS.md`).
