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
| Pages | `app/src/site/pages.tsx` (21 content routes), `app/src/site/more.tsx` (9 platform, trust and buying routes, with their tables as data in `app/src/site/platform.ts`) `app/src/site/benchmark.tsx` (6 benchmark routes, with their data in `lib/standard.ts`, `lib/transparency.ts`, `lib/interop.ts` and `lib/vocabulary.ts`) and `app/src/site/oneos.tsx` (2 one-operating-system routes, with their data in `lib/oneos.ts`), plus 5 tool routes, all listed in `app/src/site/render.tsx` `ROUTES` |
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
| `/trust/data-and-ai-transparency/` | The plain-language commitment; source, scope and status; the information table built from the app's own inventory; how AI works and the six things shown when it is used; the controls as the rows under Me; six things Semester never does, each held by a path; retention and portability; the required supporting documents with the legal register's status for each (`lib/transparency.ts`) |
| `/platform/integrations/` | The public integration registry: LTI, LTI Advantage, OneRoster, identity, SCIM, APIs, SIS, Caliper, QTI and CASE, Open Badges and CLR, each with the claims register's word, the implementation principles, the credential lifecycle and the four-stage 1EdTech plan with where each stands (`lib/interop.ts`) |
| `/platform/vocabulary/` | The nine owned terms, what each means and where it lives; the home page of each is held to print it (`lib/vocabulary.ts`) |
| `/resources/ai-governance-canvas/` | Ten boxes an institution fills in before turning on an assistant, and how Semester answers the same ten |
| `/research/` | The Academic Friction Index as a method set before its data, and the design-partners council, clinics, student advisory network and design challenge, each marked not yet running |

## The one-operating-system pages

Two pages the second brief of 29 September asked for, both printed from
`lib/oneos.ts`, whose test holds every area and row to rows that exist and
rates each at the weakest of them (D-125):

| Route | Says |
|---|---|
| `/platform/one-operating-system/` | *One Operating System. Every Student Moment.* The positioning as the brief wrote it (the supporting paragraph says *designed as*, not *is*); the student at the centre and nine areas around them, each a script-free disclosure with the student problem, the Semester workflow, who benefits, what connects, what stays official and how it connects back; the five principles; the five destinations; the final eight-question test. Beside every area, one of four words — held by a test, being built, designed, not started — computed as the weakest of the register rows it rests on |
| `/platform/why-not-another-tool/` | The traditional approach beside the Semester approach, eight rows, each with the same computed word, and what the words mean: one piece still being built makes the whole row *being built* |

The test holds both pages to printing every word, and to never printing
“fully built”.

## The community pages

Five pages the community brief of 29 September asked for, printed from
`site/community.tsx`, whose data `lib/connectregister.ts` cites:

| Route | Says |
|---|---|
| `/community/` | *The Semester Community.* The five questions it helps a student answer, six audiences and what each gets, what is built instead of a social network, the rollout order, and seven calls to action, each a page or a person |
| `/community/ambassadors/` | What an ambassador does and gets; never paid per sign-up, and no access to other students’ data |
| `/community/stories/` | Eight prompts and four consent choices; no story published yet |
| `/community/partners/` | Twelve kinds of partner, four verification labels matching what the database can say, and the rules; no partner listed yet |
| `/community/events/` | Ten kinds of session and what every one carries; no event scheduled yet |

The site test holds every one to saying that nothing is running yet, and to
printing no follower or streak word.

And a fifth tool, `/tools/navigation/`: the academic navigation diagnostic, a
guided self-assessment for institutions from `lib/navdiagnostic.ts` — seven
questions, a score, the top friction patterns and an action brief, labelled a
self-assessment and never a ranking.

## The K–12 page

One page for the K–12 edition (D-141), printed from `lib/k12/edition.ts` and
`lib/k12/requirements.ts`:

| Route | Says |
|---|---|
| `/k-12/` | *Semester for high school.* The positioning; that no district or school uses Semester today; whether a district's student data can be accepted, printed from `mayTakeDistrictData()` with the count of baseline items still short; that nobody under 13 may hold an account; what it leads with and what it does not replace; the five places it would start; each module configured for a school and what it still needs; the 26-week readiness pilot it would offer, with what it includes, leaves out and measures; and the district baseline |

The site test holds the page to saying no district uses Semester, and to
printing the baseline's answer rather than prose.

## The advancement pages

Two pages for alumni relations and fundraising (D-157), printed from
`lib/advancement/edition.ts`:

| Route | Says |
|---|---|
| `/solutions/advancement/` | *Alumni relations and fundraising.* Three parts, each *planned* with what it still needs; that no school uses it, no gift has been taken and no receipt issued; that wealth screening and predictive donor scoring are not planned; what it waits on (counsel, how a gift is paid, a price). |
| `/alumni/` | *For graduates.* What a graduate can do today, which is not giving; what a school might add; that nothing on the page asks for a gift. |

The site test holds both pages to saying nothing is built, forbids a
solicitation, and holds the graduate page's "today" list free of giving.

## Rules the tests hold

- One `<h1>`, one `<main>`, a skip link, and a unique title and description on
  every page.
- Every link goes to another page, into the app, or to `mailto:`.
- No "works at any university" claim (`DECISIONS.md` §1). The footer says
  Semester is built at Vanderbilt first.
- No live-integration claim. The institutions page says no institutional
  connection is live today.
- No checkout on the site: Plus is bought from the Account screen in the app (D-128). Pro is marked *(planned)*, and export, deletion
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
- **This describes the app's public pages** (`app/src/site/`, prerendered into
  `app/dist-site/`): they set no cookie, have no form (`form-action 'none'`),
  and store nothing anyone types. **It does not describe `company-site/`**, a
  separate static site with lead forms that post to the `lead-intake` function
  and are stored in `site_leads` (name, work email, organization, role,
  message; no IP address). `site_leads` has no time-based purge and no retention
  period is decided (`RETENTION.md`; **[COUNSEL REQUIRED]** for the period).
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
   `lib/plans.ts` before the page is public. Plus checkout is in the app (D-128); Pro is not on sale.
3. **An origin.** Set `SITE_ORIGIN` to emit canonical links, social-preview
   URLs and `sitemap.xml`. Without it they are left out rather than guessed.

## Not in this slice

- **Saving from a public tool.** A tool's result does not carry over into the
  app; the index page points to the app for a plan that is kept.
- `/membership/` hands off to the app's Account screen, where the Membership
  panel (P2.3) lives.
