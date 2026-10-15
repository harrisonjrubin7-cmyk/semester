# Semester 16-week build plan — implementation pack

From "Show me the week-by-week implementation plan" and "Full product spec and feature architecture" (Oct 2026). Interactive tracker: `ui_kits/build-plan/` in the design project.

## Files
| Path | What |
|---|---|
| `packages/auth/context.ts.txt` | Request context: JWT **verified** against the Supabase JWKS; tenant from an active membership; grants loaded from the DB per request |
| `packages/policy/chain.ts.txt` | The 14-step authorization chain as one ordered `decide()`; first failure returns step + reason |
| `policies/access.rego` + `access_test.rego` | Deny-by-default Rego, 10 `opa test` cases |
| `.github/workflows/release.yml.txt` | validate → staging (db push, functions, Playwright connected journeys) → production behind a required-reviewer environment |
| `schema-manifest.csv` | All 227 proposed tables: migration stream and tenant / actor / external-authority flags |
| `proposed-schema/*.sql` | 8 files creating the 227 tables in schema `semester_core` (not `public`, so nothing collides): RLS enabled + forced with **no policies** (deny all), `unique (tenant_id, id)`, source + freshness columns on external-authority tables. `999_verify.sql` checks all 227. Scratch project first. |
| `supabase/policies/`, `supabase/tests/` | Reference per-operation RLS + real pgTAP tests (student_tasks) |
| `workers/workflow-worker.ts.txt` | Lease loop with expiry, retries, dead letters |
| `proposed-schema/060_bespoke_core.sql` | **Bespoke** columns, checks and composite tenant FKs for the 20 tables the connected journeys need (memberships, grants, students, courses, sections, enrollment_refs, teaching_assignments, assignments, student_tasks, gradebooks, grade_entries, grade_release_batches, grade_sync_receipts, holds, time_tickets, readiness_cases/checks, registration_requests/receipts, audit_events). Encodes rules as constraints: released ⇒ graded or excused; approver ≠ submitter; completed ⇔ completed_at; audit_events append-only. The other 207 stay baseline until reconciled with the repo |
| `routes/all-routes.yaml` | 111 route records (roles, capabilities, tables validated against the manifest, commands, audit events, states, AI rule, tests, evidence, owner) — **generated drafts**, each marked `status: draft_generated` |
| `routes/capability-map.yaml`, `routes/audit-event-catalog.yaml` | 137 capability keys → routes; 137 audit events → route |
| `REVIEW-uploaded-starter.md` | Why the uploaded `server.ts`, `middleware.ts`, `client.ts`, `access.rego`, `001_identity_core.sql` shouldn’t be merged as-is |
| `launch/release-gates.yaml` | Definition of shipped, 7 go/no-go gates (identity, data, source, workflow, ux, ops, institution) with the evidence each needs, capability waves 0–6, pilot launch controls, 4 tracks, AI allowed/prohibited/required-UI |
| `launch/evidence/student.registration.submit.yaml` | First capability evidence record; ✓ marks what exists here, todo what the repo still needs |
| `supabase/policies/registration_policies.sql` + `supabase/tests/registration_rls.test.sql` | First vertical slice (registration readiness): student own-only, registrar tenant-wide via grant, advisor caseload-scoped, no direct client writes; 10 pgTAP cases incl. immediate grant revocation |
| `policies/registration_test.rego` | 6 policy tests: can submit a Semester request, can’t write the SIS record, can’t override, AI actor without grant denied |
| `proposed-schema/065_readiness_wedge.sql` | Pilot wedge: 7-state readiness machine enforced by trigger, `ready` impossible with stale source, `readiness_receipts` must say “not enrollment”, `readiness_evaluate()` idempotent + fail-closed + audit + outbox, scoped RLS |
| `supabase/tests/readiness_wedge.test.sql` | 9 cases: blocked by hold names the office, receipt wording, duplicate returns same case/one audit, illegal transitions rejected |
| `launch/runbooks/readiness_source_stale.md` | SEV-3/SEV-2 runbook: first 15 min, diagnose, safe vs never actions, verification |
| `contracts/` | Shared contract layer for the wedge: `capabilities.yaml` (20 pilot capabilities → routes, records, commands, events, audits, release requirements), `records.yaml` (10 record passports: authority, readers, write path, freshness, retention, required copy), `events.yaml` (envelope + 15 events), `audit-events.yaml` (22 stable keys with required fields), `workflows.yaml` (14-step chain + 9 command contracts with state guards), `release-evidence.yaml` (signed release decision, 10 failure drills, pilot metrics) |
| `scripts/validate-contracts.mjs.txt` | CI check that every capability’s routes, records, events, audits and commands exist; passports complete; no client writes; commands write audit + outbox; nobody hand-sets `active` |
| `proposed-schema/070_readiness_read_models.sql` | Student summary, registrar queue and ops health as `security_invoker` views — the PDF’s materialized view would bypass RLS and expose every student |
| `architecture/` | Authority model (precedence + AUTH-001…006), freshness policy (4 classes, display copy, action rules), data classification, AI boundary, migration quality gate |
| `proposed-schema/075_authority_guard.sql` | Trigger: lower source_type can’t overwrite higher on institution tables (AUTH-001) |
| `contracts/api.openapi.yaml`, `asyncapi.yaml`, `integration-adapter.yaml` + `packages/integrations/adapter.ts.txt` | Pilot API (6 operations, error model with safe next action), event channels, adapter with watermark-regression quarantine and authority-conflict reconciliation |
| `.github/workflows/contract-validation.yml.txt` | contracts · db reset/lint/test · opa · worker + Playwright readiness states |
| `launch/` | pilot-scope.md, go-no-go.yaml, launch-day-runbook.md, support-handoff.md, student + staff emails, registrar/advisor training |
| `governance/` | risk register (7), control register (11 controls → tests), decision log |
| `components/registration-readiness.passport.yaml` | Component passport: owners, authority, prohibited claims, interfaces, hard/soft dependencies, fail mode, rollback, health, evidence |
| `contracts/connection-states.yaml`, `source-verification.yaml` + `packages/source-authority/verify.ts.txt` | 8 connection states with student/staff copy; claim-level labelling rules (missing metadata → needs review; definitive only if current + connected or higher) |
| `proposed-schema/080_reconciliation_and_overrides.sql` | Reconciliation cases (9 states; can’t close without source ref, hashes, verifier, audit link; authority conflicts can only be routed or escalated) and override requests (reason ≥ 10 chars, preview + policy ref required, requester can’t approve) |
| `operations/` | environment promotion, observability (logs, traces, 5 alerts, 5 dashboards), reconciliation policy, INC-READINESS-001 with student/staff/institution messages |
| `governance/feature-flags.yaml`, `accessibility/readiness-evidence.yaml`, `architecture/ai-boundary.yaml`, `contracts/controlled-action.yaml` | Flag registry (owner, expiry, safe-off), a11y evidence pack, AI rules, controlled-action stages |
| `scripts/validate-release-evidence.mjs.txt` | Fails deploy on missing evidence fields, unapproved signoffs, expired or default-on flags |
| `governance/evidence-registry.yaml` | Evidence schema, 6 seed records (all **draft** until run — the PDF marked one accepted with a placeholder hash), invalidation rules |
| `tests/readiness-acceptance.yaml` + `e2e/readiness-acceptance.spec.ts.txt` | AT-RDY-001…010 and a coverage matrix; 9 of them implemented as staging tests |
| `pilot/` | 2 journey-completion checklists, measurement plan + operating cadence, pilot review template |
| `governance/adr/` | ADR-014 readiness ≠ enrollment, ADR-015 security_invoker views, ADR-016 auth.uid() RLS |
| `operations/service-objectives.yaml`, `support-intake.yaml`, `training/registrar-readiness-assessment.yaml` | SLOs without unmeasured commitments, intake + triage + safe macros, 3-question staff assessment |
| `proposed-schema/066_readiness_states_v2.sql` | 11-state machine, terminal states, generation bump per transition, audit-on-transition trigger |
| `proposed-schema/085_jobs_and_outbox.sql` | Jobs (state enum, generation, lease token, attempts), job_attempts, core outbox, `claim_jobs()` with SKIP LOCKED + expired-lease reclaim; no client access |
| `policies/readiness.rego` + test (8) | Command rules incl. self-approval; deny reasons as a set (the PDF’s single-value rules would conflict) |
| `packages/workflow/apply-worker-result.ts.txt` | Late-result guard: tenant, aggregate, lease, generation (job and case), state, policy, apply-once |
| `contracts/readiness-workflow.yaml`, `semantic-rules.yaml` | 7 invariants each mapped to what enforces it; 8-row failure matrix; 7 cross-artifact rules |
| `implementation/tenant-activation.yaml` + `proposed-schema/090_tenant_activation.sql` | Activation package (legal, people, identity, data, delivery prerequisites → steps → completion → hypercare); a trigger refuses to enable a live capability unless the package is approved by two different people with every prerequisite evidenced (turning OFF is never blocked) |
| `data/source-authority-register.yaml` | 6 field-level entries: system, owner, freshness class, correction path, student label, allowed/blocked uses |
| `security/role-provisioning.yaml`, `privacy/`, `integrations/source-onboarding.yaml`, `operations/support-model.yaml` | Role mapping + lifecycle events, data lifecycle + request workflow, 10-step source onboarding, support tiers 0–3 + institution-owned |
| `pilot/renewal-decision.yaml`, `registry/capabilities/registration-readiness.yaml` | Evidence-based renewal; honest 10-dimension maturity (designed = done; everything else proposed or not started) |
| `routes.csv` | 108 routes × the per-route worksheet columns, blank |

