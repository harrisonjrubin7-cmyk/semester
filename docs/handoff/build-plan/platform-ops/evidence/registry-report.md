# Registry report — 2026-10-14 (run here over the 20 capabilities in ui_kits/scale-system)

**26 blocking · 0 warnings**

| Check | Findings |
|---|---|
| REG-001 | 20 |
| REG-003 | 5 |
| REG-008 | 1 |

- **REG-001** registration_readiness — no accountable owner
- **REG-001** course_enrollment — no accountable owner
- **REG-001** degree_planning — no accountable owner
- **REG-003** degree_planning — source-backed without a freshness policy
- **REG-001** advisor_handoff — no accountable owner
- **REG-001** action_center — no accountable owner
- **REG-003** action_center — source-backed without a freshness policy
- **REG-001** consent_sharing — no accountable owner
- **REG-001** gradebook — no accountable owner
- **REG-001** official_grades — no accountable owner
- **REG-003** official_grades — source-backed without a freshness policy
- **REG-001** housing — no accountable owner
- **REG-001** dining — no accountable owner
- **REG-001** student_payments — no accountable owner
- **REG-001** financial_aid — no accountable owner
- **REG-001** ai_gateway — no accountable owner
- **REG-008** ai_gateway — AI-enabled without a governance packet
- **REG-001** marketplace — no accountable owner
- **REG-001** counseling — no accountable owner
- **REG-001** emergency — no accountable owner
- **REG-001** policy_interpretation — no accountable owner
- **REG-001** sis — no accountable owner
- **REG-003** sis — source-backed without a freshness policy
- **REG-001** lms — no accountable owner
- **REG-003** lms — source-backed without a freshness policy
- **REG-001** identity — no accountable owner

REG-001 fails for every capability because no accountable owner is named anywhere yet — that is the first thing to fix. REG-004/005/006/009 need the screen, command, workflow and document registries in the repo.

## Update after DEC-OWNER-001
registration_readiness now has an accountable owner, so REG-001 passes for it (25 blocking remain). The other 19 capabilities still have no owner.
