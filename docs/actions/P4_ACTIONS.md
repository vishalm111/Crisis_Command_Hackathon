# P4 actions: Logistics, map, scenario, demo

**May edit:** `backend/subagents/logistics.py`, `backend/services/geo.py`, `backend/services/scenario.py`, `backend/data/*`, `backend/tests/test_scenario.py`, `test_geo.py`, `test_logistics.py`, `docs/specs/logistics.md`, `docs/DEMO_SCRIPT.md`, `docs/JUDGE_QA.md`, `README.md`, everything in `frontend/` except the components owned by P1, P2, P3 (`frontend/package.json` and `vite.config.js` are shared: tiny PRs only).
**Must not edit:** models, contract, orchestrator, other sub-agents.
**Branch prefix:** `p4/`.

## Kickoff prompt
> You are working for P4 on Crisis Command. Read AGENTS.md, docs/actions/00_AGENT_PROTOCOL.md, docs/actions/01_SHARED_CONTRACT_V0.md and docs/actions/P4_ACTIONS.md. Execute tasks in order starting with P4-W1. One branch and one PR per task, run Verify, stop after each PR and report. All demo data is synthetic. Keep the safety banner visible at all times. The map must remain usable if map tiles fail to load.

## Phase 1: Web (2:00 to 6:00 PM). You unblock the frontend for everyone: do P4-W1 first.

### P4-W0: Spec card (2:00 to 2:45 PM, 20 min)
Branch `p4/specs`. `docs/specs/logistics.md` from the template.

### P4-W1: Vite app shell (by 3:00 PM, 45 min)
Branch `p4/frontend-shell`. Files: `frontend/` (package.json, vite.config.js, index.html, tailwind config, `src/main.jsx`, `App.jsx`, `api.js`, `components/Header.jsx`, `SafetyBanner.jsx`, `hooks/usePolling.js`).
Steps: React + Vite + Tailwind. `api.js` reads `VITE_API_URL` and wraps `getState`, `postJson`, with errors thrown as `Error(message)`. `App.jsx` lays out slots for every panel by name (PlanPanel, ApprovalPanel, IncidentCards, AlertsPanel, ExplanationLog, AgentChat, ResourceTable, PlanDiff, WhatIfPanel, MapView, SimulationControls) using a dynamic import with a placeholder if a component file does not exist yet, so nobody's merge breaks the build. `SafetyBanner` always shows "DEMONSTRATION / SIMULATION ONLY. NOT FOR REAL-WORLD EMERGENCY DISPATCH." `usePolling(fn, ms)` with cleanup and error state; default 1500 ms.
Acceptance: `npm run dev` shows the layout and banner; `npm run build` passes with no other components present.
Verify: `cd frontend && npm install && npm run build`. Post in the group chat when merged.

### P4-W2: geo.py (30 min)
Branch `p4/geo`. File: `services/geo.py`.
Steps: `haversine_km`, `eta_minutes`, `interpolate` exactly as contract section 4. Pure, no I/O.
Acceptance: known distance sanity check (two points about 10 km apart give about 10 km); ETA for 0 km is 2 minutes; `interpolate` at 0 and 1 returns the endpoints.
Verify: `pytest backend/tests/test_geo.py -q`. Tell P3 when merged.

### P4-W3: Seed data (45 min)
Branch `p4/seed`. File: `backend/data/seed.py`.
Steps: `build_seed_state() -> CrisisState` with resources A1 to A3, F1, F2, R1, facilities H1, H2, S1 around central Bengaluru (about 12.97 N, 77.59 E), all synthetic, distances 2 to 12 km, no incidents at t=0. Give every place a label. Wire `SimulationEngine.reset()` to use it via a tiny PR to P1 (ask P1; do not edit `engine.py`).
Acceptance: validates as `CrisisState`; every resource has base equal to location.
Verify: `pytest backend/tests/test_geo.py -q` plus a seed validation test.

### P4-W4: SimulationControls (45 min)
Branch `p4/controls`. File: `frontend/src/components/SimulationControls.jsx`.
Steps: buttons: Reset, Next Step, RUN HACKATHON SCENARIO, Advance 5 min, Fail resource (dropdown), Restore resource. Each calls the matching endpoint from contract section 5; every button disables while any request is in flight; errors shown inline.
Acceptance: all buttons hit real stub endpoints once P1-W5 is merged.

