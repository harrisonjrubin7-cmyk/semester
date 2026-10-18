# ADR-0014 · Every AI path gets a risk tier, a pre-activation evaluation record, and a fixed list of actions no model may take

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | AI governance owner (the founder acts in this role until another is named) |
| Deciders / reviewers | Founder (decision authority); security owner; privacy owner; counsel for the provider-terms, disclosure and minors items (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1, gate "AI policy reaches every model call before any pilot" (proposed) |
| Related | [`ai-policy-enforcement-map.md`](../../architecture/ai/ai-policy-enforcement-map.md); ADR 0004, 0007 ([`docs/architecture/`](../../architecture/README.md)); D-1231; [`docs/trust/AI-SYSTEM-INVENTORY.md`](../../trust/AI-SYSTEM-INVENTORY.md); [`docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](../../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md); ADR-0001 (review policy); legal rows Q-09, P-12, Q-04 in [`LEGAL_REVIEW_QUEUE.md`](../../legal/LEGAL_REVIEW_QUEUE.md) |
| Supersedes / superseded by | — |

> **Counsel required.** Provider terms for student data, AI disclosures, training/retention wording and any use with minors are legal questions: `LEGAL_REVIEW_QUEUE.md` Q-09 (AI disclosures, training/data use), Q-04 (FERPA/COPPA applicability), and `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` P-12. Nothing below states that any path is compliant.

## Context
- Twelve invocation paths P1-P12 are mapped; exactly one (P2, institution gateway `respond`, `app/server/institution/intelligence.ts:124-234`) evaluates tenant policy before the model call (`ai-policy-enforcement-map.md` §1-3). `ask()` at `app/src/lib/claude.ts:886` is imported by 25 non-test files and reads no tenant policy, `ai_policy` row or kill switch.
- Kill-switch reach is declared in `app/src/lib/governance/ai-systems.ts:42-48` (`KILL_REACH`): the device-key, OpenAI-key and proxy doors (P5-P7) are reached by nothing. The shared-key function (P1) honours only the global row (`supabase/functions/claude/index.ts:132`, `_shared/killswitch.ts:44-49`).
- Prohibited actions are held by absence, not by a rule: `app/src/lib/tools.ts:108` (`TOOLS` registry, none touches grades, enrolment, payments, permissions or outbound messages); `app/server/institution/intelligence-runtime.ts:72` (`execute` returns `{verified:false}`); `decide(` has one non-test caller, `app/server/productivity/service.ts:380`; rule `ai.retrieve_source` (`packages/institution/src/policy.ts:75,272`) is unwired.
- Stored policy with no consumer: `ai_policy.web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days`, `consent_record` (`supabase/migrations/20260923210000_intelligence_policy.sql:49-67`).
- Lookup tools bypass school `aiOff` categories: `app/src/ai/converse.ts:440` vs `:668`, `app/src/lib/lookup.ts`.
- Decision log: gateway audits 6 of ~22 outcomes with no correlation id (`intelligence.ts:132,239,312,354,373,415`; `20260924184500_gateway_action_journal.sql:34`); P1 keeps counters only.
- Evaluation evidence today: injection unit suite `app/src/ai/injection.test.ts` (11); one live red-team of 21 cases through P1 (`docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json`); kill-switch drill 2026-09-29 (`docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`) predates the activation gate of 2026-10-01 (`findings-ai.md` #11). No redaction, DLP or output scan on any path (`findings-ai.md` #8). Ten gateway refusal codes have no named test (`findings-ai.md` #9).

## Problem
What tier does each AI path hold, what evaluation evidence must be on file before a tier is activated for a tenant or cohort, and which actions may a model never take regardless of tier or configuration?

## Decision drivers
1. A school's AI-off or provider choice must hold on every path a student's request can take (findings-ai #1-3, P1).
2. A prohibited action must fail a build when someone adds it, not merely be absent today.
3. Every activation is backed by dated, expiring evidence (`app/src/lib/ops/evidence.ts` already models expiry).
4. Minimal new machinery: reuse `ai-systems.ts`, `decide()`, `feature_kill_switch`.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep the census labels in `ai-systems.ts` as documentation | No work | Labels do not gate anything; P5-P7 and P1 stay outside tenant policy | Not chosen: leaves findings-ai #1-2 open |
| B. One tier per tenant (policy-level only) | Simple to explain to a school | Same tenant runs a no-data glossary call and a grade-reading tool loop; one tier cannot be both safe and useful | Not chosen |
| C. Tier per path from data class x consequence, deny-by-default action registry, evaluation record as activation precondition | Matches how the gateway already decides; testable | Needs a registry change and a new evidence kind | **Recommended** |
| D. Adopt an external framework's classes wholesale (e.g. NIST AI RMF, EU AI Act tiers) | Recognised vocabulary | Legal characterisation is a counsel question; maps poorly to five doors | Use as a crosswalk only, after counsel |

## Decision
**Recommended, unratified.** (1) Define four tiers from the data classes in [`database/DATA_CLASSIFICATION_REGISTER.md`](../../../database/DATA_CLASSIFICATION_REGISTER.md) and the consequence of the output: T0 no model; T1 model, no person or institution data in context; T2 model over the signed-in person's own data, shown only to them; T3 model reading institution data, using tools or producing proposals. Reconcile numbering with the tier field already in `ai-systems.ts` before ratifying (open question). (2) Prohibited for every tier: a model-originated grade entry or release, enrolment/registration change, payment, purchase or payout, role/permission grant, external message send, legal-hold, deletion or export action. Models may only prepare; a human confirms; the action-class allowlist in code is deny-by-default and an unknown class is refused. (3) A tier is activated for a path only with an evaluation record: injection suite green, a named test for every refusal code, a kill-switch drill dated after the activation gate, a decision-log row for every terminal outcome with a correlation id, and a retained live red-team less than 90 days old (the 90 days is a proposal for the owner). (4) In a build configured with the gateway, every model call either passes the tenant policy check or is refused; managed accounts do not fall back to P5-P7. (5) Stored policy fields are enforced or removed. This ADR is not accepted; an agent never accepts an ADR.

## Consequences
Positive: one answer to "can the model do X here". Negative: P5-P7 (student's own key) cannot be reached by a server kill switch, so a managed-account tenant loses that door; evaluation upkeep is recurring work for a single operator. Harder: shipping a new AI feature without a tier and a registry row.

## Impact
- **Data / tenancy:** tier is a function of the table class; tenant policy read on every path (`ai_policy`, `tenant_feature_policy`).
- **Security:** closes the P1/P5-P7 kill-switch gap by documenting or removing doors; adds output scan stage (findings-ai #8) as a later step.
- **Privacy:** minors, FERPA role, provider retention and training terms are counsel items (Q-04, Q-09, P-12); `retention_days` becomes a real control or is dropped.
- **Accessibility:** refusal and "AI is off here" messages need accessible, plain-language states; not assessed here.
- **Operations (SLO, alert, runbook, support):** drill cadence added to `AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`; decision-log volume grows.
- **Cost / commercial:** the shared-key meter (D-1231) and per-tenant budget stay; per-user budget gap (findings-ai #12) remains.

## Implementation
1. Add tier and prohibited-class fields to the `ai-systems.ts` registry and its test.
2. Wire `decide('ai.retrieve_source')` or run the source loader as the caller (`intelligence-repository.ts:160-194`); pass `aiAllows` into lookup tools (`converse.ts:440`).
3. Audit every terminal outcome with a correlation id in `intelligence.ts`.
4. Re-run the kill-switch drill after the gate; file the result in `docs/evidence/ai/`.
5. Add the evaluation-record kind to `app/src/lib/ops/evidence.ts`; no migration needed for steps 1-4.

## Tests and verification
- `app/src/ai/tools.prohibited.test.ts` (proposed): add a tool named `release_grade`; must fail the build. Shown red by adding the tool, then removed.
- Per-refusal-code tests for the ten uncovered codes; each must fail when the refusal branch is deleted.
- `app/src/lib/lookup.aioff.test.ts` (proposed): with a school `aiOff` category set, `read_grades` returns refusal; fails on today's `converse.ts:668`.
- Gateway test: a tenant with `state='off'` and a request through `ask()` in a gateway-configured build is refused (fails today).
- Control: a tenant with AI on and an allowed category still succeeds (guards against a probe that refuses everything).

## Fitness functions
- `ai-policy` (Table A #7): fails if any model-invoking module is absent from the `ai-systems.ts` registry or lacks a tier; proposed `scripts/architecture/ai-policy.mjs`; runs in CI `build`.
- `policy-gateway adoption` (#6): fails if a registered T2/T3 route calls a model without `decide(`; `scripts/architecture/policy-adoption.mjs`.
- `release-evidence` (#11): fails if a tier activation cites an evaluation record older than its expiry.
- `public-claims-evidence` (#12): fails if a public AI claim lacks a current evaluation record.

## Rollback / reversal
Tier labels and the action registry are reversible by a superseding ADR. Routing managed accounts away from P5-P7 is reversible until a school relies on it contractually (counsel required).

## Open questions
Whether the gateway or direct client path is the pilot AI path (findings-database #7); whether any gateway is deployed (repo cannot say); tier numbering in `ai-systems.ts`; which provider terms are acceptable for student data (Q-09, F3).

## Addenda
None.
