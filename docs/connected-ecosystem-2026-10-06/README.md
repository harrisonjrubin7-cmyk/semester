# Connected Semester execution worklist

Date: 2026-10-06
Branch baseline: 171325039860180055b5a8eec7cf40c449f2b593
Status: proposed implementation work; not runtime wiring, deployment, test results, or release approval.

## Reuse before adding

Inspect and reconcile these existing artifacts before selecting a canonical register: ../CAPABILITY-ACTIVATION-REGISTER.md, ../OPERATIONAL-REALITY-REGISTER.md, ../MASTER-LAUNCH-READINESS-REGISTER.md, ../FEATURE-TRUTH-TABLE.md, ../EVIDENCE-REGISTER.md, ../SPRINT-1-REGISTRATION-PATH.md and ../SEMESTER-CONNECT-REGISTER.md. Their presence is observed; their contents and agreement have not yet been fully reviewed. Do not replace or duplicate them blindly.

## Capability record requirements

For each capability record: stable ID; domain; accountable owner (unassigned until accepted); code and database references; tenant scope; required capabilities; source authority; allowed writes; dependencies; event-contract version; separate implementation, wiring, deployment, verification and approval states; limitations; recovery procedure; release gate. Every verification references a commit, environment, timestamp, test or observation, result and reviewer. Unknown is not passing. Approval is scoped to tenant, environment and release and expires on material change. Do not include student payloads, secrets or credentials in evidence.

## Execution order

1. Read repository instructions and relevant nested rules. Inventory existing registries, models and registration implementation. Select the existing authoritative register through review.
2. Reconcile each explicit unwired statement against current code; preserve historical decisions and attach superseding evidence rather than rewriting history.
3. Trace one registration-readiness journey through identity, tenant scope, source loading, readiness evaluation, task or advisor handoff, authorized action, readback, student update and audit evidence.
4. Reuse existing models for identity, sources, freshness, tasks and evidence. Propose additive contracts only where a demonstrated gap exists. No new permission vocabulary without mapping to existing capability enforcement.
5. Implement the smallest missing registration-readiness slice behind existing rollout controls. Keep external institutional writes disabled unless independently authorized and supported.
6. Verify negative cases, recovery and cross-view consistency. Record actual command outputs and environment observations.
7. Consolidate documentation links after review; retain specialized evidence and runbooks. Label every external integration proposed, implemented, connected or verified with scope.

## Registration-readiness acceptance cases

- Wrong tenant and revoked grants deny access without leaking records.
- Missing inputs remain unknown; stale inputs cannot assert readiness.
- Source authority and observed timestamp are visible.
- Duplicate events and retries do not duplicate tasks or actions.
- Advisor handoff respects sharing scope and revocation.
- Provider timeout produces a recoverable state, not a false success.
- Authorized write success requires authoritative readback; discrepancies enter reconciliation.
- Notifications carry minimal information and cannot reveal another tenant's data.
- Student and advisor views converge on the same permitted outcome.
- Accessibility, keyboard use and error recovery are checked on the actual journey.
- Audit or evidence failure follows an explicitly reviewed policy; no silent bypass.

## Gap reconciliation queue

These are leads from the earlier repository inspection, not freshly verified runtime findings.

| Lead | Source | Next check | Owner | State |
| --- | --- | --- | --- | --- |
| Payment inbox recovery policy reportedly unwired | Commit 446f8378255ddb7c77b62c3bb8a5789268fed3b8 | Trace webhook, inbox store and worker invocation | Unassigned | Needs reconciliation |
| Tenant contract policy reportedly pure code only | ../TENANT-CONTRACT.md | Trace tenant configuration and runtime enforcement | Unassigned | Needs reconciliation |
| Institutional AI routing and retrieval reportedly unwired | ../decisions/D-1166.md | Compare runtime gateway, routing and retrieval metadata | Unassigned | Needs reconciliation |
| Per-record sync reportedly lacks client wiring | ../../supabase/RECORDS-REVIEW.md | Trace current client persistence and synchronization adapters | Unassigned | Needs reconciliation |
| Media generation provider reportedly unwired | ../../pipeline/README.md | Verify actual provider entry points; exclude from registration pilot | Unassigned | Needs reconciliation |

## Release boundary

This worklist grants no institutional write authority and makes no compliance claim. No production migration, deployment, merge or provider purchase is authorized by this document. Registry entries and passing pure-function tests are not proof of deployed behavior. A release needs executed tests, scoped deployment evidence, failure drills and named approval.
