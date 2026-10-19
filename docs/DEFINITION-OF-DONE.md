# The Semester Definition of Done

<!-- Rendered from app/src/lib/launchcompleteness.ts by launchcompleteness.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The one standard every feature, launch, contract, integration and claim must meet,
as the complete-company brief of 29 September 2026 asks for it. Beside each question is
where the tree already asks it, and what it does not. The engineering checklist a
pull request meets is [`docs/operating-model/QUALITY-MANAGEMENT.md`](operating-model/QUALITY-MANAGEMENT.md); this is the question behind it.
The crosswalk that holds the rest of the brief is [`docs/LAUNCH-COMPLETENESS.md`](LAUNCH-COMPLETENESS.md).

## The nine questions

| # | Question | Standing | Where the tree asks it | Gap |
| --- | --- | --- | --- | --- |
| 1 | Does it help a real user complete a meaningful job? | designed | [`docs/DO-NOT-BUILD.md`](DO-NOT-BUILD.md) — what is refused because it does not | Asked at review; no test can ask it. |
| 2 | Does it fit the unified Semester system? | tested | [`app/src/lib/oneos.test.ts`](../app/src/lib/oneos.test.ts) — the five destinations, the shared objects, the vocabulary | None. |
| 3 | Is the data persistent, authorized, sourced and explainable? | tested | [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — authorized<br>[`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — sourced | Persistence is device-first; explainability is per Action Center row. |
| 4 | Does it work accessibly and on mobile? | tested | [`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — accessibly<br>[`app/src/widthgate.test.ts`](../app/src/widthgate.test.ts) — on a narrow screen | Automated only. |
| 5 | Is it secure, privacy-safe, observable, testable and supportable? | building | [`app/src/lib/flags.test.ts`](../app/src/lib/flags.test.ts) — every flag has an owner and a rollback<br>[`docs/operating-model/QUALITY-MANAGEMENT.md`](operating-model/QUALITY-MANAGEMENT.md) — the engineering definition of done | Observable: no error tracking. |
| 6 | Can it fail safely? | tested | [`app/src/lib/failure.test.ts`](../app/src/lib/failure.test.ts) — every failure read into a sentence<br>[`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — the AI can be switched off | None. |
| 7 | Can it be configured by an institution? | tested | [`supabase/tenant-plan.check.sql`](../supabase/tenant-plan.check.sql) — the school’s plan<br>[`supabase/intelligence-policy.check.sql`](../supabase/intelligence-policy.check.sql) — the school’s AI policy | Most modules are build flags, not tenant settings. |
| 8 | Can it be migrated, audited, exported, retained and deleted appropriately? | building | [`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) — exported<br>[`supabase/retention-sweeps.check.sql`](../supabase/retention-sweeps.check.sql) — retained<br>[`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — deleted | No production load path for customer data exists; the Migration Center records evidence and roster staging is a foundation. |
| 9 | Can the company honestly sell and support it? | tested | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — no label on the site the register does not know | Support has no address yet. |

**If the answer is “no” to any of those questions, the work is not complete yet.**

## The launch acceptance rule

A feature is not launch-complete because it looks built. It is launch-complete only when it has:

- Persistent data
- Authorization
- Source and freshness labels
- Validation
- Accessibility coverage
- Error handling
- Analytics
- Support ownership
- Tests
- Rollback or feature-flag control

## The core journeys

Launch only after the major journeys work end to end, not on individual screens.
12 journeys; the weakest is **building**: tested 9 · building 3 · designed 0 · not-started 0 · held 0.

| ID | User | Must complete | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LC-JRN-01 | Student | Create account → set profile → build plan → see next action → save work → get help | tested | [`app/src/data/onboarding.test.ts`](../app/src/data/onboarding.test.ts) — onboarding<br>[`app/src/components/ActionCenter.help.test.tsx`](../app/src/components/ActionCenter.help.test.tsx) — next action and help | The next action is behind today_action_center. |
| LC-JRN-02 | Student planning | Select courses → compare options → resolve conflict → save primary plan and backups → prepare advisor agenda | tested | [`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — the plan, backups and conflicts<br>[`app/src/components/AdvisorMeeting.test.tsx`](../app/src/components/AdvisorMeeting.test.tsx) — the agenda | None. |
| LC-JRN-03 | Student learning | Open course → add/select materials → generate study asset → complete practice → view source → save progress | tested | [`app/src/components/StudyStudio.test.tsx`](../app/src/components/StudyStudio.test.tsx) — the studio<br>[`app/src/components/StudyStudio.anchors.test.tsx`](../app/src/components/StudyStudio.anchors.test.tsx) — the source | None. |
| LC-JRN-04 | Student support | Search for help → see verified resource → prepare question → create follow-up action → receive response | tested | [`app/src/components/GetHelp.test.tsx`](../app/src/components/GetHelp.test.tsx) — help<br>[`supabase/help-requests.check.sql`](../supabase/help-requests.check.sql) — the request | The response depends on staff who are not yet there. |
| LC-JRN-05 | Student career | Save project → confirm skills → create portfolio evidence → prepare application or mentor action | building | [`app/src/lib/skills-graph.ts`](../app/src/lib/skills-graph.ts) — suggested, confirmed or verified skills with evidence | No portfolio export or application step. |
| LC-JRN-06 | Faculty | Create or manage course context → publish materials/policy → approve source pack → review student-facing experience | tested | [`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — publish<br>[`app/src/components/StudyStudio.packs.test.tsx`](../app/src/components/StudyStudio.packs.test.tsx) — source packs | No student-view preview. |
| LC-JRN-07 | Advisor | Receive student-approved agenda → review shared plan → complete follow-up without accessing private data | tested | [`supabase/advisor.check.sql`](../supabase/advisor.check.sql) — only what was shared<br>[`app/src/lib/advisor-meeting.test.ts`](../app/src/lib/advisor-meeting.test.ts) — what a share carries | None. |
| LC-JRN-08 | Staff | Publish a verified resource or action → see content owner status → update or retire content | tested | [`supabase/officeactions.check.sql`](../supabase/officeactions.check.sql) — office actions | No content-owner status view. |
| LC-JRN-09 | Institution admin | Configure tenant → roles → content → integrations → features → audit and support workflow | building | [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — the console | Configuration is split between the console and the service role. |
| LC-JRN-10 | Support team | Receive student-created support grant → diagnose → respond → close → audit access | tested | [`supabase/support-access.check.sql`](../supabase/support-access.check.sql) — the grant<br>[`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) — the ticket | None. |
| LC-JRN-11 | Privacy user | Export personal data → revoke sharing → disconnect account → request deletion | tested | [`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) — export<br>[`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — deletion | None. |
| LC-JRN-12 | Finance customer | Upgrade or cancel membership → view invoice → manage payment method → retain data export rights | building | [`app/src/lib/membership.test.ts`](../app/src/lib/membership.test.ts) — Plus bought from the Account screen after a ticked consent (D-128)<br>[`app/src/lib/billing/cancel.test.ts`](../app/src/lib/billing/cancel.test.ts) — cancel reaches Stripe (D-132) | Not tested end to end with a real card; no invoice view. |

Every journey needs:

- Authenticated and unauthorized states
- Empty state
- Loading state
- Error state
- Stale-data state
- Offline or degraded behavior where relevant
- Mobile state
- Keyboard state
- Screen-reader state
- Audit event where sensitive
- Support path

The states are specified in [`docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md`](EMPTY-LOADING-ERROR-SUCCESS-STATES.md); no journey has been walked through all eleven.

> The final difference between a compelling vision and a market-defining company is
> not another feature. It is the discipline to make every existing feature real,
> trustworthy, operational, supported, and provable.
