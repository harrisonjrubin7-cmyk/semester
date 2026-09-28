# Launch Decisions — for the owner

Code can't finish a launch on its own. This page lists the decisions and
sign-offs only the owner can supply, in the order they unlock things. The
council's register is [`GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) (12
gates, verdict `NO-GO`), and the technical list is
[`GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md). This page
adds no gates of its own. It says who has to act for each one to move.

"Owner" below means Harrison Rubin, the founder, unless a row says otherwise.
One person can hold several seats at pilot scale. The council doc allows that,
but security, privacy and accessibility each need someone qualified, even if
only as an advisor.

## Step 1 — This week. Nothing here costs much, and everything after waits on it

| # | Decision | Why it blocks | Unlocks |
| --- | --- | --- | --- |
| 1 | **Take the seats you can hold**: founder, product, engineering and customer success. Write your name into [`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md). | Every seat is vacant. "A vacant seat is an unowned risk." | `escalation-owners`, and every sign-off |
| 2 | **Create a support address** separate from your personal email, e.g. a Google Workspace mailbox on the product domain. Update `SUPPORT` in `app/src/lib/privacy.ts`. | The app and both legal drafts point at a personal Gmail. | `operations-live` (support routing), `onboarding-support` |
| 3 | **Make a failed production check reach you.** In GitHub, watch the repository with Actions notifications on, and confirm a failed `Production smoke` run arrives on your phone. | Go-live says "alerting to a named person". Today no alert reaches anyone. | Go-live: error monitoring (partly), `operations-live` |
| 4 | **Form the company**, e.g. an LLC, and choose the state. | Terms, the privacy policy, contracts and a DPA all need a party to sign as. | Item 5, every customer contract |
| 5 | **Get the legal drafts reviewed.** Take [`docs/legal/`](legal/) to a lawyer. Ask Vanderbilt's Wond'ry about student-founder legal resources. Resolve every `[DECIDE]`: minimum age, FERPA wording, liability, governing law. | No terms or privacy policy are in force. You cannot sell to anyone without them. | `terms-reviewed`, COPPA-1, selling to individuals |
| 6 | **Choose where production is served.** GitHub Pages cannot send security headers. Vercel (you already have a `semester-shared-core` project there), Netlify or Cloudflare Pages all can. The headers are already written in `app/vercel.json` and `app/public/_headers`. | Go-live: "Security headers configured at the host". | That go-live line, once a probe of the live site shows the headers |

## Step 2 — Before the first pilot school

| # | Decision | Who | Unlocks |
| --- | --- | --- | --- |
| 7 | **Find the champion**: a named person at one school (a department, advising office or course) who agrees to pilot. | Owner, then the champion | `champion` seat, `pilot-outcome` |
| 8 | **Agree the data scope in writing**: which school systems connect, if any. The pilot can run with none. | Champion + owner | `data-scope` |
| 9 | **Agree 2–3 success measures and a baseline** from [`PILOT_PLAYBOOK.md`](market-readiness/PILOT_PLAYBOOK.md). | Champion + owner | `pilot-outcome` |
| 10 | **Grant engineering access to production Supabase** so the restore drill, the rollback test and the rate-limit migration can run against it. Then watch the drill run. | Owner (dashboard) | `backup-restore`, `flags-rollback`, go-live restore / rollback / rate limits |
| 11 | **Commission an accessibility review** of the piloted screens by someone qualified. A university disability-services office or an accessibility firm can do it. | Owner | Go-live accessibility audit, `onboarding-support` |
| 12 | **Hold security and privacy seats**, even as part-time advisors. | Owner recruits | `no-blockers` sign-off, `terms-reviewed` sign-off |

## Step 3 — Before selling each package

These are the plan's own conditions ("Before selling each package, use a
package-specific launch test"). Each package needs everything in the rows
above it.

| Package | Additionally needs |
| --- | --- |
| **Individuals** | Items 1–6 done. Decide on pricing, and add billing if you charge; none exists in the app today. The go-live blocking list is clear. |
| **Departments** | A department sponsor. The department-admin role tested end to end. An order form, reviewed by counsel. Training material for staff. |
| **Institutions** | A DPA. HECVAT and VPAT/ACR completed (see `docs/trust/`). SSO tested against the school's IdP. A written SLA. A UAT sign-off. |
| **Enterprise** | SOC 2 (months, with an auditor). 24/7 P0/P1 on-call, which means more than one person. Load and DR evidence. A migration plan. An enterprise SLA. |

## What does not need you

The following is engineering work that can proceed in parallel. Three pieces
are already built but not yet proven in production:

- **Host security headers**: `app/vercel.json`, `app/public/_headers`. These
  wait on item 6.
- **Rate limits on the Supabase-direct paths**:
  `supabase/migrations/20260928220000_direct_rate_limits.sql`. They reach
  production when merged. After that, confirm them with the query in
  `supabase/DEPLOY.md`, and read the Auth endpoint limits off the dashboard.
- **The golden-path journey**: `app/scripts/golden-path.mjs`, which runs in CI.
  Resuming through an account on a second device still needs a backend it can
  sign in to.

Still to build: an app-wide read-only mode and a known-issues page. Once a
decision above is made, tell Claude which one and it can carry out the
repository side.
