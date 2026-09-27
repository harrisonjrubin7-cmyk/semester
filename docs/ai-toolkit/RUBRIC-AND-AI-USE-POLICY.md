# Rubric self-check and AI-use policy

## Policy precedence

`resolve(use, layers)` in `lib/toolkit/policy.ts`:

**assignment → course → school/program → university → Semester fallback.**

The most specific layer that speaks to a use decides it. At one layer, a rule naming
the use beats a blanket stance. The fallback is **`unavailable`**, shown as *Policy
unavailable — ask your instructor*, and it never permits.

States: `allowed` · `limited` (allowed with disclosure) · `required` · `prohibited` ·
`unavailable`.

Uses on the card: brainstorming, outline feedback, practice, grammar, explaining
material, AI-assisted revision, AI diagrams, data-cleaning suggestions, code help,
final answers for an assessment.

### What the app actually knows

Only the course stance the student recorded from the syllabus (`Course.ai`:
banned / limited / allowed / unstated, plus a note). `fromCourse()` turns it into a
layer labelled **the student's own record — not verified by the instructor**, with
no invented link, effective date or verification date. `unstated` produces no layer,
so the card shows *unavailable*.

A course that "allows AI" still resolves **final answers for an assessment** to
*not allowed*: a blanket permission is not read as permitting that. Only an explicit
rule at some layer could.

Assignment, school and university layers have types and precedence but no source of
data yet — they need instructor- or institution-provided policy, which is the server
phase.

## Prohibited-assessment redirect

`redirect(layers)` offers: plan the steps yourself · write questions for office hours
· explain the concept from course material · practise on a similar problem. Each
alternative that needs AI is itself checked against the policy, so a course that
bans AI is only offered the first two (tested).

## Rubric self-check

`interpret(rubric)` splits a pasted rubric into criteria (a line carrying points:
"— 30 points", "(10 pts)", ": 20") and turns each descriptor sentence into a check
item **in the rubric's own words**. The disclaimer sits above the checklist:

> This is a study and revision guide made from the rubric's own words. It is not a
> grade prediction and not feedback from your instructor.

Nothing reads the student's work, so nothing could score it; the test checks the
output for any prediction language.

## AI-use declaration

Fields: assignment, course, tool, version, dates, uses, purpose, **kind of material
by name (never its content)**, interaction summary, output used, sources checked,
calculations/code verified, edits, limitations, attestation. Download and copy stay
disabled until the gaps are filled and the attestation is ticked. Behind
`VITE_TOOLKIT_DISCLOSURE`.
