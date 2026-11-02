# Semester Security Assurance Manual

> **Your versions (6 Oct) take precedence.** `user/00-MASTER-SECURITY-ASSURANCE-MANUAL.pdf`, `user/03-ACCESS-CONTROL-AND-RLS-STANDARD.pdf` and `user/05-APPLICATION-SECURITY-TESTING-AND-DEBUGGING-RUNBOOK.pdf` are the governing documents; `.txt` extractions sit beside each one. The Markdown files here fill the gaps (docs 01, 02, 04, 06–10, the registers, and the generated RLS and SECURITY DEFINER registers).
>
> **More of your documents (6 Oct, in `user/`):**
> - `RLS-AC-03-CROSS-TENANT-TEST-WALKTHROUGH`: how to run test AC-03 (cross-tenant access).
> - `APPSEC-10-COMMON-VULNERABILITIES-RUNBOOK`: 10 common student-app vulnerabilities, each with a safe validation, a fix and a regression test.
> - `ASVS-5-REQUIREMENT-MAPPING-GUIDE`: ASVS 5.0.0 has 345 requirements across 17 chapters. Take the requirement ids from the official release artifacts, never from summaries or an LLM.
> - `Security-audit-checklist`.
>
> Each is kept as a PDF with a `.txt` extraction beside it.
>
> **CI:** copy `ci/security-tests.yml` to `.github/workflows/`. It runs 6 jobs: action pins (every third-party action pinned to a commit SHA), secrets (gitleaks), dependencies (npm audit, high and above), SAST (semgrep OWASP), unit (tsc plus tests) and database (a fresh `supabase db reset` then `supabase test db` with pgTAP, plus a policy fingerprint). Any failure blocks the merge. Your matching suite, described in `user/pgTAP-Supabase-RLS-test-suite.*` (an AC-03 test, auth-token tests, a workflow and a 10-vulnerability map), wasn't attached as files. `user/pgTAP-suite-10-controls.*` describes 34 assertions across the 10 control families as a template to adapt to the schema; that ZIP wasn't attached either.
>
> **Pull requests:** copy `PULL_REQUEST_TEMPLATE.md` to `.github/PULL_REQUEST_TEMPLATE.md` in the repo. `user/OWASP-ASVS-audit-checklist-10-core.*` maps 10 core controls (C01–C10) to ASVS 5.0 chapters and tools. It describes a ZIP with its CSV, a pgTAP template and an IDOR walkthrough, which wasn't attached.
>
> `control-matrix.csv` holds your 52 controls (SEM-SEC-001 to 052, unchanged) plus 10 Semester-specific controls (SEM-SEC-053 to 062) in the same columns. Every control is NOT_VERIFIED.

Owner: [Security owner] · Approver: [Founder] · Reviewed: quarterly · Version 1.0, 6 Oct 2026

This manual governs. It links to the repository's existing documents rather than repeating them:
- **Security and secrets:** SECURITY.md, SECRETS.md
- **Operations:** MONITORING.md, ROLLBACK.md, RESTORE.md, STAGING.md
- **Audits:** AUDIT_PLAN.md, APP-AUDIT.md, ENGINEERING-AUDIT.md, FINAL-AUDIT.md
- **Release:** REGRESSION-CHECKLIST.md, EVIDENCE-REGISTER.md, LAUNCH-RISK-REGISTER.md

**Frameworks:**
- NIST SSDF (SP 800-218) for the lifecycle: prepare the organization, protect the software, produce well-secured software, respond to vulnerabilities.
- OWASP ASVS **Level 2** as the verification baseline, because Semester handles sensitive student data.

## For any risk, this manual answers
1. What asset or data is protected?
2. What can go wrong?
3. What prevents it?
4. What would reveal that the prevention failed?
5. Who owns the control?
6. How is it tested?
7. Where is the evidence kept?
8. What is the recovery or escalation path?

## Operating rules
- **No evidence, no release.**
- Controls prevent or detect failure. Tests prove the controls work. Evidence proves the tests ran. Manuals make the controls repeatable by real people.
- Deny by default at every layer: UI, API, database, storage, search, exports and integrations.
- A service-role key never reaches a browser, a ticket, a log, a screenshot or an AI prompt.

