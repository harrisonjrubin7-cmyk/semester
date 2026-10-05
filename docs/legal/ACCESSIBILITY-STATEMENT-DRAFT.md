# Semester Accessibility Statement — DRAFT

> **Not in force. Not reviewed by a lawyer.** A working draft for the
> accessibility owner and counsel, written from what is tested today
> ([`app/src/a11y/`](../../app/src/a11y/),
> [`WCAG-UI-AUDIT-SCORECARD.md`](../WCAG-UI-AUDIT-SCORECARD.md)). It must not
> claim conformance: no manual assistive-technology review has been done.
> The company site promised a one-day response target and a staffed report
> form until 29 September; it now says the founder reads every report and no
> time is promised, as this statement does. Every `[DECIDE: …]` is a question only
> the owner or counsel can answer.

**Date of this statement:** [DECIDE]
**Last reviewed:** [DECIDE]

## 1. Our commitment

We want everyone to be able to use Semester, including people who use a
keyboard, a screen reader, magnification, voice control or reduced motion.
We are building Semester toward **WCAG 2.2 level AA**. We do not yet claim to
meet it.

## 2. What we check on every change

Automated tests run on every change to the app and fail it if:

- a page has serious or critical issues found by the axe accessibility engine,
  on phone and desktop sizes, on the main screens;
- a control has no name a screen reader can read;
- a page has no main region or skip link;
- keyboard focus is not visible;
- motion ignores your device's reduced-motion setting;
- something needs dragging with no alternative;
- meaning is carried by colour or shape alone;
- text and background colours fall below the contrast we set, on every theme.

## 3. What you can adjust

In Settings: text size (four steps), density, and motion (follow your device,
less motion, or low stimulation), or one **Accessibility** preset that sets
large text, comfortable spacing and still motion. Semester follows your
device's high-contrast and forced-colours settings.

## 4. Known limitations

- **No manual review with screen readers** (such as NVDA, JAWS or VoiceOver)
  has been recorded yet.
- **Reflow at 320 pixels wide and 200% zoom** has been checked only on a few
  journeys, not on every screen.
- Some touch targets are smaller than recommended.
- There is **no VPAT / Accessibility Conformance Report** yet.
- Documents and media you or your instructors add may not be accessible;
  Semester cannot fix their contents.

[DECIDE: dates for the manual review and the VPAT.]

## 5. Tell us about a barrier

Email harrisonjrubin7@gmail.com with the subject **Accessibility**. Tell us
what you were trying to do, where, and what you use (browser, device,
assistive technology). A person reads every message. We do not yet promise a
response time [DECIDE: target]; if you have not heard back, write again with
the subject **Accessibility escalation**.

If you use Semester through your school, you can also contact your school's
disability or accessibility office, which can require us to fix a barrier
under its agreement with us.

## 6. Formal complaints

[DECIDE with counsel: the enforcement procedure and regulator to name for the
jurisdictions Semester serves.]
