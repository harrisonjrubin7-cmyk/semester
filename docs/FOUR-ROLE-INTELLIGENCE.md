# Four-role Semester Intelligence

This implementation connects the uploaded multi-agent framework and executive-assistant enhancement specifications to Semester’s existing conversation, faculty publishing and institutional gateway. It does not claim that every feature in those specifications is complete or that a tenant is approved for production.

## Delivered

| Requirement | Implementation |
| --- | --- |
| Four distinct roles | Executive Assistant, Executive Advisor, Tutor and Course Guide; native radio controls on both conversation surfaces |
| Separate authority | Shared role instructions and explicit tool allowlists; unknown tools denied; callback validation as well as advertised tool filtering |
| Role-scoped context | Grades and attendance excluded from automatic context; non-assistant roles do not inherit screen summaries or private standing preferences |
| Course selection | Explicit course selector for learning roles; local material/deadline lookups narrowed to the selected course |
| Course source authorization | Institutional Tutor and Course Guide require every approved source to match the selected course before generation |
| Institution-published course rules | Gateway reads latest course_ai_rules version for the tenant, course and term; disallowed modes refused before provider work |
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
