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
| Never put tokens in a URL; single-use server-recorded handoff transaction | No handoff service; no native client to hand off to | Not started. Builds only with the first native client |
| Deferred signup: sample preview before account, preview survives signup | The demo/sample course exists and is labelled a sample (`SampleMark`); no preview-to-account carry | Partly native. Carry not built |
| Server-authoritative, versioned onboarding journeys (`onboarding_*` tables, RLS) | Onboarding progress is `seenOnboarding` in client state, synced with the account | Not started. A schema and RLS change; its own reviewed PR |
| Funnel and activation event taxonomy | Designed in `MARKETING_ANALYTICS_EVENT_TAXONOMY.md`; **no analytics module exists** by decision D-4 | Designed only. Collection waits on the owner's analytics decision |
| Role-specific landing pages, `/download`, `/trust`, pilot intake | `company-site/` (96 views) and `app/src/site/`; two stacks, see `COMPANY_SITE_CURRENT_STATE.md` | Exists; convergence is owner decision D-2 |
| Fake store badges, download counts, unevidenced claims forbidden | `docs/marketing/FTC_TESTIMONIAL_AND_CLAIMS_POLICY.md`, the claims register | Already policy |
| Growth and onboarding operations consoles (`/app/ops/growth`) | Console has ten tabs; none for growth or onboarding | Not started |

## What the go/no-go decision still limits

Individual acquisition is invitation-only and a design-partner pilot is non-activation, so the PDFs' "Start free" and paid-pilot paths are not turned on by this work. `GO-NO-GO-DECISION.md` governs; the PDFs do not override it.

## Contract for the one thing built

`?src= &cid= &content= &ref= &role= &continue=` — all optional, parsed by `parseEntry`. `src` and `role` come from fixed lists; ids match `[A-Za-z0-9_-]{1,64}` (a token, URL or path fails that and is dropped); `continue` must pass `linkedScreen`, so a cold deep link cannot strand anyone. `role` is stored as `roleHint` and nothing reads it as authority: who somebody is stays with the signed-in account.

## Proof

`lib/entrycontext.test.ts`: 18 tests. With the `afterSetup` change in `state/slices/navigate.ts` reverted, the two setup tests fail (2 failed, 16 passed); restored, 18 pass.

## Left open, in dependency order

1. Owner decisions D-2 (one public renderer) and D-4 (analytics) in `MARKETING_SITE_BACKLOG.md`.
2. Marketing links that actually use the parameters: they point at a personal GitHub Pages host today (item C-12).
3. Preview-to-account carry for the sample plan.
4. Server-side onboarding journeys and RLS; then the activation taxonomy against them.
5. Handoff transactions and Universal/App Links, after a native client exists.
