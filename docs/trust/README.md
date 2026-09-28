# Trust and Procurement Package

This is what a university's security, privacy, accessibility and procurement
reviewers ask for, laid out as a procurement room, with every item pointing
at the file that answers it or marked **Absent**.

It was built from an outside brief. That brief asked for a security
whitepaper, a DPA, a pilot agreement, an SLA, a SOC 2 readiness matrix,
monitoring runbooks, a HECVAT/VPAT plan and a four-level enterprise roadmap.
Where this repository already had the answer, the room points at it rather
than copying it. `docs/market-readiness/` and `docs/market-readiness/HECVAT_READINESS.md`
remain the operating registers. This folder is what gets handed across the
table.

**Three rules hold for everything here:**

1. **No certification claims.** Semester has no SOC 2 report, no ACR, no
   penetration test, no signed DPA, and no insurance. It has not completed a
   HECVAT. Where one of those appears below, it says Absent.
2. **Legal documents are outlines for counsel.** Nothing in this folder is
   contract language anyone should sign as written.
3. **Every path cited in this folder exists.** `app/src/lib/trust.test.ts`
   fails when one does not, and it enforces the scoring rules in
   [`SOC2-READINESS.md`](SOC2-READINESS.md). The SLA figures are checked
   against code by `app/src/lib/sla.test.ts`.

## Start here

| Document | What it is |
| --- | --- |
| [`ENTERPRISE-READINESS.md`](ENTERPRISE-READINESS.md) | The four readiness levels, what "done" means at each, and where Semester is |
| [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md) | The 20-section whitepaper, true to the tree, gaps stated inline |
| [`SOC2-READINESS.md`](SOC2-READINESS.md) | Gap assessment: CC1, CC6 and A1 checklists, scored, plus the HECVAT v4 mapping and a 12-month plan |
| [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md) | FERPA school-official checklist, DPA clause requirements, and starting language for counsel |
| [`SLA.md`](SLA.md) | Availability formula, downtime tables, recommended SLA, credit schedule, exclusions |
| [`APM-RUNBOOK.md`](APM-RUNBOOK.md) | Target telemetry and alert thresholds, marked with what exists; the incident runbook |
| [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) | Sections for a 90-day pilot agreement, sample scope, scorecard |
| [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md) | HECVAT workstreams, a 90-day plan, and the VPAT/ACR checklist |
| [`VENDOR-REGISTER.md`](VENDOR-REGISTER.md) | Every outside service the code sends data to, with the diligence still owed |
| [`BRIDGE-LETTER.md`](BRIDGE-LETTER.md) | The SOC 2 bridge-letter process, for when a report exists |

## The procurement room

