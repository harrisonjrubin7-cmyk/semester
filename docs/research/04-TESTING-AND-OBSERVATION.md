# 04 · Usability, diary, survey, concept and workflow methods

Interviews are in [`03`](03-INTERVIEW-GUIDES.md). This page covers the other
five methods. Each section states what the method can and cannot establish
(source classes from [`01`](01-EVIDENCE-MODEL.md)).

## Choosing the method

| Question | Method | Class produced |
| --- | --- | --- |
| Can people do the task? Where do they fail? | Moderated usability | `observed-use` |
| What happens over weeks, in context? | Diary | `self-report` (rich, remembered close to the event) |
| How common is it, how much? | Survey (needs a sampling frame) | `self-report` |
| Is this idea worth building? | Concept test, with a commitment ladder | `opinion` → `commitment` |
| How does the institution really run this? | Workflow observation | `observed-use` + `artifact` |
| Did anything change? | Pilot measures ([`07`](07-PILOT-AND-LONGITUDINAL.md)) | `observed-use` / `measured-outcome` |

## 1 · Moderated usability tests

**Basis.** The first-win journey in
[`FIRST-WIN-SPECIFICATION.md`](../product-design/FIRST-WIN-SPECIFICATION.md)
and journeys J01, J03, J04, J05 in
[`CORE-USER-JOURNEYS.md`](../product-design/CORE-USER-JOURNEYS.md). J01's
status there is "no filed representative usability run": this is that run.

| Task | Prompt (scenario, not instruction) | Success is… | Measured |
| --- | --- | --- | --- |
| U1 Arrive | "You've just heard about this. Get started however you like." | Chooses sample vs personal data knowingly | Reads the choice? Understands what stays on the device? |
| U2 Set context | "Add one class you're taking this term." | A real course added by any offered route, including manual | Time, route chosen, errors, help sought |
| U3 Confirm | "Is what it shows right?" | Spots and corrects a planted error in the preview | Detection of the planted error (planted deliberately, disclosed afterwards) |
| U4 Today | "What should you do now, and why?" | States the action, its reason, and its source | Comprehension, not clicks |
| U5 Decide | "Do something with it." | Completes, snoozes, corrects or opens the workflow | Chooses with confidence; can undo |
| U6 Help | "You're stuck. Find a person." | Finds a human or non-AI route, understands what is shared | Path, understanding of data shared |
| U7 Source | "Ask it something about your course. How sure are you of the answer?" | Finds and uses the source; recognises a missing one | Reliance calibration |
| U8 Data | "You want your data out and your account gone." | Finds export and deletion; states what will happen | Comprehension of limits |

**Set before testing, written into the study record:** the pass criterion per
task (e.g. "completes unaided"), the severity scale (below) and who decides
severity. Criteria are not changed after the first session.

**Sample.** Five participants per distinct segment per round; a round is run,
fixed and re-run. Because five unaided successes do not show a rate, results
are reported as "n of N" and never as a percentage.

**Severity.** `S1` blocks the task or causes data/trust harm · `S2` causes
error or serious delay · `S3` friction · `S4` polish. Any `S1` involving
privacy, consent or data loss is escalated the same day to the product seat,
outside the research calendar.

**Protocol.**
- Test on the participant's own device and own assistive technology when they
  have one; never force a switch of AT.
- Seeded test data only; participants do not log into their real school
  accounts or show records unless the task needs it, and then with the
  consent tier in [`08`](08-ETHICS-CONSENT-DATA-HANDLING.md).
- Think-aloud is optional; offer retrospective probing for participants
  for whom concurrent speech disrupts AT use.
- The moderator does not help, hint, or defend the design. "What would you do
  if I weren't here?" is the only prompt.
- The product build is pinned (commit recorded) so a finding can be tied to
  the version it was found on.

**Accessibility sessions** use the same tasks on the participant's setup and
add: time with and without their settings; whether any display/input setting
(moment `accessibility-support`) held; where focus or announcements failed.
These findings are `access-barrier` insights and feed the severity process in
[`ACCESSIBILITY-GOVERNANCE.md`](../operating-model/ACCESSIBILITY-GOVERNANCE.md).
They do not replace the qualified manual review the capability register
requires; they inform where it should look.

## 2 · Diary studies

**Why.** Planning and deadline behaviour happens in the moments an interview
cannot see. A diary captures it close to the event.

**Design.**
- Two weeks per round, timed to a real deadline cluster (midterms, finals,
  registration week), so entries describe actual pressure.
- At most **one prompt a day**, answerable in under two minutes, in the same
  spirit as `DAILY_CAP` in `lib/momentfeedback.ts`. A participant may skip any
  day without penalty.
- Prompts are tied to moments: after planning, after getting stuck, after
  asking for help, after using an AI answer. Free text plus one scale.
- No screenshots of course content, grades, messages or other people by
  default. Participants may describe, not upload.
- Entry and exit interviews bracket the diary; the exit interview walks back
  through entries (the diary is the memory aid, not the finding).
- Incentive paid for the full period regardless of how many entries.

**Tooling constraint.** The app promises no third-party analytics
(`app/src/lib/privacy.ts`; `DO-NOT-BUILD.md` rule 10). Do not embed a diary,
replay or survey SDK in the app. Use a separate tool outside the product,
reviewed as a subprocessor if it holds participant data
([`SUBPROCESSORS.md`](../SUBPROCESSORS.md)).

