# Contributing to Semester

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is the short version of how a change gets from your branch to `main`; stop reading and open [`docs/developers/ONBOARDING.md`](docs/developers/ONBOARDING.md) if you have not yet cloned the repository and run it.

[`CLAUDE.md`](CLAUDE.md) is the authority for working in this repository, and this page does not replace it. Where the two differ, `CLAUDE.md` wins.

## Before you start: check main for the thing itself

Several sessions work in this repository at once and reach the same finding within minutes of each other. Before you read or write any code:

```bash
git fetch origin main
git log --oneline -30 origin/main
```

Read it for the defect, not the titles. Then search for the thing:

```bash
git log --oneline -40 origin/main | grep -i <the-thing>
git log -p --since="6 hours ago" origin/main -- <the-file-you-are-about-to-edit>
```

If it has landed, say so and stop. Do not open a second pull request to be thorough, and do not re-tune numbers somebody has already argued for. If you find one, check whether its fix covers every instance yours would have and whether it left the recurrence open; a guard nobody wrote is worth more than the fix twice.

## The flow

1. Branch from `origin/main`.
2. Make the change. Run every npm command from `app/`; the repository root has no scripts.
3. Run the gates that [`CLAUDE.md`](CLAUDE.md) lists, from `app/`.

   ```bash
   npx tsc -b
   npm run lint
   npm run check:university
   npm test
   npm run test:shuffle
   npm run build
   ```

4. If you wrote a guard, show it fails against a revert of the fix, then restore it. See [`docs/developers/TESTING-GUIDE.md`](docs/developers/TESTING-GUIDE.md).
5. Rebase onto `origin/main` before you push, not after CI tells you.
6. Open a pull request. Fill in [`.github/pull_request_template.md`](.github/pull_request_template.md): what and why, the gates you ran, and the sections that apply to a new dependency, a new module, a change advisory or a screen.
7. If you record a decision, write `docs/decisions/D-<pull request number>.md` after opening the pull request. See [`docs/developers/HOW-TO-ADD-A-DECISION-RECORD.md`](docs/developers/HOW-TO-ADD-A-DECISION-RECORD.md).
8. Wait for CI. The `build`, `secrets` and `account-sync` jobs in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) are the checks. See [`docs/developers/TESTING-GUIDE.md`](docs/developers/TESTING-GUIDE.md) for what each runs.

## Review and who approves

[`.github/CODEOWNERS`](.github/CODEOWNERS) names **one** owner today, for the whole tree and again for the paths where a mistake is a security or data incident: `supabase/migrations/`, `supabase/functions/`, `app/server/`, `app/api/`, `packages/institution/`, `.github/` and `contracts/`. The file says this is a gap it records rather than hides.

The branch-protection ruleset in [`.github/rulesets/main.json`](.github/rulesets/main.json) requires a pull request, one approving review, code owner review, the three checks above and an up-to-date branch. It is a definition in the repository. [`docs/BRANCH-PROTECTION.md`](docs/BRANCH-PROTECTION.md) says it is not active until the owner applies it, and its Applied table reads "not yet applied". Until then `main` does not enforce any of it, so the review is a practice, not a gate.

With one code owner, GitHub does not let the author of a pull request approve it. Pull requests an agent opens under the owner's account are the owner's too. [`docs/BRANCH-PROTECTION.md`](docs/BRANCH-PROTECTION.md) sets out the two ways out and which one the owner chose.

The ruleset does not require linear history. Merge, squash and rebase are all open.

## A change is not finished until its page is

If your change alters what the code does, find the page that says what the code does and change it in the same pull request. A page that describes the old behaviour is a defect.

- If the page has a `Rendered from` comment, edit the data and regenerate it: [`docs/developers/HOW-TO-CHANGE-A-REGISTER-PAGE.md`](docs/developers/HOW-TO-CHANGE-A-REGISTER-PAGE.md).
- If a test holds the page, the test will fail until the page agrees with the code.
- If nothing holds the page, you are the check. Read the code, then the sentence.
- Documentation describes actual behaviour. If you cannot verify a claim, leave it out or say it is unverified.
- Pages carry a card line under the title with six fields: Type, Audience, Owner (a council seat, never a person), Truth (`generated`, `held` or `reviewed`), Reviewed (a date) and Held by (the test that holds the page, or a dash). A reference page must be `generated` or `held`. The documentation charter is `docs/documentation/README.md`.
- Do not write that Semester is compliant, certified or secure in any page. Say what a control is, where its evidence is, and what status the register gives it. The registers to read first are [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](PUBLIC-CLAIMS-APPROVAL-REGISTER.md) and [`docs/FEATURE-TRUTH-TABLE.md`](docs/FEATURE-TRUTH-TABLE.md).

## Where things are

- [`docs/developers/README.md`](docs/developers/README.md) lists the contributor pages.
- [`docs/developers/REPO-MAP.md`](docs/developers/REPO-MAP.md) says what lives where.
- [`docs/developers/CODING-STANDARDS.md`](docs/developers/CODING-STANDARDS.md) says what is enforced and what is only practised.
- [`docs/DEFINITION-OF-DONE.md`](docs/DEFINITION-OF-DONE.md) is the standard a feature meets.
