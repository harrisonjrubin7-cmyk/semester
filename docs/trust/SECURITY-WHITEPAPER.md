# Semester Security Whitepaper

**Draft, version 0.1, 2026-09-28.** This is written for a university's security,
privacy and procurement reviewers. Every statement below is meant to be true of
the code in this repository today. Where a control is planned but not yet in
place, the text says so in that sentence rather than in a footnote.

**What this document does not claim.** Semester holds no SOC 2 report, ISO
27001 certificate, HIPAA attestation, PCI certification or WCAG conformance
report. It has not completed a HECVAT. "FERPA compliant" and "HECVAT
certified" are not things a vendor can be. FERPA is met by a contract and the
conduct behind it, and HECVAT is a questionnaire. If any other document states
one of these, this one is the correction.

## 1. Executive summary

Semester is a course and study workspace for university students, with an
institutional layer for pilots: SSO, LMS integration through LTI 1.3,
consented staff access, and a policy-governed AI gateway. It is run by one
owner. The engineering controls are stronger than the organizational ones:

- Tenant isolation is enforced in the database, and a schema-wide check fails
  the build if any public table lacks row-level security.
- Every change passes type, lint, test, secret-scan and database-policy gates.

What is missing is mostly operating evidence that only time and people
produce: access reviews, a restore drill, a penetration test, an ACR, signed
DPAs. [`SOC2-READINESS.md`](SOC2-READINESS.md) scores each gap.

## 2. Scope and shared responsibility

| Layer | Responsible |
| --- | --- |
| Physical data centers, host OS, managed Postgres, TLS termination | Supabase and GitHub (inherited; see [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md)) |
| Schema, row-level security, functions, application code, secrets | Semester |
| Identity provider, SSO attributes, LMS configuration | The institution |
| AI enablement and course AI policy | The institution, enforced by Semester |
| Device security, own AI keys, connected personal accounts | The student |

## 3. Company and security governance

There is one owner: the repository owner named in `SECURITY.md`, who holds
security, privacy, availability and incident response. That is a single point
of failure. It is stated here because a reviewer will find it anyway.

Operational policies exist and are held true by tests: incident response in
`SECURITY.md`, secrets in `SECRETS.md`, rollback in `ROLLBACK.md`, retention in
`RETENTION.md`. A privacy policy, acceptable-use policy, code of conduct and
risk register do not exist yet. Neither does a legal entity with insurance.
[`README.md`](README.md) tracks all of them.

## 4. Architecture overview

- **Browser.** A static single-page app, served by GitHub Pages.
- **Supabase.** Postgres 17, auth and edge functions. The browser talks to it
  directly, under row-level security.
- **Institution gateway.** A separate Node process (`app/server/institution`)
  for institutional integrations and the AI runtime.

There is no general backend tier. `docs/market-readiness/INFRASTRUCTURE_READINESS.md`
has the diagram and explains why that matters. A formal data-flow diagram is
not yet drawn.

## 5. Multi-tenant isolation

Row-level security is the isolation boundary, because the browser holds only
the publishable key.

- `supabase/rls-coverage.check.sql` fails the build if any public table has
  RLS off, if a new table escapes the RLS event trigger, if a write policy is
  simply `true`, or if a private table is reachable from a client role.
- The last full measurement found 155 of 155 public tables under RLS.
- Tenant-keyed suites (`supabase/tenancy.check.sql`, `supabase/integration-rls-matrix.check.sql`
  and others under `supabase/`) run negative cross-tenant tests.

Known gap: some older product tables scope their policies to the user rather
than the institution. Users cannot read each other's rows, but those policies
do not yet express the school boundary (HECVAT TEN-1).

## 6. Authentication and access control

- Accounts are Supabase Auth.
- Institutional sign-in uses SAML membership binding with SCIM lifecycle
  provisioning, tested in `supabase/identity-provisioning.check.sql`. No real
  institution's IdP has completed an exchange yet.
- Authorization is by capability, not role name. Grants are audited
  (`supabase/capabilities.check.sql`, `supabase/role-grant-audit.check.sql`).
- Staff access to a student's records requires the student's consent, is
  limited to named scopes, and expires (`supabase/support-access.check.sql`).

**MFA is partially enforced.** The shared server predicates require an aal2
session for platform_admin and support_agent capability grants and role-based
approval requests. The signed-in app challenges those accounts before mounting
capability-backed tools, and the operations console independently challenges
before protected reads. Verified TOTP and phone-code factors can be challenged;
TOTP can be enrolled. MFA is not yet enforced for every staff role or student
account, and production Auth and provider-console configuration evidence
has not been filed. This is not evidence of universal MFA or production-console
enforcement. The remaining product and provider-console work is tracked in the
remediation plan and still requires dated configuration evidence.

## 7. Encryption and key management

- **In transit.** TLS, terminated by GitHub Pages and Supabase.
- **At rest.** Provided by the hosting platform. The provider's configuration
  has not yet been collected as evidence.
- **Gateway journal.** Encrypted with AES-256-GCM.

Secrets live in the Supabase function-secret store. `SECURITY.md` lists every
secret, what holding it gets somebody, and how it is revoked. No
service-role credential is present in browser code, and
`app/src/lib/security.test.ts` fails if a function starts reading a secret
that inventory does not know. Rotation has not been performed on a schedule.

## 8. Application security and secure SDLC

Every change runs:

- the TypeScript build;
- oxlint plus the repository's style, label and vocabulary audits;
- a separate NodeNext typecheck of the gateway;
- the test suite, in file order and in shuffled order;
- a production build;
- the database policy suites against a real Postgres (`supabase/check.sh`).

