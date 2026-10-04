# How to add a route to the institution gateway

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for adding an HTTP route to the institution gateway in `app/server/institution/gateway.ts`; stop reading if you are adding a connector to a school's system, which is an adapter in `app/server/institution/` and needs institutional approval first.

**Status:** MOCK_DEMO. This is the word [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md) gives the institution gateway. It runs locally with its sandbox institution. No approved school adapter is registered in the shipped configuration (`app/server/institution/adapters.ts` is empty), so every route that needs an adapter answers 503 until one is installed. Do not write a student-facing flow that assumes a connected school.

The gateway is a function from a `Request` to a `Response`, built by `createGateway` in `app/server/institution/gateway.ts`. `app/server/institution/start.ts` puts a process around it, and `app/api/institution/[...path].ts` forwards Vercel requests to it with the `/api/institution` prefix removed. The catch-all file does not change when you add a route.

1. Check main for the route: `git log --oneline -40 origin/main | grep -i <the-thing>`.
2. Decide where the route sits relative to authentication. The health routes and `GET /v1/auth/config` answer before it. Every other route is after the bearer-token check and the rate limiter, and, for every `POST` except `/actions/reconcile`, after the read-only-mode refusal. Put a route after them unless it must answer without a token, and say why in a comment if it must.
3. Add the branch in `gateway.ts`, matching on `request.method` and `path`. Return `Response.json(body, { headers })` so the correlation headers and `Cache-Control: no-store` apply. Refuse with `fail(status, sentence, code)` so the response is the shared error envelope.
4. Add the path to `TELEMETRY_ROUTES` in `gateway.ts`. A path that is not in the set is recorded as `/unmatched`, deliberately, so that arbitrary path segments are never logged. A route with an identifier in it needs a pattern in `telemetryRoute`, like the one for `/v1/intelligence/actions/:id/confirm`.
5. If the route writes at a school, follow the two-phase pattern: prepare, show, commit with explicit confirmation. Do not add a single-step write.
6. If the shapes cross the wire, put them in `packages/institution/src/` and import them from there in both the browser client (`app/src/lib/university.ts`) and the gateway.
7. Add a test in `app/server/institution/gateway.test.ts`. Use its `fixture()` helper and `f.request(path, body)`. Include the case where the caller has no token, and assert the telemetry route name.
8. Add the route to the endpoint table in [`docs/UNIVERSITY_CONNECTIONS.md`](../UNIVERSITY_CONNECTIONS.md). If the route sits behind a flag, register the flag, see [`HOW-TO-SHIP-BEHIND-A-FLAG.md`](HOW-TO-SHIP-BEHIND-A-FLAG.md).
9. Run, from `app/`:

   ```bash
   npx vitest run server/institution/gateway.test.ts
   npm run check:university
   npm run smoke:gateway
   ```

## What fails if you get it wrong

These were followed in a scratch copy on 2026-10-04 with a route `GET /scratch/ping`.

| Step | Result |
| --- | --- |
| Route added, step 4 skipped | The existing suite stayed green. A new test that asserted the route name failed with `expected '/unmatched' to be '/scratch/ping'`. Nothing forces step 4; write the assertion. |
| Step 4 done | `gateway.test.ts` passed 45 tests, and `npm run check:university` exited 0. |

Nothing in the repository checks step 8. The table in `docs/UNIVERSITY_CONNECTIONS.md` is hand-kept. `npm run smoke:gateway` was run on the unmodified tree, not on the scratch route.
