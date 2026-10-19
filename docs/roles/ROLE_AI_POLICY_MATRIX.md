# Role AI policy matrix

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence and proposal. **No role-by-AI-mode matrix exists in code or documents today.** The right-hand columns below are a proposal assembled from the pieces that do exist; nothing in them is enforced as a role policy.

## What exists

| Piece | Where |
| --- | --- |
| Design: gateway, retrieval policy, tool broker, per-feature requirements, evaluation, incident, tenant AI console | [`docs/ai-governance/`](../ai-governance/README.md) (design, not an approval; no tenant AI console is built) |
| Tenant policy row | `public.ai_policy`: `allowed_modes` (subset of explain, hint, practice, review, draft), `allowed_providers`, `web_sources_allowed` (default false), `course_sources_only` (default true), `monthly_budget_cents`, `retention_days`, `policy_version`; written with `ai:configure` (held by `university_admin`) |
| Approved sources | `approved_source` (origin course, institution, library, web; authority authoritative, supplemental, prohibited); capability `source:approve` |
| Feature narrowing | `tenant_feature_policy.permitted_roles text[]`, evaluated by `evaluateFlag` (`app/src/lib/flags.ts`): kill switch, environment, tenant entitlement, connection approval, provider scope, capability, role policy, data classification, course rule, user eligibility |
| Course AI rules | `course:publish` (faculty): AI rules, guidance, study packs for one course (`publish_course_rules`) |
| Consent | `consent_record`; Edge `_shared/tenantai.ts` gates AI per school |
| Tool approvals | `app/src/lib/governance/ai-tools.ts`: look and mine need `self`; outward and binding need `fresh-auth`; guarded needs `official-handoff`; approvals are self, fresh-auth, second-person, official-handoff |
| Intake refusals | `PROHIBITED_STARTING_SCOPE` in `app/src/lib/governance/ai-lifecycle.ts` |
| Prohibited modes | `MODES_PROHIBITED` in `app/src/lib/governance/ai-assurance.ts` |
| Assessment | `app/src/lib/governance/grading-ai.ts`: no AI-only final grade |
| Kill switch | `kill.ai_generation` (`flags.ts`); `aikillswitch.test.ts` |
| Audit | AI audit tables hold no prompt or answer content (`ai-audit-content-free.check.sql`) |

## Never autonomous (from the brief and the existing intake refusals)

Enrol or drop a student; change an official record; issue an official grade; confer a credential; approve financial action; make disciplinary, clinical, safety or legal determinations; disclose protected information; override institutional policy; change policy, provider or model for a tenant.

The existing refusal list covers autonomous registration, official degree certification, financial-aid decisions, disciplinary judgments, health decisions, opaque risk scoring, automated hiring decisions, ranking students for employers, auto-publishing policy and unapproved production changes. Four prohibited modes have no intake refusal (automated grading without human oversight, training general models on student data, admissions or accommodation or immigration decisions beyond aid, answering graded work where policy forbids); they are held by release gates or decisions, not intake.

## Proposed role matrix (to be built on `ai_policy`, `tenant_feature_policy` and the tool broker)

| Role | May ask AI to | Retrieval sources | Tools | Must not | Human step |
| --- | --- | --- | --- | --- | --- |
| Student | Explain, hint, practice, plan, summarize own material, answer from approved institutional guidance | Own work; approved course and institution sources | look, mine | Present output as official; reveal other students' data; answer graded work against course rules | Official actions through the registration and records flows |
| Faculty | Prepare course material, draft feedback and rubrics within course rules | Own course material; approved sources | course publish drafts | Issue or change a grade | Instructor commits; moderation where policy requires |
| TA | Draft feedback for assigned work | Assigned course | draft only | Release grades | Faculty or moderator |
| Advisor | Summarize a student-shared snapshot; draft outreach | Live advisor share only | draft | Disclose beyond the share; risk-score a student | Advisor sends and decides |
| Registrar | Explain policy; draft notices | Catalog, policy, own desk queue | none that write | Enrol, drop, override, change a record | Registrar action through the controlled flow |
| Institution admin | Explain configuration; draft a configuration change | Own tenant configuration | none that write | Apply a policy, provider or module change | Approval path |
| Student accounts, aid | Draft messages; analyse non-identifying aggregates | Own queue | none that write | Approve refunds, credits or write-offs | `finance:approve` and `approve_high` holders |
| Support (Semester) | Minimal-context assistance on a ticket | Ticket thread and student-approved signals only | none | Read records outside the ticket; expand access | Support access grant or break-glass |
| Developer | Documentation and sandbox help | Public docs, sandbox data | none | Touch tenant data | n/a (no developer role yet) |
| Operator, finance | Analyse and draft | Aggregates | none that write | Approve a financial action or release | Console approvals |

## Work to make the matrix real

1. Add `permitted_roles` rows and a capability per AI mode, evaluated by `evaluateFlag`; write the matrix as data and render this table from it, with a test that every role listed exists in `app_roles`.
2. Close the four missing intake refusals or record the gate that holds each.
3. Build the tenant AI console (design chapter 08) before any institution relies on it.
4. Evaluate each role's mode against [`AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md) before enabling; no tenant has AI enabled by this audit's evidence.
5. Edge Function authorization for `claude` is UNVERIFIED (`verify_jwt` is off; see RG-09).
