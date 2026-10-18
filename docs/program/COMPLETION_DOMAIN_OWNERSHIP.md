# Semester — domain ownership: source-of-truth decisions (completion baseline)

**Date:** 2026-10-04 · **Does not replace:** [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) (owners, escalation), [`docs/DECISION-RIGHTS.md`](../DECISION-RIGHTS.md) · **Target architecture:** [`docs/target-architecture/`](../target-architecture/) (D-1144, a **proposal, not built**)

**Relationship to main.** The program asked for `docs/program/DOMAIN_OWNERSHIP_MATRIX.md`. PR #1252 merged a 120-line matrix at that path (14 program domains, keyed to `CAPABILITY_TRACEABILITY_MATRIX.md`), and **it remains the matrix**. This page is kept beside it and records only what the code establishes about *where the source of truth lives today versus the target* and the decisions (DO-1…DO-6) that exposes.

The program's "done" definition requires, per domain: a **domain owner**, a **canonical data owner / source-of-truth rule**, and an authorization boundary. This page records what the code establishes today. Where the code does not decide who is authoritative, the row says **UNDECIDED** — it does not invent an answer.

**Owner honesty.** The only person evidenced in the repository is Harrison Rubin (primary on nearly every seat). Every backup is `UNASSIGNED`. A role below is the *accountable seat*, not a staffing claim.

| Domain | Accountable seat | Source of truth **today** (code) | Source of truth **target** | Authz boundary today | Code location | State |
| --- | --- | --- | --- | --- | --- | --- |
| Identity / accounts | Security | Supabase Auth; `profiles`, `institution_membership` | Membership-derived tenant context | RLS + `auth.uid()`; gateway `context.ts` | `lib/cloud.ts`, `app/server/institution/{auth,membership}.ts`, `domains/identity` | Built, unproven e2e |
| Tenancy / policy | Security | `tenant_feature_policy`, `ai_policy`, `school_config_versions` | PDP everywhere (ADR 0007) | PDP only in productivity; others bespoke | `packages/institution/src/policy.ts`, `packages/platform/src/{policy,tenancy}` | Partial |
| Student productivity (tasks, calendar, notes, goals) | Product | **Device** (localStorage) mirrored as `state` JSON blob; tasks per-row behind flag | Server per-entity rows + offline engine | RLS by owner | `domains/tasks`, `packages/offline-sync`, `app/server/productivity/*` | **UNDECIDED** for notes/goals/calendar events |
| Files | Product | **Device** (IndexedDB) | Object storage with tenant policy | none server-side | `lib/files.ts`, `lib/idb.ts` | Client-only |
| Docs / sheets / decks | Product | **Device** | Server doc store | none | `lib/{document,sheet,docx,xlsx,pptx}.ts` | Client-only |
| Academic catalog / registration | Registrar (institution) / Product | Seed catalog (`data/catalog.ts`) by default; `registration_*` tables when tenant | **SIS authoritative in Connect; Semester in Core** (`tenant_module_mode`) | capability gates, replay keys | `20260929300000_registration_transaction.sql`, `lib/enrollment/client.ts` | Built; **no tenant, no SIS** |
| Academic record / grades | Registrar / Faculty | `academic_record_ledger`, `grade_entries` (server) | same; official writes never-queued offline | capability gates; ledger chain | `20260929310000_gradebook.sql`, `lib/gradebook/client.ts` | Built; two record paths (`lib/records.ts` legacy) |
| Learning (courses, assignments) | Product / Faculty | Mixed: `courses` rows + local authoring | LMS in Connect; native in Core | RLS | `lib/coursestudio.ts`, `functions/{canvas,lti}` | Partial |
| AI | AI owner | Gateway tables `ai_policy`, `ai_usage_*`, `gateway_intelligence_action`; **consumer path has none** | One gateway | policy-before-model on gateway path only | `app/server/institution/intelligence*.ts`, `supabase/functions/claude`, `lib/claude.ts` | **Split** (PR-01) |
| Audit / events | Security | `private.console_audit_event`, ledger chains, `domain_outbox_events` (no publisher) | Hash-chained audit + published outbox | service-only | migrations `20260929100000`, `20260928320000` | Partial |
| Integrations | Engineering | `integration_*` tables, framework | Adapters per tenant with source precedence | tenant-scoped | `lib/integration/*`, `app/server/integration/*` | Framework only |
| Community / messaging / moderation | Trust & Safety | `community_*` tables | same + staffed moderation | RLS + moderation RPC | `community/client.ts`, `lib/moderation.ts` | Built; unstaffed |
| Guardian / family | Privacy | `guardian_links`, `guardian_may_read` | same | definer-gated | `20260930233000_k12_guardians.sql`, `lib/familyshare.ts` | Built; counsel open |
| Finance / billing (individual) | Commercial | `commercial_*`, `subscriptions`, Stripe | same | service-role Edge Functions | `functions/billing-*` | Built, **held** |
| Finance (student accounts) | Registrar/Bursar | `student_accounts`, `student_payment_plans` | SIS/ERP in Connect | capability gates | `lib/finance/*` | Built; link-out |
| Marketplace | Commercial | none found (N) | — | — | docs only | Documented |
| Career / opportunities | Product | `opportunities` + local `Career` | — | RLS | `lib/listings.ts`, `server/institution/career.ts` | Partial |
| Support / trust | Support | `support_tickets` | same + staffing | RLS | `lib/supporttickets.ts`, `support-reply-notify` | Built; unstaffed |
| Entitlements / plans | Commercial | `commercial_prices`, `subscriptions` (individual); `tenant_plan` | one resolver | shadow only | `functions/_shared/entitlement.ts`, `docs/ENTITLEMENT-RESOLUTION.md` | Not enforced |
| Data lifecycle | Privacy | `export_my_data`, `erase_account`, `legal_holds` | same | definer-gated | `20260929010000`, `20260930000000`, `20261004160000` | Built |
| Public claims | Claims owner | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` + `app/src/lib/ops/claims.ts` | same | test-enforced | `ops/claims/README.md` | Built |

## Decisions this matrix exposes

| # | Question | Why it matters | Decision home |
| --- | --- | --- | --- |
| DO-1 | For notes, goals and calendar events, is the device or the server authoritative? | Blob merge conflicts; cannot claim "persists, syncs, recovers" (Phase 3 gate) | `D-<PR#>` |
| DO-2 | Is `lib/records.ts` (local) retired in favor of `academic_record_ledger`? | Two record paths | `D-<PR#>` |
| DO-3 | One AI enforcement point: gateway-only, or gateway plus a hardened shared-key function? | PR-01 | `D-<PR#>` |
| DO-4 | Is BYO-key allowed for managed (school) accounts? | Ungoverned path | `D-<PR#>` + counsel |
| DO-5 | FORCE RLS / runtime role | PR-02 | `D-<PR#>` |
| DO-6 | Marketplace: build or not market | No transaction code found | `D-<PR#>` |

Per `CLAUDE.md`, each decision takes its pull request's number: open the pull request first, then write it.
