# Pilot to Annual Conversion

How a pilot ends. Launch-readiness Phase 3. It starts when the pilot enters
`decide` ([`PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md)), which requires
outcomes measured against the baseline agreed in the charter.

## Three outcomes, all real

| Outcome | When | What follows |
| --- | --- | --- |
| **Expand** | The agreed targets are met, and the champion and sponsor want more | An annual proposal at the deal desk tier for the wider scope, followed by implementation for the new cohorts |
| **Extend** | The results are mixed and a named cause can be fixed in time | One extension, within the deal desk's pilot length (6 months in total today), with the fix and a new date written into the charter. A second extension is a stop |
| **Stop** | Targets missed, or the institution's priorities changed | A written summary to the champion; the student data export offered to the cohort (the beta exit path in harrisonjrubin7-cmyk/semester#814, once merged); tenant access ended by the offboarding steps. No renewal pitch |

"Stop" is a required outcome in every charter (`charterProblems()` refuses one
without it), because a pilot that can't end is a free trial with extra steps.

## The decision meeting

Held with the champion and the sponsor, with these on the table:

1. The charter's metrics: baseline, target and result, each from its stated
   source, at cohort level only.
2. Support volume per hundred students, and every accessibility report with
   what was done about it.
3. Cost to serve: AI usage against budget, and support and implementation
   hours.
4. Known limitations that affected the result, stated plainly.
5. Semester's recommendation, which may be to stop.

## Annual proposal

- It goes through the deal desk (`review()` in `governance/deal-desk.ts`). Any
  pilot credit is applied as the policy allows, and never as "free forever".
- The scope is the pilot's scope plus what the results justify, not plus
  everything else.
- It needs a data scope, a DPA and support terms: whatever the pilot ran
  without now has to be in writing.

## After conversion

- **Quarterly business review:** the same metrics as the pilot, plus
  adoption by cohort, support, accessibility and cost. It is written, and
  sent to the sponsor.
- **Renewal:** begins one budget cycle before the term ends, from the QBR
  record, not from memory.
- **Expansion:** each new cohort gets its own charter check and its own
  launch-council go. A contract never launches a cohort by itself.
- **References and case studies:** only with written consent from the named
  person, and never quoting student outcomes below the reporting threshold.

Records of all of this live in the company's CRM and document store, as the
[GTM playbook](INSTITUTIONAL-GTM-PLAYBOOK.md) explains.
