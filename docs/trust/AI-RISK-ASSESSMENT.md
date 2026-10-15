# AI Risk Assessment

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BASELINE — FEATURE-SPECIFIC ASSESSMENT REQUIRED** |
| Owner | Harrison Rubin, AI Governance primary; per-system owners remain required before activation; backup `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Method | Qualitative likelihood and impact; unresolved high/consequential risk blocks activation |

## Decision rule

This baseline names credible harms but does not approve a feature. Each inventory entry needs affected groups, exposure, likelihood, impact, detectability, controls, evidence, residual risk, treatment owner and acceptance authority. Legal, academic, privacy, security and accessibility determinations remain with qualified owners and the customer.

| Risk | Inherent concern | Current code/config evidence | Operational evidence and gap | Required treatment / owner |
| --- | --- | --- | --- | --- |
| Fabrication or false authority | incorrect advice, invented facts/citations, academic harm | source/citation schemas and bounded answers on parts of the gateway | no representative end-to-end results for each feature/population | feature evaluation, visible uncertainty/source review, human route / Product + Academic owner |
| Prompt injection and untrusted content | instruction takeover, exfiltration, policy bypass | structural separation and injection-shaped tests for several builders | limited live-model/adversarial proof; coverage is not universal | threat model and red-team each route/tool/source / Security |
| Privacy or cross-tenant leakage | education records, sensitive content or another tenant exposed | tenant policy/source checks, classification rules and database isolation checks | target provider/configuration and full AI-path tenant test absent | minimize, authorize, isolate, test and monitor / Privacy + Security |
| Provider secondary use or retention drift | content retained, trained on or moved beyond expectations | `store: false` on one OpenAI route; published terms register | terms not executed; zero retention and regions not established | contract/config evidence and recurring reconciliation / Legal + Privacy |
| Bias, accessibility and unequal outcomes | worse or inaccessible assistance for affected users | product accessibility controls and refusal boundaries exist separately | no complete AI-specific bias, language, disability or usability evaluation | participatory test, accessible alternative and monitoring / Accessibility + Product |
| Overreliance and high-impact use | AI substituted for qualified or institutional judgment | lifecycle prohibited scopes and prepare/confirm patterns | course/customer notices, training and observed oversight unproven | block prohibited scope, disclose limits, human decision and appeal / Customer + AI owner |
| Tool or write misuse | messages, records or external actions executed incorrectly | gateway design requires confirmation/readback; some toolkit tools are constrained | no accepted real SIS/LMS write exercise for AI-generated action | least privilege, preview, fresh confirmation, idempotency, readback, rollback / Product + Security |
| Model/provider/prompt drift | behavior changes after updates | model allowlists and policy configuration exist | no systematic change-triggered evaluation and approval record | pin/reconcile versions; regression gate and rollback / Engineering + AI owner |
| Harmful or professional-boundary output | unsafe health, legal, crisis or other advice | prompts/notices and prohibited starting scope | refusal quality and human escalation not fully tested | dedicated cases, safe redirection and incident thresholds / Product + Legal |
| Abuse, denial or cost exhaustion | automated misuse, quota loss, unavailable service | rate limits, tenant budget reservations and feature kill switch on institutional path | abuse thresholds, monitoring and drills incomplete | thresholds, alerting, budget owner, degradation and recovery test / Security + Operations |
| Inadequate transparency or recourse | user cannot understand, report or contest an output | disclosure/source components and local feedback controls | no universal report-to-owner flow or response evidence | pre-use/at-output notice, reporting SLA, correction and non-AI path / Product + Support |
| Youth/education and IP constraints | invalid authority, inappropriate data/content use | policy drafts and source controls | age, role, copyright, course and jurisdiction determinations unresolved | qualified review, customer rule and scoped notice/consent / Legal + Customer |

## Evidence state

**Code/config evidence.** See the [operating-model assurance map](../operating-model/AI-ASSURANCE.md), gateway tests, `app/src/ai/injection.test.ts`, `app/src/lib/aikillswitch.test.ts`, source-policy checks, classification tests and provider adapter tests. These prove specified repository behavior only.

**Operational evidence.** Limited point-in-time drill material exists, but no consolidated feature-specific risk acceptance, external assessment, representative evaluation set, ongoing outcome review or named-institution operating history is evidenced.

**Missing test/proof.** Score each active system, affected population and target configuration; test expected and adversarial cases; document residual risk and named acceptance; establish production thresholds, complaint/incident review and reassessment after material change.

## Claim ceiling

Semester may say it maintains an AI risk-assessment baseline that covers safety, privacy, security, fairness/accessibility, human oversight, provider and operational risks, with high-risk gaps treated as activation blockers.

## Prohibited claims

Do not claim risks are eliminated, accepted, low, independently validated, compliant with a framework, or safe for a named institution merely because a risk is listed or a repository test passes. Do not claim universal accuracy, fairness, non-discrimination or misuse resistance.
