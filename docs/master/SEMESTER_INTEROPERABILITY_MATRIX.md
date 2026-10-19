# Semester interoperability matrix

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** "Built" means code and tests exist in this repository. It does **not** mean a real institution is connected: the institutional adapter registry (`app/server/institution/adapters.ts`) is intentionally empty, every gateway service answers 503 unless the sandbox is on, and there are **zero** LTI platform registrations. Public wording is held to CLM-005: SSO, SCIM, LTI, OneRoster and SIS/LMS integrations are conditional and **prohibited as current public availability**.

The doctrine is **connect first, replace by domain**. This matrix says what Semester connects to, in what mode, with what evidence. Existing detail: [`docs/INTEROPERABILITY-ROADMAP.md`](../INTEROPERABILITY-ROADMAP.md) (rendered from `app/src/lib/interop.ts`), [`docs/LMS-INTEROPERABILITY-MATRIX.md`](../LMS-INTEROPERABILITY-MATRIX.md), [`docs/INTEGRATION-CONTROL-PLANE.md`](../INTEGRATION-CONTROL-PLANE.md).

## Evidence vocabulary

| State | Meaning |
| --- | --- |
| Built and tested | Code and tests in the repository |
| Built, off | As above, behind a flag or environment variable that is off |
| Sandbox only | Works only against the labelled sandbox adapters |
| Designed | A document says how; no code found |
| Not found | The audit found neither code nor design; treated as not started |
| Verify | Sources disagree; record the resolution in `docs/evidence/` |

## Standards

| Standard | Purpose | Status | Evidence | Next |
| --- | --- | --- | --- | --- |
| LTI 1.3 (launch, deep linking, AGS, NRPS) | Course context and grade passback from an LMS | Built and tested; 0 registrations | `supabase/functions/lti/`, `_shared/lti*.ts`, `lti_*` tables | Register in one sandbox LMS; record a launch and a passback |
| SAML 2.0 | Institutional sign-in | **Verify**: truth table says implemented-not-released and blocked on an IdP; no SAML protocol code was found outside docs (Supabase Auth may carry it) | `docs/SAML-IMPLEMENTATION-RUNBOOK.md`; migrations `tenant_sso_policy`, `bind_institution_sso_membership` | Confirm path; evidence against a test IdP |
| OIDC | Institutional sign-in | Designed (replacement register: SAML only) | `docs/OIDC-IMPLEMENTATION-RUNBOOK.md` | Build when a partner's IdP needs it |
| SCIM 2.0 | Provisioning and deprovisioning | Built, off (`SEMESTER_SCIM`) | `app/server/institution/scim*.ts`, `scim_*` tables | Dry-run against a test directory |
| OneRoster 1.2 | Rosters and enrolments | Designed; 27 source files mention it; no client code in `server` or `packages` | `docs/INTEROPERABILITY-ROADMAP.md` | First adapter: CSV roster, then REST |
| 1EdTech Edu-API | Higher-ed data exchange | Not found | | Evaluate after OneRoster |
| QTI 3 | Assessment items | Built and tested (library) | `app/src/lib/assessment/qti.ts`, `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` | Round-trip a real exported bank |
| Common Cartridge | Course package | Not found | | With Course Studio import |
| Caliper / xAPI | Learning events | Not found | | After events/outbox is adopted |
| Open Badges 3 / CLR / verifiable credentials | Portable credentials | Designed | `docs/CREDENTIAL-WALLET.md` | After the claim-verification flow (D23) |
| CASE | Competency frameworks | Not found | | With the competency map |
| Ed-Fi | K-12 data | Not found | | Only if a K-12 partner needs it |
| PESC (transcripts) | Official transcript exchange | Not found | | Only after the record ledger passes its gates |
| iCalendar (ICS) | Calendars | Built and tested | `supabase/functions/calendar/`, `fetchcal/` | |
| OAuth 2.0 (student-directed) | Google, Microsoft, Zoom, Apple connections | Built | `app/src/lib/integration/oauth*`, `oauthscopes` | |
| OpenAPI 3 | Productivity API contract | Built | `docs/api/productivity.v1.openapi.json` | Add institution gateway contract |
| Webhooks (outbound) | Event delivery | Designed; inbound webhook ingress built | `lib/integration/webhook-ingress`, `integration_webhook_events` | Outbound signing, retries, replay in the platform plan |

## Institutional systems (connectors Semester will need)

Systems are named as ecosystems an institution may run. None is connected. The first connector is chosen by the first design partner, not by Semester.

