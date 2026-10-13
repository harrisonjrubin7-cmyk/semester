# Registrar cutover validation package

Built from the uploaded `registrar_mock_validation_package.zip` and the two uploaded PDFs.

**Status: executed locally. Not deployed.** Nothing in this directory changes an external system.

| File | What it is |
|---|---|
| `mock_sis_cutover.py` | Mock cutover harness, SQLite in memory. Unchanged from the upload. |
| `mock_sis_results.json` | Results as uploaded. Reproduced exactly on 2026-10-13. |
| `cutover_boundary_policy.md` | Draft policy for institution acceptance. Text matches the PDF. |
| `registrar_audit_and_diff_review.md` | Audit of the enrollment contract and the production diff. Text matches the PDF. |

## Run

```sh
cd docs/registrar-cutover
python3 -I mock_sis_cutover.py --report /path/outside/the/repo/mock-report.json
```

Result: 10 of 10 passed. The output equals `mock_sis_results.json`.

What this establishes, per the audit: the mock's logic only. It runs on SQLite, not PostgreSQL. Auth is mock expiry and scope only, with no JWT signature check. There is no live HTTP. It does not establish RLS, row locking, or HTTP conformance.

## Not deployed, and why

1. **No deployment target exists.** The harness is a mock. The repo has no enrollment API and no `registrar_ref` family. `registrar` appears only in student-facing deadline code (`app/src/lib/registrar`).
2. **Approvals are not given.** The policy requires institutional registrar, IT change authority and Semester release authority before any external configuration changes. Privacy and security join for disclosure incidents.
3. **The production target is not confirmed.** The audit's diff found that the live project holds `registration_*`, `grade_entries`, `academic_record_entries` and module-mode controls. `registrar_ref` is a duplicate family, not an approved replacement. Still needed: a column, constraint, function and policy diff against a confirmed project, plus a migration-history diff. The platform project showed no tables in the schemas queried.
4. **The reference contract was not provided.** The audited enrollment contract is in neither the package nor the repo. Its critical fix (`oneOf` branches, `minItems`, `required` sets, rejection of irrelevant fields) cannot be applied here.

## Open audit items

- **High:** JWT issuer, audience, signature, expiry, key rotation and revocation are unverified.
- **High:** membership, purpose and integration-mode authority must be checked at execution time, not from client role claims.
- **High:** no schedule-version store, policy evaluation, shared or reserved capacity, or transactional executor exists.
- **Medium:** HTTP tests are needed for negative expected versions, unknown fields, invalid UUIDs, duplicate arrays, payload limits and credit precision. Also `Retry-After` on 429, `WWW-Authenticate` on 401, `Location` and a polling policy on 202, and stable scoped cursors.

## Found while reviewing the harness

Replaying an operation whose state is `reconcile_required` returns `200`, the same status as a confirmed replay (`command()` in `mock_sis_cutover.py`, lines 55–56). The mock's own test `uncertain()` asserts that 200. The policy says an uncertain dispatch must not be treated as settled, so a replay should report that the outcome is still being reconciled. The harness is left as received. The fix belongs in the contract, with a test.

## Decisions needed

- Confirm the target project and the institution, domain and cohort.
- Provide the enrollment contract the audit reviewed.
- Route the approvals the policy names.
