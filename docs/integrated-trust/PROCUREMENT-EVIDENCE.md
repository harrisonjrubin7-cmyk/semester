# Procurement evidence artifacts

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: a catalogue with the truth status of each artifact, and a rule for what may be said from it.** An institution's procurement, security, privacy and accessibility reviewers ask for a standard set of documents. This page lists them, says what exists behind each name today, what it permits Semester to say, and what would upgrade it. The finding that matters: **nearly everything is a controlled draft or a readiness assessment; no independent assessment or executed agreement exists, and no certification of any kind.** The company can show a diligent reviewer unusually good *working* evidence, and must not describe any of it as more than it is.

## 1. The scale

| Standing | Meaning | Example |
| --- | --- | --- |
| **Independent** | Produced or attested by a party outside the company | None today |
| **Executed** | A signed agreement or filed, dated operational record | The AI kill-switch drill; the production restore *rehearsal* is logical only |
| **Tested in the repository** | A test, check or workflow fails when it is wrong | The subprocessor list; the retention schedule; the control register |
| **Drafted** | Written for review; not approved by the owning seat or counsel | The security whitepaper; the HECVAT draft |
| **Readiness** | A gap assessment against a standard, not an audit | SOC 2, ISO 27001 |
| **Aspirational** | A plan or a template | The penetration test plan; the bridge letter |

## 2. The catalogue

| Artifact | What exists | Standing | May be said | To upgrade |
| --- | --- | --- | --- | --- |
| Architecture overview | [`docs/engineering-operations/SYSTEM-ARCHITECTURE.md`](../engineering-operations/SYSTEM-ARCHITECTURE.md); [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Drafted | How the system is built, with the repository as the source | Review by an engineer who did not write it |
| Security overview | [`docs/trust/SECURITY-WHITEPAPER.md`](../trust/SECURITY-WHITEPAPER.md) (draft v0.1, 28 September); [`docs/trust/INFORMATION-SECURITY-PROGRAM.md`](../trust/INFORMATION-SECURITY-PROGRAM.md) | Drafted | Controls named in the [control framework](CONTROL-FRAMEWORK.md) as *enforced in the repository*, with the stated gaps | Seat review (security is vacant); TR-04 reconciles its contradictions |
| Control mapping | [Control framework](CONTROL-FRAMEWORK.md), [domain requirements](DOMAIN-REQUIREMENTS.md) | Tested in the repository, Drafted for review | Which controls fail a build, which are partial, which are absent, per product domain | Seat review |
| Privacy overview | [`docs/launch-readiness/PRIVACY_AND_DATA_HANDLING.md`](../launch-readiness/PRIVACY_AND_DATA_HANDLING.md); [`RETENTION.md`](../../RETENTION.md); [data-rights procedure](DATA-RIGHTS-OPERATIONS.md) | Drafted; retention Tested | What is collected and how long it is kept, from the schedule | Counsel approval of periods |
| Data processing addendum | [`docs/trust/DPA-CHECKLIST.md`](../trust/DPA-CHECKLIST.md); [`docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`](../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md) | Aspirational | Nothing; no agreement exists | Counsel drafts and signs |
| Subprocessor list | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md), generated and held against the content security policy and the Edge Functions | Tested in the repository | Who the listed providers are | Signed provider terms, region and deletion evidence (TR-22) |
| Accessibility | [`docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`](../compliance/VPAT-ACR-SELF-ASSESSMENT.md); [accessibility program](ACCESSIBILITY-PROGRAM.md) | Readiness; automated checks Tested | Automated guards and selected browser checks (CLM-007) | Manual pass, then an assessor's ACR (TR-25, TR-47) |
| Business continuity and disaster recovery | [`docs/trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md); [`RESTORE.md`](../../RESTORE.md); [`docs/evidence/restore/2026-09-30-logical-rehearsal.md`](../evidence/restore/2026-09-30-logical-rehearsal.md) | Drafted; logical rehearsal Executed | That a logical dump restores into a disposable database and the comparison passes. **Not** a recovery time or point | Provider restore with measured times (TR-10) |
| Incident response | [Incident response](INCIDENT-RESPONSE.md), [playbooks](INCIDENT-PLAYBOOKS.md), [calendar](TABLETOP-CALENDAR.md); [`docs/trust/INCIDENT-RESPONSE-PLAN.md`](../trust/INCIDENT-RESPONSE-PLAN.md) | Drafted; one paper tabletop Executed | That a plan exists and one document walkthrough was held | The exercises on the calendar, filed |
| Penetration test | [`docs/trust/PENETRATION-TEST-PLAN.md`](../trust/PENETRATION-TEST-PLAN.md) | Aspirational | "An independent penetration test is planned." Nothing more | TR-16 |
| Dependency and secret scans | [`docs/evidence/security/`](../evidence/security) (dependency audit 2 October; working-tree secret scan 2 October) | Executed (point in time) | The dated result, with its scope | Make the audit blocking (TR-05); repeat on a schedule |
| Independent attestation | [`docs/trust/SOC2-READINESS.md`](../trust/SOC2-READINESS.md); [`docs/compliance/ISO-27001-READINESS-ASSESSMENT.md`](../compliance/ISO-27001-READINESS-ASSESSMENT.md) | Readiness | That a gap assessment exists. **Never** that Semester is audited or certified | TR-47 |
| HECVAT | [`docs/market-readiness/HECVAT_READINESS.md`](../market-readiness/HECVAT_READINESS.md); [`HECVAT_DRAFT_RESPONSE.md`](../market-readiness/HECVAT_DRAFT_RESPONSE.md) | Drafted | That a draft response exists; a *Yes* only where the control is ready and filed | Complete from filed evidence (TR-47) |
| AI governance packet | [`docs/trust/AI-GOVERNANCE-PROGRAM.md`](../trust/AI-GOVERNANCE-PROGRAM.md), [`AI-SYSTEM-INVENTORY.md`](../trust/AI-SYSTEM-INVENTORY.md), [`AI-RISK-ASSESSMENT.md`](../trust/AI-RISK-ASSESSMENT.md); the [kill-switch drill](../evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json); the [adversarial run](../evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json) | Drafted; two runs Executed | The switch held on a dated drill; one 21-case run on one model. Not that the assistant is safe, accurate, private or non-training | Seats named; repeat runs as a gate (TR-33); provider terms signed |
| Security questionnaire library | [`docs/trust/SECURITY-QUESTIONNAIRE.md`](../trust/SECURITY-QUESTIONNAIRE.md); [`docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md), 36 answers held by a claim-language filter | Tested (language); content Drafted | A starter for answers, never sent as a response | Customer-specific review |
| Service level agreement | [`docs/trust/SLA.md`](../trust/SLA.md) | Aspirational | Nothing; not started as a commitment | TR-27, TR-42 |
| Public claims register | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); `ops/claims/README.md` (40 claims, none available) | Tested (the machine-held one) | What each claim permits and prohibits | Keep the two registers in step |
| Trust center | [`docs/TRUST-CENTER.md`](../TRUST-CENTER.md) (an in-app feature); a token-gated packet server tested with fixtures | Tested in the repository | An in-app "your data" view. Whether any real packet is uploaded cannot be seen from the repository | Upload the packet; log access |

