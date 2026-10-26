# Privacy operations pack

**Status `DESIGNED`. Produced 4 October 2026 against `origin/main` at `8e9b746`. Owner: the privacy seat, which is vacant (maturity RM-06); Harrison Rubin holds it on an interim basis with no backup named.**

> **Not legal advice.** Written by a privacy-operations role, not by qualified counsel. It builds operating procedure and lists questions for counsel. Anything marked **[COUNSEL REQUIRED]** is a decision this pack does not make, and no wording here may be published, put in a contract, or relied on as a legal position until counsel has decided it and the decision is recorded.

## What this is, and what it is not

The repository already holds most of the *program-level* privacy material: a generated schema inventory, a per-table retention schedule held to the migrations by test, an operated rights-request runbook, a subprocessor register held to the CSP by test, a PIA template and PR gate, FERPA and AI programs, and a legal review queue. This pack **does not restate any of them**. It adds the operational layer they point at but do not contain, and it reconciles them with what the code does.

| Need | Existing source of truth (read first) | What this pack adds |
| --- | --- | --- |
| Data inventory, classification, retention, deletion, export, consent, guardian and minor controls | [`RETENTION.md`](../../RETENTION.md), [`DATA-INVENTORY-AND-LINEAGE.md`](../DATA-INVENTORY-AND-LINEAGE.md), [`trust/PERSONAL-DATA-PROCESSING-REGISTER.md`](../trust/PERSONAL-DATA-PROCESSING-REGISTER.md) | [01](01-PROCESSING-REGISTER-AND-CONTROLS.md): a 24-row processing register (the trust register has 7, all `[TBD]`), a per-activity lifecycle matrix, and one minors-and-guardians control matrix |
| Subject-rights workflow | [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../DATA-RIGHTS-REQUEST-RUNBOOK.md) | [02](02-SUBJECT-RIGHTS-WORKFLOW.md): intake for people with no account, identity verification by requester type, fulfilment per kind, an exception catalog, a case-log template |
| Vendor and subprocessor review | [`SUBPROCESSORS.md`](../SUBPROCESSORS.md), [`trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md) | [03](03-VENDOR-REVIEW-PROCESS.md): one privacy intake gate, tiers, checklist, renewal and change cycle |
| Privacy by design | [`operating-model/PRIVACY-IMPACT-ASSESSMENT.md`](../operating-model/PRIVACY-IMPACT-ASSESSMENT.md) | [04](04-PRIVACY-BY-DESIGN-REVIEW.md): a triage that decides *whether* a review is needed, trigger lists for analytics, AI, marketplace, integrations and marketing, and a review record |
| Privacy incidents | [`SECURITY.md`](../../SECURITY.md), [`trust/SECURITY-INCIDENT-RUNBOOK.md`](../trust/SECURITY-INCIDENT-RUNBOOK.md) | [05](05-PRIVACY-INCIDENT-COORDINATION.md): the privacy-side sequence with security and counsel, decision log, and the cases security plans do not cover |
| User-facing controls | `app/src/screens/Privacy.tsx`, `app/src/lib/privacy.ts` | [06](06-USER-FACING-CONTROLS-AND-TRANSPARENCY.md): a control-by-control map with what backs each and what is missing |
| Counsel queue | [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md), [`COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) | [07](07-COUNSEL-REVIEW-QUEUE.md): the privacy-only queue, each item with what the code assumes, and the rows both existing documents lack |
| Where docs and code disagree | n/a | [08](08-FINDINGS-AND-RECONCILIATION.md): eighteen document contradictions and eight code findings, with proposed tests |

## Claim ceiling

**Permitted:** these are designed procedures and registers, accurate to the repository on the date above. **Prohibited:** claiming any procedure is operating, rehearsed, or compliant with any named law; promising a response time to a requester; calling the register complete. The processing register is a working register: it is incomplete until the production database has been reconciled to the repository (`RETENTION.md`: "the repo is not the database").

## The three findings that matter most

1. **No one answers a rights request, and nothing can.** The student can file and track a request, but no UI, function or RPC moves a `data_subject_request` out of `received`. The runbook's "trusted operations service" is not in the repository, status changes write no audit event, and `verified_at` has no setter. Fix owner and surface before any response time is stated anywhere ([02](02-SUBJECT-RIGHTS-WORKFLOW.md), [08](08-FINDINGS-AND-RECONCILIATION.md) C1–C3).
2. **Two probable leaks no test covers.** An account export likely carries the guardian restriction record (court-order flag and staff note) the RLS policy hides from guardians, and erasure leaves consent rows in `tenant_policy_audit_event` JSON snapshots. Both come from reading the SQL; neither has been run ([08](08-FINDINGS-AND-RECONCILIATION.md) C4–C5).
3. **The breach-notice clock is promised in two places and denied in five.** `SECURITY.md` calls 72 hours a commitment; the trust incident plan, the DPA draft and the notification exhibit say no deadline is approved. This is **[COUNSEL REQUIRED]** and is queue item P-02 ([07](07-COUNSEL-REVIEW-QUEUE.md)).

## Evidence folder rule

`docs/evidence/` is test-held: every file there must be registered in `app/src/lib/ops/evidence.ts` with an owner seat and a validity period. This pack therefore keeps blank templates and logs *here*, and only a dated, real exercise (a rehearsal, a review actually completed) goes under `docs/evidence/privacy/`, together with its register entry. Nothing in this pack is evidence.

## Method and limits

Written from the audit PDF's role brief, a read of the existing documents, and a read-only pass over the migrations and code. **Nothing was run:** the database suites need PostgreSQL 17, which this host lacks, so "DB-tested" below means a `supabase/*.check.sql` suite asserts it in CI, not that it was re-run here. Statements marked *(from reading the SQL)* are inferences with a proposed test.
