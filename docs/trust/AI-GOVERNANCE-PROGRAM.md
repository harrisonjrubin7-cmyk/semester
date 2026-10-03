# AI Governance Program

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — NOT IN FORCE / NOT PRODUCTION-APPROVED** |
| Owner | Harrison Rubin, AI Governance primary; backup `UNASSIGNED` |
| Control partners | Product, Security, Privacy, Accessibility, Legal, Academic/Customer owner |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Review trigger | Before any customer activation and after a material provider, model, prompt, data, purpose, tool or control change |

## Purpose and decision authority

This program governs Semester AI from intake through retirement. AI output is assistance, not authority. A feature may be repository-implemented without being approved, configured, exercised or accepted for a customer. The accountable human or institution retains every academic, administrative and consequential decision.

The AI Governance owner coordinates the record. Product owns intended use and non-AI paths; Security owns threat and incident controls; Privacy owns purpose, minimization and data rights; Accessibility owns equivalent access; Legal determines applicable obligations and contract language; the customer owns its academic rules and activation decision. Unnamed people, incomplete evidence or unresolved high risks stop activation.

## Permitted and prohibited scope

Candidate pilot uses are user-triggered organization of authorized sources, summaries with visible limits, study aids, concept explanations and reversible suggestions. Every use remains subject to the gate below.

The initial prohibited scope includes admissions, financial aid, grading, discipline or conduct, disability/accommodation eligibility, clinical or mental-health judgment, immigration, authoritative degree or registration advice, employment decisions, profiling, and any automated institutional adverse action. AI may not impersonate a person, silently make a decision, or execute a consequential write without an approved human confirmation and authoritative readback path.

## Lifecycle gate

| Stage | Required record | Stop condition |
| --- | --- | --- |
| Intake | named owner, intended users, purpose, benefit, prohibited use check, risk tier | owner absent, purpose ambiguous or prohibited scope |
| Map | system inventory entry, data/source map, provider/model/region, affected groups, human and non-AI path | data authority, population or destination unresolved |
| Measure | feature-specific evaluation plan and dated results for grounding, citation, refusal, leakage, injection, bias/equity, accessibility, cost and abuse | threshold missing or not met |
| Approve | Security, Privacy, Accessibility, Legal, Product and customer approvals appropriate to scope | approval or provider terms missing |
| Release | configuration record, notice, limits, monitoring, audit metadata, kill switch, incident and rollback owner | target controls unobserved or rollback unexercised |
| Operate/retire | review cadence, incidents, complaints, changes, re-evaluation, retention/deletion and retirement record | material drift or unacceptable residual risk |

Approval is use-case-, tenant-, model-, provider-, region- and configuration-specific. It does not transfer automatically to another scope.

## Repository evidence and operational evidence

**Code/config evidence.** `app/server/institution/intelligence.ts` and `app/server/institution/intelligence-repository.ts` implement an authenticated institutional gateway with policy checks; `supabase/functions/_shared/killswitch.ts` implements global and tenant AI disablement; `app/server/institution/providers/openai.ts` uses bounded foreground responses with `store: false`; `approved_source` and `ai_policy` migrations represent tenant policy and source scope; associated tests exercise portions of those controls. The [operating-model assurance map](../operating-model/AI-ASSURANCE.md) maps broader controls and gaps.

**Operational evidence.** The repository contains a dated AI kill-switch drill and point-in-time source checks, but no evidence establishes a complete, currently operated governance cycle for a named institution. No executed provider/customer approval, complete feature evaluation pack, named board membership, customer acceptance or production monitoring review is evidenced here.

**Missing test/proof.** Complete the five-stage record for each feature; reconcile the deployed provider/model/version/region and terms; run representative evaluation and adversarial suites; test accessible human/non-AI routes; exercise incident, disablement and rollback in the target environment; record trained owners, monitoring thresholds and customer sign-off.

## Claim ceiling

Semester may say it has documented AI governance requirements and repository controls for policy-gated, source-aware and disableable AI workflows. It may describe specific dated tests with their exact scope.

## Prohibited claims

Do not claim that Semester AI is safe, accurate, unbiased, explainable, FERPA compliant, legally compliant, independently assessed, zero-retention, never used for training, institution-approved or production-ready without current scope-specific evidence. Do not imply that `store: false`, a test, a draft policy or a kill switch proves those outcomes.

## Related controls

- [`AI-SYSTEM-INVENTORY.md`](AI-SYSTEM-INVENTORY.md)
- [`AI-RISK-ASSESSMENT.md`](AI-RISK-ASSESSMENT.md)
- [`AI-DATA-USE-STANDARD.md`](AI-DATA-USE-STANDARD.md)
- [`AI-TRANSPARENCY-AND-USER-NOTICE.md`](AI-TRANSPARENCY-AND-USER-NOTICE.md)
- [`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md)
