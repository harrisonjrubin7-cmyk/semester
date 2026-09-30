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
| Today / Action Center | LIVE (device) | device + sync; derived from student's courses; **seeded semester is the default state** | `screens/Today.tsx`, `lib/actions.ts` | snooze/dismiss/feedback and source labels on every item not verified; seed shown as real on first run |
| My Path (degree, goals, scenarios) | PARTIAL | device; student-entered + catalog seed | `screens/Pathway.tsx`, `lib/degree.ts` | deterministic requirement engine tied to an institution-verified catalog; graduation/cost language |
| Study abroad | PARTIAL | device; student-recorded approvals | `lib/abroad.ts` (no route of its own) | host-to-home credit status labels from an approved source |
| Transfer equivalencies | PLANNED | none; register + doc only | `lib/transferhub.ts` not imported by any screen | screen, approved-equivalency data source |
| Search | PARTIAL | none; client-side over registry, guidebook and own data | `screens/Search.tsx` | no server index; no course/event/policy/people/opportunity sources; per-result authorization |
| Plan: calendar | LIVE | device + server ICS feeds (`calendar_feeds`) | `screens/Calendar.tsx`, edge `calendar`/`fetchcal` | calendar **writes** need preview + confirm audit; conflict rules are client logic |
| Plan: registration readiness | PARTIAL | device; registrar is a clipboard bridge | `screens/Registrar.tsx`, `lib/registration-day.ts` | no registrar API by design; ranked backups, official deep links per tenant |
| Study (11 modes, guides, drills) | LIVE (device) | device; seeded + imported courses | `screens/Study.tsx`, `components/StudyStudio.tsx` | see Study Studio rows |
| Study Studio: upload/extraction | PARTIAL | client-side only (pdf.js, docx, pptx, zip-bomb guard) | `lib/extract.ts`, `lib/zips.ts` | no server malware/file-type scan, no OCR pipeline with page/slide/timestamp anchors, no review-before-indexing, no source versions |
| Study Studio: AI (citations, injection defence) | PARTIAL | model via proxy/own key/shared-key edge fn | `lib/cite.ts`, `ai/untrusted.ts` | structural injection tests only; **live red-team "still owed"**; no evaluation harness results; no course/institution AI-rule enforcement |
| Ask Claude | LIVE if a key or proxy is configured | threads on device | `ai/*`, edge `claude` | production shared key unset/502 as of 2026-09-29 (`LAUNCH-DECISIONS` 15); history delete controls to verify |
| Math/Data Lab, Writing Studio, Lab Companion | PARTIAL | device | `Analyse`, `Essay`, `Sheet` screens | dedicated Lab Companion and coding support not found; accessible charts unverified |
| Workspace (Write/Sheet/Deck/Draw/Files) | LIVE (device only) | IndexedDB; **files never synced** | `screens/Write.tsx`, `Sheet.tsx`, `Deck.tsx` | no server persistence for files, no consented sharing, version history is local |
| Personal (tasks, notes, files, mail) | LIVE (device) | device; mail drafts only, never sends | `screens/Mine.tsx`, `Mail.tsx` | — (mail never sends: correct for beta) |
| Career | PARTIAL | device; student-entered | `screens/Career.tsx`, `lib/career.ts` | skills graph behind `VITE_CAREER_SKILLS_GRAPH`; application tracker/interview practice/mentor workflow depth unverified |
| Opportunities / scholarships | PARTIAL | device tracker; never computes eligibility | `screens/Opportunities.tsx` | no listings backend wired to the student screen |
| Campus Hub | MOCK_DEMO without a tenant | seed `data/campus.ts`, self-described "starting points, not facts" | `screens/Hub.tsx`, `data/campus.ts` | publisher/owner/review-expiry workflow; institution-verified content feed |
| Athlete / NIL | PARTIAL | device | `screens/Athletics.tsx`, `Nil.tsx` | no server; no component tests |
| Study groups / classmates / rooms | LIVE (signed in) | Supabase RLS | `screens/Classmates.tsx`, `rooms.check.sql` | tenancy header says classmates/rooms are **not tenant-scoped** (verify; G-03); minors excluded from matching (D-139) |
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
| RLS and negative tests | LIVE (CI gate) | 78 `*.check.sql`, `rls-coverage`, `definer-sweep`, `integration-rls-matrix` | plain SQL, not pgTAP; BOLA on definer functions left to feature suites (DR-02 note) |
| Feature flags (tenant/role/kill switch) | IMPLEMENTED_NOT_RELEASED | `lib/flags.ts`, `tenant_feature_policy`, `feature_kill_switch`, `FEATURE-FLAG-REGISTRY.md` | no per-plan or per-cohort flag dimension in the client; flags evaluated client-side (register A16) |
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
| Restore / DR | PARTIAL | CI logical-dump rehearsal; production Backups page read by the owner on 2026-09-30 (`docs/evidence/backups/backups-dashboard-reading-2026-09-30.md`): nine physical daily backups, 23–30 Sep, PITR off | **production never restored**; PITR off, so the recovery point is up to a day; engineering access to production not granted; gateway journal has no backup |
| Incident response | PARTIAL | runbooks exist | all owners "Unassigned" |
| Accessibility | PARTIAL | axe tests, focus/modal/motion tests | no human AT pass, no ACR/VPAT |
| AI evaluation | PARTIAL | `AI-RECOMMENDATION-EVALUATION-HARNESS.md`; live tests write to nonexistent `docs/evidence/ai` | no scored run, no release gate |
| Pen test, HECVAT, SOC 2 | PLANNED / BLOCKED | plans only | third parties |
| Legal (terms, privacy, refund, DPA) | PLANNED / BLOCKED | drafts in `docs/legal/` with `[DECIDE]` | **counsel review required**; drafts only |

## How this table stays true

Not yet mechanised. Following the repo's rendered-register pattern (data in `app/src/lib`, a test, an
entry in `npm run registers`) would make it guarded against the routes. That changes code, so it is
proposed for Milestone 1 and **not done here**.
