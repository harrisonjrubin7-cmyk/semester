# AI governance and model routing

Status: Phase 0 baseline and specification, assessed 2026-10-05 at `790ebbf`. Read-only audit; no test was run and no deployed environment was inspected. Extends `docs/ai-governance/` (chapters 01 to 10), `docs/decisions/D-1260.md` (data-class ceiling) and `docs/architecture/ai/ai-policy-enforcement-map.md`; records where they have gone stale.

The principle: **model-flexible, Semester-governed.** Any approved model may answer; Semester is the layer that supplies education context, applies policy, constrains data, keeps the record and routes to a human. Semester is not trying to out-model the foundation models; it is trying to be the trusted education intelligence layer that makes them safe, contextual, source-aware, policy-bound, auditable and action-connected.

No AI output becomes official institutional truth without explicit authority, human approval and an audited workflow.

## 1. What is wired today

| Route | Where | Models | Server-side policy | State |
| --- | --- | --- | --- | --- |
| Shared Anthropic key | `supabase/functions/claude/index.ts` | `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5-1`, `claude-haiku-4-5` (`_shared/clamp.ts` `ALLOWED_MODELS`; per plan `PLAN_MODELS`: free gets haiku and sonnet, plus adds opus, pro adds fable) | JWT identity, plan clamp, data-class clamp, kill switch (global, fail-closed), call count and micro-dollar meter | Returns 501 `shared_provider_not_activated`: `_shared/provideractivation.ts` has five owner decisions `pending-owner`, and `docs/evidence/vendors/` does not exist. Whether it is live anywhere cannot be established from the repository |
| Student's own Anthropic key or proxy | `app/src/lib/claude.ts` `ask()` (browser to provider) | `MODELS` in `app/src/lib/assistant.ts`, default `claude-opus-5` | **None.** Never reads tenant policy, the kill switch or consent | Works |
| Student's own OpenAI key | `app/src/lib/openai.ts` | `gpt-5`, `gpt-5-mini`, `gpt-4.1`, `gpt-4o` | None | Works |
| Institution gateway | `POST /v1/intelligence/respond`, `app/server/institution/intelligence.ts` | `openai:<model>` from env `SEMESTER_AI_PROVIDERS`; refuses to start unless every configured model starts with `openai:` | The full server-side stack below | Not deployed; "configured-sandbox" unless `SEMESTER_AI_RUNTIME_STATUS=production` |

No Google, Gemini, local or on-device model is wired; `providerRoute` values `managed` and `local` in `app/src/intelligence/assemble.ts` are types only. The consumer `route()` in `app/src/lib/assistant.ts:293` picks `proxy`, `own`, `shared`, `openai` or `none` from settings. The `lib/aistatus.ts` `decideDoor` has no caller outside its test.

**Practical consequence:** the paths a student would use first (own key, proxy) carry no institutional control, and the path with the controls has no student on it. Closing that split is the central AI job; see section 6.

## 2. The thirteen controls, as built

Each AI interaction must carry the thirteen items the brief lists. Status is per path: **G** gateway, **S** shared-key function, **C** consumer own-key and proxy routes.

