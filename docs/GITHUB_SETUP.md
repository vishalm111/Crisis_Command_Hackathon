# Crisis Command: GitHub Setup for a 4-Person Team

Drop this file into the repo as `docs/GITHUB_SETUP.md`. Total setup time for the repo owner: about 20 minutes.

> DEMONSTRATION / SIMULATION ONLY. NOT FOR REAL-WORLD EMERGENCY DISPATCH.

---

## 1. Roles

| Person | Role | Sub-agents and services owned |
|---|---|---|
| P1 | Repo owner, tech lead | Orchestrator, approval gate, engine, API, data contract |
| P2 | LLM and assessment | Assessment sub-agent, Explainer sub-agent, Grok client, scoring |
| P3 | Allocation and what-if | Allocation, Impact Detector and What-If sub-agents, plan diff |
| P4 | Logistics and demo | Logistics sub-agent, geo and ETA, seed data, scenario runner, map, controls |

Replace P1 to P4 with real GitHub usernames in `CODEOWNERS` (section 5).

---

## 2. Create the repo (P1 only)

Needs the GitHub CLI (`gh auth login` first).

```bash
gh repo create crisis-command --private --clone
cd crisis-command

# add teammates with write access
gh api -X PUT repos/<OWNER>/crisis-command/collaborators/<P2_USERNAME> -f permission=push
gh api -X PUT repos/<OWNER>/crisis-command/collaborators/<P3_USERNAME> -f permission=push
gh api -X PUT repos/<OWNER>/crisis-command/collaborators/<P4_USERNAME> -f permission=push
```

Teammates accept the invitation by email, or at `github.com/<OWNER>/crisis-command/invitations`.

Without the CLI: create the repo in the GitHub UI, then Settings, Collaborators, Add people.

---

## 3. Scaffold the project (P1 only, then push to main)

Run from the repo root:

```bash
mkdir -p backend/{models,orchestrator,subagents,services,data,tests} \
         frontend/src/{components,hooks} contracts docs/specs .github/workflows

touch backend/main.py backend/config.py \
      backend/models/{enums.py,domain.py,api.py} \
      backend/orchestrator/{orchestrator.py,workflow.py,approval_gate.py} \
      backend/subagents/{base.py,assessment.py,explainer.py,allocation.py,impact_detector.py,whatif.py,logistics.py} \
      backend/services/{engine.py,llm.py,scoring.py,diff.py,geo.py,scenario.py} \
      backend/data/seed.py backend/tests/test_scenario.py \
      contracts/mock_state.json docs/specs/.gitkeep
```

Resulting layout:

```
crisis-command/
├── backend/
│   ├── main.py, config.py
│   ├── models/            P1  (data contract, change only via P1)
│   ├── orchestrator/      P1  (trigger routing, conflicts, plan merge, approval gate)
│   ├── subagents/
│   │   ├── base.py            P1  (sub-agent interface)
│   │   ├── assessment.py      P2
│   │   ├── explainer.py       P2
│   │   ├── allocation.py      P3
│   │   ├── impact_detector.py P3
│   │   ├── whatif.py          P3
│   │   └── logistics.py       P4
│   ├── services/
│   │   ├── engine.py          P1
│   │   ├── llm.py, scoring.py P2
│   │   ├── diff.py            P3
│   │   └── geo.py, scenario.py P4
│   ├── data/seed.py       P4
│   └── tests/
├── frontend/              see ownership in section 5
├── contracts/mock_state.json   P1 (frozen early)
├── docs/                  specs, this file, demo script
├── requirements.txt, .env.example, .gitignore, README.md
```

### `.gitignore`

```gitignore
.env
.env.*
!.env.example
__pycache__/
*.pyc
.venv/
venv/
node_modules/
dist/
.DS_Store
.idea/
.vscode/
```

### `.env.example`

