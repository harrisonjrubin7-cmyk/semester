# Developer platform and marketplace

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Developer portal, API gateway, OAuth/OIDC, service accounts, webhooks, event subscriptions, SDKs (TypeScript first), sandbox tenants, test data, certification suite, migration guides, changelog and deprecation policy, partner support SLA, community, publishing workflow.
- Marketplace categories: learning tools, tutoring, research, accessibility, assessment, career, campus services, advising, financial wellness, AI providers, courseware, analytics, engagement, connectors.
- Every extension: verified publisher, security and privacy review, tenant-approved scope, versioning, support owner, incident contact, export/delete path, offboarding.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `ui_kits/workflow-runner/ (Developer platform)`, `ui_kits/external/ (Marketplace partner)` |
| Implementation state | Designed: 16-step partner workflow. No API published. |
| Product owner | Product |
| Technical owner | Engineering (platform) |
| Risk owner | Partnerships |
| Success metrics | Certified apps; Partner time to first API call; Tenant installs; Partner incidents |
| Launch gate | After pilot: one partner integration certified end to end |
| Next action | Draft the public API surface and versioning policy (post-pilot) |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