## 3. The room

A prospective institution gets a private room, not the repository. What goes in it, from the table above: the architecture overview, security overview and control mapping; the privacy overview and retention schedule; the subprocessor list with a statement of what is and is not signed; the accessibility status and program; the incident response plan and the exercise calendar with the exercises held *so far* (one); the AI governance packet; the questionnaire answers, each marked *drafted* or *evidenced*; and the claims register extract. Each is dated and carries its standing. An item with no dated source is not in the room.

Access to the room is logged, per artifact, with expiry; the packet server supports signed sixty-second links. Whether it is populated is a company fact to confirm before it is offered.

## 4. How to answer a questionnaire

1. **Yes** only for a control that is *enforced* in the [control framework](CONTROL-FRAMEWORK.md) and where the filed evidence for it exists. Cite the file.
2. **Partial** for a control that is partial, with the gap sentence from the register, verbatim.
3. **No** for an absent control, without apology and with the item in the [remediation sequence](REMEDIATION-SEQUENCE.md) that closes it.
4. **Company to supply** for anything the company, not the product, must answer: entity, insurance, signing authority, staffing.
5. **Never** answer on certification or conformance or uptime or recovery objectives or data residency or incident clocks with a *Yes* the register prohibits. The claim-language filter (`unsupportedClaims()`) is applied to the library answers and to this package.
6. A legal question — contract terms, notification duty, regulatory applicability — is answered by counsel (requires qualified human counsel review).

## 5. What a diligent reviewer will find, said first

Every one of these is true on 4 October 2026 and is better said by us than discovered:

- No penetration test, SOC 2 report, ISO certificate, HECVAT or ACR exists. The assessments are readiness documents.
- No objective has a measured value; there is no uptime history beyond five days of hourly probes; no recovery time or point is measured; no provider restore has been done.
- One person holds every role. There is no on-call rota.
- Students have no multi-factor option. Platform staff roles are not required to use it outside the console.
- No provider agreement or data processing agreement is signed.
- The gateway for institutional integrations is not deployed.
- Data-subject requests can be raised but no operator surface handles them.
- Community is built and off; there is no marketplace.
- The manual assistive-technology pass has not been run.

The reviewer will also find that the tests, the checks, the generated registers and the honesty of the gap statements are good. That is the case to make, and it is true.
