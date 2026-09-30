# AI Model Training and Data Use Policy

<!-- Rendered from app/src/lib/trust/ai-training-policy.ts by ai-training-policy.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Not in force.** A draft policy section for privacy, security, legal and
institutional review, from a document of 28 September 2026
([Draft the institutional policy section on AI model training](../expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf)). The privacy page
already says “Nothing is used to train anything.” and the privacy-policy draft says the same;
this is that promise in policy form, and the test holds the three to one another.

## The stance

**Semester does not use student, institutional, or customer production content to train general-purpose AI models by default.** Any deviation requires a separately negotiated agreement, a
documented legal basis, informed authorization where required, technical
segregation and an explicit opt-in workflow. This stance is easier to explain,
safer for institutional procurement, and aligned with the sensitivity of
academic, support and basic-needs data.

## Purpose and scope

This policy governs how Semester uses data in connection with artificial-intelligence features, including model training, fine-tuning, evaluation, retrieval, safety monitoring, quality assurance and service improvement. It applies to student, faculty, staff, institutional, customer, applicant, partner and other user data processed through Semester.

## Default rule

Semester does not use Customer Data, Student Content, institutional records, private communications, uploaded course materials, support requests, basic-needs activity, mentorship content, accessibility information or AI conversations to train or fine-tune general-purpose artificial-intelligence models by default.

Semester does not permit AI providers to use such data for their own model training unless an institution has separately authorized that use in writing and the applicable technical, contractual and legal controls are in place.

## Permitted operational uses

Subject to applicable agreements and documented controls, Semester may process
the minimum information necessary to:

- Provide a user-requested AI feature.
- Retrieve authorized sources for a grounded answer.
- Detect abuse, fraud, security threats or policy violations.
- Maintain reliability, diagnose errors and provide support.
- Evaluate safety, accuracy, accessibility and quality.
- Generate de-identified, aggregated service metrics.
- Comply with legal obligations.

Semester limits these uses by purpose, retention, access and data classification.

## Prohibited data uses

Semester does not use the following for general-purpose model training,
behavioural advertising, student ranking or undisclosed profiling:

- Education-record PII.
- Grades, transcripts, course performance, attendance or disciplinary data.
- Accommodation, disability, health, counseling or basic-needs information.
- Financial-aid, payment, housing, immigration or legal information.
- Private mentoring, club, peer-circle or support conversations.
- Private AI conversation content.
- Institution-provided confidential information.
- Sensitive personal data or inferred sensitive characteristics.
- Content from one tenant to answer another tenant’s request.

## Optional customer-authorized improvement programme

Any optional programme involving customer production data meets all of these:

- Separate written agreement and tenant-level authorization.
- Specific purpose, data categories, model or provider, and duration.
- No enrolment by default.
- Data-minimization and de-identification assessment.
- No use of restricted or highly sensitive data categories.
- Strict tenant segregation.
- Security, privacy, accessibility and AI-risk review.
- Human oversight and a documented evaluation plan.
- Withdrawal process and future-use stop mechanism.
- Clear retention and deletion rules.
- No onward sharing without documented authorization.
- Transparent student and faculty notices where required.

## Model provider controls

Semester maintains a current inventory of AI providers and models, including:

- Provider and model or version.
- Processing location and residency.
- Input and output retention.
- Training and secondary-use terms.
- Security commitments.
- Subprocessors.
- Data deletion mechanism.
- Available safety controls.
- Incident notification obligations.
- Change-notice commitments.

No provider may be enabled for production student or customer content until security, privacy, legal, accessibility, procurement and AI-governance approval is documented.

