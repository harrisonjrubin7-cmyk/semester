# Interoperability and migration factory

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Families: identity (SSO, OIDC, SAML, SCIM), learning (LTI, deep linking, grade passback only when approved), rostering (OneRoster CSV and REST), academic operations (SIS/ERP adapters), productivity (Google, Microsoft, Apple import/export), research, payments (providers only), campus services, career, AI providers, analytics, support.
- Migration factory: inventory → discovery → scope → security review → mapping → staging → validation → reconciliation → dual run → cutover → rollback → export/archive → retirement.
- Assets: intake questionnaire, source inventory template, field-mapping studio, data-quality dashboard, reconciliation engine, duplicate-resolution workspace, evidence register, cutover checklist, rollback runbook, acceptance template, export formats, decommission plan.
- Win long sales cycles by making replacement safer than staying fragmented.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `ui_kits/console/ (integrations)`, `ui_kits/workflow-runner/ (Controlled integration, Domain migration)`, `docs/launch/Cutover Plan.html` |
| Implementation state | Designed: 20-step controlled integration, 17-step migration, cutover plan. No connector built. |
| Product owner | Engineering (integrations) |
| Technical owner | Implementation |
| Risk owner | Institution IT |
| Success metrics | Time to first clean reconciliation; Unexplained mismatches = 0; Rollbacks rehearsed per migration; Integrations certified |
| Launch gate | Read-only SIS sync reconciled for pilot (launch gate) |
| Next action | Build the SIS read connector and reconciliation report for the pilot extract |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
