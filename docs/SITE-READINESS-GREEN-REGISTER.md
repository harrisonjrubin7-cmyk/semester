# Site readiness green register

Reviewed: 2026-10-03
Scope: public company-site readiness, procurement, accessibility, legal-draft, and supply-chain claims

This register records what Semester can truthfully mark green from repository evidence. Green means the named artifact or automated control exists and is reviewable. It does not turn a draft into signed terms, a self-assessment into an independent audit, a controlled test into production capacity, or a product integration into an activated customer connection.

## P04 repository and artifact validation — 2026-10-03

The focused public-site pass at `d246a348` passed **16 files and 213 tests**, covering generated routes and links, claim statuses and prohibited claims, legal-draft labels, contact routing, privacy/consent behavior, current site tools, and the legacy company-site safeguards. The static build then emitted **55 files** successfully for `https://www.semester.website` with the candidate revision/date stamped into the artifact.

The emitted site has no third-party analytics or tracking endpoint. Its ordinary pages ship no script; its six local tool pages have one same-origin script and `connect-src 'none'`. The current generated contact path is email rather than an on-site form, and explicitly says nothing typed is stored by the site. Legacy lead-form tests still verify optional update consent and privacy-respecting attribution, but do not prove message delivery or an operated response.

Artifact inspection found and corrected two unqualified institutional replacement claims. The institution and pricing pages now describe a pilot beside existing systems, keep LMS/gradebook authority off until a separately approved cutover, and state that no institutional connection is live. A regression test prevents the removed wording from returning.

This is source and generated-artifact evidence only. It does not prove the currently deployed company-site revision, external link/delivery behavior, inbox staffing, consent operations, production analytics absence, legal effectiveness, customer acceptance or institutional activation. HawkScan was also unavailable on this host: there is no Hawk runtime/tool and `HAWK_API_KEY` is absent, so no DAST pass is claimed; P07 retains the scan gate.

## Evidence-backed green items

| Site claim | Reviewable evidence | What green means | Explicit limitation |
|---|---|---|---|
| Auth and row-level-security baseline | `.github/workflows/ci.yml`; `supabase/check.sh`; policy suites under `supabase/tests/` | Migrations and policy checks run in CI and fail closed | Not an independent penetration test or live-database audit |
| Accessibility automated baseline | `docs/WCAG-UI-AUDIT-SCORECARD.md`; `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`; accessibility and contrast CI jobs | Automated and self-assessed evidence is published | Not a formal ACR; manual assistive-technology testing and external evaluation remain open |
| Backup and restore rehearsal | `.github/workflows/ci.yml`; `supabase/restore.sh`; `docs/evidence/restore/2026-09-30-logical-rehearsal.md` | A dump, restore, and comparison run in controlled CI | Not a timed drill against production infrastructure |
| Load and concurrency baseline | `.github/workflows/ci.yml`; `supabase/load.sh`; `docs/LOAD-AND-SOAK.md` | Repeated database scenarios enforce invariants, latency ceilings, and drift checks | Not production peak or end-to-end PostgREST/Edge capacity certification |
| HECVAT evidence inventory | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`; `docs/market-readiness/HECVAT_READINESS.md`; `docs/trust/EVIDENCE-REGISTER.md` | A draft response and mapped evidence set exist | Customer workbook completion and reviewer acceptance remain external |
| FERPA alignment assessment | `docs/compliance/FERPA-ALIGNMENT-ASSESSMENT.md` | Current control alignment is documented | FERPA has no product certification; institutional counsel and contracts remain external |
| ISO 27001 readiness assessment | `docs/compliance/ISO-27001-READINESS-ASSESSMENT.md` | A gap assessment is published | No ISO 27001 certificate or certification audit exists |
| VPAT-style accessibility self-assessment | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md` | A scoped self-assessment is available for review | It is not a formal ACR or third-party conformance finding |
| Procurement responses | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`; `docs/market-readiness/`; `docs/trust/` | Draft response material is published and reviewable | Counsel, insurer, auditor, and customer approvals remain separate |
| Legal and policy drafts | `docs/legal/`; `docs/trust/SLA.md`; `docs/SUBPROCESSORS.md`; `docs/trust/DPA-CHECKLIST.md` | Named drafts, proposed terms, or registers exist | Drafts are not in-force agreements; the student-data addendum and DPA agreement still require counsel |
| Staff pilot training package | `docs/launch/FACULTY-QUICK-START.md`; `docs/launch/ADVISOR-QUICK-START.md`; `docs/launch/ADMIN-OPERATIONS-GUIDE.md`; `docs/launch/FIRST-DAY-CHECKLISTS.md` | Role-specific written material exists and passes the launch-package checks | Delivery, attendance and customer acceptance require a named pilot |
| Pilot measurement worksheet | `docs/launch/PILOT-MEASURES-BASELINE-WORKSHEET.md` | A fillable scope, method, baseline, threshold and decision record is ready | No measure is agreed and no baseline exists until a customer completes it |
| Immutable CI action pins | `.github/workflows/*.yml` | Third-party workflow actions use full commit hashes | Repository ruleset activation remains a GitHub owner setting |
| Release SBOM | `.github/workflows/pages.yml`; `app/package.json`; `app/src/lib/supplychain.test.ts` | Pages builds generate a CycloneDX SBOM and retain it for 90 days | No signed provenance statement is claimed |

## Still not green by repository work alone

These are real gates, not stale copy. They stay non-green until the named event happens:

- Google sign-in and Google, Microsoft, or Zoom connections: live provider credentials, consent, and activation.
- School SSO, SIS, LMS, or official-data connections: a participating institution and acceptance evidence.
- Paid plans beyond the available checkout: product and commercial activation evidence.
- A full self-serve export/deletion experience: verified end-to-end product behavior.
- External accessibility audit or formal ACR: qualified independent evaluation.
- SOC 2 or ISO 27001: an auditor or certification body and the resulting report or certificate.
- Production restore, incident, support, and disaster-recovery exercises: an authorized live environment and dated exercise record.
- Institution UAT and pilot outcomes: a real pilot school, consented participants, and agreed baselines.
- Branch-protection enforcement and organization ownership: GitHub account-owner configuration.
- Counsel-approved DPA, student-data addendum, and in-force public legal terms: legal review and execution.

## Rule for the site

A status may be green only when its label names the thing that is actually complete. Where a larger outcome remains open, the green label names the evidence already available and the adjacent copy states the external or future gate.
