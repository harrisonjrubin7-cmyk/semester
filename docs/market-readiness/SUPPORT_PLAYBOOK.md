# Support Playbook

**Status: `IN_PROGRESS`** — **Harrison Rubin is the named support owner**. The
database boundary and Privacy surface support a student-created, seven-day
maximum, revocable and audited aggregate-only access window. A backup operator,
published service levels and institution-approved channels remain.

## Ownership

| Responsibility | Named owner | Backup |
| --- | --- | --- |
| Individual-user support | Harrison Rubin | Unassigned |
| Institutional escalation intake | Harrison Rubin | Unassigned |
| Incident-command handoff | Harrison Rubin | Unassigned |

The owner assignment is operational responsibility, not permission to inspect
student data. Every support read still requires the bounded grant below.

## Tiers

| Tier | Handles | Escalates when |
| --- | --- | --- |
| **T1** | Account, navigation, how-to | The answer needs data access |
| **T2** | Integration failures, sync issues, data questions | Code change or tenant config needed |
| **T3** | Engineering | — |

## What a supporter is allowed to see

The default remains no access. `support_access_grant` now binds one student,
one verified same-tenant `support:read` holder, an active versioned consent
record, the `learning-progress` aggregate scope and an expiry no more than
seven days away. Revoking the grant or its consent stops the next read.

`read_support_signals()` returns only per-course evidence counts, average score,
mistake count and last observation time. It records every read in immutable
pseudonymous evidence. It never returns raw notes, evidence excerpts, mistake
detail, captures, protected traits or inferred emotion.

The Privacy surface lets a student choose a same-tenant verified supporter,
state the reason, select a one-to-seven-day window and revoke it immediately.
The same surface gives the named supporter only the aggregate read authorized
by that window. Until real university role provisioning is connected and the
flow is exercised with two real tenant accounts, the pilot criterion remains
unmet.

## Channels, SLAs, knowledge base

The product has a support/request path and the repository has response
templates, but no institution-approved contact roster or contractual service
level is recorded. A university will ask for both during procurement.

## Next

Exercise the bounded grant with two real tenant accounts, assign a backup
operator, then define service levels and the institution-approved retention
schedule.
