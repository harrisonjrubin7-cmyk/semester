# Secure development and release standard

## Every pull request
- **Scanning:**
  - **Secrets:** Git history, added files, configuration, docs, sample payloads and generated assets.
  - **Dependencies:** direct and transitive packages for known vulnerabilities.
  - **Static analysis:** unsafe DOM rendering, injection sinks, open redirects, weak crypto, missing authorization, hard-coded secrets, insecure deserialization.
- **Configuration review:** `vercel.json`, Supabase migrations, redirects, headers, CORS, exposed environment variables, public buckets.
- **Human security review** for migrations, permission logic, auth, integrations, payments, file processing and elevated workflows.

## Release gates (all need evidence)
- [ ] Threat model done for high-risk changes
- [ ] Acceptance criteria cover security, privacy, accessibility, observability and rollback
- [ ] Peer review, plus security review when authority, data or integrations change
- [ ] Unit, integration, authorization, migration and regression tests pass
- [ ] Secret, dependency and static scans pass: **no critical findings**; highs fixed, or time-boxed with a compensating control and a named owner
- [ ] New exposed tables have RLS enabled, tested and reviewed
- [ ] New or changed functions have their permissions reviewed, especially SECURITY DEFINER
- [ ] Staging covers the happy, denied, failure and rollback paths
- [ ] Monitoring, alerts, dashboards and runbook updates exist for new workflows
- [ ] **Release record:** deployer, commit, approver, time, migration, rollback target, verification result
- [ ] Exceptions are written, approved, time-boxed and in the exception register
