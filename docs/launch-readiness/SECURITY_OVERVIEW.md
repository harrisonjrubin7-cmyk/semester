# Security overview

**Status:** controls implemented in part; GA assurance incomplete

## Evidenced controls

- Tenant-aware authorization and row-level policy suites exist in the repository.
- Server-side functions, capability flags, read-only controls, audit records and evidence registers are documented and tested in controlled environments.
- CI definitions include type, test, secret-scanning, dependency and browser/security workflows.
- Security, secrets, incident, rollback, restore and monitoring runbooks exist.
- A subprocessor and vendor-risk framework exists.

These are control-design or repository-execution statements. They are not proof that every control is live, configured, monitored and effective in a production tenant.

## Architecture and trust boundaries

The shipped client is a browser application with a substantial local/device state layer. Optional accounts, sync, authentication, tenant data, provider connections and server-side operations use Supabase services and Edge Functions. Static hosting serves the web assets. External identity, AI, payment, messaging and institutional providers are involved only when configured.

Authentication identifies an account; it does not by itself authorize tenant or administrative action. Authorization is expected at the data/function boundary through tenant membership, roles, capabilities and row-level policies. UI hiding is never sufficient authorization. Public client configuration may appear in the bundle; service-role and provider secrets must remain in managed server or CI stores.

High-risk institutional actions are intended to remain behind tenant capability flags, role checks, source/approval requirements and fail-closed policy enforcement. Known dependency categories include hosting/source control, Supabase, identity providers, optional AI providers, payment, monitoring/automation and institution-owned identity/LMS/SIS services. The subprocessor and vendor-risk registers must be reviewed for the exact deployment.

Vulnerability reports are routed through the published `security.txt` and `SECURITY.md`; contractual incident contacts remain customer-specific.

## Open assurance work

- HawkScan DAST could not run in the assessment environment because neither the Hawk runtime nor `HAWK_API_KEY` was available.
- A lockfile-aware production dependency audit completed with npm 10.9.3 on 2026-10-02 and reported 0 vulnerabilities; the dated record binds the result to the candidate and lockfile hash.
- The full current-CI result and production deployment state were not independently read in this assessment.
- There is no completed external penetration test.
- Production secrets/bundle review, privileged MFA evidence and vendor assessments are incomplete or attestation-only.
- Production restore, rollback, on-call and incident exercises are not complete.
- Host security headers are written in repository configurations but the go-live checklist does not verify that the current production host serves them.

## Required before GA

1. run dependency, secret, SAST and DAST scans against the immutable candidate;
2. remediate or formally dispose every finding, with no open P0/P1;
3. run an independent penetration test on the intended production architecture;
4. verify headers, TLS, CSP, rate limits, authentication, tenant isolation and logging on the live host;
5. prove privileged access, MFA, break-glass and periodic review;
6. exercise incident, rollback and restore procedures; and
7. retain sanitized reports in an approved evidence system.

## Safe procurement statement

“Semester maintains repository-based security controls and testing, including tenant-policy checks and CI security workflows. Production operation, independent testing, certifications and tenant-specific controls require separate evidence. Semester does not currently represent that it holds a SOC 2 report or completed external penetration test.”