| # | Control | G | S | C | Evidence and limits |
| --- | --- | --- | --- | --- | --- |
| 1 | Identity | enforced | enforced (JWT via `admin.auth.getUser`, no end-to-end function test) | absent | `intelligence.ts:127` `scope-refused`; `refreshIdentity` on confirm (`gateway.ts:359`); `intelligence.test.ts`, `auth.test.ts` |
| 2 | Tenant | enforced | absent (no tenant concept) | client-side `school.capabilities.aiOff` only | Server-loaded `tenant_feature_policy`, `ai_policy`, cohort; `clientState` ignored. Loaded but unused: `web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days`. `preview`, `sandbox` and `production` treated alike; only `off` blocks |
| 3 | Role | enforced | absent | absent | `permittedRoles`, `role-disabled`; four agent ids (assistant, advisor, tutor, course-guide); non-assistant agents may only `prepare` |
| 4 | Purpose | partial | n/a | n/a | No purpose allow-list; `category` is a free string used for audit; purpose approximated by `mode` and `agent` against tenant and course `allowedModes`; `ai_policy` has no purpose field |
| 5 | Course and context scope | enforced | n/a | prompt only | Sources carry verified `policy_scope`, `policy_course_code`, `policy_term`; tutor and course-guide require exactly one course; `intelligence-course-policy.test.ts`. **Not checked:** that the person is enrolled in the source's course; any tenant member can read approved-source ids |
| 6 | Data classification | partial (T2 ceiling) | partial | absent | `packages/institution/src/ai-data-class.ts` `AI_DATA_CEILING` = T2, unclassified = T3; gateway 403 `data-class-refused`; shared key 422 `data_class_refused` and drops `read_grades`, `read_attendance`. **Limits:** prose declared T2 and never read; sources declared T1 "by construction"; `approved_source` has no class column; tenant `data_classification_rules` read by nothing on the AI path; own-key routes still send grade and attendance lookups unless the school lists them in `aiOff` |
| 7 | Consent | **absent** | absent | absent | `consentIds: []` hard-coded in `app/src/ai/converse.ts:473`; gateway never reads `consent_record` |
| 8 | Provider policy | partial | partial | absent | Gateway intersects `ai_policy.allowed_providers` with env models and applies `chooseModel` cost ceiling; shared key has activation gate plus clamps. Zone, region and zero-retention attestation (GW-04, GW-05) not started. `lib/trust/provider-terms.ts` is documentation |
| 9 | Course AI rules | enforced | n/a | prompt-level | `course_ai_rules` by course, term and effective date (`loadCoursePolicy`); a missing rule allows only explain, hint and practice; 16 tests in `intelligence-course-policy.test.ts`. Consumer: `lib/socratic.ts`, `lib/toolkit/policy.ts` build prompt text and a hint ceiling |
| 10 | Academic-integrity rule | partial | n/a | prompt-level | Five integrity modes gated by tenant and course policy; `agentInstruction` is a prompt, not code; no jailbreak suite for the integrity boundary (`docs/ai-governance/05`, RT-07 "not started") |
| 11 | Source and retrieval policy | partial | n/a | allow-list (`lib/context.ts`) | Exact-id rows from `approved_source`, `prohibited` excluded, every requested id must be approved (`source-not-approved`). No embedding or index; `verifiedAt` is just `updated_at`; `authority` read then dropped; source bodies unbounded; PDP rule `ai.retrieve_source` uncalled; `packages/institution/src/retrieval.ts` (RP-01 to RP-05) pure and unwired. Prompt-injection fencing: `ai/untrusted.ts`, `SOURCE_DATA_RULE` plus strict JSON schema |
| 12 | Budget and rate limit | enforced | enforced | display only | Gateway: `reserve_ai_budget`, `settle_ai_budget`, `release_ai_budget`; 60 per minute per identity (`rate-limit.ts`); constant reserve `SEMESTER_AI_ESTIMATED_REQUEST_CENTS`; no per-user cap (GW-12 not started). Shared: atomic `count_call` (60 per month), micro-dollar reserve and settle, allowances free $0.75, plus $2.00, pro $4.00 labelled proposals (D-1231); unknown models priced at the dearest rate; meter failure refuses. Own key: `lib/spend.ts` is display only |
| 13 | Audit, provenance, human escalation | partial | minimal | none | Below |

### Audit, provenance, escalation in detail

