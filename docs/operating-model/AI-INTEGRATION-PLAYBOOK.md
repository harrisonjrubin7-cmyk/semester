# The 2026 AI integration playbook, held to the tree

<!-- Rendered from app/src/lib/governance/ai-playbook.ts by ai-playbook.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Three documents arrived on 29 September 2026 and are kept under `docs/expansion/`
as supplied. They overlap heavily with what is already in code, and replace
none of it: [`AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) owns the gates, the
release gate and the intake refusals; [`AI-ASSURANCE.md`](AI-ASSURANCE.md) owns
the NIST matrix and the evaluation tiers; `toolkit/classification.ts` owns the
data tiers. So every workflow’s prohibited decision names the intake refusal
that already refuses it, every data class is checked against what the
classification gate actually does, every definition-of-done line names the
`AI_RELEASE_GATE` item that carries it, and the vendor scorecard is code.

| Supplied document | What it holds |
| --- | --- |
| [Semester 2026 AI integration playbook](../expansion/AI-Integration-Playbook-2026.pdf) | The executive model and ten rules, the workflow card and action tiers A–E, the ten workflows, the mapping method, data classes and safeguards, the provider requirements, the vendor scorecard, onboarding, ROI, the build plan and the definition of done. |
| [Build a 2026 AI integration playbook: map 10 agentic workflows across HR, engineering and sales with data security and ROI scorecards](../expansion/AI-Integration-Playbook-Ten-Workflows-Summary.pdf) | The summary: which five workflows to build first, and the OWASP framing (prompt injection, excessive agency). |
| [Any other ways to further integrate and implement and expand the capabilities and use of AI](../expansion/Semester-Intelligence-Further-Integration.pdf) | Semester Intelligence as one layer: capabilities by domain, the action composer, the orchestrator, student-controlled memory, multimodal inputs, the confirmation matrix, measurement and a four-phase build order. |

## Where it stands

Statuses were read at `origin/main` `beaa839` on 29 September 2026. A test holds
every cited file to existing and each status to the kind of file it cites:
`designed` a document, `building` code, `tested` a test that runs on every
change. The supplied PDFs are never cited as evidence.

| | not-started | designed | building | tested | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Workflows | 1 | 0 | 2 | 7 | 10 |
| Confirmation matrix | 0 | 0 | 1 | 12 | 13 |
| Never sent casually | 0 | 0 | 3 | 5 | 8 |
| Onboarding steps | 0 | 0 | 0 | 6 | 6 |
| Multimodal inputs | 3 | 1 | 1 | 5 | 10 |

Read the workflow statuses carefully. Most of the ten are `tested` because the
*non-AI workflow* and its boundary exist and are held — registration that
registers nobody, advisor shares that expire, skills the student confirms.
In almost every case the gap is the agent itself: nothing drafts, explains or
routes with a model yet. That is the order the playbook asks for (“the non-AI
workflow is usable” is on its definition of done), not a shortfall to hide.

## The ten rules

1. AI never decides authorization or bypasses database policy.
2. AI receives only the minimum data required for the current request.
3. AI may explain, draft and prepare; it may not silently send, share, schedule, enroll, pay, delete or change records.
4. Every consequential action requires an exact preview and explicit user confirmation.
5. Institutional data is processed only under the institution’s approved purpose, agreement, data scope, policy and retention rule.
6. AI outputs based on institutional or course materials show source anchors or disclose missing sources.
7. Uploaded material is untrusted data, never executable instruction.
8. AI respects academic-integrity policy at institution, course and assignment levels.
9. Students can see, correct, delete and control eligible AI history and memory.
10. Every agentic workflow has an owner, an evaluation set, audit events, abuse controls, a kill switch and a rollback plan.

## Action-risk tiers

| Tier | Description | Example | Required control |
| --- | --- | --- | --- |
| A | Read-only explanation | Summarize a selected syllabus | Source check and output validation |
| B | Draft creation | Draft an advisor agenda or study plan | User review before saving or sharing |
| C | Internal state preparation | Propose an Action Center action or plan draft | Explicit user approval before persistence |
| D | External or reversible action | Create a calendar draft, export a document | Exact preview and confirmation |
| E | High-impact or regulated action | Send a message, share records, payment handoff, enrollment action | Fresh authentication, exact confirmation, audit; often an official handoff only |

## The ten workflows

The five the summary says to build first are marked ★. *Reaches* is the
highest action tier the workflow may reach, and only through that tier’s
control. *Refused at intake* names the `PROHIBITED_STARTING_SCOPE` entry that
already refuses part of what the workflow must never do.

| ID | Workflow | For | Job | Reaches | Must never | Refused at intake | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-01 | ★ Student Path and Registration Copilot | student | Explain requirements, compare courses, find conflicts, propose backups and draft advisor questions; never register | C | Certify degree completion, guarantee eligibility or a seat, register, add, drop or withdraw | *Autonomous registration*, *Official degree certification* | tested | `app/src/lib/registration-actions.test.ts` — proposes a backup per unbacked section, a conflict and each unticked checklist item; nothing outside Registration Day Mode<br>`app/src/components/RegistrationDayCard.test.tsx` — “Semester never registers you”; the official system opens only after a confirmation that starts on Cancel<br>`app/src/lib/degree.test.ts` — met means finished; in progress is not done<br>`docs/REGISTRATION-DAY-MODE.md` — the mode and its boundary | The proposals are rules, not a model: no AI explains a requirement or drafts advisor questions from the plan, and no incorrect-source report route exists. |
| WF-02 | ★ Syllabus-to-Study Studio Agent | student | Turn authorized course materials into source-linked study assets, reviews, practice and study plans | C | Fabricate sources, process disallowed material, answer active prohibited assessment questions | — | tested | `app/src/lib/studystudio.test.ts` — rejects invented source ids, unverifiable quotations and unsourced sections; source text stays data<br>`app/src/components/StudyStudio.anchors.test.tsx` — each PDF excerpt named by its page, and a citation opens there<br>`app/src/lib/import-review.test.ts` — deadlines need explicit verification even when valid<br>`app/src/lib/extractaccuracy.test.ts` — extraction fidelity over a labelled corpus | No malware scan of uploads; citation coverage and helpfulness are not measured in production. |
| WF-03 | ★ Academic Integrity Guardrail Agent | student | Give allowed learning help and a useful alternative where help with active graded work is restricted | A | Complete active graded submissions, fabricate sources or data, assist plagiarism evasion | — | tested | `app/src/lib/toolkit/policy.test.ts` — a course that allows AI still does not allow final answers; a course that bans it is offered only redirects that need no AI<br>`app/src/lib/coursestudio.test.ts` — final answers never permitted without the instructor confirming by name<br>`app/src/intelligence/assemble.test.ts` — integrity policy re-evaluated for every request; no request assembled when policy permits no mode<br>`app/src/ai/helpstate.test.tsx` — planning help kept for a course that bans AI help | No false-block measurement and no feedback route for a wrong refusal; refusals are not audited as events. |
| WF-04 | ★ Advisor Meeting Preparation Agent | student | Draft a student-reviewed agenda and share only the scope the student selects | E | Reveal private study, health, financial or non-shared data to an advisor | — | tested | `app/src/components/AdvisorMeeting.test.tsx` — shows exactly what the advisor will see and sends only after confirming; revokes only after confirming<br>`app/src/lib/advisor-meeting.test.ts` — carries only what the student ticked; no field for notes, history or grades<br>`app/src/lib/advisor-shares.test.ts` — always an expiry, never past 120 days; revocation stops that share only<br>`supabase/advisor.check.sql` — expiry and revocation stop reads under RLS | The agenda is assembled from ticks, not drafted by AI; no advisor-usefulness score is collected. |
| WF-05 | ★ Campus Support Navigator | student | Route to verified resources and prepare a safe official handoff | E | Diagnosis, emergency-triage promises, legal, medical or financial determinations, disclosure of restricted data | *Health decisions* | tested | `app/src/components/GetHelp.test.tsx` — wellbeing offers a crisis line and no way to send anything; a request sends only the ticked lines, after confirming<br>`app/src/lib/help-routes.test.ts` — nothing ticked by default<br>`app/src/lib/basicneeds.test.ts` — seventeen categories, each routing only to offices that exist<br>`docs/CRISIS-RESPONSE-RUNBOOK.md` — escalation for student harm | Routing is a directory lookup; no AI reads a described problem and names the office, and no source-freshness alert exists for the directory. |
| WF-06 | Career Evidence and Opportunity Agent | student | Turn confirmed work into portfolio evidence and prepare career actions | D | Invent achievements, apply automatically, rank students for employers, infer protected traits | *Opaque risk scoring*, *Ranking students for employers* | tested | `app/src/lib/career-evidence.test.ts` — confirmed, renamed, rejected and undone; no word or number the student did not supply<br>`app/src/components/CareerEvidence.test.tsx` — every suggested skill unconfirmed until the student decides; a résumé opens in Write only after its preview<br>`docs/CAREER-EVIDENCE.md` — the design | No opportunity ranking, no job-description comparison and no match reasons. |
| WF-07 | Institutional Content Governance Agent | institution | Keep campus resources, policies, events and opportunities accurate and accessible | D | Auto-publish policy changes, override a content owner, alter an official record without approval | *Auto-publishing institutional policy* | building | `app/src/lib/launch/content.test.ts` — each content row has a source, owner, review, visibility, expiry and correction; a stale review is refused<br>`app/src/components/institutional/CampaignManager.test.tsx` — Approve shown only to the named approver; locked once out of draft<br>`app/src/lib/official-notices.ts` — a stale emergency never says Required | There is no AI agent here: owner approval and staleness rules exist for content, and nothing drafts summaries, finds broken links or builds accessibility checklists. |
| WF-08 | Engineering Reliability Triage Agent | internal | Summarize incidents, correlate errors, propose runbook steps and regression tests | B | Deploy code, alter production data, rotate credentials, change the firewall, close incidents without approval | *Unapproved production changes* | building | `app/src/lib/integration/redact.ts` — tokens, keys and emails redacted from integration errors and logs<br>`app/server/institution/intelligence.test.ts` — provider failure mapped without logging questions or protected source bodies<br>`app/src/lib/governance/incident-comms.ts` — incident notices refuse placeholders and speculation | Log redaction exists; no AI triage agent, and no read-only connector to logs or the issue tracker. |
| WF-09 | Institutional Sales and RFP Copilot | internal | Prepare accurate RFP answers, pilot scopes, security responses and implementation plans | B | Unsupported compliance claims, unapproved pricing, signing contracts, disclosing protected customer data | — | tested | `app/src/lib/ops/claims.test.ts` — catches a word above what the claims register supports, and a claim on expired evidence<br>`app/src/lib/gtm/rfp.test.ts` — never claims something exists without citing it; “available now” only where every control is READY<br>`docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md` — the approved answer library | The approved claims library and its guard exist; nothing drafts an answer with AI, so the guard has never checked a generated one. |
| WF-10 | Talent and Hiring Operations Copilot | internal | Organize role requirements, interview logistics, onboarding material and candidate communications | B | Automated hiring decisions, ranking on protected characteristics, inferring sensitive traits, sending offers without approval | *Automated hiring decisions* | not-started | — | Nothing in the tree. Semester has no hires, no ATS and no HRIS; this workflow waits on a team. An automated hiring decision is refused at intake. |

Four of these refusals were added to `PROHIBITED_STARTING_SCOPE` for this playbook (D-131): automated hiring decisions, ranking students for employers, auto-publishing institutional policy, and unapproved production changes. A use case that touches any of them is refused at intake, whatever evidence it brings.

### ROI scorecards

Count completed, useful, safe outcomes — never raw usage.

| ID | Workflow | Leading | Outcome | Guardrail |
| --- | --- | --- | --- | --- |
| WF-01 | Student Path and Registration Copilot | Plan drafts created | Conflicts resolved; backups saved | Incorrect-source reports |
| WF-02 | Syllabus-to-Study Studio Agent | Study assets created | Study sessions completed; helpfulness | Citation coverage; integrity blocks |
| WF-03 | Academic Integrity Guardrail Agent | Safe alternatives offered | Integrity-policy compliance; faculty trust | False-block rate |
| WF-04 | Advisor Meeting Preparation Agent | Agendas created | Advisor usefulness; follow-up completion | Oversharing incidents |
| WF-05 | Campus Support Navigator | Search-to-action conversion | Successful resource handoffs | Stale-content reports |
| WF-06 | Career Evidence and Opportunity Agent | Skills confirmed | Portfolio or application milestone | Invented-claim corrections |
| WF-07 | Institutional Content Governance Agent | Stale items identified | Freshness improvement | Incorrect auto-draft rate |
| WF-08 | Engineering Reliability Triage Agent | Incidents summarized | MTTR reduction; recurrence reduction | Secret or PII exposure incidents |
| WF-09 | Institutional Sales and RFP Copilot | Draft responses | Response cycle time; conversion | Unsupported-claim corrections |
| WF-10 | Talent and Hiring Operations Copilot | Interview kits generated | Prep-time reduction | Bias or quality issue reports |

Cost counts model inference, embeddings, retrieval, storage, moderation, support, human review, vendor fees, engineering maintenance. None of these metrics is collected today; the tenant usage tables (`private.ai_usage_month`) count tokens, which is cost, not value.

## The human-confirmation matrix

A test holds the matrix to its own tiers: nothing automatic reaches past
internal state (tier C), and nothing at tier D or E runs without
confirmation.

| ID | AI action | Automatic? | Required control | Tier | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HC-01 | Summarize selected course material | Yes | After a source-access check: cite the source and allow correction | A | tested | `app/src/lib/studystudio.test.ts` — unsourced sections and unverifiable quotations rejected<br>`app/src/components/StudyStudio.anchors.test.tsx` — a citation opens at its page | No correction route from a summary back to its source. |
| HC-02 | Generate flashcards and practice | Yes | After a source-access check: label as generated; allow editing and deletion | B | tested | `app/src/lib/studystudio.test.ts` — generated study assets held to their sources | No test holds a “generated” label on each asset. |
| HC-03 | Draft an advisor agenda | Yes | Student review before sharing | B | tested | `app/src/components/AdvisorMeeting.test.tsx` — shows exactly what the advisor will see before anything is sent | The agenda is assembled from the student’s ticks, not drafted by a model. |
| HC-04 | Suggest a study block | Yes | Student approves before the calendar write | B | tested | `app/src/components/LifeBalance.test.tsx` — a suggested study block is added only after a preview, with focus on Cancel | Holds for Life Balance; the assistant does not propose study blocks. |
| HC-05 | Create an internal Action Center draft | Yes | Student can edit and approve | C | tested | `app/src/ai/prompt.test.ts` — calling a tool is a proposal, not an act<br>`app/src/ai/Actions.tsx` — “Nothing here has happened”: each proposal is a button the student has not pressed | A proposal cannot be edited before it is approved, only taken or left. |
| HC-06 | Save a plan change | No | Exact preview and confirmation | C | tested | `app/src/lib/registration-actions.test.ts` — a backup or conflict is proposed, never applied<br>`app/src/ai/Actions.tsx` — each proposal labelled with the change it will make | No screen test clicks a plan-change confirmation from the assistant. |
| HC-07 | Send an email or message | No | Exact draft, recipient and confirmation | E | tested | `app/src/components/GetHelp.test.tsx` — sends only the question and the ticked lines, after the student confirms<br>`app/src/components/AdvisorMeeting.test.tsx` — sends only after confirming | No email leaves Semester; the rule is proved for in-app requests, not for mail. |
| HC-08 | Create a calendar event | No | Exact preview and confirmation | D | building | `app/src/components/LifeBalance.tsx` — a suggested study block reaches the plan only through its preview | No external calendar write exists; the rule has not met one. |
| HC-09 | Share a plan | No | Scope, recipient, expiry and confirmation | E | tested | `app/src/lib/advisor-shares.test.ts` — always an expiry, never past 120 days; revocation by share<br>`supabase/advisor.check.sql` — an expired or revoked share stops reads under RLS | Advisor shares only; no other recipient kind exists. |
| HC-10 | Export a document | No | Preview, destination and confirmation | D | tested | `app/src/components/AdvisorMeeting.test.tsx` — exports only after a preview that leaves out private notes | One export path is held; others are not audited against the rule. |
| HC-11 | Register or change enrollment | No | Official handoff only unless institutionally authorized | E | tested | `app/src/components/RegistrationDayCard.test.tsx` — the official system opens only after a confirmation that starts on Cancel; Semester registers nobody<br>`app/src/lib/governance/ai-lifecycle.test.ts` — autonomous registration refused at intake | None: the handoff is the whole of it, which is what the playbook asks. |
| HC-12 | Make a payment | No | Provider-hosted flow and explicit confirmation | E | tested | `app/src/lib/billing/checkout.test.ts` — explicit consent to a named wording first, then a hosted page; nothing charged on provider failure | No AI path reaches billing; the rule is proved for the student’s own checkout. |
| HC-13 | Delete data | No | Explicit confirmation, retention policy, audit event | E | tested | `app/src/components/TrustCenter.test.tsx` — saved conversations deleted only after a confirmation, archive included and nothing else | No audit event is written for a student’s own deletion. |

## Data classes, against the classification gate

Each playbook class names the `classification.ts` tiers it covers, and the
test asks `gate(tier, "ai", courseAllowsAi = true)` for every one: a class
whose rule says “exclude” is only true if the gate refuses it. A class with
no tier must fail closed.

| Class | Examples | AI handling rule | Tiers | Reaches AI? | Note |
| --- | --- | --- | --- | --- | --- |
| Public | Published catalog, public event, public policy | May be used in approved retrieval with source citation | T0 | Yes, for the student’s own purpose | T0 in the gate. |
| Internal | Institution operations documentation | Use only with tenant authorization and need-to-know access | — | No | The student-side gate has no tier for institution operations material; the gateway’s approved_source rows are the control, per tenant. |
| Student private | Student plan, goals, drafts, study activity, portfolio | Use only for the student’s selected purpose; never expose to staff by default | T2 | Yes, for the student’s own purpose | T2 (your own academic work) in the gate; staff exposure is governed by the share tables, not the gate. |
| Restricted | Education records, financial details, accommodations, health, conduct, authentication secrets | Exclude by default; require a narrow approved workflow, explicit authority, strict logs, and often no AI processing | T3, T4, T5, T6 | No | T3–T6 in the gate; unclassified material is treated as T3 and blocked. |

No class covers T1 (course-authorized, non-sensitive): the playbook has no class for material an instructor provided for a use, and the gate already decides it by the course policy.

### What must never be sent casually to AI

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| NS-01 | Raw passwords, secrets, API keys, session tokens or credentials | building | `app/src/lib/integration/redact.ts` — tokens, keys and secrets redacted from integration errors and logs | Redaction runs on integration logs; nothing scrubs a prompt before it is sent (AI assurance MR row on redaction). |
| NS-02 | Unnecessary full student records | tested | `app/src/lib/toolkit/classification.test.ts` — unclassified material counts as an education record and stays away from AI<br>`app/src/lib/integration/classification.test.ts` — T3 and above never go to a consumer model | The gate refuses what is classified; it cannot see an unclassified record pasted into chat. |
| NS-03 | Health, diagnosis, disability, conduct, disciplinary or emergency details | tested | `app/src/lib/toolkit/classification.test.ts` — T4–T6 hard-blocked from every action | As above: a lookup, not a scan of free text. |
| NS-04 | Detailed financial-aid records, payment credentials, bank data or ledger detail | tested | `app/src/lib/integration/classification.test.ts` — T4–T6 hard-blocked from AI | Payment details never pass through Semester (Stripe’s hosted page); aid records are T4 by lookup only. |
| NS-05 | Private advisor notes or counseling information | tested | `app/src/lib/advisor-meeting.test.ts` — the meeting pack has no field for notes, history or grades | Held for the advisor pack; the assistant has no rule naming advisor notes. |
| NS-06 | Full class rosters where aggregate or de-identified data will work | building | `app/src/lib/toolkit/classification.ts` — rosters named as T3, blocked from AI | No aggregate or de-identification path exists to prefer. |
| NS-07 | Hiring decisions or protected-trait data | building | `app/src/ai/prompt.ts` — the assistant is told what it must not infer about the student | No hiring data exists; the no-inference rule is a prompt line, not a filter. |
| NS-08 | Anything the user has not authorized for the active request | tested | `packages/institution/src/policy.test.ts` — ai.retrieve_source refuses revoked, quarantined or unshared sources<br>`app/src/lib/help-routes.test.ts` — nothing ticked by default, so the question goes alone | Holds at the gateway and in help requests; the on-device assistant sends its own context. |

## The AI vendor scorecard

Score each provider 0–5 on every dimension. Do not approve on model quality
alone. `scoreVendor()` in `ai-playbook.ts` is the scorecard; the test holds
its rules.

| Dimension | Weight | What 5 means | Floor |
| --- | ---: | --- | --- |
| Data-use restrictions | 15% | Contractually no training or secondary use without explicit authorization | 4.0 |
| Privacy and retention controls | 10% | Configurable retention, deletion, access controls, clear subprocessors | 4.0 |
| Security posture | 15% | Strong documented security, encryption, auditability, incident process | 4.0 |
| Education-policy fit | 8% | Supports source grounding, academic-integrity controls, policy routing | — |
| Source and citation support | 8% | Structured retrieval, stable citations, provenance support | — |
| Tool-use safety | 8% | Narrow tools, confirmation controls, guardrails against excessive agency | 4.0, agentic workflows only |
| Prompt-injection resilience | 8% | Tested mitigations and safe context and tool boundaries | — |
| Model quality | 8% | Reliable performance on Semester evaluation sets | — |
| Accessibility capability | 5% | Supports captions, structured output, multilingual and plain-language use | — |
| Reliability and latency | 5% | SLOs, fallbacks, regional availability, predictable performance | — |
| Cost transparency | 5% | Clear pricing, quotas, monitoring, controllable unit economics | — |
| Portability | 5% | Provider-agnostic architecture, exportable prompts and evaluations, low lock-in | — |

**Approval:** every dimension scored, a weighted score of at least 4.0, every floor met, and no critical legal, security or privacy blocker — which no model quality can offset.

**The weights sum to 100%.** As supplied they summed to 95%; the missing five points went to security posture (10% → 15%), one of the three floors no weighted total can offset.

### The providers Semester can call

Every AI party in `trust/subprocessors.ts`, held there by the test, scored from the provider’s own public documentation read on 2026-09-29. Each score cites the page it rests on, and the test refuses a citation to any other host. These are desk scores, not contract review: no DPA is signed (see [`DPA-CHECKLIST.md`](../trust/DPA-CHECKLIST.md)).

**No provider is approvable yet.** Model quality is performance on Semester’s own evaluation set, `app/src/lib/governance/model-quality.ts`: fifteen synthetic cases through the prompts Semester sends, graded by fixed checks. It has not been run against either provider, so every verdict is *unscored*. The provisional reading is the weighted score over the dimensions that are scored, and any floor already missed.

| Provider | Agentic? | Verdict | Provisional | Scored weight | Floors missed | Note |
| --- | --- | --- | ---: | ---: | --- | --- |
| Anthropic (Semester’s key) | No | unscored | 4.02 | 92% | none | The shared key drops code execution, web fetch and MCP tools (claudeclamp.test.ts), so it is scored as non-agentic. Some newer models cannot run with zero retention. |
| OpenAI (institution-approved) | Yes | unscored | 4.08 | 87% | none | Called with store: false. The gateway issues server-side, single-use actions, so it is scored as agentic and the tool-use floor binds. Security and education scores rest on coverage OpenAI should confirm in writing. |
| Anthropic (student’s own key) | No | unscored | 4.02 | 92% | none | The student’s own contract with the provider; scored only to decide whether to offer the option. |
| OpenAI (student’s own key) | No | unscored | 4.08 | 87% | none | As above. |

#### Anthropic

| Dimension | Weight | Score | What the provider’s own page says |
| --- | ---: | ---: | --- |
| Data-use restrictions | 15% | 5 | Contractual: “Anthropic may not train models on Customer Content from Services”; the only use is feedback a user explicitly sends. [source](https://www.anthropic.com/legal/commercial-terms) |
| Privacy and retention controls | 10% | 4 | Inputs and outputs deleted within 30 days; flagged content kept up to 2 years; zero retention only by arrangement with sales, and not for every model; subprocessors published. [source](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) |
| Security posture | 15% | 5 | Breach notice “in any event within 48 hours”; AES-256 at rest, TLS 1.2+; SOC 2 Type II, ISO 27001 and ISO 42001 cover the API. [source](https://www.anthropic.com/legal/data-processing-addendum) |
| Education-policy fit | 8% | 3 | Safeguards required for minors (age checks, AI disclosure, COPPA); no FERPA terms for the API — the K-12 DPA covers only Claude for Teachers. [source](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors) |
| Source and citation support | 8% | 5 | Citations “return the exact passages that support each claim”; generally available on all active models. [source](https://platform.claude.com/docs/en/build-with-claude/citations) |
| Tool-use safety | 8% | 4 | Client tools run in the application; strict schemas make tool calls match exactly; server tools exist and must be left off. [source](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) |
| Prompt-injection resilience | 8% | 3 | Documented guidance (screens, layered defences, monitoring); no tested mitigation evidence Semester can inspect. [source](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) |
| Model quality | 8% | — | Unscored: Scored against Semester’s own evaluation set (app/src/lib/governance/model-quality.ts, run by app/src/ai/modelquality.live.test.ts), which has not been run against this provider. A run filed under docs/evidence/ai/ is the only thing this score may cite. |
| Accessibility capability | 5% | 3 | Strong multilingual performance and strict structured output; no speech-to-text in the API. [source](https://platform.claude.com/docs/en/build-with-claude/multilingual-support) |
| Reliability and latency | 5% | 2 | Standard tier is “best-effort availability”; no SLA in the terms; 60 days’ notice before a model is retired. [source](https://platform.claude.com/docs/en/api/service-tiers) |
| Cost transparency | 5% | 5 | Published per-tier rate limits, customer-set spend limits per organisation or workspace, and a usage and cost API. [source](https://platform.claude.com/docs/en/api/rate-limits) |
| Portability | 5% | 2 | An OpenAI-compatible endpoint exists but is “not considered a long-term or production-ready solution”. [source](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) |

#### OpenAI

| Dimension | Weight | Score | What the provider’s own page says |
| --- | ---: | ---: | --- |
| Data-use restrictions | 15% | 5 | Contractual: “OpenAI will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees”. [source](https://cdn.openai.com/osa/openai-services-agreement.pdf) |
| Privacy and retention controls | 10% | 4 | Abuse logs up to 30 days; zero retention by approval for eligible customers; some endpoints keep data until deleted; twelve storage regions. [source](https://developers.openai.com/api/docs/guides/your-data) |
| Security posture | 15% | 4 | Breach notice “without undue delay”, with no fixed hours; the trust portal lists SOC 2, ISO 27001 and 42001 but describes itself as for ChatGPT, so API coverage is not confirmed on an official page. [source](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) |
| Education-policy fit | 8% | 4 | A Student Data Privacy Agreement names OpenAI a FERPA school official, but its text names ChatGPT Edu, so API coverage needs confirming; under-13 data requires zero retention. [source](https://cdn.openai.com/osa/openai-sdpa.pdf) |
| Source and citation support | 8% | 4 | File search returns “file citations”; citations come through the hosted file tool, not arbitrary passages. [source](https://developers.openai.com/api/docs/guides/tools-file-search) |
| Tool-use safety | 8% | 4 | Function calls run in the application; strict mode enforces the schema; hosted tools (web search, code execution, MCP) exist and must be left off. [source](https://developers.openai.com/api/docs/guides/function-calling) |
| Prompt-injection resilience | 8% | 3 | Documented guidance and a free moderation endpoint; no tested mitigation evidence Semester can inspect. [source](https://developers.openai.com/api/docs/guides/safety-best-practices) |
| Model quality | 8% | — | Unscored: Scored against Semester’s own evaluation set (app/src/lib/governance/model-quality.ts, run by app/src/ai/modelquality.live.test.ts), which has not been run against this provider. A run filed under docs/evidence/ai/ is the only thing this score may cite. |
| Accessibility capability | 5% | 4 | Native transcription with timestamps and speaker labels, strict structured output; translation only into English. [source](https://developers.openai.com/api/docs/guides/speech-to-text) |
| Reliability and latency | 5% | 3 | At least six months’ notice before a GA model is retired; no SLA in the services agreement. [source](https://developers.openai.com/api/docs/deprecations) |
| Cost transparency | 5% | 5 | Hard spend limits per organisation or project that return 429 when reached, and a usage and costs API. [source](https://developers.openai.com/api/docs/guides/spend-limits) |
| Portability | 5% | — | Unscored: No official page speaks to portability or lock-in. |

What would change a score: a signed DPA with a FERPA school-official clause (education fit, both providers); written confirmation that OpenAI’s certifications cover the API (security, OpenAI); an uptime SLA (reliability, both); a filed run of the model-quality set (model quality, both).

### What a provider must show before approval

| Requirement | Verification |
| --- | --- |
| Contractual data-use restrictions | Legal and security review |
| No unauthorized training on customer data | Provider terms and configuration evidence |
| Encryption and access controls | Security documentation |
| Regional and data-residency suitability where required | Provider documentation |
| Retention controls | Provider configuration and agreement |
| Subprocessor disclosure | Vendor documentation |
| Incident notification obligations | Contract and legal review |
| Logging and audit support | Technical evaluation |
| Model and version change controls | Provider change process |
| Reliability and fallback | SLO evidence and routing plan |
| Cost controls | Rate limits, quotas, usage reporting |
| Prompt-injection and tool-use protections | Security test evidence |

## Student onboarding

First-session goal: “I now know what I need to do next.” Deliver a useful result in minutes before asking the student to configure anything.

| ID | Step | Asks | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OB-01 | Welcome and trust | Account or institutional sign-in; concise privacy, AI, accessibility and support links; institution-sponsored or personal account | tested | `app/src/data/onboarding.test.ts` — asks for an account with the one form both places share<br>`app/src/screens/Onboarding.tsx` — the adoption prompt and its steps | No step asks whether the account is institution-sponsored, and the four trust sentences (you control what you share; sources are visible; estimates are labelled; settings change any time) are not on the welcome. |
| OB-02 | Choose a starting point | What would be most helpful today? Six choices, each routing to the smallest onboarding path | tested | `app/src/components/unity/unity.test.tsx` — FirstGoal: choosing, landing and Change<br>`app/src/lib/unity.test.ts` — every goal’s screen is a real destination<br>`docs/ONBOARDING-AND-CONTEXTUAL-HELP.md` — “What would help most today?” and its six goals | Five of the six choices have a goal; “Organize this week” has none, and FirstGoal carries “Prepare for registration”, which the playbook does not list. |
| OB-03 | Build minimum context | School, program, current or target term, expected graduation, today’s goal; optional study times and constraints | tested | `app/src/data/onboarding.test.ts` — asks which term it is, on the screen that asks where<br>`app/src/lib/source.test.ts` — every source label named and explained | Program and expected graduation are not asked at onboarding; study-time preferences live in Life Balance, not here. |
| OB-04 | Deliver the first useful result | The outcome each starting choice promises, within minutes | tested | `app/src/screens/onboardingcounts.test.tsx` — counts what is the student’s own while the sample is loaded<br>`app/src/screens/firstrun.test.ts` — an empty app says what to do next | The first result is deadlines from a syllabus; no measure says whether it arrived in five minutes. |
| OB-05 | Explain the result | Why this appeared, data used, what is estimated or missing, what can change, what to do next | tested | `app/src/intelligence/Disclosure.test.tsx` — each answer shows source locators, origin, mode and an AI-assisted badge<br>`app/src/lib/source.test.ts` — only the institution’s own facts say “verified” | Answers name sources and origin; no recommendation carries a “why this appeared” line with the data used. |
| OB-06 | Invite, do not demand, connections | Calendar, course materials, an advisor agenda, a study group, events, accessibility, AI source and history controls — each after value, with incremental consent | tested | `app/src/components/TrustCenter.test.tsx` — says what is connected, what the labels mean and what AI may not use; deletes saved conversations only after a confirmation<br>`docs/ONBOARDING-AND-CONTEXTUAL-HELP.md` — connections deferred until a workflow needs them | No AI-source selector (selected, course or institution sources) and no memory categories; AI history deletion is all-or-nothing. |

### Starting choices, against FirstGoal

| Choice | First outcome | FirstGoal goal |
| --- | --- | --- |
| Plan my next term | Basic term plan and visible weekly schedule | `semester` — Build my semester |
| Understand my academic path | Path Snapshot with what is known, estimated, and needs review | `degree` — Understand my degree path |
| Organize this week | Today briefing and top three actions | **none** |
| Get help with a course | Course workspace or study plan using selected materials | `study` — Study for a course |
| Find campus support | Verified resource recommendation and safe handoff | `support` — Find campus support |
| Explore career options | Starter goal, related skills, opportunity or portfolio checklist | `career` — Explore careers |

FirstGoal also offers `registration` — Prepare for registration, `week` — Organize my week, `meeting` — Prepare for a meeting, `privacy` — Manage my data and settings, which the playbook does not list.

### The first week

| Day | Semester moment |
| ---: | --- |
| 0 | First clear action and saved plan or context |
| 1 | Today briefing and one useful prompt |
| 2 | Ask the student to review sources or add one deadline or course |
| 3 | Suggest an advisor agenda, study plan or campus resource if relevant |
| 5 | Gentle check-in: “Did this help you understand what to do next?” |
| 7 | Weekly reset: priorities, schedule, deadlines, study blocks, opportunities |

Do not flood new users with notifications: the goal is confidence and practical progress, not engagement for its own sake.

## Semester Intelligence: one layer

| Verb | Does |
| --- | --- |
| Understand | Summarize, extract, classify, connect |
| Explain | Teach, clarify, compare, translate, recommend |
| Generate | Drafts, plans, study assets, outlines, agendas |
| Prepare | Calendar drafts, advisor agendas, applications, follow-ups |
| Verify | Sources, citations, freshness, policy, permissions |
| Assist | Hand off to a human, office, tutor, advisor, mentor or support team |

### Memory the student controls

The nearest thing in the tree is *About me* (`lib/aboutme.ts`): lines the
student types, nothing inferred, each editable and deletable. Every memory
must be:

- Visible to the student
- Editable
- Deletable
- Scoped by purpose
- Not visible to staff by default
- Not used to infer sensitive characteristics
- Not loaded into an AI prompt without permission controls

### Multimodal inputs

| ID | Input | Capability | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| IN-01 | Syllabus PDF | Reviewable deadlines, policies, objectives, grading, office hours | tested | `app/src/lib/extractaccuracy.test.ts` — extraction fidelity over a labelled syllabus corpus<br>`app/src/lib/import-review.test.ts` — explicit verification before a calendar is activated | Policies, objectives and office hours are not extracted as reviewable fields. |
| IN-02 | Slides | Source-linked summary, glossary, practice, concept map | tested | `app/src/components/StudyStudio.anchors.test.tsx` — excerpts named by page; citations open there | No concept map or glossary output. |
| IN-03 | Audio or lecture video | Transcript, timestamped review guide, captions, study prompts | tested | `app/src/lib/transcribe.test.ts` — a stable hour-minute-second locator for cited transcript moments<br>`app/src/components/CourseCapture.test.tsx` — explicit consent; audio, video, image and document files accepted | No caption file is produced. |
| IN-04 | Image of a flyer | Event, deadline, location, contact, action items | not-started | — | Images are accepted by course capture; nothing extracts an event from one. |
| IN-05 | Screenshot of a hold notice | Plain-language explanation, the official next step, a reviewable action | not-started | — | Nothing reads a hold notice. |
| IN-06 | Degree-audit screenshot | Possible requirements or open items marked Needs review | not-started | — | Degree data is entered or imported, never read from a screenshot. |
| IN-07 | Spreadsheet or CSV | Explain data, charts, missing values, a methods note | tested | `app/src/lib/extract.test.ts` — reads markdown, CSV and a file the browser knows only by type | Read as text for extraction; no data explanation or chart. |
| IN-08 | Research article | Structured reading guide, evidence table, citation-aware outline | designed | `docs/ai-toolkit/LITERATURE-SYNTHESIS-AND-CITATION.md` — the literature and citation design | Designed in the toolkit; no reading guide is generated. |
| IN-09 | Resume or portfolio | Student-confirmed skills, improved structure, a tailored draft | building | `app/src/lib/career-evidence.ts` — skills proposed from the student’s own work, confirmed one by one | Nothing extracts from an uploaded résumé. |
| IN-10 | Voice note | A reviewed action, study note, meeting agenda or reflection | tested | `app/src/lib/voiceloop.test.ts` — the microphone is shut the instant a question goes | Voice is a way to ask; it does not become a note or an agenda. |

## The definition of done, against the release gate in code

| Ask | Carried by | Note |
| --- | --- | --- |
| A real user job and trigger are defined | `Intended purpose documented` | — |
| The non-AI workflow is usable | **none** | No release-gate item asks for it; the local-answer fallback is the nearest control (ai/localanswer.test.tsx). |
| Sources and data classification are defined | `Data flow approved` | — |
| Authorization happens before retrieval | `Authorized sources enforced` | — |
| Input and output schemas are validated | **none** | No release-gate item; the gateway validates to a strict schema, the on-device assistant does not. |
| Citations or limitation notices are implemented | `Citations tested` | — |
| Academic-integrity rules are enforced where relevant | `Course and institution policy enforced` | — |
| Sensitive and restricted data is excluded or specially approved | `High-risk requests safely redirected` | — |
| Human confirmation exists for consequential action | `No consequential write without exact review and confirmation` | — |
| Prompt-injection and misuse tests pass | `Prompt-injection tests pass` | — |
| Feature flag and kill switch exist | `Monitoring, feedback and kill switch exist` | — |
| Audit events and user feedback exist | `Monitoring, feedback and kill switch exist` | — |
| Accessibility acceptance criteria pass | **none** | No release-gate item; AM-15 in the assurance matrix records that the only accessibility run is the generic axe suite. |
| Cost, latency, quality and safety metrics are monitored | **none** | No release-gate item names cost or latency; the monthly allowance is a cap, not a metric. |
| A named product, security and operational owner approves launch | **none** | No release-gate item names an approver; the AI governance board has no seated members. |

## The roadmap

**Phase 1 — Safe foundations.** AI provider registry and vendor scorecards; Workflow cards and risk classification; Central policy engine; Source access and retrieval controls; Citation and source-card components; AI audit event schema; Feature flags and kill switches; Feedback and report-issue workflow; Prompt-injection and tool-use test suite.

**Phase 2 — Student value.** Ask Semester global search; Syllabus and material ingestion with review; Study assets and source-linked explanations; Advisor agenda drafting; Registration and Path explanations; Campus resource navigation; Career evidence drafting.

**Phase 3 — Controlled actions.** AI Action Composer; Study block drafts; Calendar-event drafts; Portfolio and application drafts; Advisor-share drafts; Exact confirmation UI and audit binding.

**Phase 4 — Institution governance.** Tenant AI policies; Faculty course policies; Approved source packs; Model routing configuration; AI quality and evaluation console; Usage and cost dashboards; Trust Center AI documentation; Institution-specific controls and retention settings.

Semester Intelligence should turn a confusing university signal into a sourced, explainable, student-controlled next step — while people, institutions, policies and safety boundaries stay in control.