```bash
# ---- LLM (xAI Grok). Optional: the app must work with this blank. ----
LLM_ENABLED=true
XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
# Model names change. List what your key can use with:
#   curl https://api.x.ai/v1/models -H "Authorization: Bearer $XAI_API_KEY"
XAI_MODEL=grok-4-1-fast-non-reasoning
LLM_TIMEOUT_SECONDS=8

# ---- App ----
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
# Frontend (put in frontend/.env)
# VITE_API_URL=http://localhost:8000
```

Each person copies it: `cp .env.example .env` and adds their own key (or the team key, shared by DM only, never in chat history or commits).

### `requirements.txt` (starter)

```
fastapi
uvicorn[standard]
pydantic>=2
python-dotenv
openai          # xAI's API is OpenAI-compatible: OpenAI(base_url=XAI_BASE_URL, api_key=XAI_API_KEY)
langgraph       # optional; workflow.py falls back to a sequential runner if import fails
httpx
pytest
```

Commit and push:

```bash
git add .
git commit -m "chore: scaffold project structure"
git push -u origin main
```

---

## 4. Protect `main`

Settings, Branches (or Rules, Rulesets), Add rule for `main`:

- Require a pull request before merging (1 approval from any teammate)
- Require status checks to pass (select `backend` and `frontend` after the first CI run)
- Block force pushes and deletions

Note: on a free personal GitHub account, branch protection only works on public repos. If the repo is private and you cannot enable it, follow the same rules by convention. Nothing secret lives in the repo, so making it public is also fine.

---

## 5. Ownership and `CODEOWNERS`

Folder ownership is the main way we avoid merge conflicts. Edit only your own folders. For anything else, ask the owner or open a small PR and tag them.

Create `.github/CODEOWNERS`:

```
*                                   @P1
/backend/models/                    @P1
/backend/orchestrator/              @P1
/backend/services/engine.py         @P1
/backend/subagents/base.py          @P1
/contracts/                         @P1
/backend/subagents/assessment.py    @P2
/backend/subagents/explainer.py     @P2
/backend/services/llm.py            @P2
/backend/services/scoring.py        @P2
/backend/subagents/allocation.py    @P3
/backend/subagents/impact_detector.py @P3
/backend/subagents/whatif.py        @P3
/backend/services/diff.py           @P3
/backend/subagents/logistics.py     @P4
/backend/services/geo.py            @P4
/backend/services/scenario.py       @P4
/backend/data/                      @P4
/backend/tests/test_scenario.py     @P4
```

Frontend ownership:

| Files | Owner |
|---|---|
| `App.jsx`, `api.js`, `hooks/`, Header, SafetyBanner, SimulationControls, MapView | P4 |
| PlanPanel, ApprovalPanel | P1 |
| IncidentCards, AlertsPanel, ExplanationLog, AgentChat, add-incident form | P2 |
| ResourceTable, PlanDiff, WhatIfPanel | P3 |

Shared files (`requirements.txt`, `frontend/package.json`): anyone may add a line, but keep the PR tiny, merge it quickly, and tell the group chat.

The data contract (`backend/models/*` and `contracts/mock_state.json`) is frozen after P1 publishes it. Changes go through P1 and get announced in the group chat before merging.

---

## 6. Branching and merging

Trunk-based: short-lived branches, small PRs, merge often.

- Branch name: `<person>/<thing>`, for example `p3/allocation-core`, `p4/map-view`
- Branch from the latest `main`; keep branches under about 2 hours of work
- One PR per logical change; keep it reviewable in under 5 minutes
- Reviewer's job is a quick sanity check, not perfection. Approve fast.
- Never commit straight to `main`. Never force-push `main`.
- Rebase on `main` before opening the PR: `git fetch origin && git rebase origin/main`
- Commit message style: `type(scope): summary`, where type is `feat`, `fix`, `chore`, `docs`, or `test` and scope is the folder or sub-agent (`feat(allocation): add preemption rule`)

### Daily loop

