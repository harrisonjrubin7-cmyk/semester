# Feature truth table — full-beta Milestone 0

Read at `origin/main` `9ffe292`, 2026-09-30. **A static reading of the repository, not of the running
production system.** Nothing here was verified against the live database, the live Stripe account,
or a deployed gateway; where a status depends on that, the row says so. The repo also warns that it
is not the database (`RETENTION.md`, `MIGRATION-HISTORY.md`).

Statuses (the full-beta vocabulary):

| Status | Meaning |
|---|---|
| LIVE | Works for a real user today without further owner, provider or university action |
| IMPLEMENTED_NOT_RELEASED | Built and tested; off by default, or waiting on configuration |
| PARTIAL | Some of the capability exists; named gaps remain |
| MOCK_DEMO | Only seeded, sandbox or synthetic data behind it |
| PLANNED | Designed or documented; no working code path |
| BLOCKED | Needs an external approval, credential, contract or decision |

This is a fifth register beside the Master Launch Readiness Register (nine rungs, `not-started` to
`launch-approved`), the claims register, `FEATURE-INVENTORY.md` and the completeness matrix. It does
not replace them (D-002: nothing is deleted). Mapping: LIVE/IMPLEMENTED_NOT_RELEASED ≈ `tested` and
above; PARTIAL ≈ `building`; PLANNED ≈ `designed`/`not-started`. **No Master Register row is above
`tested`, and `docs/evidence/` does not exist, so no row here may be read as `evidenced`.**

"Device" persistence means localStorage/IndexedDB with optional Supabase sync when signed in
(ADR 0001). The full-beta rule that no beta-critical feature depends only on local storage is
therefore **violated by design in most student modules**; see the gap register in
[FULL-BETA-REQUIREMENTS.md](FULL-BETA-REQUIREMENTS.md) (G-01).

## Student modules

