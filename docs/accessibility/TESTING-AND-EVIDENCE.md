# Testing, assistive-technology matrix and conformance evidence

Companion to [PROGRAM.md](PROGRAM.md). **Proposal, 2026-10-04.** It extends
[AT-PASS-PROTOCOL.md](AT-PASS-PROTOCOL.md), which stays the script for the golden path and the home of the WCAG
checklist (§7 there). This page says what is tested when, in which environments, by whom, and what each kind of
result is allowed to be cited for.

## 1. The evidence rule

Four kinds of result exist and they are not interchangeable.

| Kind | What it is | May be cited as | May **not** be cited as |
| --- | --- | --- | --- |
| **Guard** | A test or lint in `npm test` / `npm run lint` that fails when the property regresses | Evidence the property holds for the cases it covers | Conformance. A guard reads one property out of the source |
| **Sweep** | A browser script run against a built app for a named commit (`smoke:a11y`, `sweep:contrast`, `sweep:targets`, `keyboard-pass.mjs`) | Regression evidence for that commit | A screen-reader pass; a WCAG audit |
| **Pass** | A named person ran a script in a named environment with versions, and recorded what was said and seen | Evaluation evidence for that build and journey | A certification; a claim about unrecorded journeys |
| **Audit** | An independent evaluator's report against WCAG 2.2 AA, with disabled testers | The basis for an ACR, with its stated scope | A guarantee of future conformance |

Automated tools find a minority of WCAG failures (commonly estimated at about a third of issues). The program
therefore relies on guards and sweeps for *regression* and on passes and audits for *evaluation*, and does not
count a clean automated run as a pass.

## 2. Automated strategy

### 2.1 In CI today (blocking)

| Check | What it enforces | File |
| --- | --- | --- |
| Label rule | Every form control has a name; none loses it to CSS | `app/scripts/labels.mjs` (in `npm run lint`), `a11y/labels.test.ts` |
| axe-core over the rendered app | Zero serious or critical on the screen list (jsdom: contrast and layout rules are `incomplete`, not violations) | `a11y/axe.test.tsx` |
| Landmarks, titles, focus, dialogs, field errors, drag alternatives, live regions, motion, calm, type scale, skip link | Named properties | `a11y/*.test.ts(x)` |
| Contrast ramp | Every accent × ground pairing, every text rung on every surface, non-text 3:1 | `lib/contrast.test.ts`, `.github/workflows/contrast.yml` |
| Text size, density, taps, reach, glass, tokens | Settings move everything; targets; opaque under preference; no stray colour | `styles/*.test.ts` |
| Shuffled order | Tests do not depend on each other | `npm run test:shuffle` |

### 2.2 Run by hand today, to run in CI

`npm run smoke:a11y` (six journeys, desktop and 320px), `sweep:contrast`, `sweep:targets` and `keyboard-pass.mjs`
need a built app and a browser, and are not CI steps. Roadmap item 6 makes them a nightly job on the staging
build that fails on any finding. Until then, G3 runs them for the exact commit and attaches the output.

### 2.3 Guards to add (each one a pull request of its own)

| New guard | Closes | Notes |
| --- | --- | --- |
| Text-spacing run: inject the 1.4.12 overrides and fail on clipping or overlap | U-6 | In `keyboard-pass.mjs` |
| Label-in-name: accessible name must contain the visible text | U-16 | Cheap in the DOM walk; runs in the label audit and axe (`label-content-name-mismatch` is an axe rule) |
| `autocomplete` on credential and profile fields | U-23, U-26 | Static check beside `labels.mjs` |
| Hover/focus content dismissible | U-8 | Browser-driven; a plant for the control |
| Reading order versus DOM order spot check | U-3 | Heuristic, advisory not blocking |
| Alt-text and heading checks on tenant content before publish | R-FAC-1, R-STF-4 | In the authoring flow; see the content standard |
| Caption and transcript presence for every media item | U-9 | Fails the import, not the build |
| Region where a `role="status"`/`alert` is used wrongly (per-keystroke) | U-29 | Static scan for live regions inside list items that rerender |

**Every new probe ships with a control.** `keyboard-pass.mjs` already has `CONTROL=1`, which plants an unnamed
button, a focusable with no ring, an image with no alt, a second `h1` and low-contrast text so a clean run can be
told from a blind probe. A new check adds its own plant, and the guard is shown to go red against a faithful
revert of the fix it was written for before it is trusted (`CLAUDE.md`).

