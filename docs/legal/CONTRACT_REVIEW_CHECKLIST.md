# Contract review checklist: Phase 0 view

> **Not legal advice. A checklist of what exists and what counsel must review; it approves no contract term. Every row requires qualified counsel.**

| Field | Value |
| --- | --- |
| Purpose | One place that lists the contract paper in the repository, its state, and the commercial facts a contract would currently contradict |
| Linked, not copied | [`../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md`](../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md); [`../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md`](../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md); [`../trust/DPA-CHECKLIST.md`](../trust/DPA-CHECKLIST.md); [`../trust/PILOT-AGREEMENT-OUTLINE.md`](../trust/PILOT-AGREEMENT-OUTLINE.md); [`../TENANT-CONTRACT.md`](../TENANT-CONTRACT.md); [`../../LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) rows Q-03, Q-05, Q-16 |
| Date | 2026-10-04 |
| Status | **Phase 0 baseline — evidence-cited, not a readiness claim** |
| Method | `ls docs/legal-drafts docs/trust contracts`; read `app/src/lib/governance/deal-desk.ts`, `supabase/migrations/20260929070000_commercial_core.sql`, `app/src/lib/ops/claims.ts` `POLICIES` |

## 1. Paper that exists (all drafts; none reviewed or executed)

| Document | Path | State |
| --- | --- | --- |
| Pilot agreement | `docs/legal-drafts/PILOT-AGREEMENT-DRAFT.md`; outline `docs/trust/PILOT-AGREEMENT-OUTLINE.md` | draft |
| Order form template | `docs/legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md` | draft |
| Pilot proposal template | `docs/legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`; `docs/commercial/PILOT-PROPOSAL-TEMPLATE.md` | draft |
| Data processing addendum | `docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`; checklist `docs/trust/DPA-CHECKLIST.md` | draft. `app/src/lib/ops/claims.ts:693` still lists the DPA as `outline` pointing at the checklist: register and folder disagree |
| Student data privacy addendum | `docs/legal-drafts/STUDENT-DATA-PRIVACY-ADDENDUM-DRAFT.md` | draft. `claims.ts:694` says `not-started`, path `null`: register and folder disagree |
| Information security addendum; incident notification exhibit | `docs/legal-drafts/INFORMATION-SECURITY-ADDENDUM-DRAFT.md`; `SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`; `INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md` | draft |
| SLA and support exhibit | `docs/trust/SLA.md` (`NOT_STARTED` as a commitment); `docs/legal-drafts/SUPPORT-POLICY-EXHIBIT-DRAFT.md` | outline / draft |
| AI, accessibility, acceptable-use, retention exhibits | `docs/legal-drafts/AI-USE-TERMS-EXHIBIT-DRAFT.md`, `ACCESSIBILITY-ROADMAP-EXHIBIT-DRAFT.md`, `ACCEPTABLE-USE-EXHIBIT-DRAFT.md`, `DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md` | draft |
| Subprocessor list | `docs/SUBPROCESSORS.md`; `docs/legal-drafts/SUBPROCESSOR-LIST-TEMPLATE-DRAFT.md` | draft; held to code by `app/src/lib/trust/legal-drafts.test.ts` |
| MSA | none found (`ls docs/legal-drafts | grep -i msa` empty) | missing |
| Marketplace / partner terms | `docs/legal-drafts/MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md` | draft; marketplace held by D-1236 |
| Signed contracts | `contracts/README.md` only (directory holds no `<tenant>.json`) | none executed |

## 2. Checklist: facts a contract must not contradict

Each item is a repository fact today; counsel decides whether and how a clause may reference it.

| # | Item | Fact in the repository | Path |
| --- | --- | --- | --- |
| 1 | Price and fees | No approved price book; institutional prices are quote-only; three inconsistent number sets (finance model, launchkit, public site) | `commercial/READINESS_GAP_MATRIX.md` section 1; `docs/commercial/PRICING-AND-PACKAGING.md` |
| 2 | Approval authority | Deal-desk ladder is a pure function with proposed values; no named approvers exist | `app/src/lib/governance/deal-desk.ts:36-47`; `docs/legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md` |
| 3 | Term and pilot length | Every pilot is 26 weeks (D-134); deal desk allows up to 6 months; a pilot order form cannot be signed without an end date | `docs/PAID-PILOT-FRAMEWORK.md`; `docs/COMMERCIAL-CORE.md` "Contract to tenant" |
| 4 | What signing does technically | A signed **order form** sets `tenant_plan` to the highest tier on its lines, creates an implementation project and a renewal opportunity dated end minus 120 days; MSAs, DPAs and SLAs trigger nothing | `docs/COMMERCIAL-CORE.md`; `supabase/migrations/20260929080000_commercial_automation.sql`; `20261004090000_order_form_never_downgrades_plan.sql` |
| 5 | AI overage | Deal desk requires an overage policy to be stated; no rate exists; shared-key meter is dollar-allowance with a 429 at the cap, not billed overage | `deal-desk.ts:67-68,98`; `docs/decisions/D-1231.md` |
| 6 | Support and SLA | No staffed support, one responder, SLA not started | `docs/trust/SLA.md`; `company-site/index.html:1717` |
| 7 | Security representations | No SOC 2, ISO, pen test or HECVAT; claims register marks all `planned` | `app/src/lib/ops/claims.ts` ids `soc2`, `pen-test`, `hecvat`; `company-site/site.js:948` |
| 8 | Accessibility terms | No manual assistive-technology review; no ACR | `docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`; claims id `vpat` |
| 9 | Integrations promised | SSO/SCIM `in-preparation`; LTI, SIS, OneRoster `planned`; no live connector accepted | `claims.ts` ids `sso`, `scim`, `lti`, `sis`; `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` CLM-005 |
| 10 | Data roles and FERPA | School-official vs vendor not decided; no DPA signed | `LEGAL-REVIEW-QUEUE.md` Q-04; `docs/COUNSEL-BRIEF.md` B2, F2 |
| 11 | Subprocessors and AI providers | Provider terms on file, nothing signed (D-147) | `docs/trust/PROVIDER-TERMS.md`; COUNSEL-BRIEF F3 |
| 12 | Exit and retention | Departed-school retention 90 days (30 minimum) is a placeholder; seven-year financial records | COUNSEL-BRIEF A1-A4; `docs/COMMERCIAL-CORE.md` "Financial retention"; `docs/SCHOOL-OFFBOARDING.md` |
| 13 | Insurance | Not in the repository | COUNSEL-BRIEF F4; `docs/company/INSURANCE-READINESS-CHECKLIST.md` |
| 14 | Counterparty identity | Entity, address and signing authority unrecorded; signup hosted on a personal GitHub Pages address | `LEGAL-REVIEW-QUEUE.md` Q-01; `company-site/index.html:208` |
| 15 | Tax and invoicing | No institutional invoice, PO or net-terms flow; tax code approval pending accountant | `docs/COMMERCIAL-CORE.md` intro and secrets table |

## Open questions / not verified

- Contents of each draft were not legally assessed; only existence, state and conflicts with repository facts.
- No review history, redline or deviation register exists in the repository (`[CONTROLLED DEVIATION REGISTER LOCATION TO BE APPROVED]` in the matrix header).
