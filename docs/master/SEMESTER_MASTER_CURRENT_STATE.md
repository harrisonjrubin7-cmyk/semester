# Semester master — current state (Phase 0 reconciliation)

**As of** 2026-10-05 · **Base** `origin/main` `114ac32` · **Branch** `claude/sharp-pasteur-qrutl6` · **Status** Phase 0 evidence; nothing here is a release claim.

> **Claim ceiling.** This page records what was measured in this session. A row that says "not found" means a grep or listing found nothing, not that a proof of absence exists. Anything not measured is marked *unverified*.

## 1. What was run (from `app/`)

| Command | Result |
| --- | --- |
| `npm ci` (root) | completed |
| `npx tsc -b` | clean |
| `npm run lint` | passes; oxlint warnings (React hook/purity/ref warnings in `Sheet.tsx`, `Classmates.tsx`, `Calendar.tsx`, `Import.tsx`, `folds.hook.ts`, `importgraph.ts`); style, label and term audits ok |
| `npm run check:university` | clean |
| `npm run design-system:check` | 0 violations, 86 raw-value warnings; 69 contract tests in 5 files pass |
| `npm test` | passes, see §6 |
| `npm run test:shuffle`, `npm run build`, secret scan, migration validation | **not run in this pass** |

## 2. Architecture map

```
Browser (Vite + React, app/)  ──►  Supabase (project lzrqvlug…, RLS on every public table)
  screens.tsx → screens/*            RPCs (SECURITY DEFINER) · Edge Functions
  components/{ui,unity,console}      supabase/functions: lti, lead-intake, billing-*, claude,
  lib/look.ts → styles/tokens.css      integration-tick, calendar, canvas, push, trust-room, …
Gateway (app/server, app/api, packages/institution) — NodeNext, `check:university`
company-site/ — single index.html, ~100 data-page routes (third Vercel service)
```

Deployment: root `vercel.json` plus `app/` and `company-site/`. Workflows: ci, codeql, contrast, docs, drift, functions, hawkscan, infra, infra-apply, pages, production-smoke, supply-chain, workflow-lab.

## 3. App structure (measured)

- 7 navigation areas in `lib/navareas.ts` (today, plan, learn, help, campus, progress, you); 63 destination rows in `lib/nav.ts` (the PDF says 64).
- ~95 router keys in `screens.tsx`; `screens/` holds the screens (Today, Registration, Gradebook, Registrar, Console, Privacy, Support, Pathway, …).
- Design primitives: `components/ui.tsx` (ActionButton, Toggle, Segmented, EmptyState, TabList), `components/unity/` (SystemContextBar, ContextBar, ObjectCard, ActionPreview, NextSteps, DecisionTrail, Combobox, DateField, Table, States, Status, ProvenanceChips), `components/console/`.

## 4. Data architecture (live project, read-only listing)

230-odd public tables, **all with RLS enabled**. Domains present: identity/roles (`role_grants`, `app_roles` 69, `app_capabilities` 96, `role_capabilities` 185), tenant control (`tenant_*`, `school_*`, `institution_*`, `scim_*`), registration (`registration_*`), gradebook (`gradebook_*`, `grade_entries`, `regrade_*`), student accounts (`student_account_*`, `student_payment_plan*`), academic record (`academic_record_*`), dining, community, family/guardian, integrations (`integration_*`), GTM (`gtm_*`), commercial/billing (`commercial_*`, `billing_*`, `subscriptions`, `invoices`), customer success (`implementation_*`, `success_plans`, `qbrs`, `renewal_opportunities`, `account_health_snapshots`), trust (`trust_*`, `compliance_*`, `claims_register`), console (`approval_request`, `approval_decision`, `console_duty`, `break_glass_grant`, `operator_preference`), audit (`audit_event`, `*_audit_event`). Almost every operational table has 0 rows: the schema is far ahead of the data.

## 5. Eventing

`private.domain_outbox_events` (idempotency unique index, `dead_lettered_at`) and `private.domain_event_receipts` exist (`20260928320000_audit_correlation_and_outbox.sql`). **Not found:** a projection worker, projection watermarks, a read-model registry, projection rebuild. None of the 17 `ops_*` read contracts the PDFs name exists by that name (see the role/screen matrix).

## 6. Test suite

1441 test files passed (23,179 tests); details in [`SEMESTER_RELEASE_EVIDENCE_REGISTER.md`](SEMESTER_RELEASE_EVIDENCE_REGISTER.md).

## 7. Existing master documents this page does not replace

`REPO_AUDIT.md`, `SEMESTER_GAP_REGISTER.md` (203 of 319 workflow steps not fully built; 57 of 589 catalogued screens missing), `SEMESTER_CAPABILITY_MATRIX.md`, `SEMESTER_DATA_AUTHORITY_MATRIX.md`, `SEMESTER_DOMAIN_REPLACEMENT_GATES.md`, `SEMESTER_MASTER_BACKLOG.md`, `SEMESTER_SCREEN_CATALOG.md`, `SEMESTER_WORKFLOW_CATALOG.md`, and all of `docs/finish-line/`.
