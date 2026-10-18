# How to add an edge function

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for adding a Supabase edge function under `supabase/functions/`; stop reading if the logic belongs in the institution gateway, which is [`HOW-TO-ADD-A-GATEWAY-ROUTE.md`](HOW-TO-ADD-A-GATEWAY-ROUTE.md).

**Status:** LIVE. A function directory merged to `main` is deployed by the platform's own pipeline on every merge, and by `.github/workflows/functions.yml` when a merge touches the directory. Once your pull request merges, the function is live. [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md) says each function fails closed when its secrets are missing; make yours do the same.

1. Check main for the function.
2. Create `supabase/functions/<slug>/index.ts`. The slug is lower-case with hyphens. Shared code goes in `supabase/functions/_shared/`, which is not a function.
3. Import nothing over `https://`. A preview branch will not build it, and `deployfunctions.test.ts` refuses it. Use `jsr:` or `npm:` specifiers, as `supabase/functions/push/index.ts` does, or local files.
4. Decide how the function knows who is asking. `supabase/config.toml` turns the platform JWT check off for every function, so a function with no check of its own is open. Write the check in the function.
5. Register the guard in `EDGE_GUARDS` in `app/src/lib/edgeguards.ts`, for example `{ fn: '<slug>', guards: ['user-token'], evidence: USER }`. The kinds are `user-token`, `shared-secret`, `signature`, `link-token`, `flow-state`, `scheduler-token` and `public`. `evidence` is a list of patterns that must all appear in your `index.ts`. A `public` guard must carry a `why`.
6. Add a block to `supabase/config.toml`, so a preview branch deploys the function.

   ```toml
   [functions.<slug>]
   verify_jwt = false
   ```

7. Add a line under `## What is live` in `supabase/DEPLOY.md`. The line is indented and starts with the slug, then whitespace, for example `    <slug>      PENDING, awaiting first deploy`. Write what you know; do not guess a version.
8. Add a row to `supabase/functions.snapshot` with version `-`, pipeline `pending` and a date, for example `<slug>  -  pending 2026-10-04T00:00:00Z`. A pending row must be replaced by a real reading within 14 days of its date, so after the merge, read the project's function list and write the row.
9. Add a test for the function's logic. Put the logic in `supabase/functions/_shared/` so a test under `app/src/lib/` can read or import it, as the existing `*.test.ts` files for billing and LTI do. Do not import anything under `supabase/functions/` from `app/server/`, `app/api/` or `packages/institution/`.
10. Name its secrets in `supabase/DEPLOY.md` and [`SECRETS.md`](../../SECRETS.md). Never put a secret in the repository.
11. Run, from `app/`:

    ```bash
    npx vitest run src/lib/edgeguards.test.ts src/lib/deployfunctions.test.ts src/lib/functionsdeployed.test.ts
    ```

## What fails if you get it wrong

This was followed in a scratch copy on 2026-10-04 by creating a directory named `scratch-demo` under `supabase/functions/`, holding only an `index.ts`, and nothing else.

| Test file | Failure |
| --- | --- |
| `edgeguards.test.ts` | `functions with no declared guard: scratch-demo` |
| `deployfunctions.test.ts` | `deployed but not listed under "What is live": scratch-demo` |
| `deployfunctions.test.ts` | `no [functions.<slug>] block, so a preview branch deploys nothing for: scratch-demo` |
| `functionsdeployed.test.ts` | `no reading recorded for: scratch-demo` |

After steps 5 to 8 the same three files passed 39 tests. The function in the scratch copy was a one-line stub with a `supabase.auth.getUser(token)` call, so the guard evidence was proven only against that stub.

To deploy by hand, use the workflow `Deploy Edge Functions` in `.github/workflows/functions.yml`, which needs the `SUPABASE_ACCESS_TOKEN` repository secret. This page does not describe running it because it was not run.
