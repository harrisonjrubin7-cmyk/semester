# Single points of failure and degraded modes

Requirement (h) of the readiness synthesis of 30 Sep 2026. **Written from the repository, not from a drill.** Every row says what the code and documents show; none of it has been rehearsed against production, and no recovery time is stated because none has been measured (`docs/market-readiness/DISASTER_RECOVERY.md`, `RESTORE.md`).

The design fact that limits every row below: the app is **device-first** (`docs/architecture/0001-local-first-with-supabase.md`). A student's plan, notes and deadlines live on their device and work offline; the server holds what is shared, institutional, billing or consent-bearing. So most outages degrade *sharing and sign-in*, not a student's own week.

## The map

| Dependency | If it stops | What still works | What does not | Who notices / owner | Evidence it was tried |
| --- | --- | --- | --- | --- | --- |
| **GitHub Pages** (serves the app) | New visits cannot load the app | Anyone with the app cached or installed keeps working offline | First visits, updates | A person; no automatic alert (`MONITORING.md`) | none |
| **The one operator** (build, deploy, restore, incidents) | Nothing fails at once; nothing is fixed | The running app | Every recovery step in `ROLLBACK.md` and `RESTORE.md` | Founder (single point: both documents say so) | none — needs a trained second operator |
| **Supabase project** (auth, Postgres, edge functions) | Sign-in, sync, shared rooms, shares, billing state, LTI launch | Everything on the device | Everything that needs the server | `MONITORING.md` weekly look; status page (D-149) | logical dump and restore rehearsed, 30 Sep 2026 (`docs/evidence/restore/`); the live project's own backup **never restored** |
| **Supabase backups** | A bad write cannot be undone | — | Recovery | Founder | none: G5 unmet |
| **Stripe / billing webhook** | No new checkout; entitlement stays as last verified | Everything already paid for | New purchases; refund and dispute changes (recorded, change nothing) | Founder | live charges are off |
| **AI provider or the shared key** | AI features refuse | Every deterministic feature: schedule, credit, degree, entitlement rules never call a model | Drafting and explaining | `kill.ai_generation` switch drilled 29 Sep 2026 (`docs/evidence/ai/`) | kill switch held 3 of 3; the shared key was erroring on 29 Sep (owner) |
| **Vercel** (previews, institution gateway) | No previews; the gateway has no production adapters | Production app (it is on Pages) | Nothing in production depends on it yet | Founder | n/a |
| **Institution gateway journal** | Lost journal, lost integration history | — | Integration replay | Founder | **no backup exists** (G5) |
| **A school's SIS/LMS/IdP** | That school's launches, imports and sync fail | The app and the student's own data | Only that school's connectors | Integration runbook (`docs/INTEGRATION-OPERATOR-RUNBOOK.md`) | no adapter is live, so never observed |
| **Email / auth mail** | Confirmation and recovery mail do not arrive | Signed-in sessions | Sign-up, recovery | Founder | none |
| **The scheduler for edge-function ticks** | Retention sweeps and integration ticks stop | The app | Deadlines' server-side effects, retention clocks | `MONITORING.md` | none |

## Degraded-mode rules (what the product should do; the first four are built)

1. **The student's own week never depends on the server.** Built (device-first).
2. **Deterministic rules never depend on a model.** Built; AI may only explain or draft.
3. **A permission read that fails says so** rather than reading as "none" (built on the enrollment screens and the modules panel; not audited on every screen).
4. **Freshness is stated, never invented:** "Update time not recorded" instead of an age (built, M2).
5. Not built: a per-screen offline banner naming which shared features are unavailable; a queued-write indicator.

## Critical periods (priorities in a shortage)

When one person can only do one thing, do it in this order. This is a proposal for the owner to confirm, not a policy.

1. **Registration windows and add/drop deadlines, and the first week of term** — sign-in, sync and the deadline views. No deploys, no migrations.
2. **Finals and grade release** — anything that touches a student's records or deadlines.
3. **A partner school's launch week** — connectors and SSO, only if a school is live (none is).
4. **Everything else** — including new features, which wait.

A freeze calendar per term and an on-call name for these windows are **owner decisions not yet made**.

## Incident roles

`docs/operating-model/INCIDENT-COMMUNICATIONS.md` and `docs/market-readiness/INCIDENT_RESPONSE.md` define roles and messages by audience; `docs/vanderbilt/incident-routing.md` routes alerts. **Incident owners are unassigned** and the support address is a personal mailbox (G9/G10), so today every role is the founder.

## Blocked on people, not code

- A second trained operator (removes the largest row).
- A timed restore of the live project's backup on a non-production project, by someone other than the author, filed in `docs/evidence/` (G5).
- A backup for the gateway journal.
- The freeze calendar and on-call name above.
