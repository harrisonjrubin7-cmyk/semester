# Review (14 Oct)

Filed from your upload; originals unchanged in `uploads/`. Your 28 Node tests passed locally. Strong reference: catalog-only requests, no student data or free text in the provider payload, revalidation after generation, raw provider prose never rendered, timeouts bounded.

## Fixed in this copy

1. **The static site would deploy blank.** `vercel.json` sets `script-src 'self'; style-src 'self'`, but `index.html` used an inline `<script>` and `<style>`, which that policy blocks. Moved them to `app.js` and `app.css`; the strict policy stays. (`app.js` is saved as `app.js.txt` here so the design-system bundler skips it — rename before deploying.)
2. **Local could point at production.** The cross-environment check skipped `local`, so a local manifest naming the production Supabase project passed. New `validateManifest()` rejects any non-production environment sharing a production resource, `local` included.
3. **Budget had no outcome.** `settleBudget(reservation)` ran the same way for a denial before dispatch and a completed call. It now gets `'release'` or `'charge'`; a provider timeout is charged, because the request was sent.
4. **A failing audit sink replaced the real reason.** If `audit()` threw while recording a denial, the caller saw the audit error instead of the denial. The denial now always propagates, with `auditFailed: true` for alerting.

Four tests added for 2–4 (32 total). **Not run here** (no Node); `.mjs.txt` files are renamed to `.mjs` to run: `node --test gateway.test.mjs`.

## Still to do (from your STATUS.md, unchanged)
Repo integration through the existing capability system (no parallel role/RLS schema), identity and policy adapters, a real audit sink, provider integration, accessibility validation, institutional authorization.
