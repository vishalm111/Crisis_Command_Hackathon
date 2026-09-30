# Priority Formula & Tiers (v0)
Owner: P2. Source: Shared Contract Section 6.

## 1. Formula
```text
score = (severity * 10) + min(people_affected, 20) + (10 if type in {medical, fire} else 0) + (min(minutes_waiting, 30) * 0.5)
```

Where:
- `severity`: Integer from 1 (minor) to 5 (critical). Contribution: 10 to 50 points.
- `people_affected`: Integer count of estimated casualties/people affected. Capped at 20 points (`min(people_affected, 20)`).
- `type`: Emergency domain (`medical`, `fire`, `rescue`, `hazmat`). Urgency bonus: +10 points if `type in {"medical", "fire"}`.
- `minutes_waiting`: Time elapsed since report, computed as `max(0, clock_min - reported_at_min)`. Aging bonus: 0.5 points per minute, capped at 30 minutes (maximum 15 points).

## 2. Priority Tiers
| Tier | Score Range | Description | Max Acceptable ETA |
|---|---|---|---|
| **Critical** | $\ge 70.0$ | Life-threatening emergencies requiring immediate response | 15 minutes |
| **High** | $50.0 \text{ to } 69.99$ | Severe incidents with high impact or escalating hazards | 25 minutes |
| **Medium** | $30.0 \text{ to } 49.99$ | Moderate incidents requiring standard coordinated response | 40 minutes |
| **Low** | $< 30.0$ | Non-life-threatening or contained incidents | 60 minutes |

## 3. Tie-Breaking Rule
When two incidents have identical priority scores, ties are resolved deterministically in the following order:
1. **Earlier `reported_at_min`**: Older incidents are prioritized first.
2. **Alphabetical `id`**: Stable lexicographical order (e.g., `"I1"` before `"I2"`).

## 4. Human Confirmation Gate
- An incident with `needs_confirmation = true` (e.g., reported via vague free text with unverified location) is scored and displayed in the UI, but **is not allocated resources** until confirmed by human operators.
