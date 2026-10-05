# Pilot to Annual Conversion

How a pilot ends. Launch-readiness Phase 3. It starts at the `decide` stage
([`PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md)), with outcomes
measured against the baseline in the pilot plan.

The decision itself is recorded by `pilotVerdict` in
harrisonjrubin7-cmyk/semester#817. That function needs a written decision,
signed by the sponsor, and refuses `convert` or `expand` while a
high-severity security, privacy or policy issue is open.

## Four outcomes, all real

These use #817's `PilotDecision` vocabulary.

| Decision | When | What follows |
| --- | --- | --- |
| **Convert** | The agreed targets are met for the piloted scope | An annual proposal at the deal desk tier for that scope |
| **Expand** | Targets are met, and the champion and sponsor want more | An annual proposal for the wider scope; implementation for the new cohorts, each with its own launch-council go |
| **Pause** | A named cause can be fixed, and the institution wants to try again | The fix and a new date, written down. The whole pilot, pause included, still ends within the deal desk's pilot length (6 months today) |
| **Stop** | Targets missed, or the institution's priorities changed | A written summary to the champion; the student data export offered to the cohort (the beta exit path, harrisonjrubin7-cmyk/semester#814); tenant access ended by the offboarding steps. No renewal pitch |

A pilot that can't stop is a free trial with extra steps.

An "extend" option in the operating-model rollout is not a fifth verdict: it is a new written term recorded as a non-final renewal opportunity (`commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`) and does not lengthen the 26-week pilot.

## The decision meeting

Held with the champion and the sponsor. On the table:

1. The plan's metrics, each with its baseline, target and result from the
   stated source, at cohort level only.
2. Support volume per hundred students, and every accessibility report with
   what was done about it.
3. Cost to serve: AI usage against budget, and the support and
   implementation hours spent.
4. Known limitations that affected the result, stated plainly.
5. Semester's recommendation, which may be to stop.

## Annual proposal

- It goes through the deal desk (`review()` in `governance/deal-desk.ts`). Pilot
  credit applies as the policy allows, never as "free forever".
- The scope is the pilot's scope, plus only what the results justify.
- A data scope, a DPA and support terms must be in writing: whatever the pilot
  ran without has to be written down now.

## After conversion

- **Quarterly business review:** the pilot's metrics, plus adoption by cohort,
  support, accessibility and cost. Written, and sent to the sponsor.
- **Renewal:** begins one budget cycle before the term ends, from the QBR
  record.
- **Expansion:** each new cohort gets its own readiness check and its own
  launch-council go.
- **References and case studies:** only with written consent from the named
  person, and never quoting student outcomes below the reporting threshold.
