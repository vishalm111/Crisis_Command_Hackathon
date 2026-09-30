# Agent spec card: Assessment
Owner: P2. One page.

## Behavior
- **What it decides:**
  - Evaluates new incidents and escalations (from both structured forms and free-text dispatch messages).
  - Determines incident type (`medical`, `fire`, `rescue`, `hazmat`), severity (1 to 5), estimated people affected, and location.
  - Derives required resources from type defaults (medical: 1 ambulance; fire: 1 fire engine; rescue: 1 rescue team; hazmat: 1 fire engine + 1 ambulance) unless explicitly specified.
  - Computes priority score and tier using `services/scoring.py`.
  - Flags missing or ambiguous data into `uncertain_fields`.
  - Sets `needs_confirmation = true` whenever location is vague, place names are unknown, or values are uncertain, preventing premature resource dispatch until confirmed by human dispatchers.
  - Transitions incident status to `assessed`.
- **What it must never do:**
  - Must never mutate shared state directly (returns pure `SubAgentResult` payload for Orchestrator to apply).
  - Must never invent or hallucinate critical incident values (such as fake coordinates, specific addresses, or casualty figures).
  - Must never allocate resources directly or modify existing resource assignments (owned by Allocation).
  - Must never crash or raise unhandled exceptions on missing LLM key, timeout, or malformed input (always falls back to rule-based parser).

## Tools
- **Internal:**
  - `services/scoring.py`: `priority_score(incident, clock_min)`, `tier_for(score)`, `max_eta_for(tier)`.
  - Pydantic models: `Incident`, `LatLng`, `IncidentType`, `Tier`, `IncidentStatus`.
- **External:**
  - `services/llm.py`: `LLMClient.complete_json` (xAI Grok via OpenAI-compatible endpoint).
  - Fallback: deterministic keyword-based rule parser with severity vocabulary ("collapsed", "trapped", "fire", "smoke", "unconscious").

## Workflow
1. **Receive Trigger:** Orchestrator dispatches `TriggerContext` with `kind` (`new_incident`, `escalation`, `time_advance`) and incident payload.
2. **Field Extraction:**
   - **Structured Input:** Read type, severity, people_affected, location. Use default resource requirements if empty.
   - **Free-Text Input:**
     - When `LLM_ENABLED=true` and key present: Invoke `LLMClient.complete_json` with strict schema prompt instructing the model never to guess unstated attributes. Validate output constraints.
     - When `LLM_ENABLED=false` or LLM call fails: Invoke rule-based regex and keyword parser. Identify casualty numbers, emergency type, and severity boosters.
3. **Uncertainty & Safety Check:** If location is missing or vague, append `"location"` to `uncertain_fields` and set `needs_confirmation = true`.
4. **Priority & Tier Calculation:** Compute `priority = priority_score(incident, clock_min)` and `tier = tier_for(priority)`.
5. **Trace Generation:** Record `TraceEntry` with agent `"assessment"`, step name, rule details, `used_llm`, `fallback_used`, and timestamp.
6. **Return Result:** Return `SubAgentResult(payload={"incidents": [assessed_incident]}, traces=[...])`.

## Triggers
- `new_incident`: Ingest, parse, score, and set requirements for newly reported incident.
- `escalation`: Re-assess incident upon severity change or updated casualty count.
- `time_advance`: Re-evaluate waiting time component in priority score for active incidents.

## Logging
- **Trace Entry (`TraceEntry`):**
  - `agent`: `"assessment"`
  - `step`: `"parse_free_text"`, `"rule_fallback"`, `"calculate_priority"`, or `"flag_uncertainty"`
  - `detail`: Summary of extracted attributes, assigned priority score, tier, and any uncertain fields
  - `used_llm`: `true` if Grok parsed the report; `false` otherwise
  - `fallback_used`: `true` if rule-based keyword parser was used due to LLM failure or disabled state
  - `at_min`: Simulation clock minute
- **Alert / Messages:** Emits alert when `needs_confirmation = true` for operator visibility.
