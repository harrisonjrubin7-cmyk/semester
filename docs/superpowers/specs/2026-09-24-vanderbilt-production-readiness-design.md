# Vanderbilt Production Readiness Design

**Date:** 24 September 2026  
**Status:** Approved architecture; implementation planning follows user review of this specification  
**Pilot institution:** Vanderbilt University  
**Production stack:** OpenAI API, Supabase Cloud, Vercel

## 1. Purpose

This design takes Semester from a verified local pilot foundation to a deployable Vanderbilt production candidate without replacing the existing student experience or presenting a sandbox as a live university connection.

The repository can complete the software, staging environment, deployment automation, evidence packets and operator runbooks. A production claim additionally requires Vanderbilt-controlled identity and Brightspace registration, production account credentials, vendor agreements, an accessibility reviewer and Vanderbilt legal/privacy approval. Those external decisions are release gates, not missing code that Semester may simulate.

Success means:

1. Vanderbilt users authenticate through institution-managed SSO and are provisioned or removed through an audited lifecycle.
2. Semester Intelligence uses only server-held OpenAI credentials and Vanderbilt-approved policy, sources, models and budgets.
3. One Brightspace LTI 1.3 deployment completes a real launch and authorized service checks.
4. Expired or withdrawn captures become inaccessible immediately and their stored objects are deleted by an observable, retry-safe worker.
5. Production health, security, cost and retention signals reach accountable operators without exposing student content.
6. Critical journeys have an independent accessibility report and a tracked remediation decision.
7. Vanderbilt privacy and legal reviewers receive a complete, accurate review packet before activation.

## 2. Truthful completion states

Each production dependency has one of four states:

- `built`: implementation and automated tests are complete in the repository;
- `staging-verified`: deployed with synthetic identities or vendor sandboxes and evidenced end to end;
- `authorized`: the accountable Vanderbilt or vendor owner has supplied and approved the production configuration;
- `production-verified`: a controlled Vanderbilt pilot has passed the live acceptance runbook.

The product and readiness documents must display the actual state. `built` or `staging-verified` must never be described as a live Vanderbilt integration.

## 3. Environments and topology

Semester uses isolated local, staging and production environments.

### Local

- Synthetic Northstar and Cedar Coast institutions only.
- Sandbox LTI identities, fake academic records and restricted test model responses.
- No Vanderbilt credentials or production student data.

### Staging

- A dedicated Supabase project and Vercel project.
- Vanderbilt test identities only after authorization; otherwise synthetic SAML and LTI fixtures.
- Separate OpenAI project, key, model allowlist and hard budget.
- Destructive retention tests against disposable storage objects.
- Monitoring and alert routing tested before production.

### Production

- A separate Supabase project, Vercel project, domain, secrets, storage and database.
- Vanderbilt SAML connection, SCIM credential and Brightspace registration supplied through secure dashboards.
- A dedicated OpenAI project and server-held key.
- Production policy starts disabled and is activated tenant-by-tenant only after all release gates pass.

The browser loads the React application from Vercel and sends authenticated institutional requests to a same-origin Vercel gateway. The gateway verifies the Supabase access token, derives the tenant and roles from server-controlled records, and invokes only tenant-approved adapters. Supabase Postgres stores durable prepared actions, receipts, policy, provisioning events, audit metadata and retention work. Private Supabase Storage holds permitted capture originals and derivatives.

The existing SQLite action journal remains available for local development. Production uses a Postgres journal because Vercel functions do not provide a durable local filesystem and process memory cannot safely hold expiring prepared actions.

## 4. Vanderbilt identity and SSO

