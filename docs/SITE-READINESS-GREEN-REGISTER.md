# Site readiness green register

Reviewed: 2026-10-01  
Scope: public company-site readiness, procurement, accessibility, legal-draft, and supply-chain claims

This register records what Semester can truthfully mark green from repository evidence. Green means the named artifact or automated control exists and is reviewable. It does not turn a draft into signed terms, a self-assessment into an independent audit, a controlled test into production capacity, or a product integration into an activated customer connection.

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
