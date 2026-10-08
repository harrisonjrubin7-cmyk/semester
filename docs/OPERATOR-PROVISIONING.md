# Provisioning an operations test user (development and staging only)

The operations console at `#/console` opens for one thing: a live `role_grants`
row whose role carries `console:operate`, held at platform scope. Nothing else
opens it: not repository ownership, not an email address, not a title. This is
the reviewed way to create that row for a **test account in development or a
staging/preview branch**. Never run it against production; production grants
need an explicit decision from the person who owns the access.

## Two identities

| Identity | Holds | Expected |
| --- | --- | --- |
| `ops-test` | `support_agent` at platform scope | The **Semester Operations** row appears on Me; `#/console` loads; Support tab works |
| `student-test` | nothing | No row on Me; `#/console` shows the "no console:operate grant" notice; every console RPC refuses |

`support_agent` is the narrowest role that carries `console:operate` and also
`support:ticket`, which is what the Support tab needs. Pick another role from
[`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) to exercise another view
(`platform_admin` for approvals and break-glass, `incident_responder` for
Release & incidents). Several views also need a school-scoped grant on top of
the shell; see [`OPERATIONS-CONSOLE-MAP.md`](OPERATIONS-CONSOLE-MAP.md).

## Steps

1. In the staging project (Auth, then Users), create or sign in both accounts
   once so each has an `auth.users` row. Do not edit `auth.users` directly.
2. In that project's SQL editor, as the project owner, grant the one role. The
   scope id is empty exactly when the scope is `platform`; a row that disagrees
   is refused by `role_grants_scope_matches_kind`.

   ```sql
   insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at)
   select id, 'support_agent', 'platform', '', 'platform', now() + interval '14 days'
   from auth.users
   where email = '<ops-test email>';
   ```

   Give it an expiry. A test grant that never lapses is the one that gets
   forgotten. The change is written to the role-grant audit trail by
   `private.audit_role_grant_change`.
3. Confirm the match was exactly one row (`INSERT 0 1`). `0` means the email is
   wrong; do not widen the `where`.

## Verify

- Signed in as `ops-test`: Me shows **Semester Operations**; it opens
  `#/console`; the context bar names the operator and the `console:operate`
  grant.
- Signed in as `student-test`: no row on Me. Typing `#/console` shows the
  notice. Calling a console RPC (for example `console_command_center`) from the
  browser session returns a refusal, not data. Hiding a menu row is not a
  security test; this is.
- Revoke `ops-test` and reload: the row disappears and the RPCs refuse
  again. Revocation takes effect on the next read, with no cache to expire.

## Revoke

```sql
update public.role_grants
   set revoked_at = now()
 where subject = (select id from auth.users where email = '<ops-test email>')
   and role = 'support_agent' and scope_kind = 'platform';
```

Re-granting later is an update that clears `revoked_at`, not a second row
(`role_grants_one_per_scope`).
