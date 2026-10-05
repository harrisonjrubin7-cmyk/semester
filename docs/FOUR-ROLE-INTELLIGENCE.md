# Four-role Semester Intelligence

This implementation connects the uploaded multi-agent framework and executive-assistant enhancement specifications to Semester’s existing conversation, faculty publishing and institutional gateway. It does not claim that every feature in those specifications is complete or that a tenant is approved for production.

## Delivered

| Requirement | Implementation |
| --- | --- |
| Four distinct roles | Executive Assistant, Executive Advisor, Tutor and Course Guide; native radio controls on both conversation surfaces |
| Separate authority | Shared role instructions and explicit tool allowlists; unknown tools denied; callback validation as well as advertised tool filtering |
| Role-scoped context | Grades and attendance excluded from automatic context; non-assistant roles do not inherit screen summaries or private standing preferences |
| Course selection | Explicit course selector for learning roles; local material/deadline lookups narrowed to the selected course |
| Course source authorization | Every source needs an institution-approved policy binding; Tutor and Course Guide require one selected bound course and term |
| Institution-published course rules | Gateway enforces the newest date-effective course_ai_rules version for every authoritative source course/term; client hints never narrow the policies checked |
| Unknown policy | Conceptual explanation, hints and analogous practice only; draft/review not assumed permitted |
| Academic integrity across roles | All role instructions prohibit restricted graded completion; switching roles cannot bypass a published course prohibition |
| Student review of writes | Existing proposal/confirmation machinery retained; institutional non-assistant roles may prepare only |
| Distinct conversation history | Switching roles creates a fresh conversation; saved, reopened and restored conversations retain their role |
| Source anchors and freshness | Approved source title, citation label and update timestamp travel to the institution model; no invented anchors |
| Audit | Successful institutional policy decisions include the agent and support mode |

## Existing systems reused

The executive-assistant work on main already provides briefing, triage, deadline horizons, weekly reset, recovery, goals and packets. Advisor meeting and office-hours agenda components already exist. The Socratic tutor already provides Explain, Hint, Practice, Review and Draft modes and a scaffold ladder. Course Studio already supplies faculty-scoped publication of versioned AI rules, guidance and source packs. This change joins those systems through explicit assistant roles rather than duplicating them.

## Boundaries and remaining specification work

- The Course Guide is course support, not faculty impersonation. Institution-approved sources are not automatically proof of instructor authorship or approval.
- Course-specific rules currently use the existing course/term schema. Section-specific and assignment-specific policy enforcement needs additional authoritative context.
- Privacy-thresholded Course Pulse, richer formative-assessment authoring and the complete accessible-authoring workflow are not delivered by this change.
- The requested Hermes runner is not installed. No autonomous runner or direct database tools are exposed by this change.
- LTI/SSO/roster activation, provider configuration and named institutional pilot approval require separate integration and operational verification. Existing kill switches, tenant identity, approval checks and budgets remain in force.
- Institutional source selection still requires source identifiers approved by the institution; a student’s saved citation is not automatically approved for institutional generation.

## Verification

- Focused assistant, role, contract and institution suites: 576 passing, 48 live-provider tests skipped.
- TypeScript application and NodeNext gateway checks, lint and production build pass.
- Broad suite: 19,305 passing on the first run; shuffled run: 19,308 passing. Both reported three failures in scripts/rollout-publication.test.ts because external PDF/DOCX publication artifacts were absent from this workspace. These are not reported as green runs.
- Browser visual verification was blocked by ERR_BLOCKED_BY_CLIENT for the workspace localhost URL. Visual layout remains unverified.

The learning-role course-scope regression is also checked with its server boundary temporarily removed: the guard must fail, and the boundary is restored before publishing.

## Policy binding repair and activation prerequisite

Source IDs such as `econ` are opaque and remain unchanged. A browser's selected
course, term, private course record or self-reported enrollment is not authority.
The gateway now reads `policy_scope`, `policy_course_code` and `policy_term`
from approved source metadata. All roles enforce every course binding, including
mixed-course Assistant/Advisor requests. Optional request course/term hints must
jointly match a source binding when course sources are present; they never remove
another source's restriction. Tutor/Guide still require one explicitly selected
course and cannot satisfy it with institution-only sources.

An explicit `institution` scope preserves approved non-course guidance under
tenant policy. It cannot be assigned to a source whose origin is `course`.
Unbound or malformed source scope is refused before generation or budget
reservation. Only after a valid course binding has been established does a
missing published policy permit the existing conceptual-only fallback.

The additive binding migration was applied to the approved production project
`semester` (`lzrqvlugnawcgywkhqlz`) on 1 October 2026 at 18:53 UTC and recorded as
`20261001185348_approved_source_policy_scope`. The matching repository migration
preserves the exact recorded SQL, including its 5-second lock timeout and
30-second statement timeout. The historical proposal comment in that SQL records
its original review state; this paragraph records the subsequent approved apply.
Do not apply a second copy under a different version or repair unrelated migration
history as part of this change.

Read-only checks after application verified all three nullable text columns, the
validated constraint, unchanged ACLs, all four existing RLS policies and the
whole-row audit trigger. The production table contained zero approved sources and
zero course policies, so no existing rows required mapping. Source approvers must
explicitly configure each future source before it can generate; there is no
guessed backfill. Applying the schema does not enable institutional AI or deploy
the gateway. The application fix still requires a verified deployment of the
institutional runtime; the company-site preview does not provide that evidence.

Course-rule dates use the **server UTC calendar day**, inclusive. A null effective
date means immediate publication. The gateway first excludes future-effective
versions and then selects the highest eligible version. A prior effective rule
remains in force until its replacement's date. This repair covers the institutional
gateway; the pre-existing student-side policy display's latest-version selection
is not changed here.

Focused regression coverage is in
`app/server/institution/intelligence-course-policy.test.ts` and
`app/server/institution/intelligence.test.ts`. The disposable
`supabase/approved-source-policy-scope.check.sql` checks the constraint after the
migration is applied there and runs with the existing PostgreSQL policy suite. It must never be run against a live tenant database.
