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
| 1 | **Done, 2026-09-28.** The founder seat, and product, engineering and customer success as "Founder, acting", written into `COUNCIL` in `app/src/lib/launchreadiness.ts` and the table in [`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md), with a dated note there. No sign-off was added: a signature is for a decision, and none is before the council yet. The verdict reads "has not signed" for these four instead of "is vacant". | Was: every seat vacant. Still open: `escalation-owners` names people, not seats — item 2's address and item 3's alert are what let an owner be assigned there. | Every sign-off, once there is a decision to sign |
| 2 | **Create a support address** separate from your personal email, e.g. a Google Workspace mailbox on the product domain. Update `SUPPORT` in `app/src/lib/privacy.ts`. | The app and both legal drafts point at a personal Gmail. | `operations-live` (support routing), `onboarding-support` |
| 3 | **Make a failed production check reach you.** In GitHub, watch the repository with Actions notifications on, and confirm a failed `Production smoke` run arrives on your phone. | Go-live says "alerting to a named person". Today no alert reaches anyone. | Go-live: error monitoring (partly), `operations-live` |
| 4 | **Form the company**, e.g. an LLC, and choose the state. *Done by attestation, 28 September: a single-member LLC ([`HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) COMP-01). Still to record: the legal name, the state and the formation date, and a formation certificate under `docs/evidence/`.* | Terms, the privacy policy, contracts and a DPA all need a party to sign as. | Item 5, every customer contract |
| 5 | **Get the legal drafts reviewed.** Take [`docs/legal/`](legal/) to a lawyer. Ask Vanderbilt's Wond'ry about student-founder legal resources. Resolve every `[DECIDE]`: minimum age, FERPA wording, liability, governing law. | No terms or privacy policy are in force. You cannot sell to anyone without them. | `terms-reviewed`, COPPA-1, selling to individuals |
| 6 | **Choose where production is served.** GitHub Pages cannot send security headers. Vercel (you already have a `semester-shared-core` project there), Netlify or Cloudflare Pages all can. The headers are already written in `app/vercel.json` and `app/public/_headers`. | Go-live: "Security headers configured at the host". | That go-live line, once a probe of the live site shows the headers |

## Step 2 — Before the first pilot school

