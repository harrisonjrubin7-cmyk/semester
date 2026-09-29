# HECVAT draft response — first draft for owner review

**Status: DRAFT, not sent.** Written 28 September 2026 from what this
repository and the production project show. Harrison reviews every row before
any of it leaves the company. The rows marked *Company to supply* need him to
write the answer.

## What this is and is not

HECVAT is EDUCAUSE's questionnaire. A university sends its own copy of the
workbook, and the answers go into that workbook. This file is where the answers
are prepared and checked first. The question wording here is a paraphrase
grouped by HECVAT 4's areas, and the IDs are this file's own. **Map each row to
the workbook's question ID when you fill it in.** Don't assume they match.

A **No** is an acceptable answer. Reviewers read a No with a plan far more
kindly than a Yes they later find to be false, and the workbook has room for
the plan. Each No below says what would change it.

## The rules this file is held to

`app/src/lib/hecvat-draft.test.ts` parses the table and fails when:

- an answer is not one of **Yes**, **Partial**, **No**, **N/A** or
  **Company to supply**;
- a cited path (in backticks) does not exist;
- a row cites a register control (`HECVAT XXX-n`) that
  [`HECVAT_READINESS.md`](HECVAT_READINESS.md) does not have;
- a **Yes** rests on a register control that is not `READY` there, or cites
  nothing at all;
- an explanation uses certification language that nothing supports ("compliant",
  "certified", "guarantee"…), checked by the same function the RFP library uses.

When a register row moves, the answer that rests on it can move in the same
commit, and not before.

## Answers

