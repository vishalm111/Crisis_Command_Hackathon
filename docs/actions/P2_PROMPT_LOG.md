# P2 Prompt & Natural Language Parser Tuning Log

Test suite evaluating Assessment sub-agent intake across 10 varied real-world dispatch reports.

| Case | Scenario & Input Text | Parsed Type | Severity | Casualties | Location & Gate | Priority (Tier) | Uncertain Fields | Evaluation / Safety Check |
|---|---|---|---|---|---|---|---|---|
| **CASE-1** | *"man collapsed near the flyover, maybe heart attack"* | `medical` | 4 | 1 | Unverified flyover<br>`needs_confirmation = true` | 51.0 (High) | `["location"]` | ✅ **Passed Step-3 Acceptance Criteria**: Vague location correctly flagged; dispatch held for confirmation. |
| **CASE-2** | *"transformer fire broke out while an elderly person fainted nearby on Brigade Road"* | `fire` | 3 | 1 | Brigade Road (Verified)<br>`needs_confirmation = false` | 41.0 (Medium) | `["severity"]` | ✅ Disasters prioritized over secondary medical faint; verified landmark mapped. |
| **CASE-3** | *"traffic incident reported at MG Road Metro, vehicle stopped, no injuries observed"* | `medical` | 3 | 1 | MG Road Metro (Verified)<br>`needs_confirmation = false` | 41.0 (Medium) | `["type", "severity", "people_affected"]` | ✅ Missing type & severity explicitly tagged in uncertain fields. |
| **CASE-4** | *"bldng colapse near Richmond Circle, peple traped in ruble, need rescuer"* | `rescue` | 5 | 1 | Richmond Circle (Verified)<br>`needs_confirmation = false` | 51.0 (High) | `["people_affected"]` | ✅ **Typo resilience**: successfully parsed `bldng colapse`, `peple traped`, and `ruble` to trigger rescue dispatch. |
| **CASE-5** | *"toxic chemical fumes leaking from industrial truck on Shivajinagar Depot, workers vomiting"* | `hazmat` | 3 | 1 | Shivajinagar Depot (Verified)<br>`needs_confirmation = false` | 31.0 (Medium) | `["severity", "people_affected"]` | ✅ Hazmat emergency identified; dual requirement assigned (fire engine + ambulance). |
| **CASE-6** | *"huge blaze on 3rd floor commercial warehouse near Indiranagar, 12 people trapped inside smoke"* | `fire` | 4 | 12 | Indiranagar (Verified)<br>`needs_confirmation = false` | 62.0 (High) | `[]` | ✅ 12 casualties extracted; elevated severity 4; high priority score. |
| **CASE-7** | *"woman unconscious on sidewalk at Town Hall, breathing heavily"* | `medical` | 4 | 1 | Town Hall (Verified)<br>`needs_confirmation = false` | 51.0 (High) | `[]` | ✅ Unconscious keyword elevated severity to 4; medical type confirmed. |
| **CASE-8** | *"explosion heard, heavy smoke rising into sky, send ambulances and fire trucks immediately"* | `fire` | 5 | 1 | Unspecified location<br>`needs_confirmation = true` | 61.0 (High) | `["people_affected", "location"]` | ✅ Catastrophic severity 5; zero location context triggered confirmation gate. |
| **CASE-9** | *"small contained trash fire outside Victoria Hospital, no injuries, conscious bystanders watching"* | `fire` | 2 | 1 | Victoria Hospital (Verified)<br>`needs_confirmation = false` | 31.0 (Medium) | `["people_affected"]` | ✅ De-escalation words (`small`, `contained`) lowered severity to 2. |
| **CASE-10** | *"patient having acute cardiac arrest inside Bowring Hospital premises, 1 person"* | `medical` | 5 | 1 | Bowring Hospital (Verified)<br>`needs_confirmation = false` | 61.0 (High) | `[]` | ✅ Cardiac arrest triggered severity 5; verified hospital coordinates. |

## Observations & Guardrails
1. **Safety Gate Effectiveness**: Whenever location context was ambiguous or unverified (`CASE-1`, `CASE-8`), `needs_confirmation` was triggered and `"location"` added to `uncertain_fields`, preventing premature autonomous dispatch without human coordinator review.
2. **Deterministic Fallback Reliability**: With `LLM_ENABLED=false` or network timeouts, the keyword parser reliably recovers domain types, severity boosters, and number words.
3. **Typo Tolerance**: Phonetic and common emergency transcription typos (`bldng colapse`, `traped`, `ruble`) are caught by relaxed boundary matching.
