# Crisis Command: agent instructions

Cross-tool project context. Read by Antigravity, Claude Code (via CLAUDE.md), Codex and Cursor. Keep this file short; details live in `docs/`.

> DEMONSTRATION / SIMULATION ONLY. NOT FOR REAL-WORLD EMERGENCY DISPATCH. Keep the safety banner in the UI.

## What we are building
Hackathon project (Gateways 2026, team Neural Ninjas, Domain 4): a multi-agent emergency response and resource coordination assistant. It keeps an explicit crisis state, assesses incidents, allocates limited resources, plans routes, explains changes, and asks a human to approve high-impact reallocations. Demo data is synthetic and the scenario is deterministic.

## Architecture in one paragraph
One **Orchestrator** is the only top-level agent. It receives a trigger, picks the flow, owns state, detects conflicts, merges the plan and calls the approval gate. **Sub-agents** are narrow and stateless: input in, output plus decision trace out. Sub-agents: Assessment, Allocation, Logistics, Explainer, Impact Detector, What-If. Routing and allocation are deterministic. The LLM (xAI Grok, OpenAI-compatible API) is used only for parsing free-text incident reports and narrating explanations, and every call has a rule-based fallback. Full detail: `docs/01_ARCHITECTURE.md`.

## Hard rules
1. The app must work with no API key, a bad key, or a timeout (`LLM_ENABLED=false`). CI runs this way.
2. Never commit secrets. Read the key only via `backend/config.py`. Never log it.
3. Sub-agents never mutate shared state. They return results; the orchestrator applies them.
4. Every decision returns a trace (what was considered, why it was chosen). Explanations must never contradict the trace.
5. Do not invent critical incident values. Mark uncertain fields and flag for human confirmation.
6. Data contract (`backend/models/*`, `contracts/mock_state.json`) is frozen after P1 publishes it. Change only via P1.
7. Edit only files you own (see `.github/CODEOWNERS` and `docs/GITHUB_SETUP.md` section 5).

## Stack
Backend: Python 3.11, FastAPI, Pydantic v2, LangGraph (optional; sequential fallback in `workflow.py`), httpx, pytest.
Frontend: React + Vite + Tailwind, Leaflet (divIcon markers so the map works if tiles fail).
State: in-memory `SimulationEngine` for the hackathon.
LLM: xAI Grok via `OpenAI(base_url=XAI_BASE_URL, api_key=XAI_API_KEY)`. Verify model names with `GET /v1/models`.
Note: the submitted Round 1 doc lists Next.js and PostgreSQL. See `docs/OPEN_ITEMS.md`.

## Commands
```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env
uvicorn backend.main:app --reload --port 8000
pytest backend/tests -q
LLM_ENABLED=false pytest backend/tests -q
cd frontend && npm install && npm run dev
```

## Git workflow
Trunk-based. Branch `<person>/<thing>`, small PRs, rebase on `main`, never push to `main`. Commits: `type(scope): summary`. Details and checkpoint tags: `docs/GITHUB_SETUP.md`.

## Where to look
- Your action file (detailed autonomous tasks): `docs/actions/P1_ACTIONS.md` to `P4_ACTIONS.md`, with `docs/actions/00_AGENT_PROTOCOL.md` and `docs/actions/01_SHARED_CONTRACT_V0.md`
- Summary task lists: `docs/tasks/P1.md` to `P4.md`
- Timeline and exit criteria: `docs/02_TIMELINE.md`
- Draft data contract: `docs/03_DATA_CONTRACT.md`
- Spec card template for each sub-agent: `docs/specs/AGENT_SPEC_TEMPLATE.md`
- Open questions: `docs/OPEN_ITEMS.md`

## For AI coding agents
Ask which person (P1 to P4) the user is, then work only inside that person's files. Read that person's task list and the phase currently in progress. Do not add features beyond the current phase's exit criteria. Run the tests before proposing a commit.
