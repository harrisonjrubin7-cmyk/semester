# Manual assistive-technology pass: kit for the first run

**Status: prepared 2026-10-04. The pass has NOT been run.** Every result cell below is `Not tested`. This is the kit
for [`../../accessibility/AT-PASS-PROTOCOL.md`](../../accessibility/AT-PASS-PROTOCOL.md): it pins the build, names
the environments, gives the tester a brief, and lists what the automated sweeps already suspect so a person can
confirm or clear it first. Nothing here is a result. A cell is filled only by the person who ran that step, in that
environment, with the versions recorded.

| Field | Value |
| --- | --- |
| Pass owner | @harrisonjrubin7-cmyk (accessibility lead) |
| Build under test | `main` at `ff84b99c8e6a65ecd8ce4e44824248da8dea5308` (2026-10-04), served locally. **A pass for an ACR must be re-run against the deployed build**, whose URL and commit are then recorded here |
| Pass date | _(not run)_ |
| Testers | _(not named)_ |
| HECVAT rows | A11Y-3 (screen-reader pass). Feeds A11Y-2 (ACR) |
| Automated companion | [`2026-10-04-automated-sweeps.md`](2026-10-04-automated-sweeps.md): sweep evidence only, not a pass |

## 1. A realistic first pass

The protocol's required environments are E1 to E8, E10, E11 (plus E5 and E13 under the program). A first pass does
not have to do all of them at once, and a smaller pass done properly beats a large one done badly. Suggested order,
cheapest first:

| Wave | Environments | What it needs | Notes |
| --- | --- | --- | --- |
| 1 | **E6** keyboard only; **E7**, **E8**, **E9** zoom, reflow, text size; **E10** reduced motion | A browser and nobody else | The lead can run these now. They need no AT |
| 2 | **E3** VoiceOver + Safari (macOS); **E4** VoiceOver + Safari (iPhone) | A Mac and an iPhone, free built-in tools | The lead can run these. If they are new to VoiceOver, see §3; a first-time run is weaker evidence than an experienced user's and the record should say who ran it |
| 3 | **E1** NVDA + Firefox and Chrome (Windows) | A Windows machine; NVDA is free | |
| 4 | **E2** JAWS + Chrome (Windows) | JAWS is licensed; its demo mode runs about 40 minutes per session, enough per journey | |
| 5 | **E5** TalkBack (Android); **E13** Voice Control (macOS/iOS); **E11** forced colours (Windows, Edge) | An Android phone; a Mac or iPhone; Windows | |
| 6 | **E14** switch, **E15** magnification, **E16** Dragon | Only for the ACR | Later |

Wave 1 and 2 can be a single afternoon. **Recruiting at least one experienced screen-reader user from the panel to
repeat the journeys is roadmap item 2 and is what turns this from a first look into evaluation evidence.**

## 2. Setup

1. `cd app && npm ci && npm run dev` (serves on `http://localhost:5173/`). The adoption prompt appears first
   ("Your syllabi. One brain."): choose **Skip** to keep the four sample courses; the golden path needs them.
2. Fresh browser profile; default layout (tab bar, Guided workspace mode); repeat steps 2 and 7 once in **Focused**
   mode (Settings → Workspace mode).
3. Screen reader at default verbosity and punctuation "some"; **turn off any "read page on load" setting**, or the
   page's own announcements cannot be heard.
4. **Step 1 (sign in) needs a seeded test account** (see the "Step 1" row in `docs/GOLDEN-PATH-TEST-SCRIPT.md`).
   None is created by this kit. Without one, record step 1 as `Not tested`, not as a pass on the signed-out app.
5. Write down exact version strings of the AT, browser and OS **before** starting. A result without versions cannot
   back an ACR.
6. Never send anything during step 7 ("Preview what would be sent"): read it, do not send.

## 3. Tester brief (one page)

*You are testing Semester, a student app, with your screen reader or other tool. You are not being tested. The
build is a pre-release, so you will find problems; that is the point.*

1. Open the script in `AT-PASS-PROTOCOL.md` §3. For each step, do the **Do** column and compare with **Expect**.
2. In the results table record, for every step and environment: **Pass**, **Fail**, **Partial**, **Pass with
   workaround** or **Not tested**, **and the words the screen reader actually said**, copied or paraphrased
   closely. "Worked" is not a result; "said 'Button, Save plan, pressed'" is.
3. If you get stuck, say where, what you tried and how long it took. A step that takes ten minutes is a finding
   even if it eventually works.