### 2.4 What is deliberately not automated

Meaning of alt text; whether a heading describes its section; reading order that is DOM-correct but makes no
sense; whether an error message helps; whether a task is understandable; plain language; caption accuracy; whether
a custom widget actually behaves under a screen reader. Those are manual, and the matrix below is where they happen.

## 3. Assistive-technology matrix

Supersedes the environment table in `AT-PASS-PROTOCOL.md` §1; E1 to E13 keep their numbers and their meaning.
Changes from that table: TalkBack (E5) and voice control (E13) become **required** for the ACR (the product is
used on phones and voice control is how 2.5.3 failures surface), and E14 to E20 are added.

| # | Environment | Browser | Platform | Required for | Checks |
| --- | --- | --- | --- | --- | --- |
| E1 | NVDA (current), browse and focus modes | Firefox and Chrome | Windows 11 | G3, ACR | Reading, forms, tables, live regions |
| E2 | JAWS (current) | Chrome or Edge | Windows 11 | G3, ACR | Same, plus virtual cursor and forms mode |
| E3 | VoiceOver | Safari | macOS | G3, ACR | Rotor, web spots, forms |
| E4 | VoiceOver, touch and rotor | Safari | iOS, 390pt phone | G3, ACR | Swipe order, rotor, targets |
| **E5** | **TalkBack** | Chrome | Android | G3, ACR | Swipe order, explore by touch, forms |
| E6 | Keyboard only, no pointer, no AT | Chrome and Firefox | Desktop | Every PR touching UI, G3, ACR | U-10 to U-15 |
| E7 | Browser zoom 200% then 400% on a 1280px window | Chrome | Desktop | G3, ACR | U-6, U-7 |
| E8 | 320 CSS px window and a real small phone | Chrome, device | Any | G3, ACR | U-7, touch reach |
| E9 | Text-only zoom 200% and the app's largest text size | Firefox | Desktop | G3, ACR | U-6 |
| E10 | OS reduced motion, then the app's Less motion and Low stimulation | Any | macOS or Windows | G3, ACR | U-17 |
| E11 | Windows High Contrast / forced colours (both Contrast themes) | Edge | Windows 11 | G3, ACR | U-5 |
| E12 | macOS Increase contrast plus Reduce transparency | Safari | macOS | Optional | Glass opacity |
| **E13** | **Voice Control** | Safari / Chrome | macOS and iOS | G3, ACR | U-16, hover-only controls, dictation |
| **E14** | **Switch**: Switch Control (iOS) or Switch Access (Android), or a two-switch keyboard emulation | Safari / Chrome | iOS / Android | ACR | Scan order, activation, drag alternatives |
| **E15** | **Magnification**: Windows Magnifier or ZoomText at 4x; iOS Zoom | Chrome / Safari | Windows / iOS | ACR | Content near focus, hover content |
| **E16** | **Dragon** (current) | Chrome | Windows | ACR | Numbered overlay reaches every control; dictation into every field |
| E17 | Narrator | Edge | Windows 11 | Optional | Cross-check |
| E18 | Screen reader with a refreshable braille display | Any | Any | Optional, first institution that asks | Braille output of tables and maths |
| **E19** | **Media review**: captions, transcript, audio description, live captions | Any | Any | G3 for media, ACR | U-9 |
| **E20** | **Cognitive and reading review** with the panel: plain-language and reading-settings tasks; read-aloud; dyslexia and ADHD users | Any | Any | Quarterly, ACR support | U-27, COGA, §6.11 |

Record **exact version strings** of the AT, browser and OS in every result. A pass without versions cannot back an
ACR (existing rule). A pass is invalid if the screen-reader settings were left to read the page on load, which
hides what the page announces.

### Device and browser coverage

At minimum: the latest and previous major of Chrome, Firefox, Safari and Edge; iOS and Android latest and one
major back; a 320px phone, a 390pt phone, a tablet and a 1280px desktop; light, dark and both Contrast themes;
the three density settings; and the three text sizes. Each G3 pass says which cells it covered. The unrecorded
cells are not claimed.

## 4. Manual passes

### 4.1 Cadence

