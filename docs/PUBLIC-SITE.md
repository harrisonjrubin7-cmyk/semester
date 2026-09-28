# Public site

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The company and product website, built as D-011 approved: a separate set of
pages **prerendered to static HTML at real paths**, sharing the app's colours
and typefaces. Content pages ship no JavaScript: every one is indexable,
readable with scripts off, and carries a policy (`script-src 'none'`) that makes
an injected script inert. The four tool pages are the only exception (below).

## Where things are

| | |
|---|---|
| Pages | `app/src/site/pages.tsx` (21 content routes), `app/src/site/more.tsx` (9 platform, trust and buying routes, with their tables as data in `app/src/site/platform.ts`) and `app/src/site/benchmark.tsx` (6 benchmark routes, with their data in `lib/standard.ts`, `lib/transparency.ts`, `lib/interop.ts` and `lib/vocabulary.ts`), plus 5 tool routes, all listed in `app/src/site/render.tsx` `ROUTES` |
| Claims | `app/src/lib/ops/claims.ts`: every capability a page names, its status word, its rows and evidence; `app/src/site/claims.tsx` prints them (D-110). The availability matrix prints its status column from here |
| Tools | `app/src/site/tools/Tools.tsx` (the five tools), `tools/client.tsx` (hydration, bundled as `tools/tools.js`) |
| Frame | `app/src/site/Layout.tsx`: skip link, header, a script-free `<details>` phone menu, footer |
| Styles | `app/src/site/site.css`, with the app's `@font-face` rules prepended at build |
| Plans | `app/src/lib/plans.ts`: one source for the pricing page and the in-app Membership panel |
| Build | `app/scripts/build-site.mjs` renders with Vite's own module loader, writing to `app/dist-site/` (git-ignored) |
| Tests | `app/src/site/site.test.tsx`, `app/src/site/tools/Tools.test.tsx`, `app/src/lib/plans.test.ts`, `app/src/lib/ops/claims.test.ts`, `app/src/lib/standard.test.ts`, `app/src/lib/transparency.test.ts`, `app/src/lib/interop.test.ts`, `app/src/lib/vocabulary.test.ts` |

```bash
cd app
npm run site:build      # SITE_BASE, SITE_ORIGIN and SITE_APP_URL are optional
npm run site:preview    # serves dist-site on http://localhost:4175
```

## The platform, trust and buying pages

Nine pages added for buyers who cannot tell a plan from a product, each saying
which is which. Their tables are data in `app/src/site/platform.ts`, and the
availability matrix prints its status words from the claims register (D-110):

| Route | Says |
|---|---|
| `/platform/availability/` | Every capability by plan — Individual students, Department, Institution, Enterprise — each row a claim of the register with its word, and the sentence behind it |
| `/platform/service-map/` | The eight services in the order a student meets them, and who decides what: Semester coordinates, the record system certifies, the registrar registers, faculty own course policy, students control their plans |
| `/platform/system-boundaries/` | Area by area, what Semester does and what stays authoritative elsewhere |
| `/start/` | A student's first session, step by step, and the nine steps of an institution's pilot |
| `/demo/` | The demo (built to `/demo/` beside the app), ending in a next step per audience rather than "Contact us" |
| `/trust/product-quality/` | What is checked on every build, what is known, and what is deliberately not published; a build stamp when `SITE_COMMIT` or `GITHUB_SHA` is set |
| `/launch/` | What a customer's private launch site holds, and that none exists yet |
| `/pricing/how-it-works/` | What drives each tier's price, what implementation, support tiers, AI usage and migration mean, and how renewals avoid surprises |
| `/resources/campus-launch-kit/` | Email, announcement, signage and social templates, an FAQ, the source-label explainer and a launch agenda |

## The benchmark pages

Six pages the benchmark briefs asked for, each printed from a data module
whose test holds every cited path to the tree:

| Route | Says |
|---|---|
| `/semester-standard/` | Eleven public commitments — every fact has a source, every estimate its limitation, every share a scope and revoke, every critical path keyboard-operable, every AI answer its context, every AI feature a policy boundary, every integration its health, every incident a communication path, every customer an export, every high-risk action an audit, every claim its evidence — each Held, Partly held or Owed, with what holds it and the gap on the page (`lib/standard.ts`) |
| `/trust/data-and-ai-transparency/` | The plain-language commitment; source, scope and status; the information table built from the app's own inventory; how AI works and the six things shown when it is used; the controls as the rows under Me; four things Semester never does, each held by a path; retention and portability; the required supporting documents with the legal register's status for each (`lib/transparency.ts`) |
| `/platform/integrations/` | The public integration registry: LTI, LTI Advantage, OneRoster, identity, SCIM, APIs, SIS, Caliper, QTI and CASE, Open Badges and CLR, each with the claims register's word, the implementation principles, the credential lifecycle and the four-stage 1EdTech plan with where each stands (`lib/interop.ts`) |
| `/platform/vocabulary/` | The nine owned terms, what each means and where it lives; the home page of each is held to print it (`lib/vocabulary.ts`) |
| `/resources/ai-governance-canvas/` | Ten boxes an institution fills in before turning on an assistant, and how Semester answers the same ten |
| `/research/` | The Academic Friction Index as a method set before its data, and the design-partners council, clinics, student advisory network and design challenge, each marked not yet running |

