# Core User Journeys

| Control | Value |
| --- | --- |
| Status | **CONTROLLED JOURNEY MAP — PARTIAL END-TO-END EVIDENCE** |
| Owner | Harrison Rubin — company-side accountable owner; backup and customer journey owners unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Source | [`DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md) and current route/capability evidence |

## Canonical journeys

| ID | Person and job | Start → meaningful outcome | Owner | Repository evidence | Operational gap |
| --- | --- | --- | --- | --- | --- |
| J01 | Student first win | arrive/onboard → add a limited academic plan → understand Today → complete or intentionally defer one next action → know where to get help | Harrison Rubin / Product | onboarding, Today/action and help tests cover parts | no filed representative usability run; key action may depend on flags |
| J02 | Student planning | choose courses → compare options → resolve conflict → save primary/backups → prepare advisor agenda | Harrison Rubin / Product Planning | registration and advisor-agenda tests | no target advisor/student UAT or official-system readback |
| J03 | Student learning | open course → select authorized material → create/use a study aid → inspect source → save progress | Harrison Rubin / Learning Product | Study Studio and source-anchor tests | AI/provider activation and full evaluation vary by route; no observed study |
| J04 | Student support/recovery | identify need/failure → find verified help → understand privacy/authority → contact or create follow-up → recover/receive response | Harrison Rubin / Support | help components and request controls | staffed backup, service ownership and closed-loop evidence absent |
| J05 | Student data rights | inspect data/permissions → export → revoke/disconnect → request deletion → understand outcome and recovery limits | Harrison Rubin / Privacy | export, sharing and deletion tests | response backup, target execution and user comprehension unproven |
| J06 | Faculty/course owner | create context → publish materials/policy → approve source pack → preview student-facing result → update/retire | Harrison Rubin / Academic Product | course/source-pack controls | customer co-owner, student-view preview and named-customer operation incomplete |
| J07 | Advisor | receive student-approved context → review sources/limits → advise → record approved follow-up without private-data overreach | Harrison Rubin / Advising Product | share-boundary and agenda tests | customer co-owner, observed institution workflow and staffing evidence absent |
| J08 | Institution administrator | provision scope → configure roles/policy/content/integrations → validate tenant → monitor/audit/support → offboard | Harrison Rubin / Implementation | console, policy and tenant controls | customer co-owner, credentials, UAT and institutional acceptance absent |
| J09 | Support operator | receive scoped grant/ticket → diagnose → communicate → close → revoke/audit access | Harrison Rubin / Support and Security | support-access and ticket checks | named backup staff, training and operating evidence absent |
| J10 | Customer billing owner | approve plan → purchase/change/cancel → view records → preserve export/offboarding rights | Harrison Rubin / Finance and Operations | membership and cancellation logic | customer approver, real payment, invoice, accounting and approved pricing evidence incomplete |

Additional career, staff-content and community journeys remain in the broader definition-of-done register; they do not displace these launch-critical paths.

## State and modality contract

Every applicable journey must be exercised in authenticated and unauthorized states; first-run/empty; loading/saving; success; stale; offline/degraded; permission-denied; partial failure; recoverable error; destructive confirmation; and restored/resumed state. Each must cover mobile and desktop, keyboard, screen reader, 200–400% zoom/reflow, reduced motion, long/translated content, source/freshness/authority, privacy boundary, support route and audit evidence where sensitive.

## Journey evidence record

Record journey/version and environment; participant role and accessibility needs; starting data/configuration; device/browser/input; task and success criteria; timestamps; errors/recovery; source/authority comprehension; completion and abandonment; assistance; accessibility findings; qualitative notes; privacy-safe event evidence; defects/owners; and acceptance decision. Use synthetic or consented/approved data and do not turn usability research into student profiling.

## Cross-journey rules

- Keep stable routes and the current Semester app foundation unless an approved migration changes them.
- Preserve context and user work across back, refresh, offline and error paths.
- Label sample, estimated, student-entered, imported and institution-verified information accurately.
- Never imply an institutional write, approval or official record without authoritative readback.
- Provide a manual/non-AI route for important work and a human escalation for harm or blocked progress.

## Evidence state and claim boundary

**Code/config evidence.** Focused unit, component and database-policy tests support many individual steps. **Operational evidence:** no journey has a complete current artifact across every required state and modality, and named institutional operation remains unevidenced. **Missing test/proof:** run and file the journey scripts, accessibility review, target integration/UAT and staffed support response.

**Claim ceiling.** Semester may say it has defined core journeys and repository-tested components for many steps. **Prohibited claims:** do not call every journey end-to-end verified, user-validated, institution-approved or production-operated until the corresponding artifact exists.