4. Every Fail or Partial gets a row in the findings ledger (`accessibility-issue-ledger.csv`): step, environment,
   WCAG criterion if you know it (leave blank if not), what happened, what you expected, any workaround.
5. If you are new to VoiceOver: Cmd+F5 toggles it; VO is Ctrl+Option; the rotor is VO+U; Tab moves between
   controls; VO+Right Arrow reads on. Say so in your record: new users find different things than expert users,
   both are useful, and the record should not blur them.
6. Stop and tell the lead if you are asked for personal data or a real account.

## 4. Results matrix (first pass)

Steps are those in the protocol (§3 there). Environments are the first-pass set. Fill each cell with
**Pass / Fail / Partial / Pass with workaround / Not tested**; put the words said and the versions in the full
results table (protocol §4), and link the finding rows here.

| Step | E1 NVDA | E2 JAWS | E3 VO mac | E4 VO iOS | E5 TalkBack | E6 Keyboard | E7 Zoom | E8 320px | E9 Text 200% | E10 Motion | E11 Forced colours | E13 Voice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Sign in | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 2 Today | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 3 Next action | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 4 Path / Plan | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 5 Action / forms | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 6 Workspace | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 7 Help | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 8 Completion | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| 9 Resume | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |

Versions (fill before testing):

| Env | AT + version | Browser + version | OS + version | Device | Tester |
| --- | --- | --- | --- | --- | --- |
| E1 | | | | | |
| E2 | | | | | |
| E3 | | | | | |
| E4 | | | | | |
| E5 | | | | | |
| E6 | | | | | |
| E13 | | | | | |

## 5. Confirm these first (automated candidates)

The sweeps ([`2026-10-04-automated-sweeps.md`](2026-10-04-automated-sweeps.md)) flagged these. They are
**unconfirmed**: a probe can be wrong about overlap a person would not hit, and about names set by a mechanism it
cannot see (two of the first run's candidates were exactly that and are withdrawn in the ledger). A tester should
reproduce each with the keyboard and a screen reader, then set the ledger row to `Confirmed` or `Not reproduced`.

| Ledger ID | Where | What the probe saw | Reproduce |
| --- | --- | --- | --- |
| A11Y-0001 | Today (and Home), 320 CSS px | axe `target-size` (serious) on the third `workspace-text-button` in `.today-action-tools` | 320px window; measure the control and its neighbours; SC 2.5.8 |
| A11Y-0002 | hub, support, launchpad, links | 11 phone / 13 desktop controls under 24x24 (entry titles, "Open ... ↗" links, a select, "Saved") | Measure each with the spacing exception in mind; SC 2.5.8 |
| A11Y-0003 | Write, Sheet, Deck, Launchpad | 15 cards and buttons hit-tested under an element with no role | Tap or click each starter card and "Look back"; does it respond? A re-check of the first three Write starters with real clicks reached them, so this may be clipped gallery items; check the rest |
| A11Y-0004 | Assignments ("Work on it"), 320x640 | Four textareas sit half behind the bottom tab bar when focused | Tab through the form; is each field usable, and does a screen-reader user lose context? |
| A11Y-0007 | Today, Home, Calendar, Courses, Registration, Degree, 1280px | axe `aria-valid-attr-value` `incomplete` | Inspect the element axe names; does the referenced ID exist? |
| A11Y-0008 | Home, desktop, `industry-dark` theme, hover | `.journey-reason` text measures 3.96:1 against 4.5:1 while hovered | Select the Industry (dark) theme, hover the Home journey cards; compare with a colour picker. SC 1.4.3 |

Not for a tester (engineering): A11Y-0005 (the probe's name and timing weaknesses) and A11Y-0006 (not reproduced).

Contrast: axe's `color-contrast` was `incomplete` on every screen. `sweep:contrast` measures painted pixels and is the evidence; it found one hover failure (A11Y-0008) and covered only the shared frame, 5 of 63 destinations (see the sweeps page).

## 6. After the pass

1. Copy the filled tables into `docs/accessibility/AT-PASS-PROTOCOL.md` §4 and §5, or keep them here, with the
   commit under test.
2. Triage each finding (ISSUE-PROCESS §3) the same day: severity, workaround, owner, date.
3. Fill the **Result** column of `AT-PASS-PROTOCOL.md` §7 only from this pass, only for the criteria it covered.
4. Raise HECVAT A11Y-3 only in the same commit that adds the evidence, and only if the pass covered the
   critical journeys in the required environments (`hecvat-readiness.test.ts` refuses the raise otherwise).
5. Write the one-line honest status for the statement draft: what was tested, with what, by whom.
