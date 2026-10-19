# Reviewer question map

> **Type:** reference · **Audience:** security-reviewers, buyers · **Owner:** `trust` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/trust-docs.test.ts`

This page points each question a security or procurement reviewer asks to the existing page that answers it, with that page's status; stop reading if you want the answer itself, because this page holds none and drafts none.

**Status:** PARTIAL. Of the questions below, most have a page that answers part of them, and several have no answer yet.

## How to use this page

1. Find the question. The domains follow the HECVAT 4 areas the repository's own matrices use, plus the questions a short SIG-style form, a VPAT request, a data processing agreement and a FERPA or COPPA review usually add.
2. Open the answering page. It carries its own status and its own limits; read them before you copy a word.
3. Check the **Register that says so**. That is the document that records the status, so you can see who says "partial" or "not yet", and why.
4. Take any answer into a buyer workbook only through [`SECURITY-QUESTIONNAIRE.md`](SECURITY-QUESTIONNAIRE.md), which sets the response rule: `IMPLEMENTED`, `PARTIAL`, `PLANNED`, `NOT APPLICABLE` or `UNKNOWN`, with evidence and an approver for each.

## The status words on this page

| Word | Meaning here |
| --- | --- |
| answered | The page states the fact and its limits. A reviewer can read it without waiting for work to be done. It is not a certification or a signed commitment. |
| partial | The page answers part of the question, or answers it as a plan, a draft or a baseline. The gap is named by the register. |
| not yet | No answer exists to give. The page is a plan, an outline or a statement of absence. |

The test refuses `answered` for any row whose answering page opens with a draft, not-started, incomplete or not-in-force status.

## The map

Owner seats are council seats from [LAUNCH-READINESS-COUNCIL.md](../LAUNCH-READINESS-COUNCIL.md). A seat is a role, not a person; the security-lead and customer-trust seats are recorded as vacant in [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md).

| ID | Question | Answering page | Status | Register that says so | Owner seat |
| --- | --- | --- | --- | --- | --- |
| Q01 | Have you completed a HECVAT? | [`HECVAT-READINESS-MATRIX.md`](HECVAT-READINESS-MATRIX.md) | not yet | `app/src/lib/ops/claims.ts` row `hecvat` is `planned`; [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) lists the draft as "not sent" | `security` |
| Q02 | Which HECVAT domains have evidence, and which are open? | [HECVAT-EVIDENCE-MATRIX.md](../market-readiness/HECVAT-EVIDENCE-MATRIX.md) | partial | The matrix's own "Current" column: defined, partial or open per domain | `security` |
| Q03 | Can we see draft answers? | [HECVAT_DRAFT_RESPONSE.md](../market-readiness/HECVAT_DRAFT_RESPONSE.md) | partial | The draft's own header: "DRAFT, not sent"; held by `app/src/lib/hecvat-draft.test.ts` | `security` |
| Q04 | Can you map your controls to 1EdTech TrustEd Apps and EDUCAUSE? | [`COMPLIANCE-CROSSWALK.md`](COMPLIANCE-CROSSWALK.md) | partial | The page states that Semester has completed neither instrument | `trust` |
| Q05 | Do you have a standard security questionnaire response (a SIG-lite style form)? | [`SECURITY-QUESTIONNAIRE.md`](SECURITY-QUESTIONNAIRE.md) | partial | Its status: customer-specific response not approved; see also [INFORMATION-SECURITY-QUESTIONNAIRE.md](../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md) | `trust` |
| Q06 | Do you have standard RFP answers? | [HIGHER-ED-RFP-RESPONSE-LIBRARY.md](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) | partial | Each answer carries its own status; the page says no answer may use the integration status today. Held by `app/src/lib/gtm/rfp.ts` | `trust` |
| Q07 | How is the system built, and how is a tenant's data kept apart? | [`SECURITY-OVERVIEW.md`](SECURITY-OVERVIEW.md) | partial | [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md): RLS suites `LIVE`; "tenant scoping is uneven (G-03)" | `security` |
| Q08 | Where does the data live (hosting regions, data location)? | [`DATA-FLOW-MAP.md`](DATA-FLOW-MAP.md) | not yet | [SUBPROCESSORS.md](../SUBPROCESSORS.md) "Before this is published": hosting regions are not stated per subprocessor | `privacy` |
| Q09 | Has an independent penetration test been performed? | [`PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md) | not yet | `app/src/lib/ops/claims.ts` row `pen-test` is `planned`; the plan says none has been performed | `security` |
| Q10 | Do you hold a SOC 2 report or ISO/IEC 27001 certification? | [`SOC2-READINESS.md`](SOC2-READINESS.md) | not yet | `app/src/lib/ops/claims.ts` row `soc2` is `planned`; [ISO-27001-READINESS-ASSESSMENT.md](../compliance/ISO-27001-READINESS-ASSESSMENT.md) states no certification | `security` |
| Q11 | How do I report a vulnerability, and how fast is it fixed? | [SECURITY.md](../../SECURITY.md) | answered | The page: day counts are accepted internal targets, no safe-harbour wording; facts in [`CONTROL-FACTS.md`](CONTROL-FACTS.md) | `security` |
| Q12 | How are vulnerabilities and dependencies managed? | [`VULNERABILITY-MANAGEMENT-POLICY.md`](VULNERABILITY-MANAGEMENT-POLICY.md) | partial | Its status: partial, not fully operated; [SUPPLY-CHAIN.md](../SUPPLY-CHAIN.md) holds the checks | `security` |
| Q13 | Do you support SSO (SAML, OIDC, SCIM)? | [INSTITUTIONAL-SSO-LAUNCH-READINESS.md](../INSTITUTIONAL-SSO-LAUNCH-READINESS.md) | not yet | [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md): SAML `IMPLEMENTED_NOT_RELEASED` and `BLOCKED`; OIDC `PLANNED`; claims rows `sso` and `scim` are `in-preparation` | `security` |
| Q14 | Do you require multi-factor authentication? | [`PASSWORD-SESSION-AND-MFA-STANDARD.md`](PASSWORD-SESSION-AND-MFA-STANDARD.md) | not yet | `app/src/lib/ops/claims.ts` row `mfa` is `planned` | `security` |
| Q15 | How is access granted, reviewed and revoked? | [`ACCESS-CONTROL-POLICY.md`](ACCESS-CONTROL-POLICY.md) | partial | Its status: partial; see also [`IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md`](IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md), tenant-configuration dependent | `security` |
| Q16 | What do you log, and who is alerted? | [`LOGGING-MONITORING-AND-ALERTING-STANDARD.md`](LOGGING-MONITORING-AND-ALERTING-STANDARD.md) | partial | Its status: not fully staffed or operated; the truth table says no alert reaches anyone | `operations` |
| Q17 | What is your incident response process? | [`INCIDENT-RESPONSE-PLAN.md`](INCIDENT-RESPONSE-PLAN.md) | partial | Its status: designed, not target-exercised; one founder-led tabletop is dated in [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) | `security` |
| Q18 | What are your backup, restore and disaster-recovery arrangements, and your RTO and RPO? | [`BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md) | partial | Its status: target recovery not proven; no RTO or RPO is promised; production has never been restored | `operations` |
| Q19 | Is data encrypted, and who holds the keys? | [`ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md`](ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md) | partial | Its status: partial, provider-dependent | `engineering` |
| Q20 | How is software developed, reviewed and released? | [`SECURE-DEVELOPMENT-LIFECYCLE.md`](SECURE-DEVELOPMENT-LIFECYCLE.md) | partial | Its status: partial, repository-controlled | `engineering` |
| Q21 | Who are your subprocessors? | [SUBPROCESSORS.md](../SUBPROCESSORS.md) | partial | Held by `app/src/lib/trust/subprocessors.test.ts`; claims policy row `subprocessors` is `draft`; counsel review and agreements pending | `privacy` |
| Q22 | Have you assessed your own vendors? | [`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md) | not yet | The page: no vendor on the list has been risk-assessed | `privacy` |
| Q23 | Will you sign our data processing agreement? | [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md) | not yet | `app/src/lib/ops/claims.ts` row `dpa` is `planned`; status `NOT_STARTED` as a signed agreement | `privacy` |
| Q24 | Are you FERPA compliant, and will you act as a school official? | [FERPA-ALIGNMENT-ASSESSMENT.md](../compliance/FERPA-ALIGNMENT-ASSESSMENT.md) | partial | The page claims no certification; counsel review pending; see [ferpa-risk-and-permission-matrix.md](../security/ferpa-risk-and-permission-matrix.md) | `privacy` |
| Q25 | How do you handle minors and COPPA? | [FERPA-COPPA-1EDTECH-READINESS.md](../FERPA-COPPA-1EDTECH-READINESS.md) | partial | That page, held by `app/src/lib/trust/ferpa-coppa-readiness.test.ts`; counsel review pending | `privacy` |
| Q26 | What personal and education data do you hold, and how is it classified? | [`DATA-INVENTORY.md`](DATA-INVENTORY.md) | partial | Its status: partial; see [`DATA-CLASSIFICATION-STANDARD.md`](DATA-CLASSIFICATION-STANDARD.md) and the vocabularies in [`CONTROL-FACTS.md`](CONTROL-FACTS.md) | `data` |
| Q27 | How long is data kept, and what happens on deletion? | [RETENTION.md](../../RETENTION.md) | answered | Held by `app/src/lib/retention.test.ts`; the truth table says production cron state is unverified; the policy standard is [`DATA-RETENTION-AND-DELETION-STANDARD.md`](DATA-RETENTION-AND-DELETION-STANDARD.md) (partial) | `privacy` |
| Q28 | What is stored on the device and what on the server? | [0001-local-first-with-supabase.md](../architecture/0001-local-first-with-supabase.md) | answered | The ADR, marked accepted and under review | `engineering` |
| Q29 | How do you answer a data-subject request? | [`DATA-SUBJECT-REQUEST-RUNBOOK.md`](DATA-SUBJECT-REQUEST-RUNBOOK.md) | partial | Its status: not operationally accepted; the truth table says there is no screen or answering workflow | `privacy` |
| Q30 | What AI do you use, with which providers, and is student data used to train models? | [`AI-SYSTEM-INVENTORY.md`](AI-SYSTEM-INVENTORY.md) | partial | Its status: repository-inferred, deployment reconciliation required; the training policy [`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) states "Not in force"; provider terms in [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md) are unsigned | `product` |
| Q31 | Is there an AI governance program, and human oversight? | [`AI-GOVERNANCE-PROGRAM.md`](AI-GOVERNANCE-PROGRAM.md) | not yet | Its status: controlled draft, not in force and not production-approved | `product` |
| Q32 | Can AI be switched off in an incident? | [`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md) | partial | Its status: limited drill evidence; one drill dated 2026-09-29 in [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) | `engineering` |
| Q33 | Do you have a VPAT or accessibility conformance report? | [VPAT-ACR-SELF-ASSESSMENT.md](../compliance/VPAT-ACR-SELF-ASSESSMENT.md) | not yet | `app/src/lib/ops/claims.ts` row `vpat` is `planned`; the page says no formal ACR has been issued | `accessibility` |
| Q34 | How is accessibility tested? | [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md) | partial | Claims rows `a11y-app` and `a11y-human` are `in-preparation`; automated checks exist and a human review is owed | `accessibility` |
| Q35 | Is there an uptime SLA? | [`SLA.md`](SLA.md) | not yet | The page: `NOT_STARTED` as a commitment | `operations` |
| Q36 | Do you carry insurance, and who is the contracting entity? | [`README.md`](README.md) | not yet | That page's list of what blocks a signature: no legal entity, no cyber-liability insurance recorded | `founder` |
| Q37 | Where are your privacy policy and terms? | [PRIVACY-POLICY-DRAFT.md](../legal/PRIVACY-POLICY-DRAFT.md) | not yet | The page is a draft with its effective date undecided; counsel review pending | `privacy` |
| Q38 | What is your threat model? | [`THREAT-MODEL.md`](THREAT-MODEL.md) | partial | Its status: partial, requires revalidation | `security` |
| Q39 | What evidence can we see? | [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) | partial | [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) in this directory says the evidence it asks for per control has not been produced | `trust` |
| Q40 | What would a pilot agreement look like? | [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) | not yet | The page: an outline for counsel, not agreement language | `founder` |

## Where the registers disagree with each other

A reviewer will meet these. The code and the dated evidence win; the older page is named so you are not surprised.

| Where | What it says | What the evidence shows |
| --- | --- | --- |
| [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) | "No evidence has been produced" | [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) lists dated artifacts under `docs/evidence/`, for example a kill-switch drill and a dependency audit. The first page means the artifacts its own rows ask for. |
| [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md) | `docs/evidence/` does not exist; 78 check suites | `docs/evidence/` exists; [`CONTROL-FACTS.md`](CONTROL-FACTS.md) counts the suites. |
| [0004-ai-through-a-metered-gateway.md](../architecture/0004-ai-through-a-metered-gateway.md) | The gateway is not deployed | The evidence register records the deployed function answering production on 2026-09-29. The shared key is now gated off. |

## What this page adds

[SECURITY-ACCESSIBILITY-READINESS.md](../SECURITY-ACCESSIBILITY-READINESS.md) lists the items in the trust packet and their confidentiality tier. [`DOCUMENT-MAP.md`](DOCUMENT-MAP.md) lists every document in the trust directories. This page starts from the question instead of the document.
