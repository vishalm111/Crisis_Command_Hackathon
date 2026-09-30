# Timeline (start 30 Sep, 2:00 PM; submit by 10:45 AM on 1 Oct)

| Time | Phase | Goal | Done when |
|---|---|---|---|
| 2:00 to 6:00 PM | Web | Dashboard and backend skeleton on mock data | Every panel renders from a mock `/api/state`; every button calls a real stub endpoint |
| 6:00 to 10:00 PM | Integrate | UI, API and workflow wired with stub sub-agents | Full scenario clicks through end to end with placeholder logic |
| 10:00 PM to 2:00 AM | Agent | Real logic in the orchestrator and all sub-agents | Scenario produces the real plan, old vs new diff, explanations and approval gate |
| 2:00 to 9:00 AM | Test flow | Repeated runs, bug fixing, hardening | Scenario button works three times in a row; no-key run passes |
| 9:00 to 11:00 AM | Final testing | Feature freeze, rehearsal, submission | Tag `demo-ready`; submitted by 10:45 AM |

Test flow split: 2 to 4 AM run the full scenario repeatedly and fix what breaks; 4 to 9 AM edge cases, no-key fallback, What-If variants, UI polish, README, demo script. Nobody sleeps, so schedule short staggered breaks.

## Everyone, 2:00 to 3:00 PM
Clone the repo, set up `.env`, write your spec card. P1 publishes the data contract (`models/` plus `mock_state.json`) by 3:00 PM.

## Checkpoints and tags
| Time | Checkpoint | Tag |
|---|---|---|
| 5:45 PM | Web phase merged; UI runs on mock state | `phase1-web` |
| 9:45 PM | Integrate merged; scenario clicks through with stubs | `phase2-integrate` |
| 1:45 AM | Real agent logic merged | `phase3-agents` |
| 9:00 AM | Feature freeze | `feature-freeze` |
| 10:30 AM | Code freeze | `demo-ready` |

Merge freeze: last 30 minutes before each checkpoint, only bug fixes and checkpoint merges.

## Full-team rehearsals
9:30 AM and 10:15 AM: one person presents, the others watch for bugs.

## Risks
- Integrate comes before Agent, so the frozen data contract is critical. Stub sub-agents return canned results in the exact contract shape; Phase 3 replaces only the logic.
- Phase 3 is four hours. Priority formula, allocation rules and approval triggers must be fixed before it starts.