| ID | Area | Question (paraphrased) | Answer | Explanation | Basis |
| --- | --- | --- | --- | --- | --- |
| COMP-01 | Company | Legal name, ownership, size, years in operation | Company to supply | A single-member LLC, wholly owned by its founder, Harrison Rubin, with one person working in it (owner attestation, 28 September 2026). Still to add: the LLC's exact legal name, its state of formation and its formation date. | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` |
| COMP-02 | Company | Named person accountable for information security | Partial | Harrison Rubin, founder and sole owner, is accountable for information security. No annual policy review date has been set yet. Add a contact address per response. | HECVAT GOV-1 |
| COMP-03 | Company | Cyber liability insurance | No | No policy is held. A certificate will be filed under `docs/evidence/` once one is bought. | HECVAT LEGAL-2 |
| DOCU-01 | Documentation | Independent audit report (SOC 2 Type II, ISO 27001) | No | Neither exists or is claimed, and neither is planned before a first pilot. This questionnaire and the readiness register are offered instead. | HECVAT LEGAL-1, `docs/market-readiness/HECVAT_READINESS.md` |
| DOCU-02 | Documentation | Written information security policy set | Partial | Security, secrets, incident and rollback procedures are written and in use. A consolidated policy with an owner and an annual review date is still a draft. | `SECURITY.md`, `SECRETS.md`, `ROLLBACK.md`, HECVAT GOV-1 |
| DOCU-03 | Documentation | Risk register reviewed on a schedule | No | Gaps are recorded per area in the readiness documents; a single register with owners and review dates has not been started. | HECVAT GOV-2 |
| APPL-01 | Application security | Secure development lifecycle with automated gates on every change | Yes | Every change runs type, lint, unit, randomised-order and database-policy checks in CI. | `.github/workflows/ci.yml`, `supabase/check.sh`, HECVAT SDLC-1 |
| APPL-02 | Application security | Secret scanning and dependency vulnerability scanning | Yes | Gitleaks scans every pull request and the working tree; Dependabot watches dependencies. | `.gitleaks.toml`, `.github/dependabot.yml`, HECVAT SDLC-2 |
| APPL-03 | Application security | Content Security Policy | Yes | A CSP is set in the page and verified against a control in tests. The host cannot set headers, so directives that only work as headers are not in force. | `app/src/lib/csp.test.ts`, HECVAT WEB-1 |
| APPL-04 | Application security | Independent penetration test in the last 12 months | No | None has been performed. A scoped external test is planned; its summary and remediation plan will be shared under NDA. | HECVAT VULN-2 |
| APPL-05 | Application security | Published vulnerability disclosure contact and patch timelines | Partial | A security.txt in RFC 9116 form names the contact and points at the written policy, which sorts findings into four severities with a remediation target each. It is served under the app's base path rather than an origin root, so it is linked from the site rather than found by scanners. The targets are internal and no finding has yet been answered against them. | `app/public/.well-known/security.txt`, `SECURITY.md`, HECVAT VULN-1 |
| AAAI-01 | Access | Institutional single sign-on (SAML) | Partial | Built and tested at the database: one identity provider per institution, first sign-in bound to a provisioned membership. No institution's IdP has completed a live exchange yet. | HECVAT IAM-1 |
| AAAI-02 | Access | Role-based, least-privilege access with audited grants | Yes | Access is granted by named capability over a scope, every grant is audited, and the database checks the capability on each protected read and write. | HECVAT IAM-2 |
| AAAI-03 | Access | Periodic access reviews with retained evidence | No | Not yet scheduled. A quarterly review of role grants, keeping each export, is the plan. | HECVAT IAM-3 |
| AAAI-04 | Access | Multi-factor authentication on staff and administrative accounts (GitHub, Google, Supabase) | Yes | The owner attests that multi-factor sign-in is on for GitHub, Google and Supabase, the only administrative accounts (28 September 2026). Nobody has checked this independently; keep a screenshot of each account's security page as evidence. | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` |
| AAAI-05 | Access | Audit logging of administrative and policy changes | Yes | Role, moderation and support-access changes are written to append-only audit tables, checked by database suites. | HECVAT LOG-1 |
| CHNG-01 | Change management | Every production change is reviewed by a second person | No | One-person team. A ruleset requiring review and passing checks is written but not yet applied in GitHub's settings. Every change does pass CI before merge. | `.github/workflows/ci.yml`, `docs/BRANCH-PROTECTION.md` |
| CHNG-02 | Change management | Documented rollback procedure | Partial | Written, and a page rollback has been performed. Database schema changes do not roll back, and the procedure says so. | `ROLLBACK.md` |
| DATA-01 | Data | Tenant isolation between institutions | Partial | Enforced and tested with cross-tenant negative checks for the institutional data layer; older student-owned tables are isolated per account and not yet keyed to the institution. | `supabase/tenancy.check.sql`, HECVAT TEN-1 |
| DATA-02 | Data | Row-level security on every table | Yes | Row-level security is on for every table in the public schema, turned on by default by an event trigger, and swept by a database suite in CI. | `supabase/rls-coverage.check.sql`, `supabase/check.sh` |
| DATA-03 | Data | Encryption in transit | Yes | All traffic is HTTPS: static hosting, database API and functions. | `docs/market-readiness/INFRASTRUCTURE_READINESS.md` |
| DATA-04 | Data | Encryption at rest | Partial | The database host encrypts at rest; that configuration has not yet been recorded as evidence. Institutional action bodies are also encrypted by the gateway before storage. | HECVAT CRYPTO-1 |
| DATA-05 | Data | Data inventory and retention schedule | Yes | Every table has a written retention answer, and a test fails when a table is added without one. | `RETENTION.md`, HECVAT PRIV-1 |
| DATA-06 | Data | Where data is stored | Yes | The production database is Supabase in us-west-2, United States (read from the project on 28 September). The web app is static files on GitHub Pages. AI requests are processed by the providers in the subprocessor list; check their regions before answering a residency question. | `docs/SUBPROCESSORS.md` |
| DATA-07 | Data | Return and deletion of institutional data at contract end | Company to supply | Students can export and delete their own data today. The contractual return-and-destroy terms belong in the DPA, which counsel has not drafted. | HECVAT PRIV-4 |
| HOST-01 | Hosting | Hosting providers and their assurance reports | Partial | Supabase, GitHub and Vercel publish their own SOC 2 reports; request them from each provider. Semester does not hold its own report. | `docs/SUBPROCESSORS.md` |
| HOST-02 | Hosting | Separate staging environment | No | Local and per-change preview databases exist; a staging tier on the production Postgres version does not. | `docs/market-readiness/INFRASTRUCTURE_READINESS.md` |
| BCDR-01 | Continuity | Backups of production data | Partial | Daily platform backups with 7-day retention per the plan tier's documentation (the tier read as Pro on 29 September 2026 through the organization record); the figure is not yet read from the project dashboard on a dated occasion, and `RESTORE.md`'s table is where that goes. Point-in-time recovery is not confirmed. | `RESTORE.md`, `RETENTION.md` |
| BCDR-02 | Continuity | Restore tested, with stated RTO and RPO | No | A restore rehearsal passes in CI and a production restore drill is scripted; no drill against production has been run and timed, so no objectives are stated. | `supabase/restore.sh`, `supabase/restore-drill.sh`, HECVAT BCP-1 |
| BCDR-03 | Continuity | Monitoring of production availability | Partial | An hourly synthetic check probes the app and the database API, and a public status page checks the same things live. No alert is yet proven to reach a named person. | `.github/workflows/production-smoke.yml`, `app/public/status.html`, HECVAT MON-1 |
| BCDR-04 | Continuity | Contractual uptime commitment | No | None offered before a first pilot. | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md` |
| INCD-01 | Incidents | Written incident response plan with roles | Partial | Written, with severities, first moves and notice templates. It has not been exercised in a tabletop. | `docs/market-readiness/INCIDENT_RESPONSE.md`, HECVAT IR-1 |
| INCD-02 | Incidents | Notification of affected parties after a data exposure | Yes | Every affected account is emailed within 72 hours of confirming exposure, saying what was readable, for how long, whether it was read and what to do. Institution contacts are notified alongside. | `SECURITY.md`, `docs/trust/APM-RUNBOOK.md` |
| VULN-01 | Vulnerabilities | Severity model with remediation deadlines | Partial | Four severities with a remediation target each (2, 14, 60 and 180 days), the same table for a report from outside and a dependency advisory, held to each other by test. Accepted internal targets since 29 September 2026 (D-124); not yet a contractual commitment, and no finding has yet been answered inside its clock. | `SECURITY.md`, `app/src/lib/supplychain.ts`, HECVAT VULN-1 |
| PRIV-01 | Privacy | Signed DPA with FERPA school-official terms | No | None signed; counsel drafts one on request. Semester describes its controls and leaves any FERPA judgment to the institution's counsel. | HECVAT PRIV-4 |
| PRIV-02 | Privacy | Student data sold, used for advertising, or used for risk scoring | No | None of the three, and the privacy disclosure is held to the code by a test. | `app/src/lib/privacy.ts`, HECVAT PRIV-3 |
| PRIV-03 | Privacy | Students can export and delete their own data | Yes | A portable export, including what the server holds, and deletion that erases every row in one transaction and then removes the sign-in identity, proven by a database check. The `delete-account` function was confirmed active in production on 28 September. | `supabase/deletion.check.sql`, `supabase/functions/delete-account/index.ts`, HECVAT PRIV-2 |
| PRIV-04 | Privacy | Minimum-necessary sharing with institution staff, with consent and audit | Yes | Students see exactly what is sent before sending; only staff answering for that office can read it; every open is shown to the student. | HECVAT PRIV-6 |
| THRD-01 | Third parties | Published list of subprocessors | Partial | The list exists and is held to the code by a test; it is not published until counsel reviews it. | `docs/SUBPROCESSORS.md`, HECVAT PRIV-5 |
| THRD-02 | Third parties | Vendor risk assessment of subprocessors | No | A register of every subprocessor with its tier exists; no vendor has been assessed yet. | `docs/trust/VENDOR-RISK-REGISTER.md` |
| ITAC-01 | Accessibility | Current VPAT / Accessibility Conformance Report | No | No ACR exists; a formal evaluation comes first. Semester makes no WCAG conformance claim. | HECVAT A11Y-2 |
| ITAC-02 | Accessibility | Automated accessibility testing | Yes | Automated audits of critical journeys in a real browser at desktop and 320-pixel widths run in CI, with contrast checks. | `app/scripts/accessibility-smoke.mjs`, HECVAT A11Y-1 |
| ITAC-03 | Accessibility | Manual assistive-technology testing | No | No recorded screen-reader pass yet; NVDA and VoiceOver passes of critical journeys are planned. | HECVAT A11Y-3 |
| ITAC-04 | Accessibility | Route for users to report accessibility barriers, with fix times | No | Not yet published. | HECVAT A11Y-4 |
| AIML-01 | AI | AI features and how they are governed | Partial | Institutional AI runs only through a provider the institution approves, off until it is turned on, with a metered budget; the student study toolkit is on with code execution and external connectors off. | `docs/market-readiness/AI_GOVERNANCE.md`, HECVAT AI-1 |
| AIML-02 | AI | Institutional or student data used to train models | No | Semester does not use student data to train models. AI requests go to providers under API terms; confirm each provider's current no-training terms before sending. | `app/src/lib/privacy.ts` |
| AIML-03 | AI | Evaluation for accuracy and bias | No | No evaluation set or results yet; one built from approved course sources is planned. | HECVAT AI-2 |
| AIML-04 | AI | AI-specific incident response | No | Not yet written. | HECVAT AI-3 |

## Owner attestations

Facts only the owner can supply, recorded as given, with the date given.
They are statements, not verified evidence; a reviewer who asks for proof
gets the screenshots or filings behind them.

| Date | Fact | Rows |
| --- | --- | --- |
| 28 September 2026 | Semester is a single-member LLC, 100% owned by Harrison Rubin. | COMP-01, COMP-02 |
| 28 September 2026 | Multi-factor sign-in is on for the GitHub, Google and Supabase accounts. | AAAI-04 |

## Before this goes to anyone

1. Fill in every *Company to supply* row.
2. Recheck CHNG-01 against the repository's branch settings, and AIML-02 against each AI
   provider's terms on the day you send.
3. After running `supabase/restore-drill.sh`, update BCDR-02 and the register's
   BCP-1 row from its output.
4. Copy each answer into the university's own workbook, under that workbook's
   question IDs.