<!-- trust:room -->
| Folder | Item | Status | Where |
| --- | --- | --- | --- |
| Company | Legal entity | Absent | — |
| Company | Insurance certificates | Absent | — |
| Company | Executive and security contacts | Partial | `SECURITY.md` |
| Security | Security whitepaper | Draft | `docs/trust/SECURITY-WHITEPAPER.md` |
| Security | HECVAT 4 response | Register only | `docs/market-readiness/HECVAT_READINESS.md` |
| Security | Architecture diagram | Partial | `docs/market-readiness/INFRASTRUCTURE_READINESS.md`, `docs/ARCHITECTURE.md` |
| Security | Data-flow diagrams | Absent | — |
| Security | Penetration-test summary | Absent | — |
| Security | Secure SDLC policy | Partial | `REGRESSION-CHECKLIST.md`, `.github/workflows/ci.yml` |
| Security | Incident response plan | Written, not exercised | `SECURITY.md`, `docs/market-readiness/INCIDENT_RESPONSE.md` |
| Security | Business continuity and DR summary | Not started | `docs/market-readiness/DISASTER_RECOVERY.md` |
| Security | Vulnerability disclosure policy | Absent | — |
| Security | SOC 2 readiness | Gap assessment | `docs/trust/SOC2-READINESS.md` |
| Privacy | Privacy Policy | Absent | — |
| Privacy | DPA | Checklist for counsel | `docs/trust/DPA-CHECKLIST.md` |
| Privacy | Data inventory and retention | Written, tested | `RETENTION.md` |
| Privacy | Subprocessor list | Written, diligence owed | `docs/trust/VENDOR-REGISTER.md` |
| Privacy | FERPA data-use statement | Partial | `docs/FERPA-IDENTITY-GUARDRAILS.md`, `docs/trust/DPA-CHECKLIST.md` |
| Privacy | Export and offboarding plan | Partial | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` |
| Accessibility | VPAT/ACR | Absent | `docs/trust/HECVAT-VPAT-PLAN.md` |
| Accessibility | Accessibility statement | Absent | — |
| Accessibility | Testing methodology | Written, in CI | `docs/market-readiness/ACCESSIBILITY_READINESS.md` |
| Accessibility | Known issues and remediation SLA | Absent | — |
| AI | AI governance brief | Written | `docs/market-readiness/AI_GOVERNANCE.md` |
| AI | Model and provider inventory | Written | `docs/trust/VENDOR-REGISTER.md` |
| AI | Evaluation and red-team summary | Absent | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` |
| AI | AI incident plan | Absent | — |
| Operations | SLA | Framework only | `docs/trust/SLA.md` |
| Operations | Support policy | Playbook | `docs/market-readiness/SUPPORT_PLAYBOOK.md` |
| Operations | Status page | Absent | — |
| Operations | Change management | Written | `docs/operating-model/CHANGE-MANAGEMENT.md`, `ROLLBACK.md` |
| Operations | Monitoring and incident runbook | Partial | `MONITORING.md`, `docs/trust/APM-RUNBOOK.md` |
| Operations | Implementation plan | Playbook | `docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md` |
| Interoperability | LTI 1.3 architecture | Written, tested | `docs/LTI-1.3-LAUNCH-RUNBOOK.md` |
| Interoperability | SSO architecture | Written, tested | `docs/INSTITUTIONAL-SSO-ARCHITECTURE.md` |
| Interoperability | SIS/LMS adapter catalog | Registry empty by design | `docs/market-readiness/INTEGRATION_READINESS.md` |
| Interoperability | OneRoster, QTI, Common Cartridge plan | Roadmap | `docs/LMS-LEARNING-ROADMAP.md` |
| Interoperability | Migration plan | Playbook | `docs/market-readiness/MIGRATION_PLAYBOOK.md` |
| Contracts | MSA and order form | Absent | — |
| Contracts | Pilot SOW | Outline for counsel | `docs/trust/PILOT-AGREEMENT-OUTLINE.md` |
| Contracts | DPA and security addendum | Checklist for counsel | `docs/trust/DPA-CHECKLIST.md` |
| Contracts | SLA and support schedule | Framework only | `docs/trust/SLA.md` |

## What blocks a signature, and none of it is code

Engineering is ahead of everything in this list, and this list is what stops
an institution signing:

1. A legal entity to be the contracting party.
2. Cyber-liability insurance (HECVAT LEGAL-2).
3. A DPA drafted by counsel (HECVAT PRIV-4). The 1EdTech DPSA template is
   the place to start.
4. A penetration test by an independent firm (HECVAT VULN-2).
5. An ACR from a human evaluation (HECVAT A11Y-2).
6. A restore drill, timed, so an RTO and RPO can be stated (HECVAT BCP-1).
7. A privacy policy, terms of service and a vulnerability disclosure policy.

The order matters. Items 1 and 2 come before a pilot conversation turns into
paperwork. Item 6 is an afternoon's work and the cheapest credibility in this
list.

## Readiness is reached when Semester can truthfully say

- We know what data we process.
- We isolate every tenant and user.
- We can explain every AI use.
- We can show sources and control data sharing.
- We can monitor and respond when something fails.
- We can restore data and recover a service.
- We can support a real course cohort.
- We can export and delete data when the contract ends.
- We can document our security, accessibility, privacy and operations.

Today the first three are true, and the rest are not yet. That is the point to
start sending this package: when they are all true, not before.
