# Accessibility testing program

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: a program with a strong automated layer, no recorded manual result and no conformance report.** Nothing here is a claim that Semester conforms to WCAG 2.2 AA, has a VPAT or an ACR, or has been tested with assistive technology. `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` prohibits all three (CLM-008). The accessibility seat is held by the founder, acting.

The program's job is to turn "built toward WCAG 2.2 AA" into a record a procurement reader can check: what runs on every change, what runs nightly, what a person ran on which date, and what nobody has yet.

## 1. What exists, measured against what it can see

| Layer | What runs | Where | Can it fail a build? | What it cannot see |
| --- | --- | --- | --- | --- |
| Component guards | Labels, landmarks, focus ring, modal focus trap, reduced motion, drag alternatives, field errors, titles, type scale | `app/src/a11y/*.test.*` (13 files) in `npm test` | Yes | Anything layout-dependent: jsdom has no layout |
| axe-core | Real `<App/>` at 1280 and 390 pixels, serious and critical only | `app/src/a11y/axe.test.tsx` | Yes | Contrast and target size (reported as incomplete in jsdom); 15 render cases only |
| Journey smoke | Seven journeys at 1280 and 320 pixels in Chromium: one `main`, one h1, named controls, valid references, no overflow, skip link | `app/scripts/accessibility-smoke.mjs` via `ci.yml` | Yes | Hand-rolled, not axe; no 375 pixels, no tablet, no real device |
| Token contrast | 11 accents × 13 grounds, both faded strengths, every surface | `app/src/lib/contrast.test.ts` | Yes | What a browser composites |
| Painted contrast | Thirteen grounds, two widths, hover and focus | `.github/workflows/contrast.yml` nightly | **Yes since 4 October** (it could not before; see TR-01) | 58 of 63 destinations by default; 14,025 gradient-painted elements |
| Target size | Three densities, ten routes | `npm run sweep:targets`, local only | No | Not in any workflow |
| Keyboard walk | 40 Tab stops on 13 screens, axe with WCAG 2.2 tags | `app/scripts/keyboard-pass.mjs`, not in `package.json` | No | One recorded run (28 September); axe could not judge contrast in it |
| Manual and assistive technology | The protocol in `docs/accessibility/AT-PASS-PROTOCOL.md` | — | No | **No result exists** |

The table is why the claim ceiling reads as it does: of the layers that fail a build, none can judge colour as painted except one that began working this week, and none involves a person.

## 2. The program, by cadence

### On every change (automated, blocks the merge)

1. The existing guards in section 1, unchanged.
2. **TR-26:** run axe in the real-browser smoke over every destination and signed-in state, add 375 pixels, and add a text-spacing check (WCAG 1.4.12) and an autocomplete check (1.3.5). Today these 19 criteria have no automated evidence at all: 1.2.3, 1.2.4, 1.2.5, 1.3.2, 1.3.3, 1.3.5, 1.4.2, 1.4.5, 1.4.12, 1.4.13, 2.2.1, 2.3.1, 2.5.2, 2.5.3, 2.5.4, 3.1.2, 3.2.1, 3.2.2, 3.3.7. Some can be automated (1.3.5, 1.4.12, 2.5.3, 3.1.2); the rest are manual by nature and belong to section 2.3.
3. A pull request that adds a component states how it was checked with the keyboard alone (the template already asks).

### Nightly (automated, now able to fail)

4. The contrast sweep, with its scope widened from the five "chrome" destinations to all sixty-three on a rotating basis (`SWEEP_SCOPE=all` on a third of nights), and gradient-painted elements measured by sampling the screenshot (the `paint.mjs` helper exists) rather than skipped.
5. The target-size sweep moved into the same workflow.
6. A failure opens an issue titled with the criterion and the destination, and is owned by the accessibility seat. Until TR-02 lands the sweep fails every night on one hover state (and the walls sweep on its own findings); the issue is the record.

### Per release of a high-risk capability, and each quarter (manual, filed)

7. **The assistive-technology pass.** Run the protocol on the golden path and the capability's primary journey, in this matrix, and file the filled protocol under `docs/evidence/accessibility/`:

| Environment | Why |
| --- | --- |
| NVDA with Firefox, NVDA with Chrome | The most used Windows combination |
| JAWS with Chrome | Common in institutions that license it |
| VoiceOver with Safari on macOS and on iOS | The Apple path, and the only mobile screen reader reachable without a device lab |
| TalkBack with Chrome on Android | The Android path (optional until a device exists) |
| Keyboard only, no pointer | Operability |
| 200 % and 400 % browser zoom, 320 pixels, text-only zoom | Reflow and resize |
| Forced colours and increased contrast | The setting some low-vision users need |
| Reduced motion | Vestibular safety |
| Voice control | Label in name; targets reachable by speech |
| Switch access (by keyboard emulation) | Motor access |

8. **Cognitive accessibility review**, by the accessibility seat with one user who did not build the screen, against a fixed list: one primary action per view; plain wording with no retired word; no time limit that cannot be extended (the undo toast lasts eight seconds and is the only timed element found); every error says what happened, what to do and who can help, and keeps the input; no required memory across screens; consistent placement; a way to stop motion and sound; instructions that do not rely on colour, shape or position alone. The access modes (plain language, one step at a time, predictable layout, sensory-friendly) are read by one to three screens each, although the panel says "changes apply everywhere"; the review checks that claim screen by screen and either extends the modes or corrects the sentence.
9. **Mobile review.** Semester is a web app and an installable app. The review runs the journeys on one real iPhone and one real Android phone at the largest system text size, in portrait and landscape, with the on-screen keyboard open, and records touch-target failures against both the 24-pixel WCAG measure and the 44-pixel design floor. A native app, if one is ever built, adds Dynamic Type, TalkBack and VoiceOver gesture tests before its first release (see T4 in the [threat models](THREAT-MODELS.md) for the matching security prerequisite).
10. **Content and media.** Every audio file has a caption file and a transcript (48 of 52 today, TR-40); video has captions and, where it carries information that sound does not, a description; charts have a data-table alternative; live call captions are tested with two people.

### Once, then each year

11. An external assessor produces an assessment report scoped to named journeys, and the VPAT is built from it (TR-47). Until then the statement of accessibility, a draft, says what is true: built toward WCAG 2.2 AA, tested by machine, not yet by people.
12. A study with disabled participants on the golden path. Recruiting, consent and payment follow the research-consent practice in `docs/` and are the product research seat's, not this program's.

## 3. Findings, severity and the barrier route

| Severity | Meaning | Internal fix target | Offered at once |
| --- | --- | --- | --- |
| Blocker | A user cannot complete a primary journey (sign in, see Today, open a course, submit, register, pay) | Next release; flag off the change if it introduced it | An alternative route and a person |
| Major | A user can complete it only with great effort or help | Next scheduled release | The workaround, in writing |
| Minor | An inconvenience with an easy workaround | Planned | — |

These are internal targets. The company site states "no response time is promised", and that is true while one person receives the mail. A deadline-critical barrier (a blocker in the week of a due date, a registration window or a payment deadline) is a SEV3 incident under [IR-11](INCIDENT-PLAYBOOKS.md#ir-11) and follows that playbook.

The barrier route today is an email address and a form that posts to a lead-intake route and returns a reference. Items: a row per report in the accessibility register (below), a named owner, and a closing note to the reporter. No public tracker exists and none is promised.

**The accessibility register** is a table kept in the repository with: ID, date reported or found, source (user, nightly sweep, protocol run, assessor), criterion, destination or component, severity, owner seat, fix commit, guard added, closed date. The guard column is not optional: a fix without a regression guard is reopened at the next release.

## 4. Gating

- A capability's combined risk review asks three accessibility questions ([RR-A11-1 to 3](COMBINED-RISK-REVIEW.md#accessibility)): keyboard-only completion, assistive-technology results for the primary journey, and contrast as painted in empty, error and hover states. Two of the three are blocking and one needs a filed record.
- A release of a high-risk capability is *no-go* with an open blocker on a primary journey, whatever its other scores.
- Public accessibility text is checked against this program: any sentence that names a tool, a date or a scope must point at a file. Four statements on the company site did not when this program was written (TR-03).

## 5. Claim ceiling

Permitted: "Semester includes automated accessibility guards and selected browser accessibility checks" (CLM-007), naming the scope in words that match section 1.
Not permitted until the evidence above exists: no claim of conformance to WCAG 2.2 AA, no VPAT or ACR, no "accessible" or "barrier-free", no statement that screen readers, voice control or switch access work, and no response time for accessibility reports.
