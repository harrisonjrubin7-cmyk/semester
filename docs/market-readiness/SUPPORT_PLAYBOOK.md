# Support Playbook

**Status: `IN_PROGRESS`** — the database boundary and Privacy surface now
support a named, student-created, seven-day maximum, revocable and audited
aggregate-only access window. Staffed channels and service levels remain.

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

None defined. A university will ask for all three in procurement.

## Next

Exercise the bounded grant with two real tenant accounts, then define staffed
channels, service levels and the institution-approved retention schedule.