Gitleaks scans for secrets (`.gitleaks.toml`) and Dependabot watches
dependencies (`.github/dependabot.yml`). Migrations are ordered against a
ledger snapshot so that a mis-numbered migration fails in CI
(`app/src/lib/migrationorder.test.ts`). A Content Security Policy is enforced
in the page and verified against a control (`app/src/lib/csp.test.ts`).

HawkScan DAST is configured in `.github/workflows/hawkscan.yml` against an
ephemeral local build, so active probes do not target production data. It
starts scanning once `HAWK_API_KEY` and `STACKHAWK_APPLICATION_ID` are set in
GitHub Actions; until the first completed run, DAST evidence remains pending.

## 9. Infrastructure and network security

Infrastructure is fully managed: there are no servers of Semester's own to
patch, apart from the institution gateway host. Network controls are the
providers'. There is no WAF. The gateway rate-limits requests
(`app/server/institution/rate-limit.test.ts`), and the AI function caps usage
per account.

## 10. Logging, monitoring and alerting

- **Logs.** Supabase retains a month of function, Postgres and auth logs.
- **Audit tables.** Policy changes, role grants, moderation and staff access
  are recorded in audit tables.
- **Probes.** An hourly synthetic probe checks the public app and the
  production API (`.github/workflows/production-smoke.yml`).

One alert, on AI spend, is designed to wake somebody (`MONITORING.md`).
Alerting on errors, auth failures and RLS denials is defined in
[`APM-RUNBOOK.md`](APM-RUNBOOK.md) but not yet wired.

## 11. Vulnerability management and penetration testing

Dependencies and secrets are scanned on every change. `SECURITY.md` publishes
the severity model — four severities, with a remediation target of 2, 14, 60
or 180 days — and a test holds it to the patch policy the supply-chain register
renders (HECVAT VULN-1, in progress: the targets were accepted on 29 September
2026, and no finding has yet been answered against them). No independent penetration test has been
performed (HECVAT VULN-2). Both are prerequisites for an institutional
contract.

## 12. Incident response and breach notification

`SECURITY.md` is the incident runbook for data exposure. It gives:

- how to classify the incident: key leaked, policy open, or app wrong;
- the first move for each: rotate, close the gate, roll back;
- what records exist to reconstruct what happened;
- how to notify the people affected.

Customer notice templates are in
`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`. The process has
not been exercised in a tabletop. A contractual notification deadline should
follow a tabletop, not precede it.

## 13. Business continuity, backups and disaster recovery

- **Database.** Supabase takes platform backups. No restore has ever been
  performed, so Semester states no RTO or RPO
  (`docs/market-readiness/DISASTER_RECOVERY.md`).
- **App.** Rebuilds from git in minutes.
- **Gateway journal.** Has no backup. That is the sharpest open risk.

## 14. Data privacy and retention

- Every table has a written retention answer (`RETENTION.md`, held true by
  `app/src/lib/retention.test.ts`).
- Students can export their data and delete their account, and deletion is
  tested to empty what it claims (`supabase/deletion.check.sql`).
- The privacy disclosure shown in the app is kept true by test
  (`app/src/lib/privacy.test.ts`).

Tenant-wide export and deletion at contract end do not yet exist. See
[`DPA-CHECKLIST.md`](DPA-CHECKLIST.md).

## 15. Subprocessors and vendor management

Every third party a student's data can reach is listed in
[`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md). It separates Semester's own
subprocessors from destinations an institution configures and from services a
student connects. A test holds the list to the app's Content Security Policy
and its edge functions. Counsel's review, each subprocessor's DPA and the
hosting regions are still owed, and that document says so.

## 16. AI governance and model-provider controls

Institutional AI runs through one gateway. That gateway:

- verifies tenant and person scope, and loads policy server-side;
- routes only to approved models;
- retrieves only server-held approved sources;
- requires citations to sources in the request;
- meters spend against a tenant budget;
- calls OpenAI with `store: false`;
- never writes prompts or answers to its audit journal.

Browser flags cannot enable it. Provider-generated actions are prepare-only.
See `docs/market-readiness/AI_GOVERNANCE.md` and
`supabase/intelligence-policy.check.sql`. An evaluation set and an AI incident
playbook do not exist yet.

## 17. Accessibility controls

Automated audits run in CI, at desktop width and at 320px reflow: critical
journeys, labels, landmarks, focus, dialogs, motion and contrast
(`app/scripts/accessibility-smoke.mjs`, `app/src/a11y`,
`app/src/lib/contrast.test.ts`). There has been no manual screen-reader pass
and there is no ACR. See [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md).

## 18. Customer responsibilities

The institution is responsible for:

- configuring its IdP and the attributes it releases;
- deciding which courses, cohorts and AI features are enabled;
- maintaining its LMS registration;
- telling Semester promptly when staff leave or roles change, where SCIM is
  not in use;
- handling the notification duties that the law places on the institution.

## 19. Contact and vulnerability disclosure

Security reports go to the repository owner's address, as `SECURITY.md`
states and as a `security.txt` in RFC 9116 form publishes under the deployed
app's base path, with `SECURITY.md` as its policy; origin-root discovery
waits on a domain the project controls. A dedicated security address arrives
with the company domain (D-110), and safe-harbor language waits on counsel
(HECVAT VULN-1).

## 20. Document owner, version and review

| Field | Value |
| --- | --- |
| Owner | Repository owner, per `SECURITY.md` |
| Version | 0.1 (draft) |
| Written | 2026-09-28 |
| Next review | Before the first institutional security review, and at least every six months |
| Change rule | A control's description changes in the same pull request as the control |
