# P2 actions: Assessment, Explainer, Grok

**May edit:** `backend/subagents/assessment.py`, `explainer.py`, `backend/services/llm.py`, `scoring.py`, `backend/tests/test_scoring.py`, `test_assessment.py`, `test_llm.py`, `test_explainer.py`, `docs/specs/assessment.md`, `explainer.md`, `priority_formula.md`, `frontend/src/components/IncidentCards.jsx`, `AlertsPanel.jsx`, `ExplanationLog.jsx`, `AgentChat.jsx`, `AddIncidentForm.jsx`.
**Must not edit:** models, contract, orchestrator, other sub-agents. Contract gaps go in `CONTRACT_REQUESTS.md`.
**Branch prefix:** `p2/`.

## Kickoff prompt
> You are working for P2 on Crisis Command. Read AGENTS.md, docs/actions/00_AGENT_PROTOCOL.md, docs/actions/01_SHARED_CONTRACT_V0.md and docs/actions/P2_ACTIONS.md. Execute tasks in order starting with P2-W1. One branch and one PR per task, run Verify, stop after each PR and report. Use the priority rule v0 in the contract exactly; do not invent formulas. Everything with the LLM must work with LLM_ENABLED=false.

## Phase 1: Web (2:00 to 6:00 PM)

### P2-W0: Spec cards (2:00 to 2:45 PM, 30 min, human with agent help)
Files: `docs/specs/assessment.md`, `explainer.md` from `AGENT_SPEC_TEMPLATE.md`, and `priority_formula.md` copying contract section 6 (edit only if the human changes the rule). Commit on branch `p2/specs`.

### P2-W1: Grok client with fallback (60 min)
Branch `p2/llm-client`. File: `services/llm.py`. Depends on: `config.py` (P1). If not merged, read env directly behind one function and swap later.
Steps: `LLMClient` using `openai.OpenAI(base_url=XAI_BASE_URL, api_key=XAI_API_KEY, timeout=LLM_TIMEOUT_SECONDS)`; `complete_json(system, user, schema_hint) -> LLMResult(ok, data, fallback_used, error)`; request JSON only, strip code fences, `json.loads`; return `ok=False, fallback_used=True` when `LLM_ENABLED` is false, key is empty, the call times out, the HTTP call errors, or the JSON is invalid. Never raise. Never log the key or full prompts with secrets.
Acceptance: all failure modes return a fallback result in under `LLM_TIMEOUT_SECONDS + 1` seconds.
Verify: `pytest backend/tests/test_llm.py -q` using monkeypatched failures (disabled, no key, timeout, HTTP 401, invalid JSON, valid JSON).
Note: do not hardcode a model name; use `XAI_MODEL`. The human verifies the name with `GET /v1/models`.

### P2-W2: Priority scoring (30 min)
Branch `p2/scoring`. File: `services/scoring.py`.
Steps: `priority_score`, `tier_for`, `max_eta_for` exactly as contract section 6. Deterministic and pure.
Acceptance: I1 at t=15 scores 49.5 (medium); I4 with 20 people, severity 5 scores 70 (critical); ties break by earlier report then id.
Verify: `pytest backend/tests/test_scoring.py -q` with those cases plus boundary tiers (29.99, 30, 49.99, 50, 69.99, 70).

### P2-W3: IncidentCards, AlertsPanel, add-incident form (90 min)
Branch `p2/incident-ui`. Files: the three components. Depends on: P4's shell (else build standalone with props and a mock import from `contracts/mock_state.json`).
Steps: IncidentCards show type, severity badge, tier color plus text label (not color alone), priority score, people affected, status, uncertain-field chips and a "needs confirmation" banner. AlertsPanel lists alerts newest first with level icons. Add-incident form has a structured mode (type, severity, people, location label) and a free-text mode; submits to `POST /api/incidents`; shows the error message on failure and disables the button while in flight. Escalate button calls `POST /api/incidents/{id}/escalate`.
Acceptance: renders with mock state; empty lists render an empty state message.
Verify: `cd frontend && npm run build`.

