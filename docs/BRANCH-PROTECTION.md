# Branch protection for `main`

**Not active until the owner applies it.** Everything below is a definition in
the repository. GitHub's rules live in the repository's settings, which no
commit can change, so until the steps in *Applying it* have been done and the
check at the end reads back the ruleset, `main` has no required review, no
required checks, and accepts a force-push from anybody with write access. That
is the audit finding (SEC-003, "No branch protection or required review"), and
it stays open until the reading is recorded at the bottom of this file.

## What it requires

The definition is [`.github/rulesets/main.json`](../.github/rulesets/main.json),
in the format GitHub's ruleset import and API both take.

| Rule | Setting | Why |
| --- | --- | --- |
| Pull request required | every change to `main` goes through one | the review and the checks below only exist on a pull request |
| Approving reviews | at least 1 | a second pair of eyes, which is the finding |
| Code owner review | required | [`.github/CODEOWNERS`](../.github/CODEOWNERS) names who; migrations, Edge Functions, the gateway, the scheduler and the host headers are listed on their own so a second reviewer can own exactly those |
| Dismiss stale approvals | on | an approval is of the code that was reviewed, not of whatever was pushed after it |
| Approval of the most recent push | required | the person who pushed last cannot be the only approver of that push |
| Conversations resolved | required | a review comment cannot be merged past unanswered |
| Required status checks | `build`, `secrets`, `account-sync`, from GitHub Actions only | the three jobs in `.github/workflows/ci.yml` that run on a pull request; `notify` runs on push only and is not a check |
| Up to date with `main` | required (strict) | three collisions landed on `main` in one review (`VALIDATED.md` item 4), each green on its own branch |
| Force-push to `main` | blocked | history on `main` is what every deploy and every rollback reads |
| Deleting `main` | blocked | |
| Bypass list | the admin role, through a pull request only | the owner's choice on 28 September (option 2 below): one person has access, and GitHub does not let an author approve their own pull request. Every bypass is recorded on the pull request; a direct push to `main` is still refused |

Linear history is **not** required. `main` already has merge commits (#792),
and the choice between merge, squash and rebase is left open rather than
forced by a setting nobody decided. Add `{ "type": "required_linear_history" }`
to the rules if that changes.

`app/src/lib/branchprotection.test.ts` holds the file to the workflow: rename a
CI job and the required checks must follow, or the test fails — a required
check that no job reports blocks every pull request for ever.

## The one-owner problem, stated

`CODEOWNERS` names one person, and GitHub does not let the author of a pull
request approve it. With this ruleset active and no second reviewer, **the
owner cannot merge their own pull requests**, and pull requests an agent opens
under the owner's account are the owner's too.

That is the finding working as intended, not a flaw in the file: the control
the audit asks for is a second person. The honest options are:

1. **Add a second reviewer** (collaborator with write access), and add them to
   `CODEOWNERS`. This closes the finding.
2. **Add the owner as a bypass actor** (`"bypass_actors": [{ "actor_type":
   "RepositoryRole", "actor_id": 5, "bypass_mode": "pull_request" }]` for the
   admin role). Every bypass is then recorded on the pull request, which is an
   audit trail, but it is not peer review — SEC-003 stays `building` and says
   so.

**Chosen: option 2**, by the owner on 28 September. `main.json` carries that
one bypass actor and `branchprotection.test.ts` asserts exactly it, so
widening it is a commit, not a click. When a second reviewer joins, add them
to `CODEOWNERS`, empty `bypass_actors`, and change the test back: that is
what closes SEC-003.

## Applying it

Either way works; both need repository admin.

**In the browser.** Settings → Rules → Rulesets → New ruleset → Import a
ruleset, and choose `.github/rulesets/main.json` from a checkout. Check that
the imported ruleset shows *Active*, targets the default branch, and lists
`build`, `secrets` and `account-sync` under required status checks, then save.

**With the GitHub CLI**, from the repository root:

```bash
gh api --method POST repos/harrisonjrubin7-cmyk/semester/rulesets \
  --input .github/rulesets/main.json
```

To update it later, find its id and `PUT` the file to it:

```bash
gh api repos/harrisonjrubin7-cmyk/semester/rulesets --jq '.[] | [.id, .name, .enforcement] | @tsv'
gh api --method PUT repos/harrisonjrubin7-cmyk/semester/rulesets/<id> \
  --input .github/rulesets/main.json
```

Rulesets on a private repository need a paid GitHub plan; on a public one they
are free. If the import is refused for that reason, the same rules can be set
as classic branch protection under Settings → Branches, and this file is the
checklist for it.

## Checking it is really on

Do not tick the finding from the settings page you just saved. Read it back:

```bash
gh api repos/harrisonjrubin7-cmyk/semester/rules/branches/main --jq '.[].type'
```

It should list `deletion`, `non_fast_forward`, `pull_request` and
`required_status_checks`. Then try it: push a commit straight to `main` from a
scratch clone (it must be refused), and open a pull request (it must show
`build`, `secrets` and `account-sync` as required).

## Applied

| Date | By | Read back (rule types) | Direct push refused? | Notes |
| --- | --- | --- | --- | --- |
| | | | | not yet applied |
