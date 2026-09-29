# HECVAT 4 Readiness Register

**Status: `IN_PROGRESS`** — a register of what a higher-ed security, privacy,
accessibility and AI review will ask, and what this repository can show today.

HECVAT is an assessment questionnaire, not a certification. Nothing here
claims compliance with anything. Each row is one control a reviewer will ask
about, its status in the vocabulary of `SEMESTER_MARKET_READINESS.md`, the
files that prove the status, and what would move it.

## The rules this file is held to

`app/src/lib/hecvat-readiness.test.ts` parses the table below and fails when:

- a status is outside the five-word vocabulary;
- a row cites a path (in backticks) that does not exist in the tree;
- a row is `READY` or `TESTING` with no existing path cited — "it looks done" is
  not evidence;
- a row is `NOT_STARTED` or `BLOCKED` without saying what would move it;
- a row whose evidence can only come from **outside** this repository — an
  ACR/VPAT, a penetration test, a SOC 2 report, a signed DPA, insurance — is
  above `IN_PROGRESS` without a file under `docs/evidence/` cited. Those are
  documents a third party produces or a counterparty signs; the code cannot
  earn them, and this file must never be the place they get invented.

Raise a status by changing its evidence in the same commit.

The answers prepared from this register for a university's workbook are in
[`HECVAT_DRAFT_RESPONSE.md`](HECVAT_DRAFT_RESPONSE.md).

## Register

