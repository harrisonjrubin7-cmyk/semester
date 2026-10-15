# Semester NIST SP 800-53 Rev. 5 readiness matrix — controlled draft

- **Status:** `SELECTIVE MAPPING / NO CONFORMANCE CLAIM`
- **Owner:** Security/GRC owner with Privacy, Engineering, Operations, Legal, and customer control owners
- **Evidence date:** 2026-10-03
- **Baseline/tailoring:** `[CUSTOMER OR PROGRAM TO DEFINE]`

NIST SP 800-53 is a control catalog. Applicability depends on system boundary, baseline, overlays, organization-defined parameters, inherited controls, roles, and assessment method. Semester does not claim full-catalog implementation, federal authorization, FedRAMP status, or NIST certification.

## Family-level readiness

| Families | Semester control sources | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| PM/PL/RA/CA | security program, asset/threat/risk/treatment, evidence and release controls | system boundary, tailored baseline, assessors and POA&M incomplete | `PARTIAL` | Executive/Security | customer boundary, tailoring and assessment plan |
| AC/IA | access, IAM, password/session/MFA, SSO/SCIM, capability and tenant controls | provider configuration, access reviews and target UAT absent | `PARTIAL` | IAM/Security | target identity lifecycle and two-tenant test |
| AU/SI/IR | logging/monitoring, vulnerability/testing, incident plan/runbook | staffed alerts, target DAST, independent test and tabletop absent | `PARTIAL` | Security/Operations | operated events/findings/incident evidence |
| SC/SA/SR/CM | encryption/key, SDLC, supplier, change/release and configuration sources | provider assurance, provenance and complete vendor operation incomplete | `PARTIAL` | Engineering/Security/Vendor | candidate/provider/vendor assessment evidence |
| CP/MA/PE/MP | continuity, backup/restore/rollback, asset and data-lifecycle sources | live-backup restore, physical/device/media scope and RTO/RPO absent | `PARTIAL/NOT SCOPED` | Operations/Security | boundary-specific recovery and non-cloud applicability |
| AT/PS/PT/PI | training/people controls, privacy program, processing/data governance | staffing, training records, privacy roles/bases and assessments incomplete | `PARTIAL` | Executive/Privacy | personnel/training and privacy assessment evidence |

## Control-level record

`[CONTROL/ENHANCEMENT]`, applicability/rationale, control statement and parameters, implementation status, responsible/inherited provider, code/config evidence, operational evidence, assessment procedure/result, deficiency/risk, remediation/POA&M, customer-specific configuration, last/next review, approver and evidence sensitivity.

## Claim ceiling and activation blockers

Permitted: “Semester can selectively map evidence to relevant NIST SP 800-53 Rev. 5 families after a buyer defines the system boundary and baseline.” Prohibited: NIST compliant/certified, full 800-53 coverage, FedRAMP authorized/ready, assessed control effectiveness, or an approved POA&M. Blocks: authoritative buyer boundary; baseline/overlays/parameters; inherited-control/provider evidence; control-level mapping; assessors/methods; target evidence; deficiencies/POA&M; privacy tailoring; and authorized acceptance.
