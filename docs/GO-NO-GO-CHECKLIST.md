# Go / No-Go Checklist

The twelve requirements a controlled launch must meet before any cohort goes
live. Each one is a gate in
[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts).
[`launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) fails when
a row below disagrees with that data. It also fails when a gate cites a file
that does not exist, and when a gate is marked met while a
[`GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md) line it
depends on is unticked.

**Current verdict: `NO-GO`.** Re-audited against the current release tree on
2026-10-02. One gate is met (`known-limitations`), nine are partial and two are
unmet. Seven council seats are held (founder; product, engineering, customer
success, accessibility and operations held by the founder, acting; and
privacy/legal held by outside counsel) and none has signed. Five are vacant:
security, trust, data, finance and the institutional champion. `decide()` gives
31 reasons: eleven open gates, eight unsatisfied launch conditions, seven
unsigned held seats and five vacant seats.

## The authority boundary

Every open gate below now carries structured closure requirements in
`app/src/lib/launchreadiness.ts`. The test suite permits only two authorities:

- `production-authority` — the control is in the repository, but somebody
  authorized for the live service must exercise it or read its result;
- `external-approval` — a qualified reviewer, accountable person, counsel or
  pilot institution must accept or decide something code cannot decide.

There is intentionally no `repository` authority. If a missing implementation
can be completed in this tree, it remains engineering work and cannot be
relabeled as an outside blocker. The current set is eleven open gates carrying
thirteen live-service acts or external decisions; the exact action that closes
each is carried next to its gate in code and tested for presence.

| Gate | Authority | Exact closing action |
| --- | --- | --- |
| `golden-path` | Production authority | Run and record the source-backed import, account-resume and human-help journey against the intended production configuration. |
| `no-blockers` | Production authority | Complete the retained-time restore measurement, named-alert exercise and Auth email-limit readback. |
| `no-blockers` | External approval | Obtain and record the qualified accessibility audit. |
| `staging-parity` | Production authority | Compare the live preview branch and production fingerprints, RLS health, function versions and branch-secret readiness. |
| `backup-restore` | Production authority | Run a retained-time restore drill and verify recovery of a seeded, non-empty gateway-journal sample. |
| `operations-live` | Production authority | Dispatch the armed production alert exercise and record the assigned issue delivered to Harrison Rubin. |
| `operations-live` | External approval | Have a backup Semester operator and the pilot institution contacts accept their routes. |
| `escalation-owners` | External approval | Record accepted Vanderbilt contacts and an accepted backup Semester operator. |
| `terms-reviewed` | External approval | Evidence reviewer qualification, resolve the legal decisions and approve the dated publication versions. |
| `data-scope` | External approval | The pilot institution and Semester must approve a bounded data scope and name the source owner for each institutional source. |
| `onboarding-support` | External approval | A qualified accessibility evaluator must audit the six piloted workflows and sign the findings or remediation disposition. |
| `flags-rollback` | Production authority | Exercise and reverse one production kill switch or read-only mode under a communicated maintenance window. |
| `pilot-outcome` | External approval | A named institutional champion must agree the pilot baseline, success measures, stop conditions and decision date. |

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
| `no-blockers` | No P0/P1 security, privacy, accessibility, reliability, or safety blocker. | security | `UNMET` | The go-live Blocking list | Its unticked lines: timed restore, live named-person alert exercise, Auth email-limit readback and qualified accessibility audit |
| `staging-parity` | Staging configuration mirrors intended production configuration. | engineering | `PARTIAL` | `STAGING.md`: preview branch per pull request; Edge Function parity settled | Nobody has established that a preview branch matches production |
| `backup-restore` | Backup/restore tested. | engineering | `PARTIAL` | `supabase/restore.sh`: logical-dump rehearsal passed 2026-09-21; `docs/evidence/restore/2026-10-02-production-physical-restore.md`: completed production physical-backup restore into a separate project with RLS, event-trigger, table and gateway-journal checks | The dashboard view did not retain the start timestamp, so RTO is unmeasured. Production had one newer public table, and the gateway journal had no non-empty row sample |
| `operations-live` | Monitoring, alerting, incident process, status page, and support routing live. | engineering | `PARTIAL` | Hourly `production-smoke.yml`; Harrison Rubin named in the incident and support playbooks; assigned-issue alert path implemented | Dispatch the alert exercise and observe the assigned issue. Institution-side contacts and a backup operator remain unassigned |
| `escalation-owners` | Named escalation owners and response windows. | success | `PARTIAL` | `docs/vanderbilt/incident-routing.md`: windows per signal and Harrison Rubin on every Semester-side route | Vanderbilt IAM, AI, LMS, security/privacy and operational contacts are still institution-supplied inputs; the Semester backup operator is unassigned |
| `terms-reviewed` | Terms, privacy, consent, and acceptable-use content reviewed. | privacy | `PARTIAL` | `app/src/lib/privacy.ts`; the legal drafts; owner attestation naming Jessica Springsteen's 2026-09-30 13:30 review and Harrison Rubin's approval | Reviewer qualification is not independently evidenced and the drafts are not in force: legal entity, liability, governing law, privacy-response timing and publication dates remain open |
| `data-scope` | Pilot data scope/source ownership approved. | data | `UNMET` | — | No scope to approve, and no source owner named |
| `onboarding-support` | Student/staff onboarding and accessibility support ready. | success | `PARTIAL` | `docs/pilot/QUICK-START.md` and `docs/pilot/FIRST-DAY-CHECKLIST.md`, every address checked against the router by `pilotdocs.test.ts`; the accessibility support route is "Report a barrier" on `/accessibility/` (`app/src/site/pages.tsx`), with escalation to the accessibility seat, and both documents point at it | Only the qualified accessibility audit of the piloted workflows (decision 11); its go-live line is unticked |
| `flags-rollback` | Feature flags, kill switches, rollback runbooks tested. | engineering | `PARTIAL` | `ROLLBACK.md`; `docs/evidence/rollback/2026-10-02-pages-rollback-drill.md`: protected production rollback and restoration with live smoke; `app/src/lib/flags.ts` registry and six kill switches; `docs/FEATURE-FLAG-REGISTRY.md` runbook and read-only mode | The Pages rollback path is proved. No kill switch or read-only mode has been engaged against production |
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

The beta part still rests on flags and known limitations because those gates
measure controlled operation, not merely the presence of cohort tooling. The
repository now includes private-beta programs, capped cohort kinds,
invitations, memberships, known issues, feedback and exit requests
(`supabase/migrations/20260928220000_private_beta.sql` and
`app/src/lib/beta.ts`). No live cohort has been created, staffed or observed,
so this implementation evidence does not raise the operational gate.

## Changing a status

1. Change `status`, `evidence` and `gap` in `launchreadiness.ts`.
2. Change this row in the same commit. The test compares them.
3. Raising a status to `MET` requires cited evidence. If the gate names
   `goLive` lines, those lines must already be ticked in `GO_LIVE_CHECKLIST.md`.
4. Re-run `decide(CURRENT)` and update the verdict line above if it changed.
   The test checks that line too.

A gate may also go *down*. When evidence stops being true, lower the status
in the same commit that finds it. Do not wait for the next audit.
