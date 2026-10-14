# Review: uploaded monorepo starter files (13 Oct 2026)

Files: `001_identity_core.sql`, `access.rego`, `client.ts`, `middleware.ts`, `server (1).ts`, `package (1).json`, `turbo.json`, and "provide the column-by-column 227-table expansion" PDF.

The PDF says itself that its 227-table manifest uses one shared baseline column set, not bespoke columns. That matches `proposed-schema/` here. Real per-table columns must come from the repo's existing migrations.

**Don't merge these files as they are.** Each one has a safer replacement already in this pack.

| Uploaded file | Problem | Use instead |
|---|---|---|
| `server (1).ts` | `requireSession()` returns a hard-coded `stub-account`, `stub-tenant` and fixed grants for **any** cookie value — anyone who sets a `semester_session` cookie becomes that user | `packages/auth/context.ts.txt` (verifies the JWT, loads membership + grants from the DB) |
| `middleware.ts` | Only checks that a cookie *exists*; never validates it. Fine as a redirect hint, but it is not authentication | Keep as UX only; enforce in `context.ts` + edge-function `gate.ts` |
| `client.ts` | Evaluates policy in-process with only tenant + grant; `null === null` passes for any personal resource; ignores consent, authority, ownership | `packages/policy/chain.ts.txt` and `policies/access.rego` |
| `access.rego` | Same gaps; no ownership check when both tenants are null | `policies/access.rego` (11 tests) |
| `001_identity_core.sql` | No RLS on any table; `accounts` not linked to `auth.users`; `memberships` has no uniqueness or validity window; would collide with the repo's existing `public` tables | `proposed-schema/001_platform_core.sql` (separate schema, forced RLS) + `supabase/policies/` pattern |
| `package (1).json`, `turbo.json` | pnpm + Turborepo for a 7-app Next.js monorepo; the repo is npm workspaces + one Vite app | Keep the repo's tooling; add `opa test policies` and `supabase test db` scripts |