Rename `*.ts.txt` → `.ts` and `*.yml.txt` → `.yml` (the .txt keeps the design project's bundler from compiling them).

## Corrections to the source PDF
1. **Framework.** The PDF assumes Next.js App Router and seven Vercel apps. The repo is one Vite app on Vercel + Supabase. Keep it; the middleware becomes the edge-function gate (`handoff/live-integration/.../gate.ts`) plus client route guards.
2. **Token handling.** The PDF's middleware calls `decodeJwt` — decoding is not verifying. `context.ts` verifies signature, issuer and audience.
3. **Grants.** The PDF reads roles/grants from JWT claims. Claims stay valid after revocation, so grants are read from `live_workspace_grants` (or the repo's `role_grants`) per request.
4. **RLS binding.** `set_config('app.current_tenant_id', …)` is safe only inside a server-owned transaction. Never on a client-reachable connection. Prefer `auth.uid()` → membership.
5. **Null tenants.** The PDF's Rego allows when both tenant IDs are null. Fixed: personal resources also require `ownerAccountId == accountId`.

## From the monorepo-starter PDF (taken, and corrected)
| PDF piece | What's here instead | Why |
|---|---|---|
| pnpm + Turborepo, 7 Next.js apps | Keep the repo's npm workspaces + one Vite app; add `packages/auth`, `packages/policy`, `policies/`, `workers/` | A second app means two copies of every record path |
| RLS via `current_setting('app.current_tenant_id')` | `supabase/policies/student_tasks_policies.sql`: `auth.uid()` + `is_active_member()`, per-operation, no hard delete | Client-settable; and `set_config(…, true)` outside a transaction is lost after one statement, so the PDF's `bindRlsContext` silently does nothing |
| pgTAP tests that are `ok(true)` placeholders | `supabase/tests/student_tasks_rls.test.sql`: 9 real allow/deny/cross-tenant/anon cases | Placeholder tests pass while proving nothing |
| Worker lease without expiry or ack | `workers/workflow-worker.ts.txt`: expiring leases, reclaim, attempts + backoff, dead letter, token-checked ack, graceful stop | A crash would strand a job forever; a reclaimed lease could be overwritten |
| `access.rego` with only tenant + grant | Kept the stricter policy; added sensitivity → audit obligation (+1 test, 11 total) | The PDF's drops consent, authority and the null-tenant owner check |
| Server Actions + Zod | Same rule for the edge functions: validate input, re-authorize on every call | Middleware alone isn't authorization |

Use `student_tasks` as the pattern for the other 226: per-operation policies, an index on every policy filter column, and a pgTAP file with allow, deny, cross-tenant and anon cases.

## The 227-table manifest vs. the repo
The repo already has ~233 migrations in `public`. These tables are a target catalog, not a replacement. For each: if the repo has an equivalent, keep it and add missing columns additively; if not, write a real `public` migration with policies and tests, then drop the `semester_core` placeholder. Never point production code at policy-less `semester_core` tables.

The route checklist has 111 routes with screen keys and checklist focus (adds `/app/messages`, `/app/degree/what-if`, `/app/study/watch`; the PDF’s `/developments` typo is dropped). The PDF’s repo scaffold again assumes a Next.js multi-app monorepo — keep the Vite app and add `packages/auth`, `packages/policy`, `policies/` inside it.

## Order
Weeks 1–5 are prerequisites for everything else. Do not start week 8+ screens against tables without RLS and the policy tests passing. Week 16 marks only proven capabilities active — that is the same rule as the completion register and ship program.

Nothing here was run.


## Wave 1 app code (13 Oct)
`app/src/features/readiness/` — drop the `.txt` and copy into the repo at the same path:
- `api.ts` — typed client for the OpenAPI contract: caller-held idempotency keys, If-Match on routing and decisions, plain-language error copy (401/403/409/422/423/503, no server text for 5xx), STATE_COPY that never claims enrollment, isDefinitive().
- `ReadinessScreen.tsx` — student: state card with source + freshness per check, provisional note when not definitive, refer-to-office, refresh when stale, receipts, aria-live, 44 px targets.
- `RegistrarConsole.tsx` — scoped queue (ids not names), route with reason code, exception request with preview and ≥20-char justification, requester can't decide their own, 409 reloads.
- `readiness.test.ts` — 6 Vitest cases.
Add `/v1/registrar/readiness/cases/{caseId}/exceptions` and `/exceptions/{id}/decision` to `contracts/api.openapi.yaml` when wiring the server (the client already calls them).


## Delivery-management layer (13 Oct)
From "continue (5).pdf": docs/delivery/ (operating model with 10 states and 6 release trains, quality gates GATE-01…06, definitions of ready and done, decision rights with blank Vanderbilt names, dependency graph), registry/increments/RDY-INC-003…007, registry/artifacts/ART-RDY-011 (kept draft — the PDF marked it approved with no reviewer), registry/node-status.yaml, docs/delivery/risk-register.yaml RSK-001…004, docs/finance/control-baseline.yaml, pilot/expansion-scorecard.yaml, scripts/check-dependencies.mjs.txt. The script will fail today, correctly: the Wave 1 screens are in_build while foundation dependencies are not yet integration_ready.


## Shared platform contracts (13 Oct)
From "continue (6).pdf": docs/platform/contract-stack.yaml (7 contracts) + packages/contracts/envelopes.ts.txt (RecordEnvelope, CommandEnvelope, EventEnvelope, PermissionDecision, COMMAND_STEPS, assertEnvelope), record/event rules, registry/events/core-events.yaml (5 events), registry/commands/consent.withdraw.yaml, docs/privacy/consent-and-delegation.yaml, registry/ai/ai-capabilities.yaml (ai.readiness_explanation, proposed) + docs/ai/response-evidence.yaml, registry/screens/student-readiness.yaml (lists 4 gaps in the current ReadinessScreen), docs/integrations/connector-certification.yaml (SIS adapter: not_certified), docs/platform/domain-onboarding.yaml (next domain: advising or degree planning), docs/company/monthly-operating-review.yaml.
