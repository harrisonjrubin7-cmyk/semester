# Go / No-Go Checklist

The twelve requirements a controlled launch must meet before any cohort goes
live. Each one is a gate in
[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts).
[`launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) fails when
a row below disagrees with that data. It also fails when a gate cites a file
that does not exist, and when a gate is marked met while a
[`GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md) line it
depends on is unticked.

**Current verdict: `NO-GO`.** Audited against `origin/main` at `1dd79cd`,
2026-09-27, and moved on 2026-09-28. One gate is met (`known-limitations`),
nine are partial and two are unmet. Four council seats are held (founder, and
product, engineering and customer success held by the founder, acting) and
none has signed; eight are vacant, the `finance` and `operations` seats among them
since 29 September (D-118, D-120). `decide()` gives 31 reasons: the
met gate and four "is vacant" lines became four "has not signed" lines.

## How this relates to the go-live checklist

[`GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md) remains the
**technical** release list: restore, monitoring, headers, rate limits,
rollback, secrets. This checklist is the **council's** list. It takes in the
technical list as one gate (`no-blockers`) and adds the parts that are not
code: agreed outcomes, an approved data scope, named owners, and reviewed terms.
The first list does not replace the second, and the second does not re-state
the first. A gate that depends on a go-live line names it, and the test holds
the two documents in agreement.

## The gates

| Gate | Requirement | Owner | Status | Evidence today | Still missing |
| --- | --- | --- | --- | --- | --- |
| `golden-path` | Golden student path passes end-to-end. | product | `PARTIAL` | `app/scripts/accessibility-smoke.mjs` drives six journeys in CI at two viewports; `app/scripts/cold-smoke.mjs` boots the build cold; `app/scripts/golden-path.mjs` walks one student in CI at two viewports — first run and the account step, a course added from a pasted syllabus through its review and approval (the model reply stubbed), an action made and seen on Today, the deadline on Plan and something added to its day, path details saved on My Path, a deadline's own page with the syllabus sentence it came from and its Source & details, the Guide, the right door for a problem and — in a second CI run with `VITE_HUMAN_HELP` on — the request to a person previewed and never sent, Support, completion, resume after reload and in a second tab, and restore from the backup file into a fresh browser context; `app/scripts/account-sync.mjs` signs one student up and in on two fresh browser contexts in CI, at two viewports, against a local Supabase built from this repository, and carries a finished action from one to the other and a new one back | Syllabus import is proved with the model reply stubbed, and account sync against a local Supabase, not the production project. Human help is proved in a build with `VITE_HUMAN_HELP` on; whether the deployed build has it on is a repository variable nothing here reads |
| `no-blockers` | No P0/P1 security, privacy, accessibility, reliability, or safety blocker. | security | `UNMET` | The go-live Blocking list | Its unticked lines: restore, journal backup, alerting, host headers, Supabase-direct rate limits (built in `20260928230000_direct_rate_limits.sql`; not yet confirmed in production), accessibility audit, incident process, rollback on the production path, secret verification |
| `staging-parity` | Staging configuration mirrors intended production configuration. | engineering | `PARTIAL` | `STAGING.md`: preview branch per pull request; Edge Function parity settled | Nobody has established that a preview branch matches production |
| `backup-restore` | Backup/restore tested. | engineering | `PARTIAL` | `supabase/restore.sh`: a logical-dump rehearsal, passed 2026-09-21; `RESTORE.md`, the procedure | Production has never been restored. RPO, RTO and post-restore policy checks are unmeasured; the rehearsal runs in CI against a disposable database |
| `operations-live` | Monitoring, alerting, incident process, status page, and support routing live. | engineering | `PARTIAL` | Hourly `production-smoke.yml`; `INCIDENT_RESPONSE.md` written | No alert reaches a named person and there is no support address. A status page is live at `/status.html`, without subscriber notifications yet |
| `escalation-owners` | Named escalation owners and response windows. | success | `PARTIAL` | `docs/vanderbilt/incident-routing.md`: windows per signal | Every owner is unassigned |
| `terms-reviewed` | Terms, privacy, consent, and acceptable-use content reviewed. | privacy | `PARTIAL` | `app/src/lib/privacy.ts`: disclosure as data, tested against code; `docs/legal/`: terms and privacy policy drafts for counsel | No qualified review recorded. The drafts are not in force and carry open `[DECIDE]` items: legal entity, minimum age, liability, governing law |
| `data-scope` | Pilot data scope/source ownership approved. | data | `UNMET` | — | No scope to approve, and no source owner named |
| `onboarding-support` | Student/staff onboarding and accessibility support ready. | success | `PARTIAL` | `docs/pilot/QUICK-START.md` and `docs/pilot/FIRST-DAY-CHECKLIST.md`, every address checked against the router by `pilotdocs.test.ts`; the accessibility support route is "Report a barrier" on `/accessibility/` (`app/src/site/pages.tsx`), with escalation to the accessibility seat, and both documents point at it | Only the qualified accessibility audit of the piloted workflows (decision 11); its go-live line is unticked |
| `flags-rollback` | Feature flags, kill switches, rollback runbooks tested. | engineering | `PARTIAL` | `ROLLBACK.md` with measured timings; `app/src/lib/flags.ts` registry and six kill switches; `docs/FEATURE-FLAG-REGISTRY.md` runbook and the read-only mode; `app/src/lib/readonly.ts` — `VITE_READ_ONLY` stops every push and shows a standing banner, `SEMESTER_READ_ONLY` makes the gateway refuse every write with a retryable 503, each side tested and each guard shown red under revert | No kill switch and no read-only mode engaged against production, and rollback not tested on the production path |
| `pilot-outcome` | Pilot outcome baseline and decision criteria agreed. | champion | `PARTIAL` | `PILOT_PLAYBOOK.md` lists what to agree | Nothing agreed and no baseline measured |
| `known-limitations` | Known limitations published internally and appropriately to pilot users. | product | `MET` | `SEMESTER_MARKET_READINESS.md`, internally; `docs/pilot/KNOWN-LIMITATIONS.md` for pilot users, dated 2026-09-28, rendered from `app/src/lib/knownlimitations.ts` where every entry cites the file that states it; printed on the Help screen of the deployed app (`app/src/components/KnownLimitations.tsx`) and on the site at `/known-limitations/` from the same data | — (the site itself has no deployment yet, so the copy pilot users have is the one in the app) |

## The launch condition, part by part

| Part | Gates | Satisfied |
| --- | --- | --- |
| One excellent golden journey | `golden-path` | No |
| One controlled beta | `flags-rollback`, `known-limitations` | No |
| One named institutional champion | `pilot-outcome` | No |
| One approved data scope | `data-scope` | No |
| One support and incident process | `operations-live`, `escalation-owners` | No |
| One real trust/accessibility/privacy evidence package | `no-blockers`, `terms-reviewed`, `onboarding-support` | No |
| One measurable pilot outcome | `pilot-outcome` | No |
| One repeatable implementation path | `staging-parity`, `backup-restore` | No |

The beta part rests on flags and known limitations and not on cohort tooling,
because beta cohorts, invitations and feedback are Phase 1 work that has not
been built. The existing invite gate
(`supabase/migrations/20260921002428_invites.sql`) controls sign-up. It does not
run a beta program. When Phase 1 lands, add its gate to that part.

## Changing a status

1. Change `status`, `evidence` and `gap` in `launchreadiness.ts`.
2. Change this row in the same commit. The test compares them.
3. Raising a status to `MET` requires cited evidence. If the gate names
   `goLive` lines, those lines must already be ticked in `GO_LIVE_CHECKLIST.md`.
4. Re-run `decide(CURRENT)` and update the verdict line above if it changed.
   The test checks that line too.

A gate may also go *down*. When evidence stops being true, lower the status
in the same commit that finds it. Do not wait for the next audit.
