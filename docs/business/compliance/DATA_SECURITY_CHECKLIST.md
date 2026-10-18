# Data Security Checklist

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL ACTIONABLE CHECKLIST - NOT APPROVED, NOT AN AUDIT** |
| Owner | Harrison Rubin (interim; single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [DRAFT] [INTERNAL] [ASSUMPTION] [REVIEW: security] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: accessibility] |
| Audience | Internal |

> Operating document, not legal, security, privacy or accessibility advice. A tick means an artifact exists in the repository, not that the control is operated, approved or independently verified.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/trust/INFORMATION-SECURITY-PROGRAM.md](../../trust/INFORMATION-SECURITY-PROGRAM.md) and [docs/trust/SECURITY-QUESTIONNAIRE.md](../../trust/SECURITY-QUESTIONNAIRE.md) | Domain-level control program and questionnaire framework with status words | An item-level, tickable checklist in the order the user supplied, each with owner, evidence and next action | Those are controlled trust documents with a fixed shape; a checklist is a working view |
| [docs/market-readiness/PROCUREMENT_CHECKLIST.md](../../market-readiness/PROCUREMENT_CHECKLIST.md), [docs/market-readiness/GO-NO-GO-CHECKLIST.md](../../market-readiness/GO-NO-GO-CHECKLIST.md), [docs/infrastructure/COMPLIANCE-EVIDENCE.md](../../infrastructure/COMPLIANCE-EVIDENCE.md) | Procurement and go/no-go checklists; infrastructure compliance evidence | Security-and-data-only checklist with a strict tick rule; links to register rows | Different scope and no tick rule |
| [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | Per-control rows with status and remediation | The checklist points at register rows (CER-*) rather than restating them | One detail home |

## Gate (what may be done now versus held)

Ticking an item here never opens a gate. Gates are in [GO-NO-GO-DECISION.md](../../../GO-NO-GO-DECISION.md): design-partner non-activation work is GO now; paid institutional pilot, live data and tenant activation are HELD (NO-GO / RED).

## Tick rule

- `[x]` only when a file in this repository (cited in Evidence) establishes the item: a document, test, check, workflow or dated file under `docs/evidence/`. It means "exists in the tree", and the Status column says how far past that it goes.
- `[ ]` for everything else, including items where a draft exists but is unapproved, or where the proof is a provider console or a person outside the repository.
- Status vocabulary: Verified-repository / Partially evidenced / Planned / Not evidenced / Blocked-external.
- Never tick on the strength of a plan, an attestation with no export, or a third party's marketing page.

## 1. Governance and asset basics

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [ ] | Asset inventory complete and reconciled to provider consoles | Harrison Rubin (interim) | `docs/trust/ASSET-INVENTORY.md` (status INCOMPLETE) | Partially evidenced | Complete; file dated reconciliation (CER-A10) |
| [x] | Security owner named | Harrison Rubin (interim) | `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | Partially evidenced | Name a backup (TR-12) |
| [ ] | Backup security owner and second reviewer named | Harrison Rubin (interim) | NONE - gap | Not evidenced | TR-12 |
| [x] | Written security program exists (draft) | Harrison Rubin (interim) | `docs/trust/INFORMATION-SECURITY-PROGRAM.md` | Partially evidenced | Adopt by dated decision |
| [ ] | Program adopted and operating reviews held | Harrison Rubin (interim) | NONE - gap | Not evidenced | CER-A03 |
| [x] | Evidence register exists | Harrison Rubin (interim) | `docs/trust/EVIDENCE-REGISTER.md` | Verified-repository | Produce artifacts under `docs/evidence/` |
| [ ] | Training and policy acknowledgement recorded | Harrison Rubin (interim) | NONE - gap | Not evidenced | CER-A09 |

## 2. Access control and identity

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | Access control by capability, audited grants | Harrison Rubin (interim) | `supabase/capabilities.check.sql`; `supabase/role-grant-audit.check.sql` | Verified-repository | Keep |
| [ ] | MFA enforced on production and admin systems (GitHub, Supabase, hosting, domain, email) with filed proof | Harrison Rubin (interim) | NONE - gap (owner attestation only: `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`) | Not evidenced | Redacted dated exports (CER-C01) |
| [ ] | MFA / passkeys for students and platform staff roles | Harrison Rubin (interim) | NONE - gap | Planned | TR-13 |
| [ ] | Joiner / mover / leaver procedure operated | Harrison Rubin (interim) | NONE - gap (standard only: `docs/trust/IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md`) | Planned | Trigger on first non-founder access |
| [ ] | Quarterly access review with retained export | Harrison Rubin (interim) | NONE - gap | Not evidenced | CER-C08 |
| [x] | Privileged-access controls designed and tested (two-person approvals, expiring break-glass) | Harrison Rubin (interim) | `supabase/console-control-plane.check.sql` | Partially evidenced | TR-14 (break-glass consumed by nothing) |
| [x] | Service credentials inventoried (stores, owners) | Harrison Rubin (interim) | `SECRETS.md`; `app/src/lib/secrets.test.ts` | Partially evidenced | TR-09 |
| [x] | Server-side authorization is the boundary; UI gating is UX only | Harrison Rubin (interim) | `docs/architecture/0002-rls-is-the-authorization-boundary.md`; `supabase/rls-coverage.check.sql` | Verified-repository | Named-tenant two-account UAT |

## 3. Secrets and encryption

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | Secrets management documented (four stores) | Harrison Rubin (interim) | `SECRETS.md` | Partially evidenced | Rotation log is empty |
| [ ] | Rotation performed and logged on schedule | Harrison Rubin (interim) | NONE - gap | Not evidenced | TR-09 |
| [x] | No production secret in source (scan on diff and tree; dated clean result) | Harrison Rubin (interim) | `.gitleaks.toml`; `docs/evidence/security/2026-10-02-working-tree-secret-scan.md` | Verified-repository (point in time) | Repeat per release candidate |
| [x] | No service-role or secret key in the browser build (client holds publishable key only) | Harrison Rubin (interim) | `docs/ARCHITECTURE.md` (invariant 1); `SECRETS.md` | Partially evidenced | Add a bundle scan as a CI step [DRAFT] |
| [x] | No secrets in committed docs (tree scan includes docs) | Harrison Rubin (interim) | `docs/evidence/security/2026-10-02-working-tree-secret-scan.md` | Verified-repository (point in time) | Repeat |
| [ ] | No secrets in screenshots/images | Harrison Rubin (interim) | NONE - gap (scanner does not read images) | Not evidenced | Manual check before any screenshot is filed; blur tokens |
| [ ] | Encryption in transit evidenced (TLS configuration or provider statement; security headers served in production) | Harrison Rubin (interim) | NONE - gap (headers specified in `app/public/_headers`, `app/vercel.json`; host serving production sends none: TC-SEC-14) | Partially evidenced | TR-17 |
| [ ] | Encryption at rest evidenced with provider evidence | Harrison Rubin (interim) | NONE - gap | Not evidenced | CER-D14; do not claim until filed |
| [x] | Gateway action bodies encrypted before storage | Harrison Rubin (interim) | `app/server/institution/journal-crypto.ts` | Verified-repository | Key rotation record (TR-09) |

## 4. Secure development and vulnerability management

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | SDLC gates in CI (types, lint, tests, shuffled order, database policy checks) | Harrison Rubin (interim) | `.github/workflows/ci.yml`; `docs/trust/SECURE-DEVELOPMENT-LIFECYCLE.md` | Verified-repository | Hosted release evidence on a frozen candidate |
| [x] | PR review and branch protection specified and test-held | Harrison Rubin (interim) | `.github/rulesets/main.json`; `app/src/lib/branchprotection.test.ts` | Partially evidenced | Not enforced until applied (TR-46) |
| [ ] | Branch protection enforced with a second reviewer | Harrison Rubin (interim) | NONE - gap (CODEOWNERS names one person) | Not evidenced | TR-46 |
| [x] | Dependency scanning and update workflow | Harrison Rubin (interim) | `.github/dependabot.yml`; `docs/evidence/security/2026-10-02-production-dependency-audit.md` | Partially evidenced | Make audit blocking (TR-05) |
| [x] | Vulnerability intake path and disclosure contact published | Harrison Rubin (interim) | `app/public/.well-known/security.txt`; `SECURITY.md` | Verified-repository | Dedicated address; safe-harbour wording [REVIEW: counsel] |
| [x] | Severity model and remediation targets (internal targets) | Harrison Rubin (interim) | `SECURITY.md`; `app/src/lib/supplychain.ts` | Partially evidenced | Hold first finding to them |
| [ ] | Findings retested and closed on SLA with records | Harrison Rubin (interim) | NONE - gap | Not evidenced | Findings register `docs/security/FINDINGS-REGISTER.md` first entries |
| [ ] | Static and dynamic analysis results filed | Harrison Rubin (interim) | NONE - gap (workflows exist: `.github/workflows/codeql.yml`, `.github/workflows/hawkscan.yml`) | Partially evidenced | CER-D05, D06 |
| [x] | Penetration test plan written | Harrison Rubin (interim) | `docs/trust/PENETRATION-TEST-PLAN.md` | Planned | Commission (TR-16) |
| [ ] | Independent penetration test performed, findings remediated and retested | Harrison Rubin (interim) | NONE - gap | Blocked-external | TR-16 |

## 5. Logging, monitoring, backup, continuity, incident response

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | Immutable audit logging of grants, moderation, provisioning, support access | Harrison Rubin (interim) | `supabase/role-grant-audit.check.sql`; `supabase/support-access.check.sql` | Verified-repository | Evidence store beyond provider window (TR-43) |
| [ ] | Error monitoring and alert routing to a second person | Harrison Rubin (interim) | NONE - gap (synthetic checks only: `.github/workflows/production-smoke.yml`) | Not evidenced | TR-07, TR-28 |
| [ ] | Backup restore tested on a schedule (real provider backup, timed) | Harrison Rubin (interim) | NONE - gap (logical rehearsal only: `docs/evidence/restore/2026-09-30-logical-rehearsal.md`) | Not evidenced | TR-10 |
| [x] | Incident response plan written | Harrison Rubin (interim) | `docs/trust/INCIDENT-RESPONSE-PLAN.md` | Partially evidenced | [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md) |
| [x] | Document tabletop held (founder only, not a target exercise) | Harrison Rubin (interim) | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` | Partially evidenced | TT-01..TT-12 with a second person (TR-30) |
| [ ] | Target tabletop with named roles and customer contact | Harrison Rubin (interim) | NONE - gap | Not evidenced | TR-30 |
| [x] | BC/DR plan written (draft, objectives unmeasured) | Harrison Rubin (interim) | `docs/trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md` | Planned | Measure after TR-10 |
| [ ] | RTO/RPO measured and accepted | Harrison Rubin (interim) | NONE - gap | Not evidenced | TR-10, TR-27 |

## 6. Vendors, data lifecycle, privacy

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | Vendor risk register exists | Harrison Rubin (interim) | `docs/trust/VENDOR-RISK-REGISTER.md` | Planned | See [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md) |
| [ ] | Vendor reviews completed (attestation read, DPA, region, exit) | Harrison Rubin (interim) | NONE - gap | Not evidenced | CER-B12 |
| [x] | Subprocessor list exists and is held to CSP and Edge Functions by test | Harrison Rubin (interim) | `app/src/lib/trust/subprocessors.ts`; `app/src/lib/trust/subprocessors.test.ts` | Verified-repository | Counsel review |
| [ ] | Verified subprocessor list (terms, regions, DPAs on file) published | Harrison Rubin (interim) | NONE - gap | Blocked-external | TR-22 [REVIEW: counsel] |
| [x] | Retention and deletion documented, held to schema by test | Harrison Rubin (interim) | `RETENTION.md`; `app/src/lib/retention.test.ts` | Verified-repository | Durations to counsel |
| [ ] | Retention/deletion exercised on a target (rights, export, deletion, backup tail) | Harrison Rubin (interim) | NONE - gap | Not evidenced | TR-08 |
| [x] | Data-flow diagram exists | Harrison Rubin (interim) | `docs/trust/DATA-FLOW-MAP.md` | Partially evidenced | Customer-specific map |
| [x] | Architecture diagram exists | Harrison Rubin (interim) | `docs/ARCHITECTURE.md` | Partially evidenced | Gateway hosting decision |

## 7. Procurement readiness

| Done | Item | Owner | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| [x] | Trust-room (controlled document request) mechanism built | Harrison Rubin (interim) | `app/src/screens/TrustRoom.tsx`; `supabase/trust-room.check.sql` | Partially evidenced | Approve packet and flow ([TRUST_CENTER_INVENTORY.md](TRUST_CENTER_INVENTORY.md)) |
| [ ] | Controlled request flow approved and exercised end to end | Harrison Rubin (interim) | NONE - gap | Not evidenced | Trust seat vacant |
| [x] | HECVAT readiness register exists | Harrison Rubin (interim) | `docs/market-readiness/HECVAT_READINESS.md` | Partially evidenced | [HECVAT_ROADMAP.md](HECVAT_ROADMAP.md) |
| [ ] | HECVAT Lite completed for a buyer's workbook | Harrison Rubin (interim) | NONE - gap | Not evidenced | Roadmap phase 2 |
| [ ] | Full HECVAT prepared and reviewed | Harrison Rubin (interim) | NONE - gap | Not evidenced | Roadmap phase 4 |
| [x] | Questionnaire library exists, test-held | Harrison Rubin (interim) | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`; `app/src/lib/gtm/rfp.ts` | Verified-repository | [SECURITY_QUESTIONNAIRE_LIBRARY.md](SECURITY_QUESTIONNAIRE_LIBRARY.md) |
| [x] | Accessibility self-assessment and VPAT roadmap exist | Harrison Rubin (interim) | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`; `docs/trust/HECVAT-VPAT-PLAN.md` | Planned | Qualified review (TR-25) |
| [ ] | Accessibility review done and ACR issued | Harrison Rubin (interim) | NONE - gap | Blocked-external | TR-25, TR-47 [REVIEW: accessibility] |
| [x] | Customer-facing security overview drafted | Harrison Rubin (interim) | `docs/trust/SECURITY-OVERVIEW.md` | Partially evidenced | Approve exact wording (CLM-009) |
| [ ] | Incident-notification commitments in counsel-approved contract language | Harrison Rubin (interim) | NONE - gap (draft only: `docs/legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`) | Blocked-external | TR-21 [REVIEW: counsel] |

## Evidence state

Ticked items establish that something exists in the tree at revision `5eba494`. The number of ticked items is not a score and must never be quoted as a readiness percentage.

## Claim ceiling

Permitted: "Semester tracks its data-security controls in a checklist whose ticks require an in-repository artifact." Not permitted: any statement that the controls are operated, compliant or verified.

## Prohibited claims

SOC 2, FERPA/HIPAA/GDPR compliance, HECVAT completion, penetration test performed, WCAG conformance, uptime/RTO/RPO, "encrypted at rest", student MFA, live SSO.

## Professional review required

[REVIEW: security] items 3-5; [REVIEW: counsel] items 4 and 6-7; [REVIEW: privacy] item 6; [REVIEW: accessibility] item 7. None named in the repository.