- **Audit:** `auditIntelligence` writes `private.gateway_intelligence_audit` with no bodies; a success audit is a precondition for returning an answer (`audit-unavailable`, GW-16). Audited outcomes: `policy-disabled`, `kill-switch`, `data-class-refused`, `provider-refused`, success, `confirmation-required`, `confirmed-and-read-back`. **Not audited:** `scope-refused`, `role-disabled`, `mode-disabled`, source and course refusals, `budget-*`, `model-unavailable`, `cost-ceiling-exceeded`, `invalid-provider-response`, `usage-not-recorded`. No correlation id or policy version on the row (GW-14). The shared key writes `console.warn` and usage counters, no decision row. Own-key routes: none.
- **Provenance:** gateway `citedSourceIds` must be a subset of requested sources; response carries `route{provider,model}`, usage and `sourceIds`. UI: `intelligence/Disclosure.tsx` shows the `ai_assisted` badge, mode, origin, source details, and "Information Semester used". Missing: pinned model version, prompt hash, fallback disclosure (GW-14, GW-18).
- **Human escalation:** prompts instruct routing unsupported decisions to a human and naming the official screen (`agents.ts`, `ai/prompt.ts` `ACTING`); every AI write is a proposal card that needs a tap, with an inverse (`lib/tools.ts`, `ai/Actions.tsx`); gateway confirm is single-use with a five-minute expiry and a kill-switch check, but `execute` is stubbed to `{verified:false}` so every confirm returns 502 `authoritative-readback-required`. **No AI crisis or wellbeing router; no approval queue** (`docs/ai-governance` RT-09 "not started").
- **Kill switch:** `kill.ai_generation` is read by the shared key (global row only, fail-closed, `_shared/killswitch.ts`) and by the gateway (global or school row, including confirm). It does **not** reach own-key, OpenAI-key or proxy routes (`KILL_REACH` in `ai-systems.ts`; `aikillswitch.test.ts`). The one drill on file is the shared key, 29 September, which predates the activation gate.
- **Labelling:** the `ai_assisted` trust label in `app/src/lib/source.ts` reads "Written with Semester's assistant. It is not an official answer — check anything you act on." Receipts carry `authoritative: true` only after an authoritative readback, which never happens today. The answer feedback control is local and sends nothing.

## 3. Assistants

| Assistant | Today | Status | Needs |
| --- | --- | --- | --- |
| Student copilot ("Ask Semester") | `app/src/ai/converse.ts`; lookups and 16 proposal tools; consumer routes, or gateway when `VITE_UNIVERSITY_GATEWAY_URL` is set | NI | Governed by default; consent read; classification per source |
| Course-aware tutor | `tutor` and `course-guide` roles (`packages/institution/src/agents.ts`), gateway only; consumer `socratic.ts` modes | NI | Enrollment check; jailbreak suite |
| Research assistant | `FindSources.tsx` (model suggestions, no verification of its own output); web-search tool capped at 5 uses (`lib/research.ts`) | NI | Verification of cited sources (`lib/toolkit/research.ts` rules to be applied) |
| Writing assistant | `Essay.tsx`, `Work.tsx`, `lib/assignment.ts`; builders refuse to write the assignment (prompt structure tested only) | NI | Integrity jailbreak suite |
| Study planner | `Day.tsx`, `Week.tsx`, `Runway.tsx` | NI | none beyond governance |
| Registration guide | Absent (`lib/aiflags.ts`: no registration AI feature) | NS | Official-source answers with the "planning guidance, not an official enrollment decision" pattern from the brief |
| Advising support assistant | `advisor` role on the gateway, unwired; advisor-agenda drafting UI | NI | No degree-audit grounding; case model |
| Staff workflow assistant | Absent (`docs/ai-governance/05` §6) | NS | Approval queue first |
| Institutional knowledge assistant | `course-guide` over `approved_source` | NI | Server index; per-source classification |
| Faculty authoring assistant | Absent; Course Studio is not in the `ask()` importer list | NS | Faculty publish `course_ai_rules` only today |

The student answer for "Can I register for BIO 221 next term?" should be, per the brief: cite the catalog record and prerequisite state, list the window, the hold (office only), availability and credit load, say plainly "This is planning guidance, not an official enrollment decision," and link to the official registration screen. That is a registration-guide acceptance test (EOS-504): the guide may not answer without an official-source label and may not state an enrollment outcome.

## 4. Specification: the policy decision and the provider registry

### Request context (every interaction)

Adopt `packages/platform` `RequestContext` as the carrier and extend it:

```ts
type AIRequestContext = {
  correlationId: string;
  identity: { personId: string; sessionId: string };
  tenantId: string;
  roles: string[];                 // from institution_membership only, never the client
  purpose: AIPurpose;              // enumerated, see below
  scope: { courseId?: string; term?: string; sectionId?: string };
  dataClasses: DataClass[];        // classes of every field and source in the prompt
  consentIds: string[];            // consent_record ids that cover the purpose
  policyVersion: string;           // tenant ai_policy + course_ai_rules versions
  integrityMode: IntegrityMode;
  budget: { reserveCents: number; period: string };
};
type AIPurpose = 'explain' | 'summarize' | 'plan' | 'draft' | 'research' | 'study'
  | 'navigate' | 'advise_prepare' | 'author_course' | 'staff_prepare' | 'escalate';
```

The purpose list is the brief's intent classification (explain, summarize, plan, compare, draft, research, study, navigate, troubleshoot, escalate) made enforceable: `ai_policy` gains `allowed_purposes[]` and the gateway refuses an unlisted purpose (closing control 4).

### Decision order

A request is refused at the first failing step; **every refusal writes one audit row** (closing the unaudited-outcome gap). Steps: identity, tenant policy and kill switch, role, purpose, course scope and enrollment, course AI rules and integrity mode, data classification of every field and source, consent for the purpose, provider policy and region, source and retrieval policy, budget and rate limit, then model routing. After the response: citation subset check, provenance record, AI-assisted label, escalation hint.

### Provider and model registry (proposed; none exists today)

```sql
-- PROPOSED, not applied
create table private.ai_provider (
  id text primary key,              -- 'anthropic', 'openai', 'managed-eu', 'local'
  display_name text not null,
  regions text[] not null,
  zero_retention_attested boolean not null default false,
  data_ceiling text not null check (data_ceiling in ('T0','T1','T2')),
  status text not null check (status in ('draft','approved','paused','retired'))
);
create table private.ai_model (
  provider_id text references private.ai_provider(id),
  model_id text, pinned_version text not null,
  capabilities text[] not null, cost_in_micro bigint not null, cost_out_micro bigint not null,
  eval_run_id text,                 -- required to reach 'approved'
  primary key (provider_id, model_id)
);
create table private.ai_route (
  tenant_id text references public.schools(id), purpose text, primary_model text, fallback_model text,
  primary key (tenant_id, purpose)
);
```

Rules: a model reaches `approved` only with a filed evaluation run (below); a tenant `ai_policy.allowed_providers` intersects the registry, never extends it; fallback never crosses to a provider outside the tenant's allow-list or a higher data ceiling than the request; a fallback is disclosed in the response and the audit row; the registry replaces the three duplicated model lists (`lib/assistant.ts`, `clamp.ts`, `aispend.ts` `RATE_CARD`, today held in step by `claudeclamp.test.ts` and `aispend.test.ts`). `packages/institution/src/routes.ts` already encodes selection and failover rules (GW-03, 04, 06, 07, 08); wiring it is the implementation.

### Spend meter

Keep the existing reserve, settle, release design. Add a per-user cap (GW-12), a tenant dashboard fed by the same ledger, and a hard stop that is visible to the student with the reason. All allowances remain proposals until D-1231 is replaced by an approved price book (the repository has none).

### Tenant and course configuration

Tenant: `ai_policy` already holds provider allow-list, web-source flag, course-sources-only flag, retention days and default provider; the Configuration Studio and Control + Trust tab are the surfaces, and **no admin UI uses `ai:configure` today**. The work is to enforce the four loaded-but-unused fields and build the admin screen. Course: faculty publish `course_ai_rules` and `course_guidance` through Course Studio (verified in slice, flag off).

## 5. Evaluation and red-team plan

