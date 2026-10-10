# Launch Readiness Audit — Phase 0

This inventory checks the ten parts of the launch-readiness command against
what the repository holds. **Audited against `origin/main` at `1dd79cd`,
2026-09-27.** That includes the University OS merge (#779). It extends
[`SEMESTER_MARKET_READINESS.md`](../SEMESTER_MARKET_READINESS.md) and, for
integrations,
[`CURRENT-SEMESTER-ARTIFACT-INVENTORY.md`](CURRENT-SEMESTER-ARTIFACT-INVENTORY.md).
It does not replace either. Read that scorecard's *How this document has been wrong* section
first. This audit follows the rule it ends with: before any claim of absence,
name the file you would expect, search the whole tree, and check the nearby
docs for a written refusal.

| Mark | Means |
| --- | --- |
| **Present** | Built, with a file cited |
| **Partial** | Some of it built. The missing part is named |
| **Absent** | Searched for across `app/src`, `app/server`, `app/scripts`, `packages/`, `supabase/functions`, `supabase/migrations` and the docs, and not found |
| **Refused** | The repository considered it and declined in writing. The document is cited. A refusal is a decision, not a gap |

## Findings the council should see first

1. **LTI grade passback fails closed until a registration is bound to a
   school.** #779 added `public.lti_passback_decision`
   (`20260927180000_lti_integration_binding.sql`); the additive
   `20261010174500_lti_passback_requires_binding.sql` closes its legacy
   unbound bypass. Global kill switches still take precedence. A bound
   registration also needs both LTI and grade-passback flags at `production`,
   an approved write-capable connection, an unexpired score-publish scope, and
   no applicable kill switch. An unbound registration returns
   `registration-unbound` and no score is signed or sent.
2. **The command asks to "preserve Today · My Path · Search · Plan · Me".
   That navigation does not exist.** It is the target in
   `docs/expansion/Semester-Master-Implementation-Brief-v2.md` (lines 167 and
   182). The shipped navigation is `app/src/lib/nav.ts` and, for institutional
   layouts, `PRIMARY_DESTINATIONS` in `app/src/lib/institutional-ia.ts`
   (Home, Calendar, Discover, Ask Semester, Inbox). "My Path" is a button label
   that opens `Degree.tsx`. Phase 1 must define the golden path on the
   navigation that actually ships, or first make the navigation change as a
   separate decision.
3. **The command asks for a status page. `MONITORING.md` declines one in
   writing:** "It would need something to watch it, and the thing watching it
   would be the thing that needs watching." The council should uphold or
   overturn that decision explicitly. Phase 5 should not quietly build one.
4. **The SCIM service is built and not reachable.** `app/server/institution/scim.ts`
   is tested, and its tables and definer functions exist
   (`20260924150142_institution_identity_provisioning.sql`). But no gateway
   route mounts `createScimService`, and there is no Postgres repository for it.
5. **No table exists for any launch, beta, GTM, pilot or company-operations
   entity**, and no capability covers one. The staff roles that could own
   them already exist: `support_agent`, `implementation_manager` and
   `data_steward`, in `20260926150000_expansion_roles_and_features.sql`.
   Phases 1, 3 and 5 should extend `app_capabilities` rather than create a
   parallel role system.

## Part 1 — Governance and go/no-go

| Item | Mark | Evidence |
| --- | --- | --- |
| Council, gates, decision | **Present (this change)** | `app/src/lib/launchreadiness.ts`, [`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md), [`GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) |
| Technical release list | Present | `docs/market-readiness/GO_LIVE_CHECKLIST.md`, which the new gates depend on |
| `launch_*` tables (programs, checks, evidence, risk acceptances, decisions, members, runbooks, communications, incidents) | Absent, **deferred on purpose** | See *Why Phase 0 adds no migration* below |

## Part 2 — Golden path and private beta

| Item | Mark | Evidence |
| --- | --- | --- |
| Today | Present | `app/src/screens/Today.tsx`; adaptive briefing `components/TodayDecisionSurface.tsx`, `lib/today-decision.ts` (backlog in `docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md` still open, including "exactly one primary next action") |
| Path / Plan | Partial | `screens/Degree.tsx`, `screens/Pathway.tsx`, `screens/Mine.tsx`, `screens/Calendar.tsx`. No screen is named My Path or Plan |
| Registration / advising | Present | `screens/Yes.tsx`, `screens/Registrar.tsx` |
| Source-linked workspace | Present, flag off | `components/toolkit/AssignmentPanel.tsx` (Provenance section), `lib/toolkit/flags.ts` |
| Human help | Partial | `components/OfficeHours.tsx`, `components/DropBy.tsx`. No escalation to an advisor or to support |
| Cross-device resume | Present | `lib/cloud.ts` (local-first), `lib/merge.ts` (field-level merge) |
| Poor network | Present | `lib/offline.ts`, `components/Fresh.tsx` |
| Scripted end-to-end journey | Absent | The nearest are `app/scripts/accessibility-smoke.mjs` (six screens, run separately, in CI) and `app/scripts/cold-smoke.mjs` |
| Synthetic tenant | Present | `app/src/data/institutional-preview.ts` ("cedar-coast", twelve roles); `app/scripts/institutional-preview-smoke.mjs` exists but **no workflow runs it** |
| Invite-only access | Present | `supabase/migrations/20260921002428_invites.sql` (trigger on `auth.users`, off by default), `invites.check.sql` |
| Feedback | Present, no triage | `20260921215800_feedback.sql`: only the author can read it, and no staff view exists |
| Cohorts, known issues, beta flags, exit requests | Absent | Export exists (`lib/export.ts`, `screens/Export.tsx`); a beta exit request does not |

## Part 3 — Identity, SSO, SCIM, LTI, entitlements

| Item | Mark | Evidence |
| --- | --- | --- |
| SAML 2.0 | Partial | Supabase validates assertions. The tenant binding is in `app/server/institution/auth.ts` (`sso:` providers only) and `institution_identity_provider`. There is no certificate-rotation process (`docs/vanderbilt/identity-scim-acceptance.md` leaves it as a placeholder) |
| OIDC | Partial | PKCE (`lib/cloud.ts`), `signInWithSSO`. `provider_type` accepts only `'saml'`, so no institutional OIDC IdP can be configured |
| SCIM 2.0 | Partial | Finding 4 |
| LTI 1.3 launch, deep linking, AGS | Present | `supabase/functions/lti/`, `_shared/ltideeplink.ts`, `_shared/ltiags.ts`; `lti`, `ltiidentity` and `ltiags` check suites |
| LTI Names and Roles (roster) | Refused | `_shared/ltikey.ts`, asserted by `lib/ltikey.test.ts` |
| Grade passback default | Present, fail-closed: unbound registrations return `registration-unbound`; bound registrations require every gate | Finding 1 |
| Account linking | Partial | LTI link via ticket (`20260921160100_lti_identity.sql`). Linking by email match is refused in the same file as "account takeover with extra steps". **Unlink is absent** |
| Tenant discovery | Partial | Email-domain hint (`lib/schoolclaim.ts`, `lib/findschool.ts`), selector (`findschool.ts`). One SSO domain per deployment. No tenant URL |
| Per-tenant flags | Present | Registry and evaluator `lib/flags.ts`, held to `docs/FEATURE-FLAG-REGISTRY.md` by a test; state in `tenant_feature_policy` / `feature_state()`. Build-time flags in `lib/experience-flags.ts` |
| Kill switches | Present, never exercised | Six database-backed switches (`kill.integration_sync`, `kill.ai_generation`, `kill.data_upload`, `kill.code_execution`, `kill.sharing`, `kill.writeback`) in `lib/flags.ts` and `public.feature_kill_switch`. None has been engaged against production, and there is no app-wide read-only mode |
| Entitlement resolution chain | Partial | `lib/flags.ts` evaluates kill switch → environment → tenant entitlement → connection → scope → capability → role → classification → course rule → user. The launch command's plan, sponsored-access and usage-allowance steps do not exist. `public.usage` has a single global cap of 60 calls a month |

## Part 4 — GTM, RFP, pilot, implementation

| Item | Mark | Evidence |
| --- | --- | --- |
| Market and competition analysis | Present | `COMPETITION.md`, `COMPETITIVE-REVIEW.md`, `MARKET-POSITION.md` (§13 records pricing figures that conflict with each other, unresolved) |
| Pilot shape and entry criteria | Present | `PILOT.md`, `docs/market-readiness/PILOT_PLAYBOOK.md` |
| CRM, pipeline, RFP library, pilot charters, QBRs | Absent | No tables and no documents |

## Part 5 — Compliance evidence

| Item | Mark | Evidence |
| --- | --- | --- |
| Procurement checklist | Present, `NOT_STARTED` | `docs/market-readiness/PROCUREMENT_CHECKLIST.md` |
| HECVAT, SOC 2, pen test, terms, privacy policy, DPA | Absent | All marked "No" in the procurement checklist |
| VPAT / ACR | Refused for now | Procurement checklist: "Requires formal evaluation; do not fabricate" |
| Privacy disclosure as tested data | Present | `lib/privacy.ts`, `lib/privacy.test.ts` |
| Connector maturity labels | Partial | `lib/integration/catalog.ts`, `docs/UNIVERSITY-OS-ARCHITECTURE.md`. Mock providers only, and nothing is connected |
| Accessibility infrastructure | Present | `app/src/a11y/`, `accessibility-smoke.mjs` in CI. A formal audit is absent |

## Part 6 — Support, reliability, fraud

| Item | Mark | Evidence |
| --- | --- | --- |
| In-app guide | Present | `screens/Help.tsx` from `lib/guidebook.ts` |
| Ticketing, SLAs | Absent | `components/SaySomething.tsx` writes feedback. The fallback is a mailbox (`SUPPORT` in `lib/privacy.ts`) |
| Consented support access | Present | `20260925103000_support_access.sql`, `support-access.check.sql`, `components/SupportAccess.tsx` |
| Accessibility support route | Absent | No accessibility kind in `lib/feedback.ts` |
| Status page | Refused | Finding 3 |
| Degradation banner, read-only mode | Absent | `lib/integration/dashboard.ts` shows degraded connections to operators. Nothing tells students |
| Synthetic monitoring | Present | `.github/workflows/production-smoke.yml`, hourly |
| Health and readiness | Present | `app/server/institution/gateway.ts`, `readiness.ts` |
| SLOs, on-call rota | Absent | — |
| Restore | Partial | `supabase/restore.sh` rehearsal passed 2026-09-21. Production has never been restored (`RESTORE.md`) |
| Load testing | Absent | — |
| Gateway rate limit | Present | `app/server/institution/rate-limit.ts`, Postgres-backed in `runtime.ts` |
| Supabase-direct rate limit | Absent | Still a Blocking line in the go-live checklist |
| Bot sign-up, link reputation, upload scanning | Absent / partial | The invite trigger is the only sign-up control. `safeUrl()` blocks `javascript:` and `data:` links. Files stay on the device (`lib/files.ts`), so there is no server upload to scan |
| Moderation | Partial | Report status and moderation audit migrations. `lib/classmates.ts`: "Reports are stored, not moderated" |

## Part 7 — Analytics and data ethics

| Item | Mark | Evidence |
| --- | --- | --- |
| Minimal activity capture | Present | `lib/activity.ts`, `ANALYTICS.md`, `supabase/analytics.sql`: three marks per user per day, 400-day retention |
| Opt-out toggle | Absent | Disclosed, and users can read and delete their own rows, but no switch exists |
| Minimum cohort threshold | Absent | Must be a tested constant before any institutional report |
| Student risk scoring | Refused | `docs/superpowers/specs/2026-09-23-semester-intelligence-expansion-design.md`, `lib/toolkit/recommend.ts`. `lib/atrisk.ts` is the student's own attendance warning, not a score |

## Part 8 — Launch content

| Item | Mark | Evidence |
| --- | --- | --- |
| First run and onboarding | Partial | `screens/FirstRun.tsx`, `screens/Onboarding.tsx`, `docs/market-readiness/UNIVERSITY_ONBOARDING.md` |
| Quick-start, first-day checklists, FAQ, accessibility statement, student AI-use guide, launch announcements | Absent | Incident notices exist (`INCIDENT_COMMUNICATION_TEMPLATES.md`). Launch announcements do not |
| Source provenance and freshness | Partial | Assignment workspace (`docs/ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md`). For integration data, `lib/integration/freshness.ts` and "From your school" on Today, behind `module.source_freshness_cards`. Launch content has no owner, review date or expiry |

## Parts 9 and 10 — Runway, scale gates, 90-day program

Absent. No company financial or hiring data is in the repository, and this
audit recommends keeping it out. Part 9 asks that such data never reach
students or tenants. A public repository and a student-facing database are
the wrong places to hold it, even behind row-level security. If Phase 6
builds the 90-day workspace, it should hold tasks, owners and evidence links,
not financial figures.

## Why Phase 0 adds no migration

The command lists nine `launch_*` tables under Part 1. Phase 0 adds none,
for three reasons:

- **The evidence is already in the repository.** Every gate cites repository
  files, and a test checks them. A table of evidence links would be a second
  copy that no test compares with the first.
- **Decisions need an audit trail, and git already provides one.** A council
  decision is a commit that changes `holder`, `signoffs` or a gate. It has an
  author, a timestamp, a diff and review.
- **No reader for the tables exists yet.** Tables are worth adding when a
  screen or a staff role needs to query them. That begins with the beta
  cohorts in Phase 1 and the support queue in Phase 5. The roles to own them
  already exist (Finding 5).

If the council prefers the tables now, they are straightforward to add as
`platform_admin`-only tables with an audit trigger and a `.check.sql`. The
open question is where the source of truth lives, not how to build the tables.

## Documents this audit found stale

Each was checked against the code. None is corrected in this change, to keep
it focused.

| Document | Says | Actually |
| --- | --- | --- |
| `MONITORING.md` §"Uptime monitoring" | "honestly just not done" | Hourly public-production smoke since #757 (`production-smoke.yml`) |
| `docs/market-readiness/SECURITY_READINESS.md` §"The in-memory rate limiter" | The limiter is a per-process `Map` | `runtime.ts` uses `PostgresRateLimiter`, backed by `gateway_take_rate_limit` |
| `docs/market-readiness/DISASTER_RECOVERY.md` | Gateway journal is single-host SQLite, "no backup strategy at all" | `runtime.ts` uses `PostgresActionJournal`, so the journal is backed up with the database. The go-live line "Gateway journal backed up" still needs evidence of that |
| `SEMESTER_MARKET_READINESS.md` / `EXECUTIVE_READINESS.md` | "No SSO — no SAML or OIDC" | Supabase SAML SSO is wired (`signInWithSSO`, `institution_identity_provider`, SSO-to-SCIM binding). It is not yet activated for any tenant. `marketreadiness.test.ts` still probes for `app/src/lib/sso.ts`, a file this implementation never created, so its "absent" check proves nothing about SSO |
