# Support Playbook

**Status: `IN_PROGRESS`** — the database boundary now supports a named,
student-created, seven-day maximum, revocable and audited aggregate-only access
window. The user-facing grant flow, staffed channels and service levels remain.

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

The remaining product work is the student surface for choosing a verified
supporter, stating the reason, selecting the window and revoking it. Until that
surface and real university role provisioning are connected and exercised,
the pilot criterion remains unmet.

## Channels, SLAs, knowledge base

None defined. A university will ask for all three in procurement.

## Next

Connect the bounded grant to the student Privacy/Support surface, then exercise
it with two real tenant accounts before defining channels and service levels.
