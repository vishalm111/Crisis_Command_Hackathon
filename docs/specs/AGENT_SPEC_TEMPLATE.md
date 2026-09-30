# Agent spec card: <sub-agent name>
Owner: <P#>. Copy to `docs/specs/<name>.md`. One page.

## Behavior
What it decides, and what it must never do.

## Tools
- Internal: engine state, scoring, geo functions used
- External: LLM API, map tiles (and the fallback when unavailable)

## Workflow
Numbered steps from input to output.

## Triggers
Which of: new incident, resource failure, escalation, time advance, approval decision, what-if.

## Logging
Fields written to the decision trace and agent messages.