### P4-W5: MapView (75 min)
Branch `p4/map`. File: `frontend/src/components/MapView.jsx`. Dependency: `leaflet` (tiny PR to `package.json`, tell the group).
Steps: Leaflet with `divIcon` markers (emoji or letter with color and text label): incidents by type and tier, resources by type and status, facilities. Lines from assigned resources to incidents. OpenStreetMap tile layer with a plain background so markers still work if tiles fail; a small legend. Center on the seed area.
Acceptance: renders from `contracts/mock_state.json`; no console errors with tiles blocked.
Verify: `npm run build`; manually test with the network tab set to offline.

## Phase 2: Integrate (6:00 to 10:00 PM)

### P4-I1: Logistics v0 (45 min)
Branch `p4/logistics-v0`. File: `subagents/logistics.py`.
Steps: `SubAgent` named `logistics`. Given the plan, set `eta_min` and `distance_km` with `geo.eta_minutes`, choose the nearest hospital with free capacity for medical assignments (`facility_id`), return current `positions` for en-route resources by interpolating from base to incident using the clock. Traces state distances used.
Acceptance: assignments have positive ETA and a `facility_id` for medical incidents.
Verify: `pytest backend/tests/test_logistics.py -q`.

### P4-I2: Polling and live markers (30 min)
Wire `usePolling` in `App.jsx` to `GET /api/state` and pass state to every panel. Show a "backend unreachable" banner if polling fails 3 times in a row, and keep the last good state visible.

### P4-I3: Scenario runner (90 min)
Branch `p4/scenario`. File: `services/scenario.py`.
Steps: implement the 7 steps in contract section 9 as an ordered list of scripted events (trigger kind, payload, clock time). Expose `next_step(engine, orchestrator)` and `run_all(...)`, used by `POST /scenario/next` and `/scenario/run` (ask P1 to wire the routes if not done). The script is deterministic and idempotent after reset.
Acceptance: with stubs, all 7 steps run without errors and state stays valid.

## Phase 3: Agent (10:00 PM to 2:00 AM)

### P4-A1: Logistics real logic (75 min)
Branch `p4/logistics`. File: `subagents/logistics.py`.
Steps: rank candidate resources by ETA for a given incident (used by P3 through `geo`; Logistics only refines), en-route interpolation using `fraction = elapsed / eta`, hospital choice by distance then free capacity, shelter choice for rescue incidents, mark a resource `on_scene` when the fraction reaches 1. Update facility `load` in the returned payload only.
Acceptance: after Advance 5 min, markers move; a hospital at capacity is skipped.

### P4-A2: Tune seed and scenario (75 min)
Adjust seed coordinates and wording so contract section 9 plays out exactly: step 4 preempts A1 from I1, step 5 needs approval. Change only `seed.py` and `scenario.py`; if the rules themselves must change, file a contract request.
Acceptance: `test_scenario.py` asserts, per step, the key facts listed in contract section 9.

### P4-A3: test_scenario.py end to end (45 min)
Run all 7 steps through the API with `TestClient` and `LLM_ENABLED=false`; assert final plan, approval flow, and that reset then rerun yields identical output.

## Phase 4: Test flow (2:00 to 9:00 AM)
- Run the scenario three times in a row through the UI; log any break in `docs/actions/INTEGRATION_BUGS.md` and tell the owner.
- README: what it is, safety note, setup, env, how to run, how to run the scenario, architecture diagram (mermaid), the no-key fallback, team and originality note.
- `docs/DEMO_SCRIPT.md`: 3-minute story following the 7 steps with what to click and what to say at each step.
- `docs/JUDGE_QA.md`: 10 likely questions (why multi-agent, where is the LLM used, what if the API is down, how do you avoid hallucination, how is it different from nearest-resource, how does approval work, scalability, real-world data, ethics and safety, what next).
- 9 to 11 AM: after the first clean run record the backup demo video (human).

## Definition of done
Web: shell, geo, seed, controls, map render. Integrate: scenario button plays all steps with stubs. Agent: `test_scenario.py` green; the demo is repeatable three times in a row.
