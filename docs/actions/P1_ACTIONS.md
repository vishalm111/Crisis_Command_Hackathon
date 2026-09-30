# P1 actions: Orchestrator, engine, API (repo owner, tech lead)

**May edit:** `backend/models/*`, `backend/orchestrator/*`, `backend/services/engine.py`, `backend/subagents/base.py`, `backend/main.py`, `backend/config.py`, `contracts/*`, `.github/*`, `frontend/src/components/PlanPanel.jsx`, `ApprovalPanel.jsx`, `requirements.txt`, `docs/actions/01_SHARED_CONTRACT_V0.md`.
**Must not edit:** other people's sub-agents, services or components. Add stubs in `orchestrator/stubs.py` instead.
**Branch prefix:** `p1/`. **Read first:** `AGENTS.md`, `00_AGENT_PROTOCOL.md`, `01_SHARED_CONTRACT_V0.md`.

## Kickoff prompt (paste into Antigravity or Claude Code)
> You are working for P1 on Crisis Command. Read AGENTS.md, docs/actions/00_AGENT_PROTOCOL.md, docs/actions/01_SHARED_CONTRACT_V0.md and docs/actions/P1_ACTIONS.md. Execute tasks in order starting with P1-W2 (P1-W1 is a human step). Follow the protocol exactly: one branch and one PR per task, run Verify commands, stop after each PR and report. Do not edit files outside the "May edit" list.

## Human steps (not for the agent)
- P1-W1 (by 2:45 PM): `gh repo create`, add collaborators, push scaffold from `docs/GITHUB_SETUP.md`, enable branch protection, add CODEOWNERS with real usernames, add CI. Post the repo link.
- Get each teammate's GitHub username and confirm the P1 to P4 mapping.

## Phase 1: Web (2:00 to 6:00 PM). Checkpoint 5:45 PM, tag `phase1-web`

### P1-W2: Models from the contract (by 3:00 PM, 30 min)
Branch `p1/models`. Files: `backend/models/enums.py`, `domain.py`, `api.py`.
Steps: implement every enum and model in contract sections 1 and 2 with Pydantic v2; `api.py` holds request bodies for section 5; add `backend/tests/test_models.py`.
Acceptance: models import cleanly; `CrisisState` round-trips through `model_dump_json` and `model_validate_json`; invalid severity (0 or 6) is rejected.
Verify: `pytest backend/tests/test_models.py -q`.
Handoff: tell everyone "contract published" once merged. This unblocks all other agents.

### P1-W3: mock_state.json (by 3:00 PM, 15 min)
Branch `p1/mock-state`. File: `contracts/mock_state.json`.
Steps: a valid `CrisisState` mid-scenario (about t=20): 3 to 4 incidents including one `needs_confirmation`, all seed resources, a current plan with 4 assignments, a pending `ApprovalRequest` with a diff, 2 explanations, 3 alerts, 6 traces.
Acceptance: loads with `CrisisState.model_validate_json`; every id referenced exists; frontend agents can render every panel from it.
Verify: add `test_mock_state_valid` in `test_models.py` and run it.

