# Review fixes to the merged feature expansion

Codex reviewed the twelve expansion PRs (#775 to #850) when each left draft.
Its findings arrived after the PRs had merged into
`semester-unified-platform`, so they are fixed here together. Some findings
were raised on more than one PR; each appears once below.

**Decision:** D-058. **Migration:** `20260928310000_expansion_review_fixes.sql`.

## How each fix was proved

Every fix has a test that fails against a faithful revert of it and passes
with it restored. Where a test could pass for the wrong reason, it has a
control.

## Server

| Finding | Fix | Test |
|---|---|---|
| A publisher could read other offices' actions directly (#833) | Read policy asks `private.may_publish` for rows with an office | `officeactions.check.sql`: registrar and resources-only staff read 0; Financial Aid reads 1 (control); a pre-Phase-J row keeps its rule |
| Delete my account left the demand consent and plan rows (#837, #843, #850) | `forget_my_course_demand()`; both tables listed in `OWNED_TABLES` | `demand.check.sql`: rows and consent gone, another contributor's kept (control), next refresh no longer counts the student |
| Delete my account kept shares an advisor received (#802, #816, #837, #850) | `forget_my_advisor_shares()` removes shares at either end | `advisor.check.sql`: none addressed to the advisor left; a share between two others untouched (control) |

## Privacy on a shared device

| Finding | Fix | Test |
|---|---|---|
| Advisor meeting preparation, private notes included, shared by every account (#816, #833, #843) | Store keyed per account (`meetingKey`) | `AdvisorMeeting.test.tsx`: account B sees none of A's; A's is still there |
| Workspace export included private advisor notes (#850) | Backup reads meetings without notes; a restore keeps the device's notes | `workspace-backup.coverage.test.ts`: notes absent, another account's meetings absent, restore keeps notes |
| The shared-with-me view kept one advisor's opened share for the next (#802, #845) | Keyed by account | `AdvisorMeeting.test.tsx` |
| The sharing panel kept the last account's shares (#850) | Keyed by account | Same mechanism as above |
| Office actions stayed on screen for the next account (#845, #850) | Feed state carries the account it was fetched for | `OfficeActionFeed.test.tsx` |
| The office desk kept the last staff member's drafts (#843) | Keyed by account | Same mechanism as above |
| Graduation draft ids crossed accounts (#780) | `cloudOwner` recorded; only the saving account sees or changes it | `GraduationSimulator.phase-d.test.tsx` |

`DemandDesk`, `DemandContribution` and `TrustCenter` had the same stale-state
pattern without a finding, and are keyed by account too.

## Correctness

| Finding | Fix | Test |
|---|---|---|
| The first cost line erased the typed totals (#780) | Typed totals become "Earlier estimate" lines | `GraduationSimulator.phase-d.test.tsx` |
| A switched-off registration reminder could still be pushed (#780) | `PushTop` rebuilds the queue when the reminder changes | `PushTop.regday.test.tsx` |
| Work windows ignored the sleep floor (#802) | Windows clipped to the protected floor | `life-balance.test.ts`, with the floor-off control |
| Lower-case prerequisite codes were missed (#802, #810) | Case-insensitive, with ordinary words ("or 1020") refused | `course-detail.test.ts`, with a control |
| An unchecked share snapshot could crash the advisor view (#802) | `readSharePayload` validates it | `advisor-meeting.test.ts`, `advisor-shares.test.ts` |
| The shortlist outlived a catalog import (#810) | Saved ids carry their code; stale or reused ids count for nothing | `course-detail.test.ts`, with a same-catalog control |
| Removing a file deleted its dependents before the fallible trash step (#810) | The file goes first; on failure nothing changes | `SourceLocker.test.tsx` |
| Provenance recorded the selection at save, not at generation (#810, #816, #837) | Records the sources the draft was generated from | `StudyStudio.test.tsx` |
| Artifact tags survived unconfirming or renaming a skill (#816) | Tags follow the decision | `career-evidence.test.ts`, with a control |
| The clash line named the wrong meeting (#833) | Names the meeting that overlaps | `course-detail.test.ts` |
| Emptying the cart hid Stop contributing (#837) | The standing contribution is found by catalog term and stays stoppable | `DemandContribution.test.tsx`, with a control |
| Wrapped counted every saved schedule in every term (#843, #845, #850) | Counted once, in the term it was planned from | `wrapped.test.ts`, `SemesterWrapped.test.tsx` |
| Reconnecting pulled but did not push (#845) | `pushNow()` after the pull | `OfflineBanner.reconnect.test.tsx`, with a no-account control |
| Action Center opened official sites offline (#845) | `requireOnline('handoff')` | `ActionCenter.test.tsx`, with the online control |

## Second round: Codex on #879

#879 merged while Codex's reviews were still running. They found two more
problems, both introduced by #879's own fixes:

| Finding | Fix | Test |
|---|---|---|
| The reconnect push ran even when the pull had failed, and `push` overwrote the account's copy | Already fixed on the base by main's sync work (#885): every push names the rows this device has read, the server refuses a push naming stale ones, and the device pulls, merges and retries. `pushNow` reuses that push. Nothing added here | main's own sync tests |
| A second account saving the same draft replaced the first account's id | `cloudIds` keeps one id per account; the older one-owner form is read into it | `GraduationSimulator.phase-d.test.tsx`, `graduation.test.ts` |

## Also here

The base branch's backup coverage guard was failing. #793 added a device
store without registering it. It is registered here.

## Rollback

Revert the commit. The migration changes one policy and adds two functions.
To undo it, a later migration restores the policy from
`20260928302000_office_action_feed.sql` and drops the functions.
