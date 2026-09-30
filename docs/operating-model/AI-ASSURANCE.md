# AI assurance: NIST AI RMF and NIST AI 800-1, audit-ready

<!-- Rendered from app/src/lib/governance/ai-assurance.ts by ai-assurance.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Three documents arrived on 28 September 2026 and are kept under `docs/expansion/`
as supplied. [`AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) already runs each
AI capability through six gates owned by the four functions of the NIST AI Risk
Management Framework, and refuses ten starting scopes at intake. The documents
do not replace that; they ask what an auditor would want to see at each
function, and add the misuse lens of NIST AI 800-1. So every matrix row names
the gate it is evidenced at, every line of the release gate names the
`AI_RELEASE_GATE` item that already carries it or says none does, every
prohibited mode names the refusal already in code or says none is, and a risk
tier that says "do not deploy" is held to `PROHIBITED_STARTING_SCOPE`.

**Status caveat.** NIST AI 800-1 is a second public draft (2025): a voluntary source of controls, not a certification and not a finalized requirement, and it is not cited as either in any contract or public claim until its publication status changes.

| Supplied document | What it holds |
| --- | --- |
| [NIST AI RMF vs NIST AI 800-1 compliance audit: dual-use controls under Govern, Map, Measure, Manage](../expansion/NIST-AI-RMF-and-800-1-Audit-Matrix.pdf) | The audit-ready control matrix, model evaluation inside Govern, the risk tiers, the 800-1 checklist, the artifact set and the release gate. |
| [Map NIST AI RMF and NIST AI 800-1 into an AI governance compliance checklist](../expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf) | The 800-1 applicability decision, governance and threat-modelling items, and the AI model-training policy (held in trust/ai-training-policy.ts). |
| [Show me the transfer transition hub details (with career, safe AI and basic needs)](../expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf) | Safe AI for students: the modes to build first, the modes to prohibit, the answer labels, the pipeline and the governance metrics. |

## Where it stands

Statuses were read at `origin/main` `92952f0` on 28 September 2026. A test holds
every cited file to existing and each status to the kind of file it cites:
`designed` a document, `building` code, `tested` a test that runs on every
change. The supplied PDFs are never cited as evidence. Nothing is above
`tested`, because nothing has an artifact under `docs/evidence/`.

| | not-started | designed | building | tested | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Control matrix | 2 | 6 | 6 | 7 | 21 |
| 800-1 checklist | 16 | 5 | 16 | 25 | 62 |

## The four functions

| Function | Semester purpose | Key question | Operating result |
| --- | --- | --- | --- |
| Govern | Establish accountability, policies, oversight and evidence | Who owns this AI system, and what risk is acceptable? | A controlled AI lifecycle with clear decision rights |
| Map | Define context, affected people, data, dependencies and harm scenarios | What can go wrong, for whom, and through which pathway? | A use-case-specific risk register and boundary design |
| Measure | Test performance, safety, privacy, accessibility and misuse resilience | How do we know whether controls work? | Evidence-based release and monitoring decisions |
| Manage | Prioritize, treat, monitor, communicate and retire risks | What do we do about unacceptable or changing risk? | Documented mitigation, incident response and continuous improvement |

A loop, not a line: Govern → Map → Measure → Manage → update governance,
policies, inventory, evaluations and launch gates.

## The audit-ready control matrix

Each row: what AI 800-1 emphasises, Semester’s control, the artifact an
auditor asks for, what they check, the lifecycle gate the artifact is
evidenced at, and where the tree stands.

| ID | Function | AI 800-1 emphasis | Semester control | Required artifact | Audit checkpoint | Gate | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AM-01 | Govern | Accountability for misuse risk | Assign an executive AI-risk owner and a system owner per feature and model | AI governance charter; RACI | Owner and escalation path approved | G0 | designed | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — the board, its membership and decision rules<br>`app/src/lib/governance/charters.ts` — an owner per module flag | The board has a charter and no members; no feature names an executive AI-risk owner by seat. |
| AM-02 | Govern | Capability and access governance | Risk-tier each model, tool, API, modality and agent | Model and system inventory | Inventory is current and reviewed quarterly | G0 | tested | `app/src/lib/trust/subprocessors.ts` — every AI provider the gateway can call, and what it sees<br>`app/src/lib/claudeclamp.test.ts` — the shared key’s model allowlist equals the models the app offers | Providers and model names are inventoried; versions, modalities and tools are not, and nothing carries a risk tier. |
| AM-03 | Govern | Supplier risk | Assess provider retention, training, safety, security, residency, incident notice and model-change terms | AI vendor assessment | No production use without approval | G0 | tested | `app/src/lib/trust/vendorrisk.test.ts` — the vendor risk register held to the subprocessor list<br>`docs/trust/VENDOR-RISK-REGISTER.md` — Anthropic retention settings and attestations marked “to confirm” | Provider training and retention terms are not recorded per provider; the register and the DPA checklist both say so. |
| AM-04 | Govern | Misuse policy | Define prohibited uses, tool permissions, user restrictions and enforcement | Acceptable-use policy; tenant policy configuration | Policy is visible and enforceable | G0 | tested | `app/src/lib/governance/ai-lifecycle.ts` — ten scopes refused at intake<br>`app/src/lib/governance/ai-lifecycle.test.ts` — a prohibited scope is refused whatever evidence it carries<br>`supabase/migrations/20260923210000_intelligence_policy.sql` — ai_policy and approved_source per tenant | No student-facing acceptable-use page; the refusals are in code and a governance document, not where a student acts. |
| AM-05 | Govern | Evaluation accountability | Approve evaluation standards, launch thresholds, re-test triggers and independent review | Evaluation policy; evaluation plan | A feature cannot launch without evidence | G0 | designed | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — the suites and hard boundaries of the recommendation harness<br>`docs/operating-model/AI-LIFECYCLE-GATES.md` — G3 needs an evaluation and a red-team | No evaluation policy sets thresholds by risk tier, and no independent reviewer is named. |
| AM-06 | Map | Threat context | Identify users, affected parties, use context, high-risk groups and institutional authority boundaries | Use-case dossier | Context reviewed before build | G1 | designed | `docs/operating-model/AI-LIFECYCLE-GATES.md` — G0 and G1 evidence: user job, intended outcome, data flow, policy mapping | No use-case dossier exists for any live AI feature; the gate is defined and has not been passed by anything. |
| AM-07 | Map | Misuse pathways | Model deliberate misuse: jailbreaks, prompt injection, exfiltration, fraud, malware, impersonation, dangerous instructions, abuse of tools | AI misuse threat model | Each risk has likelihood, impact, owner and mitigation | G2 | building | `app/src/lib/governance/risk.ts` — the risk register, with an AI-output risk and its controls | One register row, not a threat model per misuse pathway; no likelihood per pathway. |
| AM-08 | Map | Tool and agent risk | Identify every external action, system permission, data source and write operation | Tool-permission map | No unapproved write or action path | G2 | tested | `app/src/ai/prompt.test.ts` — the assistant names only tools that exist, and a tool call is a proposal, not an act<br>`app/server/institution/intelligence.test.ts` — gateway actions are server-issued, expiring and single-use, with the full reviewed effect | The map is the prompt, the gateway and their tests; no document lists each tool with its permission and data source. |
| AM-09 | Map | Data risk | Classify prompts, sources, files, retrieval data, outputs, logs and evaluation datasets | AI data-flow diagram | Restricted data prohibited or controlled | G1 | designed | `docs/operating-model/DATA-STEWARDSHIP.md` — data classes per domain<br>`RETENTION.md` — what is kept and for how long | No data-flow diagram for the AI path from prompt to provider to log. |
| AM-10 | Map | Impact assessment | Identify student, staff, institutional, accessibility, privacy, academic-integrity and reputational harms | AI impact assessment | Unacceptable harms create a launch block | G1 | not-started | — | No impact assessment has been written for any AI feature. |
| AM-11 | Measure | Capability testing | Test what the selected model can generate or execute, including code, multimodal output and tool use | Capability assessment | Risk tier matches demonstrated capability | G3 | not-started | — | No capability assessment of any provider model; capability is taken from the provider’s description. |
| AM-12 | Measure | Misuse testing | Red-team for jailbreaks, prompt injection, dangerous content, data exfiltration, fraud, impersonation and tool misuse | Red-team report | High-severity failures remediated before launch | G3 | building | `app/src/ai/injection.test.ts` — the structural injection suite: twelve texts through every builder, inside the fence, instructions unchanged<br>`app/src/ai/injection.live.test.ts` — the injection red-team against the real model: three canaries in seven builders, skipped without a key<br>`docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json` — its first run, 29 September 2026: claude-opus-5 through the shared key’s proxy, 21 cases, none followed<br>`app/src/lib/quotes.adversarial.test.ts` — quotations built to fool the citation checker | The injection red-team has run once, on one model, and held (21 of 21); nothing yet runs against a live model for dangerous content, exfiltration, fraud, impersonation or tool misuse, so the red-team report this row asks for is one fifth of the way there. |
| AM-13 | Measure | Quality and grounding | Measure source fidelity, citation accuracy, hallucination rate, refusal behaviour and policy adherence | Evaluation dataset and results | Meets use-case thresholds | G3 | building | `app/src/lib/extractaccuracy.test.ts` — an extraction-accuracy gate over a labelled syllabus corpus<br>`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — suites for grounding and citations, planned | One labelled corpus, for extraction; no measured rate for source fidelity, citation accuracy, hallucination, refusal or policy adherence. |
| AM-14 | Measure | Privacy and security | Test access control, tenant isolation, leakage, secret exposure, file handling and provider-boundary controls | Security and privacy test report | No unresolved critical finding | G3 | tested | `packages/institution/src/policy.test.ts` — ai.retrieve_source refuses revoked, quarantined or unshared sources and chunks above provider clearance<br>`app/server/institution/intelligence.test.ts` — a request naming an unapproved source is refused before the provider sees the question<br>`supabase/intelligence-policy.check.sql` — another tenant cannot read or change policy | The gateway’s source repository is tenant-level only (AI-004); no test sends a file through the upload path and checks what the provider received. |
| AM-15 | Measure | Accessibility and fairness | Test screen-reader output, reading level, alternative formats, disparate error and refusal patterns, accommodation impact | Accessibility and fairness test report | Critical barriers fixed or the feature blocked | G3 | building | `app/src/ai/Answer.tsx` — the answer surface the axe suite covers | No reading-level or disparate-refusal measurement; accessibility is the generic axe run, not an AI-specific one. |
| AM-16 | Manage | Control treatment | Apply gating, filters, rate limits, least privilege, sandboxing, confirmation, redaction and feature flags | Mitigation plan; configuration record | Controls active in production | G4 | tested | `supabase/functions/_shared/killswitch.ts` — the switch every generator reads<br>`app/src/lib/aikillswitch.test.ts` — off globally, off per school, thrown when unreadable<br>`app/server/institution/rate-limit.test.ts` — per-identity limits through an atomic RPC, failing closed<br>`app/src/lib/allowance.test.ts` — the monthly cap the claude function counts before the call | No redaction before provider calls and no output filter; the configuration record is the code, not a document. |
| AM-17 | Manage | Incident response | Detect, triage, contain, communicate and learn from misuse and safety incidents | AI incident runbook; incident log | A drill performed and lessons tracked | G4 | designed | `docs/RUNBOOKS.md` — the runbook library<br>`app/src/lib/governance/incident-comms.ts` — an ai_quality audience whose notice names outputs to distrust, approved by the AI governance chair | The notice exists; no AI incident runbook, no P0–P3 taxonomy (AI-014), no incident log, no drill. |
| AM-18 | Manage | Access response | Reduce or suspend access where abuse or a risk threshold is met | Enforcement and exception procedure | Actions are proportionate and appealable | G4 | building | `app/src/lib/governance/risk.ts` — reviewException(): no indefinite exception, 90 days at most | Nothing suspends one account’s AI access short of the tenant switch, and no appeal route exists. |
| AM-19 | Manage | Change management | Re-evaluate on model, provider, prompt, policy, integration, modality or tool change | Change request; re-approval evidence | No material change bypasses review | G5 | building | `supabase/migrations/20260923210000_intelligence_policy.sql` — tenant_policy_audit_event records every change to ai_policy and approved_source<br>`app/src/lib/coursestudio.test.ts` — course AI rules are versioned, newest shown<br>`app/src/lib/governance/edgecases.ts` — EC-AI-08: no pinned model versions or evaluation baseline | A policy change is logged; a model, provider or prompt change triggers no re-evaluation, and prompts are not versioned. |
| AM-20 | Manage | Transparency | Give users source, policy and limitation labels and an issue-report route | UI evidence; transparency page | User understanding tested | G4 | tested | `app/src/lib/source.test.ts` — the five source labels, held to the migration<br>`app/src/intelligence/Disclosure.test.tsx` — each answer shows source locators, origin, mode and an AI-assisted badge<br>`app/src/ai/usingline.test.tsx` — the Using line says what the answer drew on | Ask chat answers carry no citations or per-answer limits (AI-005, AI-013); user understanding has never been measured; no transparency page summarises AI use. |
| AM-21 | Manage | Retirement | Disable or revoke models, delete or preserve records appropriately, migrate safely, notify tenants | Retirement plan | Exit and recovery drill completed | G5 | designed | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` — offboarding a tenant<br>`docs/operating-model/AI-LIFECYCLE-GATES.md` — G5: continue, improve, limit or remove | No plan for retiring one model or provider while a tenant is live. |

## Govern: model evaluation belongs here

Model evaluation belongs in Govern, not only in Measure, because leadership
decides in advance what "good enough" means, which harms are unacceptable, who
can approve exceptions, and what evidence must exist before launch.

- [ ] Maintain an AI Evaluation Policy approved by the AI Governance Council.
- [ ] Define risk tiers for every AI use case, model, modality, data class, tool integration and user population.
- [ ] Define the required evaluation categories for each risk tier.
- [ ] Establish release-blocking thresholds before model selection or development.
- [ ] Define who designs tests, who executes them, and who independently reviews them.
- [ ] Require test datasets that are synthetic, public, licensed or otherwise approved.
- [ ] Prohibit the use of production student records in evaluation unless explicitly authorized, minimized and subject to documented review.
- [ ] Set re-evaluation triggers: model version change, provider change, new tool or action, new modality, policy change, incident, material complaint, new data source, or expansion to a new tenant or use case.
- [ ] Define evidence-retention periods, sign-off requirements and audit access.
- [ ] Create a formal risk-acceptance process for residual risk; no informal exceptions.
- [ ] Require human review and student and institutional representative input for high-impact or sensitive workflows.
- [ ] Require independent security, privacy and accessibility review for high-risk releases.

### Evaluation policy by risk tier

| Tier | Example | Evaluation requirement | Launch authority |
| ---: | --- | --- | --- |
| 0 | Non-sensitive internal drafting with no external actions | Basic quality and security review | Product and engineering owner |
| 1 | Student study support using public or student-provided non-sensitive material | Grounding, policy adherence, privacy, accessibility, misuse baseline | Product, AI owner, privacy and security approval |
| 2 | Institution-approved course and material retrieval, career support, or resource navigation | Full quality, source fidelity, tenant isolation, injection, accessibility, bias, abuse and human-handoff tests | AI governance review |
| 3 | Tool-enabled workflows, advisor and staff support, sensitive support routing, or broad external API action | Enhanced adversarial testing, permission simulation, incident drill, legal, privacy and accessibility approval, staged rollout | Governance council or executive delegate |
| 4 | High-impact decisions or prohibited domains: admissions, aid, discipline, accommodation, health or crisis diagnosis, hidden student-risk scoring | Do not deploy for automated decision-making | Prohibited unless redesigned into non-decision support |

Tier 4 is not deployed for automated decision-making. Of the domains it names, the intake already refuses *financial-aid decisions*, *disciplinary judgments*, *health decisions*, *opaque risk scoring*; *admissions decisions* and *accommodation decisions* are not yet named in `PROHIBITED_STARTING_SCOPE`, and the page says so rather than implying they are.

## The NIST AI 800-1 misuse-risk checklist

AI 800-1 is aimed most directly at developers of dual-use foundation models.
Semester develops none and accesses provider models through its own key or the
student’s, so it applies the parts relevant to a SaaS deployer: provider
governance, capability assessment, misuse threat modelling, access control,
monitoring, incident response and transparency.

### Applicability and inventory

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-01 | Identify whether Semester develops, fine-tunes, hosts or only accesses each foundation model | building | `app/src/lib/trust/subprocessors.ts` — Semester accesses provider models through its own key or the student’s; it trains none | Stated by the register’s shape, not as a recorded applicability decision per model. |
| MR-02 | Record provider, model and version, modality, deployment region, API and tool access, tenant availability and business owner | building | `app/src/lib/trust/subprocessors.ts` — provider and region<br>`supabase/migrations/20260924163000_intelligence_provider_runtime.sql` — per-tenant provider runtime rows | Model version, modality and business owner are not columns anywhere. |
| MR-03 | Record user groups: student, faculty, staff, administrator, partner, public | tested | `app/src/lib/rolelaunch.ts` — every role the database can grant, by category<br>`app/src/lib/rolelaunch.test.ts` — held to app_roles | Roles are inventoried for the product, not per AI feature. |
| MR-04 | Record data types processed: public, institution-approved, student-provided, education-record PII, sensitive or restricted, prohibited | building | `app/src/lib/source.ts` — five source labels on every fact<br>`app/src/lib/ops/console.ts` — data classification and the controls each class imposes | No AI feature records which classes reach the provider. |
| MR-05 | Record external integrations, agentic capabilities and write permissions | tested | `app/src/ai/prompt.test.ts` — a tool call is a proposal; only existing tools are named | No written map of tools to permissions. |
| MR-06 | Identify whether any feature exposes broad public prompting, code generation or external actions | tested | `app/src/lib/flags.ts` — kill.code_execution as a distinct switch<br>`app/src/lib/aikillswitch.test.ts` — a switch is only ever about its own capability | Public prompting is not exposed and nothing records that finding. |
| MR-07 | Assign a dual-use and misuse risk tier to each feature | not-started | — | No feature carries a tier. |
| MR-08 | Reassess whenever capability, access, model, provider, tool or data changes | not-started | — | No reassessment trigger; see AM-19. |

### Governance and accountability

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-09 | Assign an executive AI-risk owner | designed | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — a chair the board has not yet seated | No seat holds it. |
| MR-10 | Assign a named technical owner for each deployed model and provider | not-started | — | None named. |
| MR-11 | Create an AI risk committee with security, privacy, legal, accessibility, product, trust-and-safety and institutional representatives | designed | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — membership by seat | No members. |
| MR-12 | Define AI risk appetite and unacceptable-use categories | tested | `app/src/lib/governance/risk.ts` — appetite tiers<br>`app/src/lib/governance/ai-lifecycle.test.ts` — the ten unacceptable starting scopes are refused | Appetite is stated for the company, not per AI use case. |
| MR-13 | Establish an escalation path for dual-use, abuse, security, safety, copyright, privacy and student-harm incidents | designed | `docs/CRISIS-RESPONSE-RUNBOOK.md` — escalation for student harm<br>`SECURITY.md` — how a security report is handled | No path names AI misuse or copyright. |
| MR-14 | Require approval before enabling model tool use, code execution, external actions or elevated automation | tested | `app/src/lib/flags.ts` — kill.code_execution<br>`app/src/lib/governance/charters.test.ts` — every flag has a charter with an owner | A flag is not an approval record; nothing says who approved turning one on. |
| MR-15 | Maintain evidence of training for operators, developers, moderators, support teams and customer administrators | not-started | — | No training record for anyone. |
| MR-16 | Review provider terms, safety controls, security posture, retention, training, incident notice and deletion commitments | designed | `docs/trust/DPA-CHECKLIST.md` — the no-training clause, unchecked<br>`docs/trust/PROVIDER-TERMS.md` — training, retention, breach-notice and deletion terms per provider, verbatim | Published terms are recorded; none is accepted or signed, and no safety-control or security-posture review has run. |
| MR-17 | Run periodic governance reviews and publish an appropriate transparency summary | designed | `docs/operating-model/OPERATING-RHYTHM.md` — the quarterly cadence | No review has run and nothing is published. |

### Misuse threat modelling

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-18 | Identify intentional misuse by external attackers, students, staff, insiders, compromised accounts, malicious prompt authors, vendors and integrations | building | `app/src/lib/governance/risk.ts` — insider and account-compromise risks in the register | Not modelled per AI feature. |
| MR-19 | Model jailbreaks, direct and indirect prompt injection, context poisoning, exfiltration, credential theft, secret leakage, impersonation, social engineering, malware generation, fraud, harassment, nonconsensual imagery and dangerous instructions | building | `app/src/ai/prompt.test.ts` — the prompt names what it must not do or infer | A prompt rule is not a threat model; no pathway has a likelihood or an owner. |
| MR-20 | Identify harm pathways from generated content to real-world action | tested | `app/src/ai/prompt.test.ts` — calling a tool is a proposal, not an act | The pathway is closed by design; it is not written down as a model. |
| MR-21 | Identify risks created by multimodal inputs, files, voice, images, video, code execution, web retrieval, plugins and external actions | building | `app/src/ai/usevoice.ts` — voice input exists<br>`app/src/lib/flags.ts` — kill.data_upload and kill.code_execution | Voice and upload paths have switches and no threat model. |
| MR-22 | Identify especially affected populations and institutional contexts | not-started | — | Nothing names them for AI. |
| MR-23 | Record likelihood, impact, detectability, mitigation, residual risk and owner | building | `app/src/lib/governance/risk.ts` — likelihood, impact, controls, residual and owner seat per company risk | Per company risk, not per misuse pathway. |
| MR-24 | Define explicit stop and disable thresholds | not-started | — | The switch exists; no threshold says when to throw it. |

### Capability and access controls

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-25 | Test relevant harmful or dual-use capabilities before deployment | not-started | — | No capability test. |
| MR-26 | Restrict access according to risk: public, authenticated, verified, institution-admin-approved or sandbox-only | tested | `supabase/migrations/20260923210000_intelligence_policy.sql` — ai_policy per tenant<br>`app/src/lib/aikillswitch.test.ts` — a school can be switched off alone | Two levels exist (tenant on, tenant off); no verified or sandbox level. |
| MR-27 | Require stronger identity verification for privileged or tool-enabled access | not-started | — | No step-up for AI actions. |
| MR-28 | Apply rate limits, quotas, concurrency caps, abuse thresholds and bot controls | tested | `app/server/institution/rate-limit.test.ts` — per-identity limits, failing closed when shared storage is down<br>`app/src/lib/allowance.test.ts` — the monthly cap matches what the claude function enforces | Limits and caps exist; no concurrency cap, no abuse threshold and no bot control (EC-AI-09). |
| MR-29 | Limit model contexts, file types, tokens, attachments, output formats, retrieval sources and available tools by role and tenant | building | `supabase/migrations/20260923210000_intelligence_policy.sql` — approved_source per tenant | Sources are limited per tenant; tokens, file types and tools are not limited by role. |
| MR-30 | Use least privilege for every connected tool and API | tested | `app/src/ai/prompt.test.ts` — no tool that could act on the student’s behalf exists | True because there are no acting tools; nothing enforces it if one is added. |
| MR-31 | Require user confirmation for external writes, scheduling, messages, data sharing, financial actions, SIS or LMS writes and other consequential actions | tested | `app/server/institution/intelligence.test.ts` — no consequential action without fresh explicit confirmation; a receipt only after readback<br>`app/src/ai/prompt.test.ts` — a tool call is a proposal the student confirms | Holds for the gateway and the assistant; nothing yet writes to a SIS or LMS, so the rule has not met a real write. |
| MR-32 | Remove, gate or sandbox capabilities whose residual misuse risk is unacceptable | tested | `app/src/lib/governance/ai-lifecycle.test.ts` — ten scopes refused at intake | Refusal at intake, not a residual-risk decision per capability. |

### Defence in depth

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-33 | Enforce policy and authorization before calling the model | tested | `supabase/functions/_shared/killswitch.ts` — the switch is read before generation<br>`app/src/lib/aikillswitch.test.ts` — and thrown when unreadable | The switch is checked first; course policy is not enforced at the gateway. |
| MR-34 | Use tenant-scoped, allowlisted retrieval sources | tested | `packages/institution/src/policy.test.ts` — ai.retrieve_source needs enrolment or an authorized share, with a field allowlist<br>`supabase/migrations/20260923210000_intelligence_policy.sql` — approved_source rows per tenant | The gateway repository is tenant-level only (AI-004); Ask Semester on the student’s device does no retrieval. |
| MR-35 | Separate untrusted content from system and developer instructions | tested | `app/server/institution/providers/openai.ts` — instructions in the developer role, sources as JSON user content, output to a strict schema<br>`app/src/lib/studystudio.test.ts` — an instruction inside a source stays data | Held for the gateway and the Study Studio; the on-device assistant (app/src/ai/assemble.ts) has no such test. |
| MR-36 | Detect and resist direct and indirect prompt injection | building | `app/src/ai/injection.test.ts` — twelve injection-shaped texts through every builder: inside a fence, instructions unchanged, closing tags disarmed<br>`app/src/ai/untrusted.ts` — the fence and the rule every builder carries<br>`app/src/ai/injection.live.test.ts` — the red-team against the real model: three canaries in seven builders, skipped without a key, never yet run<br>`app/src/lib/studystudio.test.ts` — one injection-shaped source, kept as data | The suite is structural — the material cannot reach the instructions — and says so; what a live model does with a fence is the red-team AI-010 still owes. |
| MR-37 | Scan files for malware and unsafe content before ingestion | building | `app/src/lib/mediascan.test.ts` — community images: real type, metadata, perceptual hash, known-abuse hash<br>`app/src/lib/flags.ts` — ops.data_upload rolls out only after malware scanning exists | Images only, and the scanner is not yet a deployed function; no malware or antivirus scan of any upload. |
| MR-38 | Redact secrets and unnecessary PII before model-provider calls | building | `app/src/lib/toolkit/classification.test.ts` — unclassified material counts as T3 and stays away from AI; T4–T6 are hard-blocked<br>`app/src/lib/integration/redact.ts` — tokens, keys and emails redacted from integration errors and logs | A tier lookup keeps classes out; nothing scrubs PII or secrets from a prompt that is sent. |
| MR-39 | Apply input and output safety filters appropriate to the use case | building | `app/src/lib/toolkit/safety.ts` — a keyword notice naming the professional boundary a topic runs into — a notice, not a filter | No classifier on input or output; a filter refusal cannot be told from an outage (EC-AI-04). |
| MR-40 | Use sandboxed code execution with restricted network, filesystem, process, identity and secret access | tested | `app/src/lib/toolkit/flags.test.ts` — the codeExecution flag is pinned off<br>`app/src/lib/claudeclamp.test.ts` — the shared key drops code_execution, web_fetch and mcp_toolset | No sandbox exists; execution is off rather than contained (docs/ai-toolkit/CODE-STUDIO-AND-SANDBOX.md). |
| MR-41 | Validate tool parameters against schemas and allowlists | tested | `app/src/ai/prompt.test.ts` — tools are named from a fixed list | Parameters are not schema-validated. |
| MR-42 | Generate action previews and require user confirmation | tested | `app/src/ai/prompt.test.ts` — a tool call comes back to the student as a proposal | No screen test clicks the confirmation. |
| MR-43 | Create feature flags, kill switches, provider and model rollback and tenant disable paths | tested | `supabase/functions/_shared/killswitch.ts` — global and per-school<br>`app/src/lib/aikillswitch.test.ts` — held | No provider or model rollback path. |
| MR-44 | Keep a manual fallback for high-value workflows | tested | `app/src/ai/localanswer.test.tsx` — Ask Semester answers without a gateway, and says why when it cannot<br>`app/src/lib/offline-mode.test.ts` — high-risk actions are refused offline, never queued | The fallback is a local answer, not a person. |

### Measure and monitor

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-45 | Maintain representative, approved evaluation sets for each use case | building | `app/src/lib/extractaccuracy.test.ts` — a labelled syllabus corpus with an accuracy gate<br>`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — planned suites, none built | One corpus, for extraction; none for any assistant use case. |
| MR-46 | Test grounding, hallucination, citation validity, refusal quality, policy adherence, privacy leakage, safety, bias, accessibility and usability | not-started | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — the suites named | None runs. |
| MR-47 | Run adversarial testing for jailbreaks, injection, exfiltration, dangerous instructions, fraud, impersonation and tool misuse | building | `app/src/lib/quotes.adversarial.test.ts` — quotations built to fool the citation checker into a false confirm | One checker is tested adversarially; jailbreak, exfiltration, fraud, impersonation and tool misuse are not. |
| MR-48 | Test cross-tenant isolation and source authorization | tested | `supabase/governance.check.sql` — tenant isolation walked account by account | At the database, not through the AI path. |
| MR-49 | Test model and tool behaviour after model, provider, prompt, policy, integration or retrieval changes | not-started | — | No re-test trigger. |
| MR-50 | Monitor blocked and allowed request patterns, abuse attempts, safety-report volume, override rate, false positives, false negatives, appeals, incidents, time-to-detection and time-to-resolution | building | `app/server/institution/journal.ts` — intelligence_audit records tenant, actor, provider, model, tokens, cost and the policy decision per call<br>`app/src/lib/spend.test.ts` — cost per question on a student’s own key<br>`MONITORING.md` — AI budget monitoring “partly”: the provider dashboard and health.sql | The audit row exists; nothing aggregates blocked requests, abuse attempts, overrides or false positives from it. |
| MR-51 | Detect model drift and provider behaviour changes | not-started | — | Nothing watches provider output over time. |
| MR-52 | Review evaluation and production metrics at defined risk-tier intervals | not-started | — | No tiers, so no intervals. |

### Response, accountability and transparency

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MR-53 | Maintain AI incident categories, severity levels, owners and response timelines | tested | `app/src/lib/governance/incident-comms.ts` — an ai_quality incident kind, with what its notice must say<br>`app/src/lib/governance/incident-comms.test.ts` — held | One kind, no AI severity levels, owners or response timelines (AI-014). |
| MR-54 | Preserve minimum necessary evidence under access, retention and legal-hold rules | tested | `RETENTION.md` — ai_usage rows swept after the tenant’s retention_days; no prompt or response text stored<br>`app/src/lib/retention.test.ts` — held to the migrations<br>`app/src/lib/threads.test.ts` — device threads capped by count and characters | A legal hold exists (maturity RM-02): a platform-wide or school hold keeps the AI usage metadata of the held school, but no prompt or response text is stored to preserve. |
| MR-55 | Contain harm through account restriction, capability disablement, model rollback, tenant disablement or provider escalation | tested | `app/src/lib/aikillswitch.test.ts` — capability and tenant disablement | No account restriction or model rollback. |
| MR-56 | Support user reporting of unsafe, harmful, inaccessible, inaccurate, biased, privacy-invasive or policy-violating output | building | `app/src/lib/fixthis.ts` — “this answer is incorrect” under About this screen, opening a report<br>`app/src/ai/Turns.tsx` — the answer feedback pair is local and says nothing is sent | No report-an-answer control reaches anyone (AI-013). |
| MR-57 | Give users understandable source, policy, limitation and escalation labels | tested | `app/src/intelligence/Disclosure.test.tsx` — source locators, origin, mode and the AI-assisted badge<br>`app/src/ai/helpstate.test.tsx` — unavailable states named with actions | No policy label per course on an answer, and no escalation label. |
| MR-58 | Maintain an appeal and correction mechanism for consequential enforcement | not-started | — | No enforcement on a person exists, so no appeal does. |
| MR-59 | Notify institutions, users, providers, insurers and regulators when required | tested | `app/src/lib/governance/incident-comms.ts` — who is told, by whom, how soon<br>`app/src/lib/governance/incident-comms.test.ts` — held | Regulators and insurers are not audiences. |
| MR-60 | Conduct root-cause analysis and track corrective actions to closure | not-started | — | No corrective-action tracker. |
| MR-61 | Reassess the risk register and evaluation plan after every material incident | not-started | — | No incident has been recorded and no rule says to. |
| MR-62 | Publish appropriate aggregate transparency information without creating new abuse paths | not-started | — | Nothing published. |

## The artifact set

A control is not audit-ready until it produces evidence. Each artifact the
audit names, and the file that is it today — or none.

| Artifact | Where | Note |
| --- | --- | --- |
| AI Governance Charter and RACI | `docs/operating-model/AI-GOVERNANCE-BOARD.md` | Charter without members. |
| AI Acceptable Use Policy | **none** | The refusals are in ai-lifecycle.ts; no policy a student or administrator reads. |
| AI Model and System Inventory | `docs/SUBPROCESSORS.md` | Providers, not models or versions. |
| AI Vendor and Provider Assessment | `docs/trust/VENDOR-RISK-REGISTER.md` | Training and retention terms not yet recorded. |
| AI Use-Case Dossier | **none** | None written. |
| AI Data-Flow Diagram | **none** | None drawn. |
| AI Misuse Threat Model | **none** | One row of the risk register. |
| AI Impact Assessment | **none** | None written. |
| Risk-Tiering Decision | **none** | The tiers are defined here; no feature has been placed in one. |
| Evaluation Policy and Risk-Tier Test Standard | **none** | The twelve controls above are the outline. |
| Evaluation Plan, Datasets, Results and Sign-Offs | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` | A plan; no dataset, no results. |
| Red-Team and Adversarial Test Report | **none** | None. |
| Accessibility and Fairness Test Evidence | `docs/WCAG-UI-AUDIT-SCORECARD.md` | The product’s scorecard, not an AI-specific one. |
| Security, Privacy and Tenant-Isolation Test Report | `supabase/governance.check.sql` | The check, not a report of a run. |
| Tool and Agent Permission Map | **none** | The prompt test is the map. |
| Production Configuration and Feature-Flag Record | `docs/FEATURE-FLAG-REGISTRY.md` | Flags and switches; not provider configuration. |
| AI Incident Response Plan and Exercise Evidence | **none** | The general runbooks; no AI plan, no exercise. |
| Incident Register and Corrective-Action Tracker | **none** | None. |
| Model and Provider Change Log | **none** | Policy changes are audited; model changes are not logged. |
| User Transparency and Issue-Reporting Evidence | `app/src/lib/source.ts` | Labels in code; no measured understanding. |
| Risk Acceptance and Exception Register | `docs/operating-model/RISK-GOVERNANCE.md` | Exception rules exist; no exception has been approved. |
| Retirement and Offboarding Plan | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` | Tenant offboarding; not model retirement. |

## The release gate, against the one in code

No AI feature enters production until the accountable owner can answer yes to
all of these. Each is held to `AI_RELEASE_GATE` in `ai-lifecycle.ts`: the item
that already carries it, or a note on why none does.

| Ask | Carried by | Note |
| --- | --- | --- |
| The intended use, prohibited use and authority boundary are documented | `Intended purpose documented` | — |
| A named business owner, technical owner and escalation owner exist | **none** | G0 asks for one owner; three are asked for here. |
| The risk tier and AI 800-1 applicability are recorded | **none** | New: no gate item records a tier. |
| Data flows, retention, provider terms and tenant isolation are approved | `Data flow approved` | — |
| Relevant misuse, privacy, security, accessibility, quality and grounding tests pass | `Prompt-injection tests pass` | The gate names injection and citations; the rest are G3 evidence. |
| Launch-blocking thresholds are satisfied or a formally approved exception exists | **none** | New: no gate item names a threshold. |
| User-facing source, policy, limitation and report controls are live | `Output labelled as a generated draft where appropriate` | — |
| Tool permissions are least-privilege, previewable and confirmation-gated | `No consequential write without exact review and confirmation` | — |
| Monitoring, incident response, kill switch and rollback have been tested | `Monitoring, feedback and kill switch exist` | Exist, not tested; and rollback is not named. |
| Customer and institution configuration, contract commitments and support documentation are complete | **none** | G4 evidence, not the pilot gate. |
| Required audit evidence is stored, versioned and retrievable | **none** | New: nothing under docs/evidence/ yet. |

## Safe AI for students

Source-grounded, policy-aware, reversible and human-routed. The modes to
build first, each with the control it needs:

| AI mode | Student value | Required safety control |
| --- | --- | --- |
| Explain a concept | Plain-language, adaptive explanation | Cite approved sources where available; disclose limits |
| Study coach | Quiz, retrieval practice, teach-back, study plan | Do not imply mastery or diagnose learning ability |
| Source-grounded summary | Summarize a syllabus, reading or authorized document | Show source anchors, page and section links, and a review prompt |
| Planner | Turn student-provided goals into action and calendar suggestions | User preview and confirmation; never write externally by default |
| Drafting partner | Outline, revise, clarify or format user text | Course-policy banner, attribution guidance, user review |
| Navigator | Identify the correct office and prepare questions | Route to the institution-verified source; no official decisions |
| Accessibility assistant | Reading support, plain-language restatement, alternative formats | Preserve meaning; disclose when a transformation might alter content |
| Career preparation | Interview practice, application feedback, portfolio wording | No employability score, and no claim the student has not verified |

### Modes to prohibit or tightly restrict

Each names the refusal already in code — an intake refusal or a release-gate
item — or says none is.

| Mode | Refused by | Note |
| --- | --- | --- |
| Automated disciplinary recommendations | `Disciplinary judgments` | — |
| Admissions, financial-aid, accommodation or immigration decisions | `Financial-aid decisions` | Aid is refused; admissions, accommodation and immigration are not named at intake. |
| Mental-health diagnosis or crisis assessment | `Health decisions` | — |
| Hidden student-risk scoring | `Opaque risk scoring` | — |
| Automated grading without institution-approved human oversight | **none** | Not refused at intake; a Course Studio decision (D-100) keeps grading with the instructor. |
| Generating answers to active graded work where course policy prohibits it | `Course and institution policy enforced` | A release-gate item, not an intake refusal. |
| Using student data or content to train general models without documented authorization | **none** | The stance is trust/ai-training-policy.ts; nothing refuses it in the lifecycle. |
| Cross-tenant retrieval or leakage of institution or course material | `Authorized sources enforced` | — |
| Sending AI-generated actions to SIS, LMS, calendar or email without confirmation | `No consequential write without exact review and confirmation` | — |

### What every answer shows

| Label | Says |
| --- | --- |
| Source | Institution verified, course-authorized, student-provided, or general model knowledge |
| Status | Grounded, generated, incomplete, may be outdated, or needs official confirmation |
| Policy | Allowed, limited, or not available under this course or institution policy |
| Limits | What this response can and cannot establish |
| Action | Open the source, revise the question, report an issue, save privately, or contact the correct human or office |

The five source labels in `lib/source.ts` (Institution verified, Imported,
Student entered, Estimated, Needs review) are the **Source** line; the
**Status**, **Policy**, **Limits** and **Action** lines are not yet one
vocabulary across answers (AM-20).

### The safety pipeline

1. User request
2. Tenant, course and role context
3. Policy and entitlement check
4. Data-classification check
5. Approved-source retrieval, when applicable
6. Prompt-injection and unsafe-content defences
7. Model call through an approved provider
8. Output safety, citation, policy and accessibility checks
9. User-visible source, status and limitation labels
10. Feedback and report mechanism
11. Minimal audit event and monitored quality metrics

### Governance metrics

- Source-grounded answer rate
- Citation and source-open rate
- Incorrect-answer reports
- Policy-block rate
- Human-handoff rate
- Prompt-injection detection rate
- Sensitive-data prevention rate
- Accessibility feedback
- Model, provider and version usage
- Cost per successful request
- False-positive and false-negative safety review

Never a proxy for student success: engagement duration, number of prompts, message sentiment.