**Today:** 15 deterministic cases `MQ-01` to `MQ-15` (`app/src/lib/governance/model-quality.ts`, asserted to be exactly 15, each check shown to refuse a bad reply); a structural injection suite (`app/src/ai/injection.test.ts`, 12-item corpus); `eval-lint.test.ts`; tool-scoping, census and tripwire tests (`app/src/lib/governance/ai-direct-calls.test.ts` lists four doors and misses SDK use). Live suites skip without a key (`ai/modelquality.live.test.ts`, `injection.live.test.ts`). Filed evidence under `docs/evidence/ai/`: one 21-case injection run through the shared-key proxy (all 21 `followed:false`; consumer prompt builders only, not the institution route) and the 29 September kill-switch drill. **No model-quality baseline run is filed and there is no CI release gate on it.**

**Plan:**

| Suite | Purpose | Gate |
| --- | --- | --- |
| Model quality (live) | Baseline per approved model, filed | A model cannot become `approved` in the registry without a filed run |
| Injection and exfiltration | Institution route, including `approved_source` bodies | All cases `followed:false` at the pinned model version |
| Leakage | No other tenant's, course's or person's data; no T3 or above in prompts | Zero leaks on a seeded cross-tenant corpus |
| Integrity jailbreak | Course rule `no AI` and `explain only` hold under adversarial prompts (RT-07) | Pass rate above the faculty-agreed threshold; failures block the assistant for that course |
| Tool abuse | Proposal tools cannot act without a tap; confirm needs a readback | No action without confirmation |
| Crisis and wellbeing | Crisis routing to human help first (RT-09) | Every crisis case routes to the crisis path |
| Bias and accessibility | Parity across seeded personas; plain-language output | Reviewed by a human panel |
| Cost | Reserve covers actual; runaway prevention | No overshoot unrecorded |
| Provider incident | Kill switch, fallback and rollback drill | A drill per provider per quarter; the kill switch reaches every route |

Thresholds are proposals until a decision file records them. Evaluation follows the NIST AI Risk Management Framework as a reference (govern, map, measure, manage), per the brief.

## 6. Closing the governed-path gap

Sequence (details in [the backlog](EDUCATION_OS_BACKLOG.md), epic E5):

1. **Kill switch and policy reach every route** or the route is removed: own-key and proxy become explicitly "personal, ungoverned, off in tenant builds" when `VITE_UNIVERSITY_GATEWAY_URL` is set (a build-time rule a test can hold).
2. Audit every refusal; add correlation id and policy version to the audit row.
3. Read consent; stop hard-coding `consentIds: []`.
4. Purpose allow-list and enrollment check on source reads.
5. Per-source data classification column on `approved_source`; classify at write time.
6. Registry, routing and disclosed fallback; the evaluation gate on `approved`.
7. Governed copilot becomes the default surface; BYO is a clearly labelled personal mode.
8. Registration guide, then advising support, then faculty authoring, each behind its own evaluation suite.

**Unverified:** the governed client path (`converse.ts` about lines 455 to 498) sends the student's own saved-source ids as `sourceIds`, while the gateway requires ids from tenant `approved_source`; ordinary student sources may be refused `source-not-approved`. The audit did not trace this end to end; EOS-505 starts with a reproduction.

## 7. Incident handling

Per `docs/ai-governance/07-incident-response-and-shutdown.md`: severity, who may engage the kill switch (`killswitch:engage`), tenant versus global scope, provider-specific shutdown, communication, and review. Required additions: the kill switch reaching all routes (section 6), a provider-level incident drill, and a standing record of which model version produced which audited answer so a bad version can be traced and its answers reviewed.

## Stale documents to correct

`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` ("nothing built") is stale (the set, lint, filed run and injection suite exist; still true: no filed baseline, no CI gate). `docs/ai-governance/README.md` finding 5 and chapter 03 `RP-02` predate D-1260 and are half stale (a T2 ceiling is on the gateway and shared key; per-source classification is still absent). `docs/architecture/ai/ai-policy-enforcement-map.md` predates D-1260 and the `aiOff` lookup fix. `app/src/lib/governance/ai-systems.ts` AI-01.1 `reconcile` says `read_grades` and `read_attendance` reach the model on consumer routes: now false for the shared key, still true for own-key, OpenAI and proxy. `docs/ai-governance` and the "tenant AI console" text apply to the gateway only; consumer routes cannot be stopped by a school.
