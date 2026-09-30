# Shared contract v0 (PROPOSED: P1 confirms or edits by 3:00 PM, then it is frozen)

Everything below is a proposal so all four agents can start in parallel. The Pydantic models P1 publishes in `backend/models/` override this file. Where this file and the models disagree, the models win and P1 updates this file.

## 1. Enums
- `IncidentType`: `medical`, `fire`, `rescue`, `hazmat`
- `ResourceType`: `ambulance`, `fire_engine`, `rescue_team`
- `FacilityKind`: `hospital`, `shelter`
- `IncidentStatus`: `new`, `assessed`, `assigned`, `en_route`, `on_scene`, `resolved`
- `ResourceStatus`: `available`, `en_route`, `on_scene`, `unavailable`
- `Tier`: `critical`, `high`, `medium`, `low`
- `TriggerKind`: `new_incident`, `resource_failure`, `resource_restored`, `escalation`, `time_advance`, `approval_decision`, `what_if`
- `ApprovalStatus`: `pending`, `approved`, `rejected`

## 2. Domain models (fields; all Pydantic v2)
- `LatLng`: lat, lng, label (optional)
- `Incident`: id, type, severity (1 to 5), description, location (LatLng), people_affected (int), required (dict ResourceType to int), status, reported_at_min (int), priority (float, set by Assessment), tier, uncertain_fields (list of str), needs_confirmation (bool), source (`structured` or `free_text`)
- `Resource`: id, type, name, base (LatLng), location (LatLng, current), status, assigned_incident_id (optional)
- `Facility`: id, kind, name, location, capacity, load
- `Assignment`: id, resource_id, incident_id, eta_min (float), distance_km (float), facility_id (optional), locked (bool), approved (bool), reason (str)
- `Unmet`: incident_id, missing (dict ResourceType to int)
- `PlanMetrics`: avg_eta_min, max_eta_min, coverage_pct (share of required resource-slots filled), utilization_pct (share of non-failed resources assigned), unresolved_count (incidents with any unmet slot)
- `Plan`: id, version (int), assignments, unmet, metrics
- `DiffChange`: resource_id, kind (`added`, `removed`, `reassigned`, `eta_changed`), old_incident_id, new_incident_id, old_eta_min, new_eta_min, reason
- `PlanDiff`: from_version, to_version, changes
- `TraceEntry`: agent, step, detail, used_llm (bool), fallback_used (bool), at_min
- `Explanation`: id, trigger, bullets (list of str), trace_refs (list of int indexes into traces)
- `Constraint`: resource_id, incident_id, kind (`locked` or `approved`)
- `ApprovalRequest`: id, status, reasons (list of str), consequences (list of str), proposed_plan, diff, created_at_min
- `Alert`: id, level (`info`, `warning`, `critical`), text, at_min
- `AgentMessage`: id, agent, text, at_min
- `CrisisState`: clock_min, incidents, resources, facilities, current_plan, proposed_plan (optional), approval (optional), plan_history (list of Plan), constraints, traces, explanations, alerts, messages, event_log (list of str), llm_status (`enabled_ok`, `enabled_fallback`, `disabled`)

## 3. Sub-agent interface (`backend/subagents/base.py`, P1)
```python
class TriggerContext(BaseModel):
    kind: TriggerKind
    payload: dict            # e.g. {"incident_id": "I4"} or {"resource_id": "A3"}

class SubAgentResult(BaseModel):
    payload: dict            # shape per agent, see below
    traces: list[TraceEntry]

class SubAgent(Protocol):
    name: str
    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult: ...
```
Rules: sub-agents are pure. They receive a state they must not mutate and return a result. Only the Orchestrator applies results to state.

Payload shapes:
| Agent | `payload` |
|---|---|
| Assessment | `{"incidents": [Incident, ...]}` (new or re-scored, priority and tier set) |
| Impact Detector | `{"invalidated": [{"assignment_id": str, "reason": str}]}` |
| Allocation | `{"plan": Plan}` (assignments carry ETA from `geo.eta_minutes`; `unmet` filled) |
| Logistics | `{"assignments": [Assignment], "positions": {resource_id: LatLng}}` (ETA refined, facility_id chosen for medical) |
| Explainer | `{"explanation": Explanation}` |
| What-If | `{"scenario": {...trigger...}, "affected_incidents": [...], "affected_resources": [...], "conflicts": [...], "approval_required": bool, "reasons": [...], "proposed_plan": Plan, "diff": PlanDiff, "metrics_before": PlanMetrics, "metrics_after": PlanMetrics}` |

## 4. Shared pure functions
- `services/geo.py` (P4): `haversine_km(a, b) -> float`; `eta_minutes(a, b) -> float` = `2 + (haversine_km * 1.4 / 40) * 60` (2 min dispatch delay, road factor 1.4, 40 km/h); `interpolate(a, b, fraction) -> LatLng`
- `services/scoring.py` (P2): `priority_score(incident, clock_min) -> float`; `tier_for(score) -> Tier`; `max_eta_for(tier) -> float`
- `services/diff.py` (P3): `diff_plans(old, new, reasons) -> PlanDiff`; `compute_metrics(plan, state) -> PlanMetrics`
- `services/llm.py` (P2): `LLMClient.complete_json(system, user, schema_hint) -> LLMResult` with fields `ok`, `data`, `fallback_used`, `error`. Never raises. Returns `ok=False, fallback_used=True` when disabled, keyless, timed out, or unparseable.