| ID | Domain | Control | Status | Evidence | What moves it |
| --- | --- | --- | --- | --- | --- |
| GOV-1 | Governance | Named security owner, reviewed policy set | `IN_PROGRESS` | `SECURITY.md`, `SECRETS.md`, `docs/market-readiness/SECURITY_READINESS.md` | Name an accountable owner and an annual review date; no named owner exists yet |
| GOV-2 | Governance | Risk register reviewed on a schedule | `NOT_STARTED` | — | Start a register from the gaps already written in `docs/market-readiness/`, with owner and review date per risk |
| SDLC-1 | Secure SDLC | Every change runs policy, type, lint and test gates in CI | `READY` | `.github/workflows/ci.yml`, `supabase/check.sh`, `REGRESSION-CHECKLIST.md` | — |
| SDLC-2 | Secure SDLC | Secret scanning and dependency scanning | `READY` | `.gitleaks.toml`, `.github/dependabot.yml`, `.github/workflows/ci.yml` | — |
| VULN-1 | Vulnerability management | Written severity model and patch SLAs, public disclosure contact | `IN_PROGRESS` | `SECURITY.md`, `app/public/.well-known/security.txt`, `app/src/lib/supplychain.ts`, `app/src/lib/security.test.ts` | The contact is published (a security.txt in RFC 9116 form, linked from the site's `/security/` page) and the four severities carry remediation targets held to the patch policy by test. The file sits under the app's base path, not at the origin root scanners start from, so automatic discovery waits on a domain the project controls. The targets were accepted unchanged by the founder acting in the security seat on 29 September 2026 (D-124); no finding has been worked against them yet: a record of findings answered inside their clocks, then `TESTING` |
| VULN-2 | Vulnerability management | Independent penetration test with remediation plan | `NOT_STARTED` | — | Commission a scoped external test; file its executive summary under `docs/evidence/` |
| IAM-1 | Identity | Institutional SSO with lifecycle provisioning | `TESTING` | `supabase/migrations/20260924150142_institution_identity_provisioning.sql`, `supabase/migrations/20260924154500_bind_institution_sso_membership.sql`, `supabase/identity-provisioning.check.sql` | A live SAML exchange with a real institution's IdP, recorded |
| IAM-2 | Identity | Least privilege by capability, not role name, with audited grants | `READY` | `supabase/migrations/20260922012000_capabilities.sql`, `supabase/capabilities.check.sql`, `supabase/role-grant-audit.check.sql` | — |
| IAM-3 | Identity | Periodic access review with retained evidence | `NOT_STARTED` | — | Define a quarterly review of `role_grants` and keep each review's export |
| TEN-1 | Tenant isolation | Cross-tenant negative tests at the database | `IN_PROGRESS` | `supabase/tenancy.check.sql`, `supabase/expansion.check.sql`, `supabase/help-requests.check.sql` | Older direct-to-Supabase product tables do not yet key their policies to the school; see *Multi-tenancy* in `SEMESTER_MARKET_READINESS.md` |
| CRYPTO-1 | Encryption | TLS in transit; encryption at rest; encrypted gateway journal | `IN_PROGRESS` | `app/server/institution`, `docs/market-readiness/INFRASTRUCTURE_READINESS.md` | Record the hosting provider's at-rest encryption configuration as evidence rather than as an assumption |
| WEB-1 | Application security | Content Security Policy, verified against a control | `READY` | `app/src/lib/csp.test.ts`, `app/index.html` | Header-only directives wait on a host that sets headers |
| LOG-1 | Logging | Immutable audit of institutional policy, role and moderation changes | `READY` | `supabase/role-grant-audit.check.sql`, `supabase/moderation-audit.check.sql`, `supabase/support-access.check.sql` | — |
| IR-1 | Incident response | Written process, roles and customer notice templates | `IN_PROGRESS` | `docs/market-readiness/INCIDENT_RESPONSE.md`, `docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`, `docs/vanderbilt/incident-routing.md` | Run and record a tabletop exercise; nothing has exercised the process |
| BCP-1 | Resilience | Backup restore performed and timed; stated RTO/RPO | `NOT_STARTED` | — | Run `supabase/restore-drill.sh` against the second project, as `RESTORE.md` lays out, and record its output; no restore of production data has ever been performed |
| MON-1 | Reliability | Synthetic monitoring of production | `IN_PROGRESS` | `.github/workflows/production-smoke.yml`, `MONITORING.md`, `app/public/status.html` | Retained availability history and an alert that reaches an accountable person |
| PRIV-1 | Privacy | Data inventory and retention answer for every table | `READY` | `RETENTION.md`, `app/src/lib/retention.test.ts` | — |
| PRIV-2 | Privacy | Student export and account deletion that empties what it claims | `READY` | `app/src/lib/export.ts`, `app/src/lib/erase.ts`, `supabase/deletion.check.sql`, `app/src/lib/privacy.test.ts` | — |
| PRIV-3 | Privacy | Disclosure kept true by test | `READY` | `app/src/lib/privacy.ts`, `app/src/lib/privacy.test.ts` | — |
| PRIV-4 | Privacy | Signed DPA with FERPA school-official terms | `NOT_STARTED` | — | Counsel drafts the DPA; a signed copy per institution goes under `docs/evidence/` |
| PRIV-5 | Privacy | Published subprocessor list | `IN_PROGRESS` | `docs/SUBPROCESSORS.md`, `app/src/lib/trust/subprocessors.test.ts` | The register exists and is held to the CSP and Edge Functions by test; counsel's review, each subprocessor's terms and hosting regions, then publication |
| PRIV-6 | Privacy | Minimum-necessary sharing with staff, consented and audited | `READY` | `supabase/help-requests.check.sql`, `supabase/support-access.check.sql`, `app/src/lib/help-routes.test.ts` | — |
| AI-1 | AI governance | Tenant-approved providers, server-held sources, metered budget | `TESTING` | `docs/market-readiness/AI_GOVERNANCE.md`, `supabase/migrations/20260924163000_intelligence_provider_runtime.sql`, `supabase/intelligence-policy.check.sql` | Institutional approval of the provider project and data terms |
| AI-2 | AI governance | Model evaluation set, hallucination and bias testing | `NOT_STARTED` | — | Build an evaluation set from approved course sources and record a run |
| AI-3 | AI governance | AI incident playbook | `NOT_STARTED` | — | Extend `docs/market-readiness/INCIDENT_RESPONSE.md` with AI-specific containment and rollback |
| A11Y-1 | Accessibility | Automated journey audits at desktop and 320px reflow in CI | `READY` | `app/scripts/accessibility-smoke.mjs`, `app/src/a11y`, `.github/workflows/contrast.yml`, `app/src/lib/contrast.test.ts` | — |
| A11Y-2 | Accessibility | Current ACR on the VPAT 2.x template | `NOT_STARTED` | — | A formal evaluation; `docs/market-readiness/ACCESSIBILITY_READINESS.md` names the audits that must come first |
| A11Y-3 | Accessibility | Manual screen-reader pass on critical journeys | `NOT_STARTED` | — | Record NVDA/VoiceOver passes for registration, degree and help routes |
| A11Y-4 | Accessibility | Public issue-reporting route with remediation SLA | `NOT_STARTED` | — | Publish an accessibility contact and severity → fix-time table |
| INT-1 | Integrations | Validated transport contract, adapter registry, two-phase actions | `IN_PROGRESS` | `packages/institution`, `app/server/institution`, `docs/market-readiness/INTEGRATION_READINESS.md` | The adapter registry is deliberately empty; one certified adapter against a real system |
| TS-1 | Trust & safety | Report intake with audited moderation | `IN_PROGRESS` | `supabase/reports.check.sql`, `supabase/moderation-audit.check.sql` | Named moderation coverage and an appeals route |
| SUP-1 | Support | Support tiers and consented staff access | `IN_PROGRESS` | `docs/market-readiness/SUPPORT_PLAYBOOK.md`, `supabase/support-access.check.sql` | A support address and an on-call route a university can be given |
| LEGAL-1 | Legal | SOC 2 Type II report | `NOT_STARTED` | — | Not planned before a first pilot; say so rather than implying one exists |
| LEGAL-2 | Legal | Cyber liability insurance certificate | `NOT_STARTED` | — | Obtain a policy; file the certificate under `docs/evidence/` |

## Corrections this file made on the way in

`docs/market-readiness/SECURITY_READINESS.md` lists SSO as **Missing — no
SAML/OIDC**. That was true when written and is not now: SAML membership
binding and SCIM lifecycle provisioning landed in
`20260924150142_institution_identity_provisioning.sql` and
`20260924154500_bind_institution_sso_membership.sql`, with
`identity-provisioning.check.sql` walking them. IAM-1 above says `TESTING`, not
`READY`, because no real institution's IdP has completed an exchange.