## Contents
| # | Document | Purpose |
|---|---|---|
| 01 | System boundary and data classification | What we protect, and where it lives |
| 02 | Threat model | What can go wrong, per high-risk feature |
| 03 | Access control and RLS standard | The authorization rules, and how they're proven |
| 04 | Secure development and release standard | Pull request and release gates |
| 05 | Security test plan | Layered testing |
| 06 | Incident response runbook | Severity, roles, first actions |
| 07 | Backup, restore and rollback runbook | Recovery |
| 08 | Logging, monitoring and evidence standard | Detection and proof |
| 09 | Vulnerability management | Findings to closure |
| 10 | User, admin and operator manuals | Instructions for each audience |

**Registers:**
- `control-matrix.csv`, `risk-register.csv`, `evidence-register.csv`, `access-register.csv`, `exception-register.csv`
- `RLS-COVERAGE-REGISTER.csv` and `SECURITY-DEFINER-REGISTER.csv`, both generated from the handoff SQL

## 30-day sequence
1. **Days 1–5: database authority audit.** Inventory exposed tables, RLS, policies, grants, storage rules, service-role use, triggers and SECURITY DEFINER functions. Fill in the TODO columns of both registers.
2. **Days 6–10: consolidate.** Write this manual's documents and registers, linking the existing docs.
3. **Days 11–15: automate gates.** Add RLS tests, secret scanning, dependency scanning, static analysis, migration review and staging smoke tests to CI.
4. **Days 16–20: adversarial staging review.** Test IDOR, session lifecycle, API abuse, XSS, file handling and business-logic misuse.
5. **Days 21–25: prove recovery.** Run rollback, restore and secret-rotation drills, a disabled-user test and an incident tabletop.
6. **Days 26–30: executive audit.** Review open findings, owners, exceptions, evidence and release readiness.

## Verification status
Every control starts as **NOT_VERIFIED**. It becomes **PASS** only with scoped test evidence in `evidence-register.csv` and a reviewer's approval; partial or stale evidence is **FAIL** or **EXPIRED**.

ASVS mappings in `control-matrix.csv` are **4.0.3 chapter level**, and requirement ids are deliberately left blank rather than guessed. ASVS 5.0.0 is current and its numbering differs. Map to version-qualified 5.0.0 requirement ids before making any external assurance claim.

## Compliance applicability (questions to answer, not claims)
| Regime | Applies when | Owner question |
|---|---|---|
| FERPA | Semester holds education records as a school official for an institution | Which contracts make Semester a school official, and under what direct-control terms? |
| GLBA Safeguards | An institution's student financial-aid information is processed | Does any module touch aid data covered by the institution's GLBA program? |
| State student-privacy laws (e.g. SOPIPA, SOPPA, NY Ed Law 2-d) | Students or institutions in that state | Which states are in scope per contract (Student Data Privacy Addendum, Exhibit A)? |
| State breach-notification laws | Personal information of residents | Which notice timelines are shortest across states in scope? |
| GDPR / UK GDPR | Data subjects in the EU or UK, or targeting them | Any EU/UK students, applicants or staff? |
| COPPA | Users under 13 | Is the product ever offered to under-13s? (It shouldn't be.) |
| PCI DSS | Card data | Is card data kept out of Semester's systems entirely, by using Stripe-hosted checkout? |
| Accessibility (ADA Title II/III, Section 504/508, WCAG 2.1/2.2 AA) | Public institutions and their vendors | Is a VPAT/ACR current, with which WCAG version? |
| SOC 2 / HECVAT | Requested in procurement | Which, when, and what evidence exists today? |

## Before adoption
1. Assign named owners and approvers for every control.
2. Confirm the current repository, schema, exposed resources and deployed configuration.
3. Run the authorization tests as the real application roles, not just over a privileged connection.
4. Approve the remediation deadlines and recovery targets.
5. Finish the ASVS 5.0.0 mapping.
