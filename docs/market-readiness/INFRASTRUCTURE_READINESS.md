# Infrastructure Readiness

**Status: `IN_PROGRESS`**

## What the deployment actually is

This matters more than any individual gap, because it governs how several
other items must be solved.

```
BROWSER  ──────────────►  GitHub Pages (static SPA)
                                  │
                                  ├──────────►  Supabase  (Postgres + auth + RLS)
                                  │
                                  └──────────►  app/server/institution  (Node gateway)
```

- `.github/workflows/pages.yml` builds and deploys the SPA to GitHub Pages
- `.github/workflows/functions.yml` covers functions
- Supabase project `lzrqvlugnawcgywkhqlz` (Postgres 17), with per-PR preview
  branch projects
- The institution gateway is a separate Node process

**There is no general backend tier.** Items that assume conventional server
middleware must be solved either at the host, in the SPA shell, or in the
gateway process:

| Spec item | Where it has to live here |
| --- | --- |
| Security headers | Host configuration; Pages does not let the app set them |
| Health endpoints | The gateway process |
| Background jobs | Supabase scheduled functions, or the gateway |
| API versioning | The gateway contract (`INSTITUTION_VERSION = 1` already) |
| Central AI gateway | New — most likely the gateway process |

## Environments

| Tier | State |
| --- | --- |
| Local | Yes — `npm run dev`, local Postgres via `supabase/check.sh` |
| Preview | Yes — per-PR Supabase preview branches, real and automatic |
| Staging | **Missing** — no staging tier exists |
| Production | Pages + the Supabase project |

The missing staging tier is a real risk: migrations currently go from a
throwaway Postgres 16 straight to a production Postgres 17. `supabase/check.sh`
is loud about the version difference and is right to be.

## Preview-branch hazard, learned today

Force-pushing a branch that has already deployed a migration to its preview
project leaves the preview database holding a migration version the directory
no longer has, and the check fails with *"Remote migration versions not found
in local migrations directory."* The fix is to reset the preview branch. This
is not visible in the diff and will recur.

## Next

A staging tier on Postgres 17, so migrations meet the production version before
production does.
