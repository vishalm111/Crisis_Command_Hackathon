@AGENTS.md

# Claude Code notes
- Plan before large edits; keep diffs small enough to review in 5 minutes.
- Run `LLM_ENABLED=false pytest backend/tests -q` before suggesting a commit.
- Do not touch files owned by another person; propose a small PR and tag the owner instead.