| Pass | When | Who | Scope |
| --- | --- | --- | --- |
| **Story check** | Every PR with UI | Author, reviewed by an accessibility champion for anything custom | The story's keyboard model; E6 and the screen reader of choice on the changed surface |
| **Journey pass** | At each ring promotion (G3) | Accessibility lead or a delegate, with a panel member for new journeys | The changed critical journeys, rows required for G3 |
| **Full pass** | Quarterly and before an ACR | Accessibility lead plus panel | Every critical journey for every role, rows required for the ACR |
| **Panel session** | Monthly | Product research, with paid panel members | Open tasks on new work; unstructured exploration |
| **Independent audit** | Once before the first ACR, then annually | External evaluator | The scope in the audit contract (§7) |

### 4.2 The journeys

Eight student golden-path steps are scripted in `AT-PASS-PROTOCOL.md` §3 (sign in; Today; next action with
source; My Path or Plan; register, advise or study action; a source-linked assignment; human help; completion).
This program adds a journey list **for each role** in ACCEPTANCE-CRITERIA.md, in the same Do / Expect format,
written as that role's story reaches G3. Roles and their first journeys:

| Role | Journeys to script first |
| --- | --- |
| Student | The eight scripted steps, then pay a bill, request an alternate format, and use the assistant to build a plan |
| Guardian | Accept an invitation; change sharing; view a bill |
| Alumnus | Claim an account; request a transcript; change retention |
| Faculty, TA, tutor | Publish a course item with alt text and captions; grade with the keyboard; set extra time |
| Advisor | Receive and use an agenda; record a follow-up |
| Staff, administrator | Configure a tenant setting; import and fix failures; publish a verified resource; handle an alternate-format request |
| Organisation | Create an event with access fields; check people in |
| Employer | Post a listing; run an assessment with an accommodation |
| Moderator, support | Work a case; use granted support access |

### 4.3 The record

Every pass writes one row per step × environment (the form is §4 of the AT-PASS-PROTOCOL), and every finding goes
to the issue ledger (§6 below, ISSUE-PROCESS §2). The working records are kept in [`first-pass/`](first-pass/); the dated result is filed as `docs/evidence/accessibility-baseline.md` (the artifact `docs/PROOF-CALENDAR.md` names, registered in `app/src/lib/ops/evidence.ts`) with the
commit under test, so the pass can be reproduced and an institution can be shown it. Results are one of **Pass**,
**Fail**, **Pass with workaround**, **Not tested**, **Not applicable**. "Not tested" is a legitimate result and an
honest one; blank is not.

## 5. WCAG 2.2 AA conformance evidence

### 5.1 The evidence table (one row per criterion)

The checklist in `AT-PASS-PROTOCOL.md` §7 is the template. The program adds the columns that make it
evidence, not a list:

| Column | Content |
| --- | --- |
| SC, level, name | WCAG 2.2 Level A and AA only (4.1.1 omitted) |
| Applies to | Surfaces and roles it applies to (web desktop, phone, PDF, email, media) |
| Guard | Test or lint that holds part of it, if any |
| Sweep | Script and commit, if any |
| Pass | Row IDs of the manual results |
| Audit | Auditor's finding reference |
| Result | Supports / Partially Supports / Does Not Support / Not Applicable (VPAT terms) |
| Known limitation | Plain-language limitation, each with a workaround, owner and target date |

**Every Result cell is empty until the manual evidence exists.** A result is filled from a Pass or Audit row and
never from a Guard or a Sweep alone.

### 5.2 Scope declaration

Every ACR and every internal readiness statement begins with the scope: product and version (commit and build
date); surfaces (web, PWA; native clients "none"); roles evaluated; journeys evaluated; environments evaluated;
what is explicitly out of scope (third-party embeds, tenant-authored content, integrations the institution
operates, archived media). The ACR describes the product *as deployed*, not as designed.

### 5.3 Third parties and tenant content

Semester can make its own components accessible. It cannot make a school's own uploaded PDF or an embedded
vendor tool accessible by itself. The ACR says so, names the content-author validation (R-FAC-1, R-STF-4) as the
control, and lists any third-party component (a video player, a payment form, an embedded tool) with its own ACR
or an honest "not evaluated". An extension does not get certified without an accessibility review
(`operating-model/ACCESSIBILITY-GOVERNANCE.md`).

## 6. Statements and what supports them

