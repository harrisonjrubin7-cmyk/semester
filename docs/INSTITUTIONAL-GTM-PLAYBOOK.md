# Institutional GTM Playbook

How Semester sells to universities, from a target account through renewal.
Launch-readiness Phase 3.

The rules are code wherever code can hold them:

| Rule | Where |
| --- | --- |
| Sales stages, the gate before each one, and how each maps onto #817's account status | `SALES_STAGES`, `SALES_EXIT`, `ACCOUNT_STATUS_OF` and `salesMoveProblems()` in [`app/src/lib/gtm/stages.ts`](../app/src/lib/gtm/stages.ts) |
| What an answer to an RFP may claim | [`HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](HIGHER-ED-RFP-RESPONSE-LIBRARY.md), from `app/src/lib/gtm/rfp.ts` |
| What a pilot must agree | `pilotReadiness` in #817, and [`PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md) |
| Price, discounts, who approves | [`operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md), `governance/deal-desk.ts` |

## Where GTM records live

harrisonjrubin7-cmyk/semester#817 stores Semester's own institutional pipeline in
the database: accounts, the buying committee, the decision log, pilots and
their outcomes. They sit at platform scope behind a new `account:manage`
capability that only Semester's sales role (`account_executive`) holds, and a
customer school's configurers can read only their own account. That PR came
first, and the pilot rules live there.

The launch command's full list (`sales_contacts`, `qbr_records`,
`renewal_records`, …) is broader than #817's tables. Before it grows, the
council should confirm three things, because this is the same database
students' records live in:

1. **No personal data about contacts beyond a role and a work address.**
   Meeting notes about named people belong in a CRM, not beside student data.
2. **No student data ever joins a pipeline table.** Pilot outcomes are
   cohort aggregates, suppressed below ten.
3. **The capability boundary is tested both ways.** A student and another
   school's administrator must each be refused, as #817's `gtm.check.sql`
   already does for its own tables.

## Ideal customer profile

What decides fit is what Semester can honestly deliver now: a planning and
experience layer, invite-only, with no system-of-record integration yet.

**The ranking is owned by [`commercial/MARKET-SEGMENTATION.md`](commercial/MARKET-SEGMENTATION.md)
and [`commercial/IDEAL-CUSTOMER-PROFILE.md`](commercial/IDEAL-CUSTOMER-PROFILE.md)**, dated later
and carrying the evidence state: first a private or regional four-year program or
student-success unit, then honors, first-year or transfer programs, then a
college or department advising unit. This list used to rank transfer-heavy
community colleges first and private colleges third; those are hypotheses, not
a measured order, so they are no longer ranked here. Each of the following
qualifies on the same disqualifiers, and
[`commercial/ACCOUNT-SCORING-AND-FORECAST.md`](commercial/ACCOUNT-SCORING-AND-FORECAST.md)
orders actual accounts:

- **Transfer-heavy community college, or one department of a regional
  public university.** The pain is concrete (planning, deadlines, where to
  get help), a cohort of 50–200 is natural, and no SIS write is needed.
- **A career center, library or research office** whose service is under-used
  because students can't find it. It needs only the directory and human-help
  modules.
- **A private college**, when the champion is in student success rather than
  IT.
- **Multi-campus or state systems**: later. The multi-campus rules exist
  (`governance/hierarchy.ts`), but no single campus is live yet.

For each target, record the following on the account (#817's tables, or a CRM for anything about named people):
- institution type and size
- stack (SIS, LMS, CRM, advising)
- the problem in the champion's words
- budget cycle
- RFP or procurement status
- security and accessibility requirements
- the buying committee
- data readiness
- the proposed cohort
- the outcome hypothesis
- the target term
- the referral source

## Stages

The gates are in `SALES_EXIT`, summarized here:

| Entering | Requires |
| --- | --- |
| qualified | A named champion, the problem in their words, a budget cycle and a decision process |
| outcome_workshop | The buying committee mapped, including IT, privacy, accessibility and the academic sponsor |
| proposal | Security, privacy and accessibility review started, answered from the RFP library |
| pilot_or_implementation_SOW | A pilot plan with no `pilotReadiness` problems (#817) |
| contracted | Procurement and legal signed; no deal-desk refusals |
| live | The launch council's go for the first cohort |
| renewal | A signed, final `pilotVerdict` (#817) with outcomes measured |

An opportunity moves forward only, and can't skip a gated stage.
`closed_lost` is reachable from anywhere. A lost deal comes back as a new
target account, with fresh discovery.

## Buying committee

Expect, and map before the outcome workshop:
- the academic sponsor (provost's office or student success)
- the champion
- IT and identity
- the security office
- privacy or the registrar (FERPA)
- accessibility or disability services
- procurement
- legal

For a pilot using AI features, add whoever owns AI policy.

## What is never said in a sale

Anything the RFP library would refuse:
- certification or compliance claims without a third party's report;
- a university system "integrated" while no adapter is installed;
- a customer named as a reference without their written consent;
- a feature from an open pull request described as available.
