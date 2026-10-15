# Semester AI assurance program

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin (AI governance has no second seat; backup commander `UNASSIGNED`) |
| **Method** | Static audit of the gateway, edge function, registries and tests by an audit agent. The live-model suites are skipped without a key and were not run. |

## Lifecycle

AI feature request → use-case classification → data classification → policy and
course-rule check → threat model → model and provider review → evaluation plan →
red-team test → human review design → release gate → monitoring → feedback and
incident handling.

The repository's own gates G0–G5 in `app/src/lib/governance/ai-lifecycle.ts`
and `docs/ai-governance/` hold the design. This document records what is built.

## Routes

Five routes exist (`lib/governance/ai-systems.ts`): `shared-key`, `device-key`,
`device-key-openai`, `proxy`, `institution-gateway`.

| Route | Kill switch reaches it | Data-class ceiling | Notes |
| --- | --- | --- | --- |
| shared-key (`supabase/functions/claude`) | yes | T2 (D-1260), refused with 422 `data_class_refused` | shared key blocked pending five owner evidence items. Since D-1251 (2026-10-05) it refuses an account whose `profiles.school_id` is set (403) and one whose school cannot be read (503); behind the provider-activation gate, not deployed, not run on a Deno runtime. Serving a school's students with the school's policy applied on the edge is **not done**. |
| institution-gateway (`app/server/institution/intelligence.ts`) | yes | `PROVIDER_FIELD_CLASS` typed so a new field does not compile without a class | no tenant using it |
| device-key, device-key-openai | **no** | none server-side | call the provider from the browser; bypass kill switch and school AI-off (F-04) |
| proxy | partial | — | not audited in depth |

Limits recorded by D-1260 and confirmed by the audit: free text is not scanned
for class, sources are T1 by declaration, and tenant `data_classification_rules`
are read by nothing on the AI path. `school.capabilities.aiOff` is client-side
tool gating in `ai/converse.ts` and `lib/lookup.ts`, not server enforcement.

## The 20 required AI artifacts

(The brief says 19 and lists 20.)

| # | Artifact | State | Evidence | Next |
| --- | --- | --- | --- | --- |
| 1 | AI inventory | exists | `lib/governance/ai-systems.ts` (15 entries; a test fails on any unlisted model-calling file); `docs/trust/AI-SYSTEM-INVENTORY.md` | — |
| 2 | Provider registry | partial | `ALLOWED_MODELS`, `PLAN_MODELS` (`clamp.ts`), `ai_policy.allowed_providers`, `provideractivation.ts` | one versioned registry |
| 3 | Model registry | partial | `ALLOWED_MODELS` in `clamp.ts` and `lib/assistant.ts` | versioned table with owner and review date |
| 4 | Prompt/template registry | **absent** | ~28 `*_SYSTEM` constants and `ai/prompt.ts` | registry with version, owner, eval link |
| 5 | Tool permission matrix | exists | `lib/governance/ai-tools.ts` (deny by default, tested both ways), `_shared/aitools.ts` | server half of the broker (TB-02 onward) not built |
| 6 | Data classification matrix | exists | `toolkit/classification.ts`, `ai-data-class.ts`, `canonical-display.check.sql` | scan free text |
| 7 | Course AI rule model | exists | `course_ai_rules`, `courserules.ts`, `course-agent-policy.ts` | — |
| 8 | Tenant AI policy model | exists | `ai_policy`, `approved_source`, `consent_record`, `tenant_feature_policy` | tenant AI console is designed only |
| 9 | AI evaluation harness | partial | `lib/governance/model-quality.ts` (15 cases, runs in `npm test`); live suites skipped without a key | file a live baseline |
| 10 | Evaluation dataset catalog | partial | the 15 cases in code | coverage matrix (EV-06) |
| 11 | Safety / red-team scenarios | exists | `ai/injection.test.ts`, `injection.live.test.ts` (21 cases) | repeat per model |
| 12 | Hallucination / quality measurement | partial | grounding, verbatim-quote and "claims an act the app cannot do" checks | a measured rate on file |
| 13 | Bias / fairness review | **absent** | paired-prompt harness is EV-07, not started | build where applicable |
| 14 | AI incident runbook | exists | `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`; kill-switch drill; tabletop | backup commander |
| 15 | AI cost monitoring | exists | `_shared/aispend.ts`, `usage`, `20261004170000_ai_spend_meter.sql`, `ai-spend.check.sql` | separate eval budget (GW-13) |
| 16 | AI transparency UX | exists | `intelligence/Disclosure.tsx`, `ai/Answer.tsx`, `lib/aistatus.ts` | — |
| 17 | Human escalation rules | exists | `lib/aihandoff.ts`, `_shared/escalation.ts`, `grading-ai.ts` holds AI grading to human review | — |
| 18 | User correction and appeal | partial | gradebook `regrade_requests`; no AI-specific flow | AI correction route |
| 19 | AI release checklist | exists | G0–G5, `MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md` | — |
| 20 | AI deprecation / rollback | partial | `kill.ai_generation`, `provideractivation.ts`, G5 retire gate | model-alias drift gate (EV-12) |

Counts: 10 exist, 8 partial, 2 absent (prompt registry, bias review).

## Evidence on file

| Artifact | Date | Result | Limit |
| --- | --- | --- | --- |
| Kill-switch drill against production | 2026-09-29 | 3 of 3: 200 before, 503 while engaged, 200 after | one account, one function |
| Prompt-injection red-team | 2026-09-29 | 21 of 21 held on one model | one model, one run |
| Founder tabletop: cross-tenant AI disclosure and provider change | 2026-10-03 | document walkthrough | no alerting, no staffed escalation |

No model-quality run is filed (`docs/ai-governance/06-evaluation-framework.md`
EV-01: "not started: no run is on file").

## Stale

`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` says "Nothing here is built yet".
The deterministic harness is built. The document should say what is built and
what is not.

## Gaps, ranked

| # | Gap | Closes |
| --- | --- | --- |
| 1 | Device-key routes bypass kill switch and AI-off ([SEC-09](SEMESTER_SECURITY_FINISH_LINE.md)) | refuse when policy says off |
| 2 | No filed model-quality baseline | run the live suite, file under `docs/evidence/ai/` |
| 3 | No prompt registry | registry plus a test that fails on an unregistered prompt |
| 4 | Free text not scanned for class; tenant rules unused on the AI path | scan, or state the limit to buyers |
| 5 | No bias or leakage suites | EV-07; a cross-tenant leakage case in the red team |
| 6 | Red team covers one model | repeat on each allowed model and on change |
| 7 | No AI-specific correction route | route and runbook |
| 8 | Backup AI incident commander | assign |
| 9 | Tenant AI console | designed only; defer until a tenant needs it |

## Release gate for any AI change

A change that touches a prompt, model, tool, route or policy is not released
until: use-case and data class recorded; ceiling test green; tool matrix updated
and tested both ways; deterministic harness green; a live run filed if the model
or a prompt builder changed; kill-switch path confirmed for the route; transparency
text reviewed; cost impact stated; rollback named. The
[master checklist](SEMESTER_MASTER_RELEASE_CHECKLIST.md) carries this as section
AI.