## 5. API (FastAPI, all under `/api`, JSON; errors return `{"error": str}` with a 4xx status)
| Method and path | Purpose |
|---|---|
| GET `/state` | Full `CrisisState` |
| GET `/health` | `{"ok": true, "llm_status": ...}` |
| POST `/scenario/reset` | Reset to seed state |
| POST `/scenario/next` | Play the next scripted scenario step |
| POST `/scenario/run` | Reset then play all steps to the end |
| POST `/incidents` | Body: either structured fields or `{"free_text": str}` |
| POST `/incidents/{id}/escalate` | Body: `{"severity": int}` |
| POST `/resources/{id}/fail` and `/restore` | Mark unavailable or available |
| POST `/time/advance` | Body: `{"minutes": int}` |
| POST `/approval/{id}/approve` and `/reject` | Decision on the pending request |
| POST `/whatif` | Body: `{"kind": TriggerKind, "payload": {...}}`; returns the What-If payload; never changes live state |

## 6. Priority rule v0 (PROPOSED)
`score = severity*10 + min(people_affected, 20) + (10 if type in {medical, fire} else 0) + min(minutes_waiting, 30)*0.5`
Tiers: `>= 70` critical, `50 to 69.99` high, `30 to 49.99` medium, `< 30` low. Ties: earlier `reported_at_min`, then id.
Max acceptable ETA by tier: critical 15 min, high 25, medium 40, low 60.
An incident with `needs_confirmation = true` is scored and shown but not allocated until a human confirms.

## 7. Allocation rules v0 (PROPOSED)
1. Process incidents in priority order (highest first).
2. For each required resource type and count, choose the nearest eligible resource by ETA. Eligible = `available`, or currently assigned but preemptible (rule 4). Among free candidates prefer the smallest ETA (tie-break by resource id). Only if no free candidate exists, preempt, taking from the lowest-priority source incident first, then smallest ETA.
3. A resource that would exceed the incident's max ETA is not eligible; if no eligible resource exists, record the slot in `unmet`.
4. Preemption: a resource assigned to incident B may be taken for incident A only if A.priority minus B.priority is at least 8, the assignment is not `locked` or `approved`, and B is not `on_scene`.
5. Stickiness: keep an existing assignment unless the resource became `unavailable`, or rule 4 applies, or an alternative improves ETA by at least 5 minutes.
6. Every choice writes a `TraceEntry` with candidates considered, the winner and the rule applied.

## 8. Approval gate v0 (PROPOSED; `orchestrator/approval_gate.py`, P1, with P3)
A proposed plan needs human approval if any of these hold:
- It preempts a resource from an incident with severity 4 or 5.
- It leaves a `critical` tier incident with any `unmet` slot.
- It changes 3 or more assignments compared with the current plan.
- It includes an incident with `needs_confirmation = true` that would receive resources.
Otherwise the orchestrator commits the plan automatically and logs it.

## 9. Scenario v0 (PROPOSED; synthetic; `services/scenario.py` and `data/seed.py`, P4)
Seed: 3 ambulances (A1, A2, A3), 2 fire engines (F1, F2), 1 rescue team (R1), 2 hospitals (H1, H2), 1 shelter (S1), placed around central Bengaluru (about 12.97 N, 77.59 E) so distances stay 2 to 12 km. All data synthetic.
Steps (ids fixed so tests can assert them):
1. t=0: I1 medical, severity 3, 2 people, needs 1 ambulance. Expected: nearest ambulance assigned.
2. t=5: I2 fire (warehouse), severity 4, 6 people, needs 1 fire_engine and 1 ambulance.
3. t=10: free-text report with vague location ("man collapsed near the flyover, maybe heart attack"). Expected: I3 created with `uncertain_fields` including location, `needs_confirmation = true`, alert raised, no resources allocated.
4. t=15: I4 building collapse, severity 5, 20 people, needs 1 rescue_team, 2 ambulance, 1 fire_engine. Expected: R1 and F2 assigned, A3 assigned, second ambulance (A1) preempted from I1 (priority about 70 vs 49.5, severity 3 so no approval needed; I2 also qualifies but I1 has lower priority so it is taken first); I1 becomes unmet; explanation says why.
5. t=20: A3 fails while en route to I4. Expected: Impact Detector flags the A3 to I4 assignment; no free ambulance exists, so A2 would be preempted from I2 (priority about 72.5 vs 63.5, gap 9), and I2 has severity 4, so the gate requires approval; proposed plan and diff shown.
6. t=22: human approves. Expected: plan promoted, diff recorded, explanation updated, approved assignments locked.
7. What-If (no state change): fail F2. Expected: affected incident I4, conflict reported, approval flagged, metrics before and after shown.
The scenario must be deterministic: same steps give the same plan every run.
