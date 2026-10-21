# Incident response runbook

## Severity
| Sev | Example | Immediate response | Target |
|---|---|---|---|
| 1 | Confirmed broad student-data exposure, credential compromise, destructive production failure | Contain access, rotate secrets, preserve evidence, page the incident commander | Immediate |
| 2 | Possible cross-tenant access; a critical authorization bypass with limited scope | Disable the feature or permission path; confirm exposure | Same day |
| 3 | Important vulnerability with no known exploitation | Fix, add a compensating control, schedule remediation | Within SLA |
| 4 | Low-impact hardening | Backlog it, with an owner and a review date | Planned release |

**Roles:** incident commander, technical lead, communications lead (institutions and families), scribe.

## Debugging safely
- **Data handling:**
  - Never put production secrets, tokens, personal records or raw auth headers in tickets, chat, logs, screenshots or AI prompts.
  - Use correlation ids, redacted logs and synthetic accounts.
- **Changes:** reproduce in local or staging first, and make one reversible change at a time, verifying each.
- **Authorization bugs:** if data exposure is plausible, add a temporary deny rule or feature flag *before* diagnosing.
- **Suspected secret exposure:** revoke and rotate first, investigate second.
- **Evidence:** before cleanup, preserve logs, deployment ids, migration version, affected scope and timestamps.

## After every incident
Write a review covering the timeline, affected data and users, root cause, control gap, remediation, the test added, the owner and closure evidence.

Institution notice follows each contract's breach clause (DPA: within 72 hours of confirmation).