| # | Decision | Who | Unlocks |
| --- | --- | --- | --- |
| 7 | **Find the champion**: a named person at one school (a department, advising office or course) who agrees to pilot. | Owner, then the champion | `champion` seat, `pilot-outcome` |
| 8 | **Agree the data scope in writing**: which school systems connect, if any. The pilot can run with none. | Champion + owner | `data-scope` |
| 9 | **Agree 2–3 success measures and a baseline** from [`PILOT_PLAYBOOK.md`](market-readiness/PILOT_PLAYBOOK.md). | Champion + owner | `pilot-outcome` |
| 10 | *Partly done, 29 September:* the migration ledger, the fourteen rate-limit triggers and the cron jobs were read off the project through the database connector, read-only, and the plan tier off the organization record (**Pro**, so seven days of daily backups per Supabase's page); all written into `RESTORE.md`, `RETENTION.md` and the go-live checklist. What a connector cannot see is still yours: whether the point-in-time add-on is on and its retention, off Database → Backups, and the drill itself. **Grant engineering access to production Supabase** so the restore drill, the rollback test and the rate-limit migration can run against it. Then watch the drill run. While there, **read the plan tier, the backup schedule, its retention and whether point-in-time recovery is on off Database → Backups**, and write them with the date into the table in [`RESTORE.md`](../RESTORE.md): until then the seven days in `RETENTION.md` is the tier's documentation, not a reading (D-119). | Owner (dashboard) | `backup-restore`, `flags-rollback`, go-live restore / rollback / rate limits; the backup retention becomes a verified figure |
| 11 | **Commission an accessibility review** of the piloted screens by someone qualified. A university disability-services office or an accessibility firm can do it. | Owner | Go-live accessibility audit, `onboarding-support` |
| 12 | **Hold security and privacy seats**, even as part-time advisors. | Owner recruits | `no-blockers` sign-off, `terms-reviewed` sign-off |
| 13 | **Done, 29 September 2026.** The four remediation targets in [`SECURITY.md`](../SECURITY.md) (critical 2 days, high 14, medium 60, low 180; `PATCH_POLICY` in `app/src/lib/supplychain.ts`) were accepted unchanged by the founder acting in the security seat, on the owner's instruction (D-124): *proposed* is out of `SECURITY.md` and `supplychain.ts`, and `app/src/lib/security.test.ts` expects the acceptance line. Still owed for `VULN-1` to move: a finding answered inside its clock. | Security seat, or owner acting | HECVAT `VULN-1` toward `TESTING`, once a finding has also been answered inside its clock |
| 14 | **Done by decision, 29 September 2026 (D-124).** No deletion record survives a restore: the ledger kept outside the database — a salted hash of the account, the table, the time — is not built, because it would keep a trace of who deleted what, which the privacy design does not. The restore exception in `RETENTION.md` and the privacy-policy draft, and the broad notice in `RESTORE.md`, are the standing policy rather than an interim. Made on the owner's instruction without counsel; counsel may reopen it with item 5. | Owner, with counsel | Closed; reopened only by counsel |
| 15 | **Done, 29 September 2026 (D-142).** Both drills ran against production with a throwaway invited account, deleted afterwards. *The kill switch held, 3 of 3:* `npm run drill:killswitch` answered 200, was refused 503 with the runtime's own sentence while `kill.ai_generation` was engaged (22:52–22:55 UTC), and answered 200 again after release; the record is `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`. *The red-team held, 21 of 21:* three canaries in the material of seven prompt builders, sent to claude-opus-5 through the shared key's proxy; no reply carried one, and the transcript is `docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json`. The first files under `docs/evidence/` lifted the compliance crosswalk's ceiling; AI-012 is `evidenced` and AI-010 `tested`. Getting there took the key being set at all (501 until then) and then set cleanly: the first saved value was not a key, which #987 now refuses with a 503 before anyone is counted. Still open: the institution gateway (not deployed) and a per-tenant row were not drilled, and one run on one model is a floor — re-run the red-team on every model change. | Owner (holds the key and the dashboard) | AI-010 `tested`, AI-012 `evidenced`, R-07 mitigated in part; `docs/evidence/` exists |

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
  `supabase/migrations/20260928230000_direct_rate_limits.sql`. They reach
  production when merged. After that, confirm them with the query in
  `supabase/DEPLOY.md`, and read the Auth endpoint limits off the dashboard.
- **The golden-path journey**: `app/scripts/golden-path.mjs`, which runs in CI.
  Resuming through an account on a second device still needs a backend it can
  sign in to.

- **Read-only mode**, built 2026-09-28: `VITE_READ_ONLY=true` on a deploy
  stops every device pushing and shows a standing banner; `SEMESTER_READ_ONLY=on`
  makes the gateway refuse every write with a retryable 503. Registered with
  its engage, confirm and rollback steps in
  [`FEATURE-FLAG-REGISTRY.md`](FEATURE-FLAG-REGISTRY.md) under **Read-only
  mode**; `app/src/lib/readonly.ts` is the app side. Never yet engaged against
  production, which waits on item 10.
- **Known limitations for pilot users**, published 2026-09-28:
  [`pilot/KNOWN-LIMITATIONS.md`](pilot/KNOWN-LIMITATIONS.md), rendered from
  `app/src/lib/knownlimitations.ts` where every entry cites the file that
  states it; printed on the Help screen in the app and at
  `/known-limitations/` on the public site from the same data. Beside it,
  [`pilot/QUICK-START.md`](pilot/QUICK-START.md) and
  [`pilot/FIRST-DAY-CHECKLIST.md`](pilot/FIRST-DAY-CHECKLIST.md), which point
  at the accessibility route on `/accessibility/`. The `known-limitations`
  gate is met; `onboarding-support` is partial, waiting only on item 11.

Once a decision above is made, tell Claude which one and it can carry out the
repository side.