### P1-W4: Config and SimulationEngine (60 min)
Branch `p1/engine`. Files: `backend/config.py`, `backend/services/engine.py`.
Steps: `config.py` reads env (`LLM_ENABLED`, `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_MODEL`, `LLM_TIMEOUT_SECONDS`, `BACKEND_PORT`, `CORS_ORIGINS`) via python-dotenv and never logs the key. `SimulationEngine` holds one `CrisisState`; methods: `get_state()`, `reset()` (loads seed; until P4's seed exists, loads `contracts/mock_state.json`), `snapshot()` (deep copy for What-If), `advance_clock(minutes)`, `log(event)`, `apply_incident(...)` style mutators that only the orchestrator calls.
Acceptance: reset is idempotent; `snapshot()` mutations never affect live state; clock only moves forward.
Verify: `pytest backend/tests/test_engine.py -q` (write it).

### P1-W5: FastAPI with stub endpoints (60 min)
Branch `p1/api-stubs`. File: `backend/main.py`.
Steps: implement every route in contract section 5 returning mock or engine data; CORS from `CORS_ORIGINS`; errors as `{"error": str}` with 4xx; `/api/health` returns `llm_status`.
Acceptance: every route responds 200 with valid JSON against the models; unknown ids return 404 JSON.
Verify: `uvicorn backend.main:app --port 8000 &` then `curl -s localhost:8000/api/state | python -m json.tool | head`; `pytest backend/tests/test_api.py -q` using FastAPI `TestClient`.

### P1-W6: PlanPanel and ApprovalPanel on mock data (60 min)
Branch `p1/plan-approval-ui`. Files: the two components. Depends on: P4's Vite shell (if not merged, build components standalone with props and a local mock import).
Steps: PlanPanel lists assignments (resource, incident, ETA, locked badge), metrics, unmet slots. ApprovalPanel shows reasons, consequences, diff summary, Approve and Reject buttons calling `POST /api/approval/{id}/approve|reject`, disabled while a request is in flight.
Acceptance: renders from `contracts/mock_state.json`; no crash when `approval` is null.
Verify: `cd frontend && npm run build`.

## Phase 2: Integrate (6:00 to 10:00 PM). Checkpoint 9:45 PM, tag `phase2-integrate`

### P1-I1: Sub-agent base and stubs (30 min)
Branch `p1/stubs`. Files: `subagents/base.py`, `orchestrator/stubs.py`.
Steps: `TriggerContext`, `SubAgentResult`, `SubAgent` protocol exactly as contract section 3; canned stubs for all six sub-agents returning valid payloads for the scenario; a registry `get_subagent(name)` that prefers the real module and falls back to the stub if import or call is not yet implemented.
Acceptance: the orchestrator can run every flow with stubs only.

### P1-I2: Orchestrator and workflow runner (90 min)
Branch `p1/orchestrator`. Files: `orchestrator/orchestrator.py`, `orchestrator/workflow.py`.
Steps: implement the trigger-to-flow table from `docs/01_ARCHITECTURE.md`. `Orchestrator.handle(trigger)`: snapshot state, run the flow's sub-agents in order, collect traces, apply results to state (incidents, plan, explanation, alerts), run the approval gate, then commit or set `proposed_plan` and `approval`. `workflow.py` exposes `run_flow(flow_name, state, ctx)` sequentially (LangGraph comes in Phase 3).
Acceptance: each trigger kind produces a valid updated `CrisisState`; What-If never mutates live state; a sub-agent exception becomes an alert and a trace, not a 500.
Verify: `pytest backend/tests/test_orchestrator.py -q` (write it, one test per trigger kind using stubs).

### P1-I3: Live API and approval endpoints (60 min)
Branch `p1/live-api`. Files: `main.py`, `services/engine.py`.
Steps: route handlers call the orchestrator instead of returning mock data; approve promotes `proposed_plan` to `current_plan`, locks approved moves (`Constraint` kind `approved`), bumps plan version, appends to `plan_history`; reject discards the proposal and records a constraint so the same move is not proposed again. Double approve returns 409.
Acceptance: approve and reject change state as described; state stays valid.
Verify: `pytest backend/tests/test_api.py -q` covering approve, reject, double-approve.

### P1-I4: Integration duty (continuous)
Review and merge teammates' PRs promptly (5-minute reviews). At 9:30 PM run the whole scenario by hand through the UI and log every break in `docs/actions/INTEGRATION_BUGS.md`. Tag `phase2-integrate` at 9:45 PM.

## Phase 3: Agent (10:00 PM to 2:00 AM). Checkpoint 1:45 AM, tag `phase3-agents`

### P1-A1: Conflict detection and plan merge (60 min)
Branch `p1/merge`. File: `orchestrator/orchestrator.py`.
Steps: after Allocation, detect conflicts (a resource in two assignments, a locked or approved assignment changed, a resource assigned while `unavailable`, an incident over-allocated). Resolve by: locked or approved always win; otherwise the higher-priority incident wins; record the resolution as a trace.
Acceptance: no plan leaves the orchestrator with a conflict; test each conflict type.

### P1-A2: Approval gate (45 min)
Branch `p1/approval-gate`. File: `orchestrator/approval_gate.py`.
Steps: implement contract section 8 as `evaluate(current_plan, proposed_plan, state) -> GateDecision(required: bool, reasons: list[str], consequences: list[str])`. Consequences are plain sentences generated from the diff (for example "I1 loses ambulance A1 and becomes unmet").
Acceptance: unit tests for each of the four triggers and for the auto-commit path.

### P1-A3: LangGraph wiring with fallback (60 min)
Branch `p1/langgraph`. File: `orchestrator/workflow.py`.
Steps: build the same flows as a LangGraph graph; wrap `import langgraph` in try/except; if unavailable or on graph error, use the sequential runner from P1-I2. Both must produce identical results on the scenario.
Acceptance: a test runs the scenario through both runners and compares final plans.

### P1-A4: Plan promotion and history (30 min)
Steps: ensure `plan_history` stores every committed plan; `PlanDiff` between last two plans is available in state; `event_log` records every trigger and decision.

## Phase 4: Test flow (2:00 to 9:00 AM)
- 2 to 4 AM: triage bugs from scenario runs, merge fixes fast.
- 4 to 9 AM: P1-T1 make `POST /scenario/reset` safe at any moment; P1-T2 debounce and idempotency for double clicks (same trigger within 1 second is ignored or returns the previous result); P1-T3 error handling audit (no unhandled 500s, structured errors surface as alerts in the UI); P1-T4 run `LLM_ENABLED=false` full scenario.
- 9:00 AM: tag `feature-freeze`. 10:30 AM: tag `demo-ready`. Only critical merges after 9:00.

## Definition of done per phase
- Web: every route returns valid mock JSON and PlanPanel and ApprovalPanel render.
- Integrate: `POST /scenario/run` completes with stubs and state stays valid at each step.
- Agent: the scenario in contract section 9 passes end to end with real sub-agents, including the approval path.
