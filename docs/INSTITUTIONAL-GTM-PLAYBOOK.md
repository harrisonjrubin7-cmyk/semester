# Institutional GTM Playbook

How Semester sells to universities, from a target account through renewal.
Launch-readiness Phase 3.

The rules are code wherever code can hold them:

| Rule | Where |
| --- | --- |
| Sales stages and the gate before each one | `SALES_STAGES`, `SALES_EXIT` and `salesMoveProblems()` in [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |
| What an answer to an RFP may claim | [`HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](HIGHER-ED-RFP-RESPONSE-LIBRARY.md), from `app/src/lib/gtm/rfp.ts` |
| What a pilot must agree | [`PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md) |
| Price, discounts, who approves | [`operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md), `governance/deal-desk.ts` |

## A decision: GTM records are not stored in Semester

The launch command lists about thirty tables for GTM, including
`sales_accounts`, `sales_contacts`, `buying_committee_members`,
`champion_records`, `pilot_baselines`, `qbr_records` and
`renewal_records`. **This phase adds none of them, deliberately.**

- **The data would be in the wrong place.** These tables would hold named
  contacts at other organizations, deal values and meeting notes. This
  repository is public, and Semester's database is the one students' records
  live in. Putting company pipeline data beside student data, behind the same
  row-level security, turns a student-privacy boundary into a sales-data
  boundary. A mistake in one then becomes a disclosure in the other. The
  command's own rule, "do not expose company pipeline data to students or
  unrelated tenant users", is best kept by not putting it there.
- **A CRM already does this.** A small company's pipeline is better held in a
  CRM, and its documents in the company's document store, both with access
  limited to the people who sell.
- **What does belong here is the discipline.** Stage gates, charter rules
  and claim rules must be the same for every deal and reviewable in one
  place, so they are code. The records are checked against them.

If the council decides otherwise, the tables should go in a separate project
from the student database, not in `public` beside it.

## Ideal customer profile, in order of fit today

What decides fit is what Semester can honestly deliver now: a planning and
experience layer, invite-only, with no system-of-record integration yet.

1. **Transfer-heavy community college, or one department of a regional
   public university.** The pain is concrete (planning, deadlines, where to
   get help), a cohort of 50–200 is natural, and no SIS write is needed.
2. **A career center, library or research office** whose service is under-used
   because students can't find it. It needs only the directory and human-help
   modules.
3. **A private college**, when the champion is in student success rather than
   IT.
4. **Multi-campus or state systems**: later. The multi-campus rules exist
   (`governance/hierarchy.ts`), but no single campus is live yet.

For each target, record the following in the CRM, not here:
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
| pilot_or_implementation_SOW | A draft charter with no `charterProblems()` |
| contracted | Procurement and legal signed; no deal-desk refusals |
| live | The launch council's go for the first cohort |
| renewal | The pilot reached `decide` with outcomes measured |

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