**Limits.** Self-report; self-selected diligence; entries drift toward the
socially acceptable. Treat as `self-report`, never as behaviour.

## 3 · Surveys

A survey measures how widespread something already understood is. It does not
discover. Run one only after interviews have produced the language and options
(otherwise the options are the researcher's guesses).

**Design rules.**
- One decision per survey, named in advance, with the threshold that would
  change it.
- Sampling frame stated: who was invited, by which route, response rate.
  Self-selected links produce `route: inbound` evidence and are labelled.
- Neutral wording, balanced scales, no double-barrelled items, "prefer not to
  say" on sensitive items, no required questions.
- Standard instruments where one exists: Single Ease Question (per task),
  UMUX-Lite or SUS (overall), a trust/privacy index in the termly survey
  already scheduled in `RESEARCH-AND-SERVICE-DESIGN.md`.
- Behavioural items ask about the *last* occurrence, not general frequency.
- **Reporting.** Within research, "n of N". Anything leaving research obeys
  `MIN_COHORT = 10` (`lib/institution-ops.ts`): no cell under 10 is shown, and
  complementary suppression applies. No weighting claims without a frame.
  Confidence intervals, not significance stars, for any comparison.

**Limits.** Stated intent overpredicts action. A survey cannot support a
`willingness` insight above C1 on its own.

## 4 · Concept tests and willingness

**Principle.** Opinion about a concept is cheap and biased upward. Rank what
the participant *does* by the cost to them:

`opinion` < `email address given` < `time booked` < `real data shared` < `referral made` < `signed letter` < `money`

Only the right-hand end is `commitment`. A concept test records the highest
rung each participant reached, not how much they liked it.

**Procedure.**
- Show a labelled concept stimulus (storyboard, static screens or a clearly
  marked mock). The session tells the participant it is an idea, not a product,
  and nothing shown exists unless stated.
- Present one concept at a time (monadic); randomise order if more than one is
  tested in a session. Ask for the problem it addresses *before* any rating.
- Fake-door or smoke tests are allowed **only inside a session or an invited
  cohort, with disclosure and a debrief**. Never on a public page: public
  copy that implies availability that does not exist is a claims violation
  ([`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md),
  CLM-005/CLM-006).
- **Price.** Stated price answers (Van Westendorp, Gabor-Granger) are
  `opinion`. They are used only to bracket a range for a behavioural test.
  The behavioural tests, in order of strength, are those `VALIDATED.md` already
  names: a soft paywall in the pilot, then 20–30 structured pricing
  interviews, then a pre-sale or paid pilot. A checkout path now exists for
  individual Plus ($7.99 monthly, $59 annual;
  [`BILLING-LIVE-ACCEPTANCE-2026-10-03.md`](../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md)),
  but it is held by the governed acquisition control, the only purchase so far
  is the owner's acceptance run, and the prices were set before any
  willingness-to-pay observation. Using the money rung with participants
  needs the acquisition control's approval; until then the strongest rung
  available is real data shared and time booked. (`VALIDATED.md`'s statement
  that payment code does not exist predates this and is stale.)

**Limits.** A concept test can kill an idea (nobody recognises the problem) far
more reliably than it can confirm one.

## 5 · Institutional workflow observation

**Purpose.** Learn how a process actually runs: who touches what, how long it
waits, where work goes around the system. This is where the audit's
institutional claims (registrar, finance, student affairs, IT) are tested.

**Forms.**
- **Contextual inquiry:** shadow one staff member doing one real task for
  60–90 minutes, asking only "what are you doing now, and why?"
- **Service blueprint walk-through:** for any handoff, fill the eight questions
  in [`RESEARCH-AND-SERVICE-DESIGN.md`](../operating-model/RESEARCH-AND-SERVICE-DESIGN.md)
  (capacity, wait, owner, escalation, closure, communication, accommodation
  route, retention).
- **Artifact review:** forms, policy pages, calendars, published SLAs,
  anonymised ticket categories. Class `artifact`; the gap between the artifact
  and the observed process is itself a finding.
- **Workaround inventory:** list every spreadsheet, email thread and sticky
  note that holds process state. Each is a `workaround`.

**Safeguards (non-negotiable).**
- The observer **does not see education records**. Arrange the observation so
  screens showing student information are off, turned away, or replaced by
  test data; if a record is incidentally visible, the observer does not record
  or retain it and tells the staff member.
- The institution's own observer or confidentiality requirements are followed;
  if none exist, a short non-disclosure and no-record statement is signed
  before the first visit. Counsel reviews this text.
- Staff speak as individuals about their work. What one staff member says is not
  reported to their supervisor or any institutional contact, identifiably.
- A student in an observed advising meeting has consented separately and in
  advance, and may stop it at any point.
- Nothing from an observation is used to sell to that office within the same
  term (separation of research and selling, [`02`](02-STAKEHOLDER-RESEARCH-PLAN.md)).

## Method quality checks (apply to every study)

| Check | Question |
| --- | --- |
| Decision named | Which register entry and decision class does this serve? |
| Pre-registered | Were tasks, criteria and analysis written down before the first session? |
| Independence | How many independent sources, and by which routes? |
| Disconfirmation | What was done to try to prove the finding wrong? |
| Segment | Exactly who was and was not sampled? |
| Limits stated | What can this study not tell us? |