| Domain | Typical systems | Mode today | Semester role | First integration shape |
| --- | --- | --- | --- | --- |
| SIS | Banner, PeopleSoft, Workday Student, Colleague | Not connected; sandbox adapter only | Read, label, hand off | Read-only roster and catalog via vendor API or flat-file |
| LMS | Canvas, Brightspace, Blackboard, Moodle | Canvas API proxy built; LTI built | Launch, context, passback | LTI first |
| Identity | Entra ID, Google Workspace, Okta, Shibboleth, CAS | Not connected | Consume | SAML or OIDC plus SCIM |
| Degree audit | Degree Works, uAchieve | Not connected | Read-only status | Export or API |
| Advising/CRM | EAB Navigate, Slate, Starfish | Not connected | Handoff | Appointment link |
| Student accounts | Bursar/ERP, payment processors (Touchnet, Nelnet, Flywire) | Not connected | Show and hand off | Deadline feed, hosted payment link |
| Financial aid | COD, vendor aid systems | Not connected | Checklist and handoff | None until counsel |
| Housing | StarRez, Adirondack | Sandbox | Status and handoff | Status feed |
| Dining and card | Transact, CBORD, Sodexo, Aramark, Grubhub | Sandbox; module.dining | Hours, status, ordering through partner | Partner API |
| Library | Alma, discovery layers | Not connected | Links | Later |
| Career | Handshake, Symplicity | Not connected | Opportunity layer | Later |
| Safety | Institutional alert systems | Signed webhook built, off | Handoff only | Per-institution agreement |
| Accessibility services | Accommodate, Clockwork | Not connected | Handoff | Later |
| Content/publishers | Courseware vendors | Not connected | LTI | LTI |

## External services Semester itself depends on

Source of truth for subprocessors: `app/src/lib/trust/subprocessors.ts`, rendered to `docs/SUBPROCESSORS.md` and held to the CSP by a test.

| Service | Role | State | Gap |
| --- | --- | --- | --- |
| Supabase | Database, auth, storage, edge functions | In use; Pro plan; 7-day daily backups per vendor docs; PITR unverified | No production restore ever run; no DPA on file |
| GitHub (Actions, Pages) | CI and static hosting of the app | In use | Pages cannot send security headers (F-06); move decided in LAUNCH-DECISIONS item 6 |
| Vercel | Institutional gateway; company site | Gateway "only once an institution enables it"; company site served per the brand-alignment note | Deployed revision unverified; gateway deployment UNKNOWN-INVESTIGATE |
| Anthropic | AI provider (shared key, metered; student keys) | Shared key blocked pending activation | Commercial terms, retention setting, student-records decision |
| OpenAI | Institution-approved provider; student keys | Route built | Per-institution approval |
| Stripe | Individual payments | Live-mode test executed 2026-10-03 | Subprocessor register says "not active"; refunds, disputes, tax unexercised |
| Resend | Site forms and opt-in support email | In use | Personal-mailbox dependencies (F-13) |
| OpenStreetMap, Nominatim, Photon | Maps | Student-directed | |
| Company-site CDNs (cdnjs, jsdelivr), YouTube nocookie | Marketing site | In the site CSP | "In no register yet" per the audit |

## Connector lifecycle (the control plane that already exists)

Every connector, whatever its standard, passes the same states. The tables and workers exist; no real connector has run through them.

```
proposed → scoped → credentialed → sandbox-synced → reconciled → approved (institution) →
live-read → (dual-run) → live-write (per scope, separate approval) → degraded | paused | retired
```

| Control | Mechanism |
| --- | --- |
| Scope approval | `integration_scopes`; `scope.sis.*` flags |
| Mapping | `integration_mappings`; field-level lineage (`lib/integration/lineage`) |
| Health | `integration_sync_runs`, freshness states, drift detection |
| Failure | `integration_dead_letter`, replay with `integration:replay` |
| Stop | `kill.integration_sync` and per-connector pause |
| Reconciliation | `integration_reconciliation`; sync simulation sandbox (`docs/SYNC-SIMULATION-SANDBOX.md`) |
| Degraded operation | Source states `Stale` and `Unavailable` shown to the user (`docs/DEGRADED-MODE-MAP.md`) |

## Certification

Provider maturity and certification are described in `docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`. Semester claims no 1EdTech certification and none is pursued yet; seeking LTI Advantage certification is a step in the 12-month plan after the first sandbox registration.

## Required evidence per connector before it can be called supported

1. A sandbox run recorded under `docs/evidence/` (inputs, outputs, errors).
2. A scope list and data map the institution approved.
3. A reconciliation report with every exception explained.
4. A kill-switch test and a degraded-mode screenshot.
5. A rollback: disable the connector and confirm the product still works from the labelled last-known data.
6. A support runbook entry (`docs/INTEGRATION-OPERATOR-RUNBOOK.md`).