Today the inventory is [the subprocessor register](../SUBPROCESSORS.md) and
[`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md): providers and regions, with
retention and training terms marked “to confirm”, and the published terms
recorded verbatim in [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md), none signed. The
[DPA checklist](DPA-CHECKLIST.md) carries the no-training clause unchecked for
the same reason.

## Transparency and user control

When AI is used, Semester provides, where appropriate:

- Notice that AI was used.
- Source, scope and status labels.
- Applicable course or institutional policy.
- Relevant limitations and human-review guidance.
- A way to report incorrect, harmful, inaccessible or policy-inappropriate output.
- Controls for eligible AI history, sharing and deletion.

## Governance and enforcement

Semester maintains an AI inventory, risk assessments, evaluation records, incident-response procedures, access controls, change management and periodic reviews. Material policy violations may result in feature restriction, suspension, customer notification where appropriate, provider escalation or other corrective action.

## Implementation requirements

A policy is credible only if enforced in architecture. Each requirement, and
where the tree stands, read at main commit 92952f0 on 28 September 2026:
`designed` cites a document, `building` code, `tested` a test that runs on every
change.

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 3 | 7 |

| ID | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| TP-01 | Tenant-scoped retrieval indexes | tested | `packages/institution/src/policy.test.ts` — ai.retrieve_source needs enrolment or an authorized share, with a field allowlist<br>`supabase/intelligence-policy.check.sql` — another tenant cannot read or change policy or sources | The gateway repository is tenant-level only (AI-004); the on-device assistant does no retrieval at all. |
| TP-02 | No cross-tenant vector search | tested | `supabase/intelligence-policy.check.sql` — sources are approved per tenant and course<br>`supabase/governance.check.sql` — tenant isolation walked account by account | There is no vector index yet, so the rule is true by absence rather than by test. |
| TP-03 | Provider contracts with no-training and no-retention terms where available | building | `app/server/institution/providers/openai.test.ts` — the institutional OpenAI call uses store: false and stateless responses<br>`docs/trust/DPA-CHECKLIST.md` — the no-training clause, unchecked<br>`docs/trust/PROVIDER-TERMS.md` — both providers’ published no-training and retention terms, verbatim | store: false does not itself establish zero data retention (docs/market-readiness/AI_GOVERNANCE.md); the terms are recorded as published, and neither is accepted or signed by Semester. |
| TP-04 | Prompt and output redaction and data-loss-prevention controls | building | `app/src/lib/toolkit/classification.test.ts` — unclassified material is an education record and stays away from AI; T4–T6 are hard-blocked | A tier lookup keeps classes out; nothing redacts PII or secrets from a prompt that is sent. |
| TP-05 | Separate environments for production, evaluation and synthetic test data | designed | `STAGING.md` — the staging environment<br>`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — evaluation suites planned against fixtures | No evaluation environment; the one labelled corpus (extractaccuracy.test.ts) is a fixture in the test suite. |
| TP-06 | Role-bound access to AI logs | tested | `app/server/institution/postgres-journal.test.ts` — the audit is written through a service-only RPC<br>`app/server/institution/journal.ts` — intelligence_audit: tenant, actor, provider, model, tokens, cost and the policy decision | Who may read the audit is not yet a granted capability; only the service role writes it. |
| TP-07 | Retention limits for prompts, outputs and evaluation samples | tested | `RETENTION.md` — ai_usage rows swept after the tenant’s retention_days; no prompt, response or source text stored<br>`app/src/lib/retention.test.ts` — held to the migrations and the scheduler | Device threads are capped by count, not by age; evaluation samples have no retention rule because there are none. |
| TP-08 | Configurable tenant-level AI enablement and policy controls | tested | `supabase/intelligence-policy.check.sql` — ai_policy per tenant: modes, providers, sources, retention, policy version<br>`app/src/lib/aikillswitch.test.ts` — off globally or for one school, failing closed | The claude edge function does not yet read ai_policy; the switch is the only tenant control it enforces. |
| TP-09 | Provider and model change-approval workflow | building | `app/src/lib/claudeclamp.test.ts` — the shared key allows exactly the models the app offers<br>`supabase/migrations/20260923210000_intelligence_policy.sql` — tenant_policy_audit_event records every policy change | A model allowlist is a list, not an approval; no record says who approved adding a model (EC-AI-08: no pinned versions). |
| TP-10 | Deletion propagation to retrieval indexes, caches and evaluation datasets | tested | `app/src/lib/erasure.test.ts` — export and erasure held to one data map<br>`supabase/deletion.check.sql` — account deletion in SQL | No retrieval index or evaluation dataset exists to propagate to; the map will need those tables when they do. |
| TP-11 | Audit logs for AI feature use: model and version, source set, policy decision and safety outcome | tested | `app/server/institution/intelligence.test.ts` — journals metadata without protected source bodies<br>`app/server/institution/journal.ts` — provider, model, policy decision, action and confirmation | No source-set column and no safety outcome; the on-device assistant writes no audit row. |

The misuse-risk checklist and the audit matrix this policy sits inside are
[the AI assurance page](../operating-model/AI-ASSURANCE.md).
