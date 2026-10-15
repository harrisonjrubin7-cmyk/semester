# ISO/IEC 27001 readiness assessment

**Status:** Internal gap assessment published; Semester is **not ISO/IEC 27001 certified**.

**Assessment date:** 1 October 2026

**Owner:** Harrison Rubin, founder

**Scope:** Semester web application, company website, Supabase data plane, deployment pipeline, and documented operating controls

This is a readiness assessment, not an accredited audit, certification, or
legal opinion. It maps the management-system work visible in this repository to
the major ISO/IEC 27001:2022 ISMS lifecycle expectations without reproducing the
standard's copyrighted control text.

## Executive result

| ISMS workstream | Current evidence | Standing | What moves it |
| --- | --- | --- | --- |
| Context, scope, and interested parties | `docs/TRUST-CENTER.md`, `docs/market-readiness/EXECUTIVE_READINESS.md`, `docs/SUBPROCESSORS.md` | In progress | Approve a controlled ISMS scope statement and interested-party register |
| Leadership and accountability | `SECURITY.md`, `docs/operating-model/TRUST-BRAND-AND-LEGAL.md` | In progress | Sign an information-security policy, assign control owners, and set annual review dates |
| Risk assessment and treatment | `docs/market-readiness/HECVAT_READINESS.md`, `docs/MASTER-LAUNCH-READINESS-REGISTER.md` | In progress | Consolidate risks into one approved register with likelihood, impact, treatment, owner, due date, and acceptance record |
| Competence and awareness | `docs/market-readiness/SUPPORT_PLAYBOOK.md`, `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` | Designed | Record completed training and role competence; a written curriculum is not completion evidence |
| Document control | Version-controlled policies and tests in this repository | In progress | Establish approval, version, distribution, retention, and withdrawal rules for controlled ISMS documents |
| Operational controls | CI gates, database-policy checks, access audit, incident, retention, export, deletion, and subprocessor registers | In progress | Close the open HECVAT register rows and collect production operating evidence over time |
| Performance evaluation | `.github/workflows/production-smoke.yml`, test reports, readiness registers | In progress | Define ISMS metrics, retain results, run an internal audit, and complete management review |
| Corrective action and improvement | Issue and remediation workflows in source control | Designed | Operate a formal nonconformity/corrective-action log and verify effectiveness |

## Certification gate

Semester can claim certification only after it has operated the ISMS, completed
an internal audit and management review, corrected material gaps, and received a
valid certificate from an accredited certification body. Until that evidence is
filed, the only allowed public claim is: **"ISO/IEC 27001 readiness assessment
published; not certified."**
