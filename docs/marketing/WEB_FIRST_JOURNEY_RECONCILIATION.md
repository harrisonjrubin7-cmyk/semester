# Web-first journey: five Perplexity PDFs against the repository

Date: 2026-10-05. Baseline: `origin/main` at `3bd382d`.
Evidence boundary: source inspection plus the unit tests named below. Nothing was rendered in a browser and nothing here says what is deployed.

## Inputs

Five PDFs, plus a sixth ("Bottom line", 5 pp) that arrived later and restates the same model with scenario-planning funnel ranges and per-role time-to-value timelines; it adds no requirement beyond the table below. All six are "web-first, native as an optional layer": the web-versus-native teardown (16 pp), the journey flowchart (12 pp), the company-site and onboarding system (18 pp), and two conversion-and-deferred-signup reports (12 pp each; the second is a near copy of the first, and only its first three pages differ in what they add). Benchmark figures in them (app-store conversion, time-to-value) are directional and are not adopted as targets here.

## What they ask for, and where each stands

| PDF requirement | Repository | Status |
| --- | --- | --- |
| Web is the default for new visitors; install is optional and after value | Manifest, service worker and share target exist; `lib/onhome.ts` says the app never tells anyone to install; no native app exists | Already the posture |
| Preserve the destination through sign-in | `lib/returnto.ts` (once, 15-minute expiry, re-validated) | Already native |
| Allowlisted destinations only | `lib/deeplink.ts` (`linkedScreen`) | Already native |
| Preserve the destination through **first-run onboarding** | A new install opened on onboarding before reading the address; setup then ended on the import screen | **Gap, closed here** (`lib/entrycontext.ts`, `afterSetup`) |
| Structured, sanitised entry context (source, campaign, role hint); a link grants nothing | Nothing read these | **Closed here**, in memory and `sessionStorage` only, 30 minutes |
| Query strings never carry a role, tenant, entitlement or token | Enforced for the new parameters by `lib/entrycontext.test.ts` | **Closed here** |
| Never put tokens in a URL; single-use server-recorded handoff transaction | `public.handoff_transactions` with `create_handoff` (service role) and `consume_handoff` (signed-in): nonce stored as a hash, 15-minute cap, one use, one answer (null) for every failure, screen from a fixed list. Tested in `supabase/onboarding-journeys.check.sql` | **Server half built.** No Edge Function calls `create_handoff` yet and no native client consumes it; both wait on the first native app |
| Deferred signup: sample preview before account, preview survives signup | In the app, local state is the draft and first sign-in merges it into the account (`docs/CROSS-DEVICE-CONTINUITY.md`, `lib/merge.ts`); the sample is labelled (`SampleMark`). The public site's demo uses fictional data and keeps nothing a visitor typed | **Already native in the app.** Nothing on the public site is entered by the visitor, so there is nothing to carry; none built |
| Server-authoritative, versioned onboarding journeys (`onboarding_*` tables, RLS) | `onboarding_journeys`, `onboarding_assignments`, `onboarding_step_progress`, `onboarding_events` with owner-only reads, no client writes, and `start_onboarding` / `complete_onboarding_step` / `skip_onboarding_step` as the only way to change them. Existing `onboarding_progress` left as it is. No journey is seeded | **Built (migration `20261006000000`), not applied to any live project and not yet used by the app.** What the tour says is a publish decision |
| Funnel and activation event taxonomy | The repo's own taxonomy (20 `marketing_*` events) is now a typed contract with an allowlist and a **no-op sink** (`lib/marketingevents.ts`), consent fail-closed; the PDFs' onboarding events are rows in `onboarding_events`, not a second client taxonomy | **Contract built; collection still off.** §2 of the taxonomy lists six preconditions and none is met |
| Role-specific landing pages, `/download`, `/trust`, pilot intake | `company-site/` (96 views) and `app/src/site/`; two stacks, see `COMPANY_SITE_CURRENT_STATE.md`. Its 26 links into the app now carry `src`, `cid`, `content` and `role=student` (`site.js`, held against the app's parser by `companysiteentrylinks.test.ts`) | **Links built.** Page convergence is owner decision D-2 |
| Fake store badges, download counts, unevidenced claims forbidden | `docs/marketing/FTC_TESTIMONIAL_AND_CLAIMS_POLICY.md`, the claims register | Already policy |
| Growth and onboarding operations consoles (`/app/ops/growth`) | Console has ten tabs; none for growth or onboarding | Not started |

## What the go/no-go decision still limits

Individual acquisition is invitation-only and a design-partner pilot is non-activation, so the PDFs' "Start free" and paid-pilot paths are not turned on by this work. `GO-NO-GO-DECISION.md` governs; the PDFs do not override it.

## What was built after the first pass

1. **Onboarding on the server** (`supabase/migrations/20261006000000_onboarding_journeys_and_handoff.sql`). Clients may read their own rows and published journeys and may write nothing directly; every change is a function that reads the caller from `auth.uid()`, checks the step against the journey version the assignment was made under, refuses to skip a required step, and is safe to retry. What a link said is cut to an allowlist in the database (`private.entry_context`) as well as in the browser, and `entrycontextparity.test.ts` holds the two lists together. `tenant_id` is never client-chosen. 58 checks in `supabase/onboarding-journeys.check.sql`, including a second account, the signed-out role, and account deletion.
2. **Hand-off** (same migration). A routing request, not proof of authority: the app still decides what the account may open.
3. **Event contract** (`app/src/lib/marketingevents.ts`). Unknown fields are refused rather than dropped; five events the server observes cannot be built in the browser; a test reads the module's source for any network, storage or cookie reach, and another that no other file builds a tracker over a real sink, so turning collection on is a deliberate edit to that test.
4. **Company-site links** (`company-site/site.js`, checksum refreshed). Checked in Chromium against the served page: 26 of 26 app links decorated from `?utm_source=youtube&utm_campaign=…`, no page errors. Only `role=student` is sent as a role hint, because every app link on the site is for an individual.

## Found and fixed while building it

The database check caught that Supabase's default privileges grant `EXECUTE` on a new function to `anon` directly, so `revoke … from public` alone left a signed-out visitor able to reach `consume_handoff`. The migration now revokes from `public`, `anon` and (for the two server functions) `authenticated`.

## Not done, and why

- **Applying the migration.** It has run only against a throwaway Postgres 17. Applying it to a live project is a deliberate step with the change-advisory notes in the PR.
- **Publishing a journey, and the app calling these functions.** No journey is seeded and nothing in the app calls `start_onboarding` yet; that needs a product decision on the tour.
- **An Edge Function that creates hand-offs, and any native consumer.** Waits on a native client.
- **Turning collection on.** Preconditions in the taxonomy §2: a recorded owner decision, updated cookie and privacy notices, a first-party endpoint, a consent control, a named retention owner, a denylist test.
- **Admin-facing adoption reads.** Need a cohort floor and a consent decision.

## Contract for the entry link


`?src= &cid= &content= &ref= &role= &continue=` — all optional, parsed by `parseEntry`. `src` and `role` come from fixed lists; ids match `[A-Za-z0-9_-]{1,64}` (a token, URL or path fails that and is dropped); `continue` must pass `linkedScreen`, so a cold deep link cannot strand anyone. `role` is stored as `roleHint` and nothing reads it as authority: who somebody is stays with the signed-in account.

## Proof

- `lib/entrycontext.test.ts` (entry link, merged earlier): with the `afterSetup` change reverted the setup tests fail; restored they pass.
- `supabase/onboarding-journeys.check.sql`: 58 checks. Its first run failed on a signed-out visitor reaching `consume_handoff`; fixed, then 58 pass. The whole suite passes with `SEMESTER_CHECK_REAPPLY=1` (every migration applied twice, schema identical), which also caught two things this migration owed (an allowlist entry in `grants.check.sql`, an index per new foreign key).
- `entrycontextparity.test.ts`: 5 tests. With `'console'` added to the SQL's destination list it fails (2 failed, 3 passed); restored, 5 pass.
- `marketingevents.test.ts`: 16 tests. With a `fetch(` appended to the module, the no-reach test fails; removed, 16 pass.
- `companysiteentrylinks.test.ts`: 19 tests, run against the app's own parser; and the served page in Chromium (see above).

## Left open, in dependency order

1. Apply the migration to a live project after the advisory notes are signed off; publish a first journey.
2. Owner decisions D-2 (one public renderer) and D-4 (analytics) in `MARKETING_SITE_BACKLOG.md`, and the §2 preconditions before any collection.
3. The app calling `start_onboarding` / `complete_onboarding_step` in place of the client-only checklist.
4. Hand-off creation (an Edge Function) and Universal/App Links, after a native client exists.
