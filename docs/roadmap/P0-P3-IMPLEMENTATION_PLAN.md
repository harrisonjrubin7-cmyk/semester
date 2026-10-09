# Semester Education OS P0–P3 implementation plan

Baseline: `origin/main` at `55adab11`, assessed 2026-10-08.

This plan extends the current Semester foundation. It does not create a disconnected shell, parallel design system, replacement registry or unsupported institutional claim.

## P0 — governed registration-readiness pilot

Outcome: a student, assigned advisor and authorized registrar see the same policy-filtered, source-aware readiness state; stale and unknown facts fail safely; exceptions enter a durable queue; every consequential attempt receives a receipt and reconciliation result.

1. Add a versioned readiness projection contract to the existing institution package.
2. Add persistence/migration for evaluation requests, facts, source versions, workflow state, tasks and receipts only where current tables cannot carry them.
3. Evaluate reads and commands through the current policy/access-saga boundary.
4. Connect the existing student UI to the projection behind an exposure/feature gate, retaining the local planning fallback.
5. Add advisor and registrar projections/queues using existing Semester UI patterns.
6. Add audit/outbox events, idempotency, retry/dead-letter and reconciliation behavior.
7. Add negative tenant/relationship tests, state-matrix UI tests and end-to-end sandbox coverage.
8. Keep official write capability disabled until target-specific approvals and connector evidence exist.

Exit evidence: focused gates green; migration and rollback tested; sandbox demonstration complete; target integration remains explicitly unavailable unless separately approved and verified.

## P1 — academic operations and student success

Outcome: governed course delivery, assessment/grade release, advising and support workflows.

- consolidate Course Studio around current course/material/assignment/rubric foundations;
- add TA assigned-section and accommodation-minimized access;
- complete grade release approval, receipt and SIS/LMS reconciliation;
- build advisor caseload, referrals, outreach and support-plan queues;
- unify notification delivery receipts and support escalation;
- require course/institution AI policy and source citations for AI-assisted drafts.

## P2 — broader institution and external audiences

Outcome: institution-controlled finance, campus, career and delegated-audience functions, with separate data boundaries.

- finance/aid visibility and controlled cases before native payment orchestration;
- housing, dining, library, maps and campus-service adapters;
- career/employer disclosure with explicit student consent;
- family delegation with expiry, revoke and access history;
- applicant and alumni identity transitions without inherited student-record access;
- institution policy, integration, privacy and data-quality consoles.

## P3 — platform ecosystem and company operations

Outcome: partner/developer platform and advanced operations after the governed core is proven.

- scoped API/OAuth/webhook console and partner verification;
- advanced operations inbox, reconciliation and replay controls;
- commerce/payment orchestration only after legal, security and accounting readiness;
- company systems physically and logically separated from education records;
- multi-institution reliability, capacity, recovery and independent assurance;
- human approval remains mandatory for consequential automation.

## Definition of done for each slice

- canonical capability and exposure records updated;
- migration/data contract and rollback path present where state changes;
- server authorization, tenant isolation and policy obligations tested;
- command/query/event/workflow behavior versioned;
- authority, source, freshness and version visible to the user;
- ready/loading/empty/error/forbidden/stale/offline states covered as applicable;
- consequential action audited and receipt-bearing;
- focused unit, integration and end-to-end tests pass;
- accessibility and 320 px behavior verified;
- monitoring, support owner and runbook documented;
- deployment, provider, approval and observed-operation evidence recorded separately.

## Near-term implementation order

1. governed readiness projection;
2. durable readiness evaluation and reconciliation workflow;
3. student UI adoption with explicit fallback;
4. advisor/registrar queue projections;
5. sandbox E2E and database negative tests;
6. target-specific connector work only after authorization and credentials.