| Module | Status | Persistence / authority | Evidence | Main gap for full beta |
|---|---|---|---|---|
| Today / Action Center | LIVE (device) | device + sync; derived from student's courses; seeded semester is the default state, but its dates no longer drive Today until claimed | `screens/Today.tsx`, `lib/actions.ts`, `lib/standing.ts` | the Action Center is the production default and can be explicitly rolled back with `VITE_TODAY_ACTION_CENTER=off`; snooze is one duration; dismiss has no reason; item freshness is "not recorded" (no per-date timestamp); snooze/dismiss/feedback stay on the device |
| My Path (degree, goals, scenarios) | PARTIAL | device; student-entered + catalog seed | `screens/Pathway.tsx`, `lib/degree.ts` | deterministic requirement engine tied to an institution-verified catalog; graduation/cost language |
| Study abroad | PARTIAL | device; student-recorded approvals | `lib/abroad.ts` (no route of its own) | host-to-home credit status labels from an approved source |
| Transfer equivalencies | PLANNED | none; register + doc only | `lib/transferhub.ts` not imported by any screen | screen, approved-equivalency data source |
| Search | PARTIAL | none; client-side over registry, guidebook and own data | `screens/Search.tsx` | no server index; no course/event/policy/people/opportunity sources; per-result authorization |
| Plan: calendar | LIVE | device + server ICS feeds (`calendar_feeds`) | `screens/Calendar.tsx`, edge `calendar`/`fetchcal` | calendar **writes** need preview + confirm audit; conflict rules are client logic |
| Plan: registration readiness | PARTIAL | device; registrar is a clipboard bridge | `screens/Registrar.tsx`, `lib/registration-day.ts` | no registrar API by design; a term-load estimate (student-entered limits, hours) now sits beside the credit target in Registration Day Mode, which is off by default; per-tenant official deep links not built |
| Study (11 modes, guides, drills) | LIVE (device) | device; seeded + imported courses | `screens/Study.tsx`, `components/StudyStudio.tsx` | see Study Studio rows |
| Study Studio: upload/extraction | PARTIAL | client-side only (pdf.js, docx, pptx, zip-bomb guard) | `lib/extract.ts`, `lib/zips.ts` | no server malware/file-type scan, no OCR pipeline with page/slide/timestamp anchors, no review-before-indexing, no source versions |
| Study Studio: AI (citations, injection defence) | PARTIAL | model via proxy/own key/shared-key edge fn | `lib/cite.ts`, `ai/untrusted.ts` | structural injection tests only; **live red-team "still owed"**; no evaluation harness results; no course/institution AI-rule enforcement |
| Ask Claude | LIVE if a key or proxy is configured | threads on device | `ai/*`, edge `claude` | the shared key answered production on 2026-09-29 (`docs/evidence/ai/` kill-switch drill), with no provider terms accepted in Semester's name; from the next deploy of `claude` it is off until the activation row below clears; history delete controls to verify |
| Shared AI key activation (Semester's Anthropic key) | BLOCKED | `supabase/functions/_shared/provideractivation.ts`, read by edge `claude` before the key | `app/src/lib/trust/provideractivation.test.ts`, [SHARED-PROVIDER-ACTIVATION.md](trust/SHARED-PROVIDER-ACTIVATION.md) | owner: a legal entity, accepted Commercial Terms, a student-records decision, a retention setting and an approved audience, each with evidence under `docs/evidence/vendors/`, then `SHARED_AI_PROVIDER=on`; all five pending |
| Math/Data Lab, Writing Studio, Lab Companion | PARTIAL | device | `Analyse`, `Essay`, `Sheet` screens | dedicated Lab Companion and coding support not found; accessible charts unverified |
| Workspace (Write/Sheet/Deck/Draw/Files) | LIVE (device only) | IndexedDB; **files never synced** | `screens/Write.tsx`, `screens/Sheet.tsx`, `screens/Deck.tsx` | no server persistence for files, no consented sharing, version history is local |
| Personal (tasks, notes, files, mail) | LIVE (device) | device; mail drafts only, never sends | `screens/Mine.tsx`, `screens/Mail.tsx` | — (mail never sends: correct for beta) |
| Career | PARTIAL | device; student-entered | `screens/Career.tsx`, `lib/career.ts` | skills graph behind `VITE_CAREER_SKILLS_GRAPH`; application tracker/interview practice/mentor workflow depth unverified |
| Opportunities / scholarships | PARTIAL | device tracker; never computes eligibility | `screens/Opportunities.tsx` | no listings backend wired to the student screen |
| Campus Hub | MOCK_DEMO without a tenant | seed `data/campus.ts`, self-described "starting points, not facts" | `screens/Hub.tsx`, `data/campus.ts` | publisher/owner/review-expiry workflow; institution-verified content feed |
| Athlete / NIL | PARTIAL | device | `screens/Athletics.tsx`, `screens/Nil.tsx` | no server; no component tests |
| Study groups / classmates / rooms | LIVE (signed in) | Supabase RLS | `screens/Classmates.tsx`, `rooms.check.sql` | members-only rooms per school are built and **off for every school** (D-155, `docs/SCHOOL-MEMBERSHIP-ENFORCEMENT.md`); until one is switched on any confirmed account can still join any school's room; minors excluded from matching (D-139) |
| Community | IMPLEMENTED_NOT_RELEASED | Supabase RPCs | migration `20260928032000_community.sql`, `community.check.sql` | volunteer moderation flag default-off |
| Call (video) | PARTIAL | P2P WebRTC; no stored state | `screens/call/*` | completeness matrix row is stale; TURN config env-dependent |
| Supporter / Family view | PARTIAL | device plans; server `family_grants` exist but client does not read them | `screens/Family.tsx`, `family*.check.sql` | recipient view; time-limited revocable grant wired end to end |
| Account (sign-up, verify, sync, export, delete) | LIVE when Supabase configured | Supabase Auth | `screens/Account.tsx`, `components/AccountSecurity.tsx`, `deletion.check.sql` | recovery dialog, change password/email and sign-out-other-devices built in M1 (tested with fakes; not exercised against a live Supabase project); a session *list* still absent |
| Privacy / Data / Export | LIVE | Supabase | `export_my_data`, `erase_account` | erasure fails closed for staff who wrote to four immutable history tables; no full-account file export incl. IndexedDB files |
| Help / Support | LIVE (help), gated (tickets) | static guidebook; tickets behind `VITE_SUPPORT_TICKETS` | `screens/Help.tsx` | support-access UX; named responders unassigned |

## Membership and billing

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Plan catalog, entitlements | IMPLEMENTED_NOT_RELEASED | `commercial_*` tables, `my_entitlements()`, `ENTITLEMENT-RESOLUTION.md` | Free/Plus/Pro/Access: only Plus is buyable; Pro/Access not enabled and must not be shown as such |
| Hosted Checkout | IMPLEMENTED_NOT_RELEASED — **BLOCKED** for live charges | edge `billing-checkout`; 503 without `STRIPE_SECRET_KEY` | live charges need separate owner approval |
| Signature-verified, idempotent webhook | IMPLEMENTED_NOT_RELEASED | `_shared/stripe.ts`, `apply_payment_event` | `payment_events` keeps only a hash: **not replayable**; no dead-letter queue |
| Cancellation | IMPLEMENTED_NOT_RELEASED | edge `billing-cancel` | no resume/undo, no plan change/downgrade path |
| Customer Portal | PLANNED | none | required by M6 |
| Dunning | IMPLEMENTED_NOT_RELEASED | `run_dunning`, `commercial-automation.check.sql` | writes action records only; no in-app notice; grace hard-coded |
| Refund / dispute handling | PARTIAL | `charge.refunded`, `charge.dispute.created` recorded | **no effect on invoice, `credits_refunds` or entitlement; no dispute-closed / invoice-voided / 3DS events** |
| Test-mode E2E suite + manual script | PLANNED | none found | M6 |

## Identity, tenancy, institution

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Tenants, memberships, roles, scopes | IMPLEMENTED_NOT_RELEASED | `schools`, `role_grants`, `private.has_capability`, ~250 tables with RLS | tenant scoping is uneven (G-03) |
| School offboarding (audited case, reversible until purge) | IMPLEMENTED_NOT_RELEASED | `supabase/migrations/20260930200000_school_offboarding.sql`, `supabase/school-offboarding.check.sql`, `docs/SCHOOL-OFFBOARDING.md` | no purge, no export generator, never rehearsed on a preview branch |
| RLS and negative tests | LIVE (CI gate) | 78 `*.check.sql`, `rls-coverage`, `definer-sweep`, `integration-rls-matrix` | plain SQL, not pgTAP; BOLA on definer functions left to feature suites (DR-02 note) |
| Feature flags (tenant/role/cohort/kill switch) | IMPLEMENTED_NOT_RELEASED | `lib/flags.ts`, `tenant_feature_policy` (roles and release cohorts, main `20260929340000`), `feature_kill_switch`, `FEATURE-FLAG-REGISTRY.md` | no plan dimension (entitlements are resolved separately, `ENTITLEMENT-RESOLUTION.md`); flags evaluated client-side (register A16) |
| SAML SSO | IMPLEMENTED_NOT_RELEASED — **BLOCKED** | `institution_identity_provider`, `INSTITUTIONAL-SSO-LAUNCH-READINESS.md` | needs a university IdP; no cert-expiry alert; IdP registered by hand |
| OIDC SSO | PLANNED | `provider_type` accepts only `saml` | build |
| SCIM 2.0 | IMPLEMENTED_NOT_RELEASED | `app/server/institution/scim.ts`, off unless `SEMESTER_SCIM=on` | never run against a real IdP; separate gateway service vs ADR 0003 |
| LTI 1.3 (launch, deep link, AGS) | IMPLEMENTED_NOT_RELEASED — **BLOCKED** | edge `lti` | needs Brightspace registration; NRPS refused; unbound registration answers `allowed-unbound` |
| SIS / catalog connectors | PLANNED | `ADAPTERS = []` in both registries; test enforces empty | every production adapter needs a school-approved credentialed adapter — **BLOCKED** |
| Google / Microsoft calendar & files | PARTIAL | client-side PKCE, narrowest scopes list | tokens in `localStorage`; no institution-level connector; broad scopes remain (INT-012) |
| Canvas | PARTIAL | read-only proxy with student's own token | student-side convenience, not institutional |
| Institution gateway (records/actions/AI) | MOCK_DEMO | sandbox adapters only | **no production adapters**; every real service answers 503 |
| Tenant admin console | IMPLEMENTED_NOT_RELEASED | `screens/Console.tsx`, control plane, approvals, break-glass | admin-facing guide missing; permission simulator tab absent (A19) |
| Content governance / publishing | PARTIAL | `trust_artifacts`, `ListingDesk`, seed campus data | no approval workflow with expiry alerts for tenant content |
| Support access grants / break-glass | LIVE in schema, tested | `support_access_grant`, `break_glass_grant`, `console-approvals.check.sql` | UI path for student approval; drills |
| Aggregate reporting n ≥ 10 | PARTIAL | CHECKs on `course_demand_snapshots`, `outcome_aggregates`; `gtm_campaign_report` | count floor only: no complementary suppression or differencing protection |
| Audit events | PARTIAL | `audit_event` envelope + `audit-and-subject-requests.check.sql` (M1, unapplied to any project) | two producers only (request raised, account export); the other ~12 audit tables are not migrated to it; outbox still has no producer (B11) |
| Consent records | LIVE | `consent_record` | — |
| Data-subject requests | PARTIAL | `data_subject_request` table with 30-day clock, RLS and a check suite (M1, unapplied) | **no screen, no answering workflow, no verification step for guardian/institution requests** |
| Retention | LIVE (schedule) | `RETENTION.md`, `retention_sweeps` | production cron state unverified |
| Minimum age 13 / minors kept off social | LIVE in schema (D-139) | `minimum-age.check.sql` | — |
| Faculty Course Studio, advisor meeting mode | PARTIAL | `VITE_COURSE_STUDIO`, `ADVISOR-MEETING-MODE.md` | verify UI depth in M7 |

## Operations and assurance

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| CI gates (tsc, lint, tests, shuffle, budgets, axe smoke, golden path, RLS suites, gitleaks, audit) | LIVE | `.github/workflows/ci.yml` | no SAST/CodeQL; no coverage tool |
| Staging with isolated demo tenants | PLANNED | `STAGING.md`: parity steps 2–4 never run | M9 |
| Monitoring / alerting | PARTIAL | `MONITORING.md`, `public/status.html` | **no alert reaches anyone**; no client error capture |
| Restore / DR | PARTIAL | CI logical-dump rehearsal | **production never restored**; `docs/evidence/` absent; gateway journal has no backup |
| Incident response | PARTIAL | runbooks exist | all owners "Unassigned" |
| Accessibility | PARTIAL | axe tests, focus/modal/motion tests | no human AT pass, no ACR/VPAT |
| AI evaluation | PARTIAL | `AI-RECOMMENDATION-EVALUATION-HARNESS.md`; live tests write to nonexistent `docs/evidence/ai` | no scored run, no release gate |
| Pen test, HECVAT, SOC 2 | PLANNED / BLOCKED | plans only | third parties |
| Legal (terms, privacy, refund, DPA) | PLANNED / BLOCKED | drafts in `docs/legal/` with `[DECIDE]` | **counsel review required**; drafts only |
| Purpose-coded FERPA authorization (tenant + role + relationship + purpose + data class, permit/deny audited) | PLANNED | `docs/PDF-EVIDENCE-GAP-MATRIX.md` row b | no purpose code exists; **counsel must define the purposes first**; denied attempts are not on the audit record |
| Canonical person / source-authority model | PLANNED | `docs/PDF-EVIDENCE-GAP-MATRIX.md` row c | needs a real pilot school's identifiers; source labels exist on four tables only |
| Versioned policy / rules engine with explanation and rollback | PARTIAL | `supabase/migrations/20260928050000_tenant_rollout.sql`, `docs/PDF-EVIDENCE-GAP-MATRIX.md` row f | roll-out and flags are versioned; no single rule object; depends on open PRs #1011 and #1018 |
| Migration Center (dry run, parallel run, cutover, rollback, archive) | IMPLEMENTED_NOT_RELEASED | `supabase/migrations/20260929200000_migration_center.sql`, `supabase/migration-center.check.sql` | never used on a real migration |
| LTI 1.3 launch validation (issuer, audience, azp, exp/iat, single-use nonce, deployment) | IMPLEMENTED_NOT_RELEASED | `supabase/functions/_shared/lti.ts`, `supabase/lti.check.sql` | never launched from a real platform; not 1EdTech-certified; inbound-signature review belongs to the security workstream |
| OneRoster staging and reconciliation | PLANNED | `app/src/lib/interop.ts` | no adapter; security workstream |
| SPOF and degraded-mode map | PARTIAL | `docs/DEGRADED-MODE-MAP.md` | written from the repository, never drilled; no measured RTO/RPO; one operator |
| Decision rights / two-person rules | PARTIAL | `docs/DECISION-RIGHTS.md` | describes enforcement; no adopted charter; no rule for policy, security or data exceptions |
| Pilot evidence log and scorecard | PARTIAL | `docs/pilot/DISCOVERY-EVIDENCE-LOG.md` | blank template; targets are the owner's |
| Accessible authentication (WCAG 2.2 SC 3.3.8) on sign-in and account forms | PARTIAL | `app/src/components/authaccess.test.ts` | guard on the source only; no human check with a password manager or screen reader |
| Financial aid, payroll, general ledger, system-of-record replacement | BLOCKED | `docs/PDF-EVIDENCE-GAP-MATRIX.md` row X1 | specialist controls and pre-pilot evidence; the student-accounts and dining modules on main are built and off, not ready |

## How this table stays true

Not yet mechanised. Following the repo's rendered-register pattern (data in `app/src/lib`, a test, an
entry in `npm run registers`) would make it guarded against the routes. That changes code, so it is
proposed for Milestone 1 and **not done here**.
