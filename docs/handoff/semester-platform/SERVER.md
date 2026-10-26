# Semester server

## Shape
One Postgres database (Supabase), one schema per domain, one Next.js app with a small server surface, and background workers. No separate API server until load or team size demands it.

| Layer | Runs | Responsibility |
|---|---|---|
| Postgres + RLS | Supabase | Source of truth for Semester data; every tenant row has institution_id; RLS keyed to core.my_institution() and ctl.can() |
| api.* functions | Postgres, security definer, search_path='' | The only write path for users. Validate, check capability, rate-limit, write, audit, outbox, all in one transaction |
| Next.js routes | Vercel / Node | AI gateway (app/api/ai), payment webhooks, access intents (OpenAPI in control-plane/baseline), signed handoff links |
| Workers | Node, service role, scheduled or queue-driven | Sync, readiness rebuild, outbox publish, notifications, access saga, privacy fulfilment, retention, renewals |
| Storage | Supabase Storage, private buckets | Path rules per bucket; malware scan state in comms.files |
| Policy | OPA (control-plane baseline) | Access decisions and saga transition guard |

## Rules
1. **The institution's SIS and LMS are the record.** Mirrors carry source and synced_at. Integration direction for SIS/LMS is read-only by constraint.
2. **Honest states.** A missing record is 'unknown'. 'ready_as_of' needs a time and a fresh source (constraint). Resolving a handoff sets 'stale' until the next sync confirms.
3. **One write path.** Clients never insert, update or delete tenant tables directly, except personal tasks, preferences and personal calendar events.
4. **Every write is audited** via audit.log, and every cross-system effect goes through ctl.outbox in the same transaction.
5. **Workers are idempotent.** Outbox consumers dedupe on id; long jobs hold a lease with a fencing token.
6. **Staff see data through capabilities,** never by role name. Support access needs a student-approved window of at most 4 hours.

## Workers
| Worker | Trigger | Writes |
|---|---|---|
| sis.sync | 15 min per tenant + on demand | acad.terms, courses, sections, enrollments, holds; opsx.sync_runs |
| lms.sync | 15 min | work.assignments, work.grades |
| readiness.rebuild | after sync, per changed student | acad.readiness_items |
| outbox.publish | continuous | ctl.outbox.published_at |
| notify.dispatch | outbox events | comms.notifications (quiet hours, per-kind prefs; safety bypasses quiet hours) |
| access.tick | due opsx.access_jobs | opsx.access_jobs (control-plane/baseline/worker) |
| privacy.fulfil | approved opsx.privacy_requests | export bundle or deletion + evidence_ref |
| retention.sweep | nightly | expired notifications, drafts, revoked tokens, tenant exits |
| renewals.notice | daily | owner task from biz.contracts.renewal_notice_on |

## Environments
local (supabase start) → dev → staging (pilot rehearsal with test tenants) → production. Migrations apply in order; supabase/check.sh and the RLS tests run in CI before any deploy.

## Tests every migration needs
- A student cannot read another student's readiness, holds, grades, messages or notes.
- An advisor reads only assigned students; an office reads only its own holds and handoffs.
- Cross-tenant reads return nothing.
- Each api.* function: forbidden caller refused, idempotent retry returns the same result, audit row written.
- Constraints: ready without evidence rejected; support window over 4 h rejected; SIS write integration rejected; measured pilot result without a value rejected.