```bash
git switch main && git pull
git switch -c p3/allocation-core

# work, then
git add -p
git commit -m "feat(allocation): priority-first matching"

git fetch origin && git rebase origin/main
git push -u origin HEAD
gh pr create --fill          # then ping a teammate for approval
```

### Integration checkpoints (adjust times if your start shifts)

| Time | Checkpoint | Tag after merge |
|---|---|---|
| 5:45 PM | Everything from the Web phase merged; UI runs on mock state | `phase1-web` |
| 9:45 PM | Everything from the Integrate phase merged; scenario clicks through with stub agents | `phase2-integrate` |
| 1:45 AM | Real agent logic merged; scenario runs with real plan, diff, explanations | `phase3-agents` |
| 9:00 AM | Feature freeze after the 2 AM to 9 AM test-flow block; from here only test fixes | `feature-freeze` |
| 10:30 AM | Final testing and refinement done; code freeze | `demo-ready` |

Tag with `git tag phase1-web && git push --tags`. If something breaks badly later, you can always `git checkout demo-ready` for a known-good build.

Merge freeze rule: during the last 30 minutes before each checkpoint, only bug fixes and merges for the checkpoint itself. No new features.

---

## 7. Pull request template

Create `.github/pull_request_template.md`:

```markdown
## What changed
<!-- one or two lines -->

## How I tested it
- [ ] Ran the backend tests (`pytest backend/tests`)
- [ ] Ran the app locally
- [ ] Works with LLM disabled (`LLM_ENABLED=false`)

## Touches shared files?
- [ ] No
- [ ] Yes: models / contracts / requirements / package.json (owner notified)
```

---

## 8. CI (keeps `main` green)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    env:
      LLM_ENABLED: "false"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      # exit code 5 = no tests collected yet; allow it early in the project
      - run: pytest backend/tests -q || [ $? -eq 5 ]

  frontend:
    runs-on: ubuntu-latest
    if: ${{ hashFiles('frontend/package.json') != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

CI deliberately runs with `LLM_ENABLED=false`, so it also proves the no-API-key fallback works.

---

## 9. Secrets

- `.env` is git-ignored. Only `.env.example` is committed.
- If a key is ever committed or pasted publicly: rotate it in the xAI console immediately. Deleting the commit is not enough.
- The backend must read the key only through `config.py` and must never log it.
- If there is no key, or Grok errors or times out, every LLM call must fall back to rule-based logic. This is tested in CI.

---

## 10. First 30 minutes checklist

**P1**
- [ ] Repo created, teammates added, scaffold pushed
- [ ] `main` protected (or convention agreed), CI file merged
- [ ] `CODEOWNERS` has real usernames
- [ ] Data contract (`models/` and `contracts/mock_state.json`) published and announced

**Everyone else**
- [ ] Invitation accepted and repo cloned
- [ ] `.env` created from `.env.example`
- [ ] Backend runs: `python -m venv .venv`, activate it, `pip install -r requirements.txt`
- [ ] Frontend installs once P4 pushes the Vite app: `cd frontend && npm install && npm run dev`
- [ ] Agent spec card for your sub-agent(s) added in `docs/specs/` with these headings: Behavior, Tools (internal / external), Workflow, Triggers, Logging

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `git push` rejected | `git fetch origin && git rebase origin/main`, then push again |
| Merge conflict in a shared file | Keep both sides' changes, run the app, `git add` and `git rebase --continue`. Tell the file's owner. |
| Committed to `main` by mistake (not pushed) | `git branch p3/rescue && git reset --hard origin/main`, then continue on the new branch |
| CI fails only on GitHub | Run with `LLM_ENABLED=false` locally; CI has no API key |
| Can't see the repo | Accept the invitation email, or check `github.com/<OWNER>/crisis-command/invitations` |
| Frontend can't reach backend | Check `VITE_API_URL` and that `CORS_ORIGINS` includes `http://localhost:5173` |
| Grok call fails | Check the key, the model name (`GET /v1/models`), and the base URL `https://api.x.ai/v1`. The app should fall back automatically. |