## Phase 2: Integrate (6:00 to 10:00 PM)

### P2-I1: Assessment v0, rule-based (60 min)
Branch `p2/assessment-v0`. File: `subagents/assessment.py`.
Steps: implement the `SubAgent` protocol (`name = "assessment"`). For structured input: compute priority and tier with `scoring.py`, set status `assessed`, set required resources from type defaults (medical: 1 ambulance; fire: 1 fire_engine; rescue: 1 rescue_team; hazmat: 1 hazmat as fire_engine 1 plus ambulance 1) unless the input specifies them. For `free_text`, use a keyword parser: type keywords, severity words ("collapsed", "trapped", "unconscious" raise severity), number words for people; anything not found goes into `uncertain_fields`; location vague (no known place name) sets `needs_confirmation = true`. Return traces stating each rule used with `used_llm=False`.
Acceptance: the step-3 free-text sample from contract section 9 yields `needs_confirmation = true` and location in `uncertain_fields`.
Verify: `pytest backend/tests/test_assessment.py -q`.

### P2-I2: ExplanationLog and AgentChat live (60 min)
Branch `p2/explain-ui`. Files: the two components.
Steps: ExplanationLog renders `explanations` (trigger, bullets) newest first; each bullet expandable to its referenced traces. AgentChat renders `messages` as a chat feed by agent name, auto-scroll to newest, polling handled by P4's hook.
Acceptance: works with live `/api/state` once P1-I3 is merged; no crash with empty arrays.

## Phase 3: Agent (10:00 PM to 2:00 AM)

### P2-A1: Assessment with Grok parsing (75 min)
Branch `p2/assessment-llm`. File: `subagents/assessment.py`.
Steps: for `free_text`, call `LLMClient.complete_json` with a system prompt that demands JSON: `{"type","severity","people_affected","location_label","required":{...},"uncertain_fields":[...],"confidence":0-1}` and instructs "never guess: if a value is not stated, put the field name in uncertain_fields and return null". Validate the JSON against the Incident fields; reject out-of-range values; on any failure use the rule-based parser. Set `used_llm` and `fallback_used` on the trace. Location must never be invented: a null location sets `needs_confirmation = true`.
Acceptance: with `LLM_ENABLED=false` results equal P2-I1 behavior; with a mocked valid LLM response the LLM values are used; with mocked garbage the fallback is used and the trace says so.
Verify: extend `test_assessment.py` with those three cases.

### P2-A2: Explainer (75 min)
Branch `p2/explainer`. File: `subagents/explainer.py`.
Steps: build `Explanation` bullets deterministically from `TraceEntry` and `PlanDiff` (for example "A1 moved from I1 to I4 because I4 priority 70 exceeds I1 priority 49.5 by at least 8 and I1 is not locked"). Every bullet carries `trace_refs`. Optional narration: if the LLM is available, ask Grok to rephrase the bullets more fluently while preserving every number and id; verify all numbers and ids in the output appear in the input, else discard the narration and keep the deterministic bullets.
Acceptance: deterministic bullets always exist; narration that changes any number or id is rejected.
Verify: `pytest backend/tests/test_explainer.py -q` including a test that a contradictory mocked narration is rejected.

### P2-A3: Trace consistency test (30 min)
Add a test that runs the scenario (or a fixture of it) and asserts every id and number in every explanation bullet exists in the referenced traces or diff.

## Phase 4: Test flow (2:00 to 9:00 AM)
- P2-T1: run the full scenario with no key, a wrong key, and a 1-second timeout; confirm the UI shows `llm_status` fallback and nothing breaks.
- P2-T2: tune prompts on 10 varied free-text reports (vague location, multiple incidents in one message, no severity words, typos); record results in `docs/actions/P2_PROMPT_LOG.md`.
- P2-T3: audit every explanation in the scenario against its trace by hand.
- 9 to 11 AM: re-read the demo explanations once more for accuracy.

## Definition of done
Web: llm and scoring tested, three UI pieces render mock state. Integrate: adding an incident from the UI creates an assessed incident. Agent: free text works with and without Grok, explanations never contradict traces.