And a fifth tool, `/tools/navigation/`: the academic navigation diagnostic, a
guided self-assessment for institutions from `lib/navdiagnostic.ts` — seven
questions, a score, the top friction patterns and an action brief, labelled a
self-assessment and never a ranking.

## Rules the tests hold

- One `<h1>`, one `<main>`, a skip link, and a unique title and description on
  every page.
- Every link goes to another page, into the app, or to `mailto:`.
- No "works at any university" claim (`DECISIONS.md` §1). The footer says
  Semester is built at Vanderbilt first.
- No live-integration claim. The institutions page says no institutional
  connection is live today.
- No checkout. Every paid price is marked *(planned)*, and export, deletion
  and saved plans are listed as on every plan.
- The product preview is labelled demo data.
- Every capability a page names carries one of six status words from the
  claims register (`ops/claims/README.md`), and the word may not be above
  what the master-register rows behind it support. Nothing on the site prints
  a `data-claim` the register does not know, and `/launch-readiness/` lists
  every claim with what the words mean.
- The home page asks what brought the visitor and sends each answer to a real
  page. Contact routes each topic to a council seat and promises no response
  time it cannot keep. Pricing states currency, billing period, tax,
  cancellation and refunds before anything is for sale. `/legal/` lists every
  policy with its status; none is in force, and the page says so.
- The site sets no cookie, has no form (`form-action 'none'`), and stores
  nothing anyone types.
- The site's colours equal the app's `:root` tokens.
- Only tool pages have a script: exactly one, `tools/tools.js`, same-origin,
  nothing inline. Their policy is `script-src 'self'` and `connect-src 'none'`,
  so a tool cannot send what is typed into it even if its code tried.
- Every tool hydrates without a mismatch (checked by prerendering, then
  hydrating, in the test).

## The readiness pages

`/launch-readiness/` answers four audiences — students, advisors and
departments, institutions, and IT, security, privacy and accessibility
reviewers — from the claims register, and links the status page
(`app/public/status.html`), which probes Semester from the reader's browser.
`/proof/` is the customer proof policy, written before there is proof.
`/legal/` is the policy table: status, version, effective date and owner for
each, with what the page will show once one is in force.

## The public tools

`/tools/graduation/`, `/tools/schedule/`, `/tools/checklist/` and
`/tools/advisor/`. Each is prerendered, so its starting state is readable
without JavaScript (a `<noscript>` note says the controls need it), and then
hydrated by `tools/tools.js` (about 71 kB gzipped, mostly React).

They call the app's own tested functions — `project()` from
`lib/graduation.ts`, `conflicts()` from `lib/registration.ts`, `CHECKLIST` from
`lib/registration-day.ts` — so the website and the app cannot disagree. Nothing
is stored or sent: state lives in the page and is gone when the tab closes. The
advisor planner copies to the clipboard or prints; the student sends it
themselves. The graduation result is labelled *Estimated* and says it is not a
degree audit.

The next term the calculator starts from is fixed when the site is built. A
build that goes months without a rebuild will start from a past term, which the
student can change; rebuild each term.

## Decisions still needed before it is served (none are made here)

1. **Where it is served.** Two options, and either is a production change:
   - The site at the root, with the app moved to `/app/`. This needs a
     redirect for existing `#/…` links.
   - The site on its own domain or path, with the app left where it is.

   The build takes `SITE_BASE` and `SITE_APP_URL`, so both work without code
   changes.
2. **The planned prices.** The blueprint's suggested $7.99 / $59 (Plus) and
   $14.99 / $99 (Pro) are shown as *planned*. Confirm or change them in
   `lib/plans.ts` before the page is public. No billing exists, per D-009.
3. **An origin.** Set `SITE_ORIGIN` to emit canonical links, social-preview
   URLs and `sitemap.xml`. Without it they are left out rather than guessed.

## Not in this slice

- **Saving from a public tool.** A tool's result does not carry over into the
  app; the index page points to the app for a plan that is kept.
- `/membership/` hands off to the app's Account screen, where the Membership
  panel (P2.3) lives.
