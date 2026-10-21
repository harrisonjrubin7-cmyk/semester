## What this changes
<!-- One or two sentences. Link the issue and, for high-risk changes, the feature security design record (handoff/assurance/02). -->

## Risk level
- [ ] Low: copy, styling, no data or authority change
- [ ] High: touches auth, permissions, RLS or policies, migrations, SECURITY DEFINER functions, files, payments, integrations (SIS, LTI, Stripe), exports, AI actions, or admin/support tools → **security review required**

## Security checklist (no evidence, no release)
- [ ] **Authorization:** every new read or write is checked on the server. The UI hiding a button isn't a control.
- [ ] **RLS:** any new exposed table has RLS enabled and forced, with reviewed policies. Tests run as `authenticated` with realistic JWT claims, **never as postgres or the service role**.
- [ ] **Cross-tenant and cross-user:** negative tests added (AC-02, AC-03 pattern): student A can't read B; tenant 1 can't read tenant 2.
- [ ] **No self-grant:** a user can't change their own roles, ownership or tenant (AC-05, AC-06).
- [ ] **Definer functions:** `search_path = ''`, EXECUTE revoked from PUBLIC, caller checked inside, and a row added to `SECURITY-DEFINER-REGISTER.csv`.
- [ ] **Writes are commands:** idempotency key, expected version or row lock, and audit + outbox in the same transaction.
- [ ] **Input and output:** validated with a schema on the server; no unsafe HTML; uploads scanned and private, served by expiring signed URLs.
- [ ] **Secrets:** none in client code, logs, fixtures or screenshots; the service-role key is server-only.
- [ ] **Logging:** sensitive access goes through `record_audit()`; no tokens, raw JWTs or PII in logs.
- [ ] **Dependencies:** none added, or each one is pinned and has passed the scan.
- [ ] **States:** loading, empty, error, denied, stale-source and offline all handled.
- [ ] **Rollback:** the rollback target is named, and the migration is forward-fixable.

## Evidence
<!-- Links: CI run, pgTAP output, screenshots of denied paths, staging verification. Add rows to handoff/assurance/evidence-register.csv. -->
- CI:
- Tests:
- Staging check (happy / denied / failure / rollback):

## Exceptions
<!-- Any control not met: rationale, compensating control, owner, expiry → exception-register.csv. Leave empty if none. -->
