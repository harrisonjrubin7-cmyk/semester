# Access control and RLS standard

Allow access only when **all** of these hold:
- the person is authenticated
- their institutional membership is active
- the permission is active right now
- the scope covers the resource
- the purpose comes from the workflow
- the record classification permits it
- consent or an exception applies where needed

Decisions are made on the server. Database, files, search, exports and integrations enforce the same restrictions. Being faculty or an advisor isn't blanket authorization.

## Every table
- [ ] Is it exposed through the API? If not, it lives in a private schema.
- [ ] RLS is enabled, and **forced** where the table owner shouldn't bypass it.
- [ ] Policies exist for each operation that's allowed. Client writes are denied unless a reviewed policy says otherwise; mutations go through commands.
- [ ] Anonymous users can't read it.
- [ ] One student can't read another student's or another tenant's rows.
- [ ] A low-privilege role can't change grants, permissions, audit records or institutional configuration.
- [ ] The service role is used only in trusted server code.
- [ ] No trigger or function creates an unintended authority path.

Current state: `RLS-COVERAGE-REGISTER.csv` (292 tables across the handoff SQL, all RLS-enabled; policies reviewed for read paths only).

## Every SECURITY DEFINER function
- [ ] Name, owner, purpose, callers, objects touched, and whether it bypasses RLS are recorded in `SECURITY-DEFINER-REGISTER.csv`.
- [ ] EXECUTE is revoked from PUBLIC and granted only to the roles that need it.
- [ ] `SET search_path = ''` (true for all 48 today).
- [ ] **Fixing search_path alone doesn't restrict who can call the function, or stop it reading data the caller shouldn't see.** Review four things separately: the owner (and whether it has BYPASSRLS), the authorization checks inside the function, EXECUTE grants, and search_path.
- [ ] The function checks the caller's identity and authorization itself.
- [ ] It's tested by direct call as anon, student, staff, admin and service role, with malicious input and cross-tenant ids.

## Also covered
- **Grants vs policies:** object grants (GRANT SELECT) and row policies are separate layers, and both are needed.
- **Storage:** bucket policies follow the same record-access rules, downloads use expiring signed URLs, and there are no public buckets for records.
- **Realtime:** channels are authorized the same way as the tables behind them.
- **Migrations:** every migration reruns the RLS suite in CI, and staging validates it before production.

## Sources of truth
- **Policies:** `handoff/reference-slice/enterprise-v4/user/014_semester_read_policies.sql` (+ test)
- **Authorization model:** 011 (`authorize()`)
- **Audit:** 013
- **Role matrices:** `ui_kits/semester-app` → `#/trust/matrix`

## Authorization test cases (from your 03 standard)
Run every one as the real application roles, not over a privileged connection.

| Id | Case | Expected |
|---|---|---|
| AC-01 | Anonymous read or write of a protected object | Denied; no protected rows |
| AC-02 | User A reads B's private resource | Denied, with no sensitive detail in the error |
| AC-03 | A tenant-1 member reads or changes a tenant-2 resource | Denied across API, RPC, storage and exports |
| AC-04 | Insert with a spoofed owner or tenant | Rejected; no row created |
| AC-05 | Update a row to another tenant or owner | Rejected; original unchanged |
| AC-06 | Grant yourself a role or capability | Rejected; no grant or event |
| AC-07 | Direct definer RPC with a foreign id | Denied; no leaked row and no side effect |
| AC-08 | A revoked, expired or suspended user reuses an old session | Sensitive access denied |
| AC-09 | Mixed permissive policies | No unexpected allow |
| AC-10 | Public view or derived export | No unauthorized rows or columns underneath |
| AC-11 | Privileged API gets an unauthorized request | Denied **before** any service-role operation |
| AC-12 | Guessed object path or stale signed URL | Behaves as the approved policy says |
| AC-13 | Forged metadata or claims, expired token, wrong issuer or audience | Denied |
| AC-14 | Concurrent revoke and write; repeated or out-of-order workflow events | Revoked access isn't restored |
| AC-15 | Owner and scoped-staff positive cases | Authorized operations succeed |
| AC-16 | Fresh database vs upgraded database | Identical grants and policy behavior |

Coverage so far:
- `user/014_semester_read_policies_test.sql`: parts of AC-01, 02, 03, 08 and 15.
- `user/017_command_tests.sql`: AC-04, 05, 06, 07, 11 and 14.

- `user/018_remaining_access_tests.sql`: AC-09 (permissive policies listed for review; no `USING true` or anon policies), AC-10 (views are `security_invoker`; no client-readable materialized views), AC-12 (private record buckets; no anon storage policy), AC-13 (forged metadata claims read nothing; no policy trusts JWT metadata) and AC-16 (a fingerprint of policies, grants and functions to diff between a fresh and an upgraded database in CI).

All 16 now have a test. Still missing: a two-connection concurrency harness, and HTTP-level tests for signed-URL expiry.