Vanderbilt currently describes OneVU, powered by Okta Verify, as its identity and multifactor-authentication platform. The production connection therefore uses Supabase SAML SSO with Vanderbilt-provided IdP metadata and Vanderbilt-controlled attribute mappings. Official background: [Vanderbilt OneVU and account access](https://www.vanderbilt.edu/welcome/accessing-university-systems/) and [Supabase SAML SSO](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml).

### Sign-in behavior

- Semester offers a Vanderbilt SSO entry point only when the production tenant has an authorized SAML provider identifier.
- The browser starts SSO through Supabase and returns to an allowlisted HTTPS callback.
- The gateway verifies the Supabase JWT and resolves its SSO provider identifier to exactly one tenant.
- User-editable metadata never grants a tenant, role or capability.
- MFA enforcement remains Vanderbilt's responsibility at the IdP; Semester records only the authentication method and provider identifier needed for authorization evidence.
- Password and social login may remain available for personal Semester accounts but cannot enter Vanderbilt institutional scope.

### Session controls

- Institutional sessions use explicit inactivity and maximum-duration policies.
- Deprovisioned accounts lose institutional membership immediately; sensitive gateway operations also check the current membership record rather than relying solely on possibly stale JWT claims.
- Break-glass platform administration uses separately protected accounts, hardware-backed MFA where available, narrow capabilities and mandatory audit events.

## 5. SCIM 2.0 lifecycle

Semester exposes a Vanderbilt-specific SCIM 2.0 service from the institutional gateway. It supports `/ServiceProviderConfig`, `/Schemas`, `/ResourceTypes`, `/Users` and `/Groups` with create, read, filter, replace, patch and deactivate behavior required for the pilot.

### Security and tenancy

- Vanderbilt receives a dedicated random bearer credential through a secure channel; only a salted hash is stored.
- The credential is bound to the Vanderbilt tenant and cannot name another tenant in a request.
- Rate limits, bounded request bodies, schema validation, idempotency and immutable provisioning audit records apply to every request.
- SCIM external identifiers are unique within the Vanderbilt tenant.
- Responses omit application data unrelated to provisioning.

### Role mapping

- Vanderbilt groups map through an administrator-approved table to Semester roles and capabilities.
- Unknown groups grant nothing and are recorded for review.
- Student, faculty, teaching-assistant, advisor, administrator, applicant, family and alumni access remain distinct.
- A role assertion records its source as institution-provisioned.

### Deprovisioning

- `active: false` immediately suspends institutional access and revokes current tenant membership.
- Required academic and audit records follow the approved Vanderbilt retention policy rather than being silently deleted.
- Personal device-local Semester data remains separate from Vanderbilt-controlled institutional records.
- Reactivation is explicit, audited and does not restore expired capabilities automatically.

## 6. Approved OpenAI provider

Semester Intelligence remains provider-independent at its application boundary. The production implementation adds an OpenAI adapter behind the existing governed intelligence service; no OpenAI key, provider credential or service-role secret enters the browser bundle.

For every request, the gateway enforces:

- verified Vanderbilt tenant and active membership;
- permitted institutional role;
- enabled integrity mode;
- approved course and institutional sources;
- allowed data categories and capture-consent state;
- model allowlist, per-request cost ceiling, monthly tenant budget and rate limits;
- response citation, provenance, uncertainty and information-used disclosure;
- metadata-only audit records with no prompt, response or course-content logging by default.

The adapter sends the minimum approved context to OpenAI. It refuses when policy, credentials, sources, budget or model availability are missing. It never silently falls back to a personal API key or a second provider.

Consequential actions remain prepare-review-confirm operations. Prepared actions are durable, immutable, expiring and single-use. Execution must return authoritative readback before Semester displays a verified receipt.

Production activation requires recorded Vanderbilt decisions on permitted models, retention, training/data-use terms, regions, sensitive data categories, faculty source approval, budgets and incident escalation. Until then the feature remains policy-disabled while non-AI planning and study tools continue to work.

## 7. Vanderbilt Brightspace integration

Brightspace is the first authorized LMS target because Vanderbilt publicly identifies Brightspace as its campus LMS and reports institutional LTI 1.3 work. The implementation extends the repository's existing LTI 1.3 launch, identity, deep-linking and Assignment and Grade Services foundation.

Vanderbilt administrators provide the issuer, client identifier, deployment identifier, OIDC authorization endpoint, token endpoint, JWKS endpoint, allowed redirect URIs and approved scopes. Private key material is generated and stored server-side.

The production acceptance path verifies:

1. OIDC login and signed LTI launch;
2. state, nonce, issuer, audience, deployment and timestamp validation;
3. Vanderbilt tenant binding and course-context isolation;
4. student, instructor and teaching-assistant role separation;
5. account linking without trusting display names or email as authorization;
6. deep-link selection and return;
7. authorized line-item discovery and grade-service read/write behavior;
8. replay, expired launch, removed deployment, missing scope and unavailable-LMS refusals;
9. token and signing-key rotation;
10. connection health, audit evidence and revocation.

Canvas, Blackboard and Moodle remain adapter targets, not live claims, until separately authorized and tested.

## 8. Retention and deletion operations

The existing consent-aware database policies and `private.expire_capture_assets()` foundation become a complete deletion pipeline.

### Database stage

- A daily Supabase Cron job claims expired, withdrawn or policy-invalid assets into a tenant-scoped deletion queue.
- Claiming is idempotent and uses locked batches so overlapping runs cannot process one item twice.
- Original and derived records become inaccessible before object deletion begins.
- Legal holds exclude matching records and produce an auditable reason.

### Storage stage

- A service-role Edge Function receives only claimed queue entries.
- It deletes the exact private Storage object keys, confirms absence, and marks each queue item complete.
- Missing objects are treated as already deleted; transient provider errors remain retryable with bounded exponential backoff.
- Permanent failures enter a review state and alert operators.
- Logs contain tenant-safe identifiers, counts, timings and error classes, never recording content.

### Proof

Automated tests cover withdrawal during processing, natural expiry, legal hold, duplicate worker execution, cross-tenant keys, already-missing objects, partial batch failure and retry. Staging acceptance uploads disposable objects, expires them, runs the scheduled path and proves both database refusal and object absence.

Supabase documents Cron as a `pg_cron`-backed scheduler whose job runs are observable in the database: [Supabase Cron](https://supabase.com/docs/guides/cron).

## 9. Monitoring and incident operations

Monitoring combines Vercel runtime/traffic telemetry, Supabase logs and metrics, the gateway readiness endpoint and scheduled synthetic probes.

### Signals

- frontend availability and JavaScript error rate;
- gateway availability, latency and error rate;
- authentication and SCIM refusal/failure rates;
- database, connection-pool and Storage health;
- Brightspace launch and service-token failures;
- OpenAI latency, refusal rate, token use and cost without prompt content;
- retention job delay, claimed/deleted/failed counts and missed schedules;
- authorization denials and cross-tenant isolation alarms;
- backup completion and restore-drill evidence.

### Alerting

- Critical: confirmed tenant-isolation failure, exposed secret, destructive data loss or unauthorized consequential action.
- High: authentication outage, gateway outage, repeated retention failure or broad LMS failure.
- Medium: elevated latency, budget exhaustion, partial integration degradation or accessibility regression.
- Low: non-blocking operational debt and capacity warnings.

Each alert has a named owner, acknowledgement target, escalation path, containment steps, recovery checks and post-incident record. The first production pilot does not offer an uptime SLA until representative monitoring history supports one.

Supabase provides service logs, reports, metrics and log-drain capabilities for this operating model: [Supabase observability](https://supabase.com/docs/guides/observability).

## 10. Accessibility review

Automated structural, labeling, contrast, keyboard, zoom, responsive and regression checks remain release gates. They are necessary evidence, not a formal conformance opinion.

An independent reviewer tests the critical Vanderbilt journeys with VoiceOver/Safari, NVDA/Chrome, JAWS/Edge, keyboard-only input, 200% and 400% zoom/reflow, reduced motion, mobile screen readers, touch target sizing, errors, loading states and document exports. Journeys cover student, faculty, teaching assistant, advisor, administrator, applicant, authorized family and alumni experiences.

The deliverable is an issue ledger with WCAG 2.2 AA criteria, severity, reproducible evidence, affected roles, remediation owner and retest result, followed by an Accessibility Conformance Report or VPAT. Semester claims only the criteria the reviewer has actually evaluated.

Vanderbilt's published accessibility route identifies its Web Accessibility Coordinator and states its institutional accessibility objective: [Vanderbilt accessibility information](https://www.vanderbilt.edu/about/accessibility/). Outreach is drafted for the coordinator and an independent auditor but is not sent without user approval.

## 11. Legal, privacy and procurement review

The review packet contains:

- system and data-flow diagrams;
- data inventory, classification, purposes and minimum collection;
- FERPA responsibilities and proposed school-official treatment;
- OpenAI, Supabase, Vercel and other subprocessors;
- data-processing, security and breach-notification terms;
- retention, deletion, export, legal hold and account-deprovision behavior;
- classroom recording, participant notice and applicable consent analysis;
- AI use, academic integrity, faculty control and prohibited data categories;
- applicant, family, alumni and minor-related handling;
- privacy notice, terms, acceptable-use and consent language;
- security controls, incident response, accessibility evidence and known limitations.

The primary institutional privacy route is Vanderbilt's Data Governance Office at `privacy@vanderbilt.edu`, published in [Vanderbilt's Privacy Policy](https://www.vanderbilt.edu/privacy/). Contract and legal review routes through the [Vanderbilt Office of General Counsel](https://www.vanderbilt.edu/generalcounsel/legal/). These are routing contacts, not evidence of approval. Outreach drafts are prepared but not sent until explicitly authorized.

## 12. Failure and degraded behavior

- SSO unavailable: institutional login stops with a clear support path; no password fallback enters Vanderbilt scope.
- SCIM unavailable: existing active sessions remain governed by current membership checks; provisioning retries are idempotent and administrators see stale lifecycle status.
- OpenAI unavailable or disallowed: Ask Semester explains the verified reason and non-AI workflows remain available.
- Brightspace unavailable: cached/imported student work remains labeled with freshness; official reads and writes stop and no receipt is fabricated.
- Retention worker delayed: records remain inaccessible after policy expiry, queue age alerts, and deletion retries without restoring access.
- Monitoring unavailable: deployment health becomes unknown, not green; production changes pause until observability returns.
- Accessibility blocker discovered: the affected journey is disabled, repaired or formally excluded from the pilot with an accountable decision.
- Legal or privacy approval withheld: the relevant data category or capability remains disabled.

## 13. Verification matrix

Repository completion requires unit, integration, database-policy, production-build and browser tests for each new boundary. Staging completion additionally requires:

- SAML test-provider login, logout, expiry and tenant-mismatch checks;
- SCIM create/update/group/deactivate/reactivate and replay checks;
- OpenAI approved/refused/budget/source/timeout and redaction checks;
- Brightspace sandbox launch, role, deep-link and grade-service checks;
- scheduled retention and physical object-deletion proof;
- alert delivery and incident runbook exercise;
- backup restoration drill;
- keyboard, screen-reader and zoom smoke across critical journeys;
- secret scanning and proof that no production credential enters a client bundle.

Production verification requires a Vanderbilt-controlled pilot account set, approved test courses, named operators, reviewer sign-off and written legal/privacy approval. No automated test substitutes for those external decisions.

## 14. Release gates

Vanderbilt production activation is blocked until all of the following are recorded:

1. production Supabase and Vercel ownership, billing and administrator recovery;
2. Vanderbilt SAML metadata and successful controlled SSO acceptance;
3. SCIM credential, role mapping and deprovisioning acceptance;
4. dedicated OpenAI project, approved policy and cost ceiling;
5. Brightspace registration and live pilot-course acceptance;
6. scheduled retention and Storage deletion evidence;
7. monitored backup and restore exercise;
8. incident owners and alert delivery evidence;
9. independent accessibility report and disposition of blockers;
10. Vanderbilt privacy, legal, security and procurement approval;
11. no unresolved critical or launch-blocking high-severity defect;
12. rollback and tenant-disable procedures demonstrated.

Passing repository tests produces a deployment candidate. Only passing these release gates produces a Vanderbilt production pilot.
