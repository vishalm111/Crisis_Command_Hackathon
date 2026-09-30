# Autonomous agent protocol (all four people)

Applies to any coding agent (Antigravity, Claude Code) working from an action file. Human = the person who owns the action file.

## Before starting a task
1. Read `AGENTS.md`, `docs/actions/01_SHARED_CONTRACT_V0.md`, and your own `docs/actions/P#_ACTIONS.md`.
2. `git switch main && git pull`. Create the branch named in the task (`p#/<thing>`).
3. Confirm every file you will edit is in your "May edit" list. If not, stop and ask the human.
4. Confirm the task's "Depends on" items are merged to `main`. If not, use the stub or mock named in the task; do not wait, and do not build the missing dependency yourself.

## While working
- Do the task's steps in order. Stay inside the task's scope and the current phase.
- Never edit `backend/models/*`, `contracts/*`, or another person's files. If the contract is wrong or missing something, write the request in `docs/actions/CONTRACT_REQUESTS.md` (append one line: who, what, why) and message P1 via the human.
- Never invent priority, allocation or approval rules. Use the v0 rules in the shared contract. If they are ambiguous, stop and ask.
- Everything that touches the LLM must work with `LLM_ENABLED=false`. Never log or print the API key.
- Prefer small pure functions with type hints and docstrings that state the rule being applied.

## Before committing
1. Run the task's **Verify** commands. All must pass.
2. Run `LLM_ENABLED=false pytest backend/tests -q` (and `npm run build` in `frontend/` if you touched the frontend).
3. `git add -p`, review your own diff, commit with `type(scope): summary`.
4. `git fetch origin && git rebase origin/main`, then `git push -u origin HEAD` and `gh pr create --fill`.
5. Stop. Do not merge your own PR. Report to the human: task ID, what changed, verify output, anything skipped.

## Stop and ask the human when
- A dependency is missing or the contract disagrees with your task.
- Verify fails twice after a fix attempt.
- The task would require touching a file you do not own.
- You are within 30 minutes of a checkpoint and the task is not close to done (report status instead of starting something new).

## Time boxes
Each task lists a time box. If you are at 150% of the box, stop and report what is left.

## Report format (paste to the human)
```
Task: P#-XX
Branch / PR: ...
Done: ...
Verify: <commands and results>
Not done / assumptions: ...
Needs from others: ...
```
