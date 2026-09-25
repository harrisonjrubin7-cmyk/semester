# Security Readiness

**Status: `IN_PROGRESS`**

## What is genuinely strong

**Row-level security is the security model, and it is tested.**
`supabase/check.sh` starts a throwaway Postgres, applies all 35 migrations and
runs 18 policy suites — 367 assertions, currently 0 failures. This is more
rigour than most products of this size apply to authorization.

**The gateway validates tokens over the network.** `app/server/institution/auth.ts`
calls `getUser` every time rather than decoding a JWT locally, on the stated
reasoning that a locally verified signature proves issuance, not that the
session still exists. Roles are read from `app_metadata`, which only a
service-role key can write; `user_metadata`, which the user can write, is
never read.

**Rate limiting exists on the gateway.** `app/server/institution/gateway.ts`,
60 requests per 60s window, with expiry sweeping.

**A real CSP already ships,** and its own comment is the model for how this repository documents a partial mitigation: every source is justified by something that loads from it, the two directives a meta tag cannot carry are named rather than dropped, and the browser sweep that verified it was run once more with `font-src 'none'` as a control, to prove the sweep could see a violation at all.

**Secrets hygiene is set up.** `.gitleaks.toml` at the root; `SECRETS.md`
documents handling; CI runs `npm audit --audit-level=high`.

## What is missing

| Item | State | Note |
| --- | --- | --- |
| Tenant isolation | **Implemented for the institutional data layer** | Tenant policy, evidence, capture, identity/provisioning, gateway journal and role-audit policies are covered by cross-tenant suites. Older direct-to-Supabase product tables still use their original user/school boundaries and are not a blanket institutional tenancy claim. |
| The `school_id` pin | **Fixed today** | Was a no-op. See below. |
| HTTP security headers | **Partly present** | A full CSP ships in `app/index.html` (meta-delivered), browser-verified against a control and guarded by `lib/csp.test.ts`. `frame-ancestors`, `report-uri` and HSTS cannot be carried by a meta tag and wait on a host that sets headers. |
| Admin audit log | **Implemented for tenant policy and role changes** | Tenant settings, AI policy, approved sources and consent already write immutable old/new events. Future role grants, changes and revocations now write pseudonymous, append-only tenant events. Moderation action evidence still needs its own workflow-level implementation. |
| SSO | **Missing** | No SAML/OIDC. |
| Rate limiting beyond the gateway | **Missing** | Supabase-direct paths (most of the app) are unlimited. |
| Cross-tenant security tests | **Partial** | `supabase/tenancy.check.sql` covers the foundation (13 checks). No policy enforces isolation yet, so there is nothing further to assert. |

## Finding: the `school_id` pin was a no-op

Found by writing `supabase/tenancy.check.sql`, roughly an hour after
`20260921170000_schools.sql` merged.

That migration reasoned correctly about what it needed — the column must have
exactly one legitimate writer, `claim_school()` — and chose a statement that
does not achieve it:

```sql
revoke update (school_id) on public.profiles from anon, authenticated;
```

A column-level `REVOKE` can only remove a column-level `GRANT`. It cannot
subtract from a table-level one, and Supabase's default privileges hand
`all on tables` to both API roles as each table is created. Postgres accepts
the statement, warns that nothing could be revoked, and leaves the ACL alone.

Measured on the applied schema:

```
role     = authenticated
tableacl = {postgres=arwdDxt/postgres, anon=arwdDxt/postgres,
            authenticated=arwdDxt/postgres, service_role=arwdDxt/postgres}
colacls  = (none)
has_column_privilege(authenticated,'public.profiles','school_id','UPDATE') = t
```

So between those two commits, any signed-in account could set its own
`school_id` — the column was self-declaration, which is the precise state the
migration was written to prevent.

**INSERT was open by the same mechanism**, and `lib/classmates.ts` creates this
row with an upsert, so closing UPDATE alone would have moved the hole rather
than shut it.

Fixed in `20260921211500_pin_profile_school.sql` by dropping both blanket
grants and handing back explicit column lists. Both halves proven by revert:

| Revert | Result |
| --- | --- |
| whole migration | ✗ `a signed-in account wrote school_id directly` |
| the INSERT half only | ✗ `a new profile was created with school_id already set` |

### The general lesson

`revoke <priv> (column)` is inert on any table Supabase has granted at table
level, which is every table in `public`. The pattern appears exactly once in
this repository and is now fixed; a guard against it recurring would belong in
`grants.check.sql`, which already asks whole-schema allowlist questions of
function EXECUTE and could ask the same of column privileges.

## The in-memory rate limiter

`RATE = { window: 60_000, max: 60 }` is held in a `Map` in one process. It is
correct for a single host and evaporates on restart and does not coordinate
across instances. Documented here so nobody reports it as distributed.

## Next

1. Configure header-only protections on a host that supports them.
2. Add distributed limits to any direct-to-Supabase mutation that remains in
   the production institutional scope.
3. Add moderation workflow audit evidence when that server workflow lands.