| Sentence (public or sales) | Needs |
| --- | --- |
| "We build to WCAG 2.2 AA" | Program adopted, owner named, G1 checklist in use. A statement of intent, not conformance |
| "Automated accessibility tests run on every change" | The guards in §2.1, accurate to the list. True today |
| "Our app is WCAG 2.2 AA conformant" | A current ACR with scope and a Supports or Partially Supports result for every criterion. **Not true today** |
| "Tested with NVDA, JAWS, VoiceOver and TalkBack" | A recorded Pass in each, with versions |
| "Independently audited" | The audit report, date and scope |
| "VPAT available" | The ACR itself, current within twelve months |
| "Accessible to everyone" | Never. There is no evidence that could back it |

Every such sentence goes through the claims register (`ops/claims`, `app/src/lib/ops/claims.test.ts`) and counsel
before it is published (gate G5).

## 7. Institutional review artifacts

What a university's accessibility coordinator, IT, procurement and counsel are given, and when. Statuses are as of
this page; each is "no" until its evidence exists.

| Artifact | Contents | Status | Where it lives | Tier |
| --- | --- | --- | --- | --- |
| Accessibility statement | Commitment, scope, standard, known limitations, contact, fix times, feedback and escalation route | Draft only (ACCESSIBILITY-STATEMENT-DRAFT.md) | Public site, once published | Public |
| ACR (VPAT 2.x, WCAG 2.2 edition) | Per-criterion result with scope, version, date, evaluator | **Does not exist** | `docs/evidence/` (registered) | Public once exists |
| HECVAT accessibility rows | A11Y-1 `READY`; A11Y-2, A11Y-3, A11Y-4 `NOT_STARTED` | As stated | `market-readiness/HECVAT_READINESS.md` | NDA |
| Review packet | The program, the criteria, the guard list, sweep and pass records for a named commit, the open-finding ledger, the audit report, the role journey scripts | To assemble when item 2 completes | `docs/evidence/` (registered) | NDA |
| Open-finding ledger | CSV: WCAG 2.2 criterion, severity, evidence, role, owner, remediation, retest, status, dates | Template in ISSUE-PROCESS §7 | `docs/evidence/` (registered) | NDA |
| Section 508 / EN 301 549 mapping | WCAG rows mapped to 508 Chapter 5 and EN 301 549 clause 9 and 11 | Not started | In the ACR | Public once exists |
| Audit contract and report | Scope, method, testers, severity scale | Not started | Evidence folder | NDA |
| Accommodation and alternate-format SOP | The tenant-side workflow Semester supports (ISSUE-PROCESS §6) | Drafted | Customer success | Public summary |
| Accessibility release notes | Every release note has an accessibility section, even "no change" | Governance row, not yet in use | Release notes | Public |
| Procurement answers | The checklist rows that ask about accessibility | `market-readiness/PROCUREMENT_CHECKLIST.md` | NDA |

### The Vanderbilt packet

The institution-specific plan (`docs/superpowers/plans/2026-09-24-vanderbilt-06-accessibility-legal.md`) already
describes a reviewer-ready packet and issue ledger and says it prepares review and does not impersonate approval.
This program supplies the content that plan's accessibility packet needs: the role journeys (§4.2), the matrix
(§3), the criteria and the ledger. The review stays with Vanderbilt's own accessibility coordinator and an
independent auditor; a draft message to them is labelled **NOT SENT** until the owner sends it.

### Conditions to publish an ACR

1. A manual Pass exists for the journeys in scope, with versions.
2. An independent audit has reported, or the ACR says plainly that it has not.
3. Every Critical and Serious finding on those journeys is fixed or has a stated workaround and date.
4. Counsel has read the wording.
5. The raise is committed in the same change as the evidence under `docs/evidence/`; the readiness test refuses
   the raise otherwise (`hecvat-readiness.test.ts`).

## 8. Remediation within testing

When a pass finds a defect:

1. Record it in the ledger with the criterion, the environment, the words the AT said, and the steps.
2. Triage it (ISSUE-PROCESS §3) the same day.
3. Fix the **class**: find the shared component or add the lint rule so it cannot return (the label audit and the
   contrast ramp are the precedents), then fix the instance.
4. Retest in the same environment that found it **and** one other, and record the retest.
5. Close only on a verified retest. A fix that passes a guard but not the AT that found it stays open.

## 9. Test data and safety

- Passes use seeded accounts and the sample courses; **never** production students' records.
- Panel members are paid, consented and given the build and the script in advance; their own AT configuration is
  the one tested, and is recorded.
- Screen recordings and transcripts of sessions are evidence and personal data: stored under the privacy rules, with
  consent, redacted where they show an account.
- Do not send anything while testing "Preview what would be sent" (existing rule in the golden path).
