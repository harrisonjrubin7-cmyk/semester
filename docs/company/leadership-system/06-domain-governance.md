# 7 · Governance of product, AI, security, privacy, accessibility, pricing, risk and public claims

> **PROPOSED — NOT ADOPTED.** The repository already holds charters, gates and registers for each domain. This page does not restate them. It answers the question they leave open: **at this stage, with this many people, who actually decides, who can stop it, and what is the smallest forum that keeps it honest?**

## The design in one paragraph

Eight domains, one **Trust Review**, one **trust ledger**, three **change classes**. Each domain has an owner who decides, an independent check who can stop, a short list of required evidence, and a link to the detailed document that already exists. Instead of five separate boards for one person, there is a single weekly 30-minute Trust Review and a quarterly session with outside advisors; the detailed charters become the target state each domain grows into.

## Change classes

Every change in any domain is one of three classes. The class decides the review, not the domain.

| Class | Definition | Review | Clock |
| --- | --- | --- | --- |
| **Standard** | Reversible, local, inside an approved pattern, no new data class, no new claim | The DRI; automated gates | Same day |
| **Significant** | Reversible but touches shared behavior, a vendor, a setting default, a tenant-visible behavior, or a new use of existing data | The DRI plus the domain's named reviewer (not the author) | 2 working days |
| **Critical** | Trust floor: identity, tenancy, authorization, a new data class, classification floor, an AI route that touches student data, a legal-sensitive claim, anything irreversible, a tenant activation | Domain forum, independent check, and counsel where `[COUNSEL]`; recorded decision | 10 working days; may be faster for a security fix |

**Emergency path:** a security or safety fix ships first under the incident process and is reviewed within 2 working days. The review can reverse it.

## The Trust Review

One forum replaces separate AI, privacy, security and accessibility meetings until each domain has enough volume to need its own.

| | |
| --- | --- |
| **Cadence** | Weekly 30 minutes; quarterly 90 minutes with advisors |
| **Pre-seed seats** | Founder; the privacy/AI-aware advisor or counsel on call; a student seat quarterly. The security assessor and accessibility evaluator attend when a finding is on the agenda |
| **Standing input** | The [trust ledger](#trust-ledger) |
| **Decides** | Critical changes in security, privacy, accessibility and AI; exceptions; claim withdrawals; whether a matter needs an external opinion |
| **Output** | A one-line decision per item in the ledger, with owner and date; dissent recorded |
| **Splits into committees** | Series A: the quarterly session becomes the board's Audit & Risk with trust as a standing item; Growth: a separate Trust committee ([01](01-board.md#stage-plan)) |

## Trust ledger

A single living view, kept by the owner of the Trust Review. It replaces the habit of a separate list in each domain.

| Section | What it holds | Source |
| --- | --- | --- |
| Open P0/P1 risks | Each with owner, plan and date | [`RISK-REGISTER.md`](../RISK-REGISTER.md) and [`RISK-GOVERNANCE.md`](../../operating-model/RISK-GOVERNANCE.md) |
| Exceptions | Security, privacy, data and policy exceptions, each with an expiry; any past expiry is red | [`POLICY-EXCEPTION-PROCESS.md`](../POLICY-EXCEPTION-PROCESS.md) |
| Claims | Approved claims by expiry; any withdrawn; any found live outside the register | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| Incidents | Open and recently closed, with the structural fix for each | Incident log |
| Data-rights requests | Open, with the clock | [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md) |
| AI | Use cases by lifecycle gate; evaluations due; safety events; cost per outcome | [`AI-LIFECYCLE-GATES.md`](../../operating-model/AI-LIFECYCLE-GATES.md) |
| Evidence | Artifacts filed vs scheduled; those expiring | [`PROOF-CALENDAR.md`](../../PROOF-CALENDAR.md), [`EVIDENCE-REGISTER.md`](../../../EVIDENCE-REGISTER.md) |
| Accessibility | Critical barriers open; evaluator findings and retest status | Accessibility conformance register |

## Domain governance

Each domain: **owner decides**, **independent check can stop**, **evidence required**, **cadence**, and the document that holds the detail.

### Product

| | |
| --- | --- |
| **Owner / stop** | Product owner decides scope and quality bar. The independent check is the **definition of done** and the launch-council gates; no one can ship around either |
| **Evidence** | Each requirement has a user, a first-win measure, acceptance criteria, error and degraded states, an owner, and a release gate ([`DEFINITION-OF-DONE.md`](../../DEFINITION-OF-DONE.md)) |
| **Rhythm** | Per release council; quarterly portfolio review: build, partner, integrate, defer, decline or sunset ([`PORTFOLIO-GOVERNANCE.md`](../../operating-model/PORTFOLIO-GOVERNANCE.md)) |
| **Rule** | "If a request cannot be configured, audited, tested, supported, rolled back and reused, it should not become permanent core product code" ([`README.md`](../../operating-model/README.md)). A new capability needs a charter and scorecard; a scorecard zero blocks it |
| **Decision** | Class B (A for tenant activation) |

### AI

| | |
| --- | --- |
| **Owner / stop** | The AI owner (founder until a hire) decides what is built. **Any member of the AI quorum can engage the kill switch**; the quorum reviews afterward and does not approve beforehand ([`AI-GOVERNANCE-BOARD.md`](../../operating-model/AI-GOVERNANCE-BOARD.md#decision-rules)) |
| **Minimum quorum while the full board has no seats** | The founder; privacy counsel or the privacy advisor; a student or faculty voice. **No use case is approved without privacy and a student-or-faculty voice present.** This is a scaled-down starting point for the full ten-seat board, which stays the target state |
| **Evidence** | A charter and scorecard; lifecycle gates G0–G5; an evaluation harness result; prompt-injection and exfiltration tests; a documented non-goal and safety boundary; provenance and a user-visible explanation; a model and provider routing policy ([`AI-LIFECYCLE-GATES.md`](../../operating-model/AI-LIFECYCLE-GATES.md), [`AI-ASSURANCE.md`](../../operating-model/AI-ASSURANCE.md)) |
| **Fixed floors (not a board decision)** | The platform floors in `classification.ts`, which the board cannot waive: nothing classified T3 or above goes to a consumer model, and nothing T4 or above goes anywhere ([`AI-GOVERNANCE-BOARD.md`](../../operating-model/AI-GOVERNANCE-BOARD.md#decision-rules)) |
| **Human confirmation** | Any external, financial, academic-record, enrollment, grade or otherwise consequential action |
| **Rhythm** | Weekly in the Trust Review; quarterly evaluation review; ad hoc within 5 business days of a high-risk change or an AI quality incident |
| **Decision** | Class A for a new use case or provider |

### Security

| | |
| --- | --- |
| **Owner / stop** | Security owner decides controls. The independent check is the **external assessor** and a second reviewer on trust-floor changes. **A P0/P1 finding stops the affected motion**; it cannot be risk-accepted |
| **Evidence** | Threat model per domain and per privileged workflow; access review each quarter; vulnerability triage and rescan; independent assessment; incident drill; restore and rollback drills ([`SECURITY.md`](../../../SECURITY.md), [`SECRETS.md`](../../../SECRETS.md), [`RESTORE.md`](../../../RESTORE.md), [`ROLLBACK.md`](../../../ROLLBACK.md)) |
| **Rhythm** | Weekly in the Trust Review; quarterly access and vendor review; annual independent review |
| **Rule** | A security exception is a two-person act, P2/P3 only, with an expiry |
| **Decision** | Class A for a trust-floor change; B otherwise |

### Privacy and data

| | |
| --- | --- |
| **Owner / stop** | Privacy owner decides within procedure; **counsel** is the independent check for novel questions, minors, regulated data and notification duties `[COUNSEL]` |
| **Evidence** | Data inventory and lineage, classification, retention and deletion schedules, privacy impact assessment for any new data use, consent records, data-rights clocks, subprocessor register ([`DATA-INVENTORY-AND-LINEAGE.md`](../../DATA-INVENTORY-AND-LINEAGE.md), [`PRIVACY-IMPACT-ASSESSMENT.md`](../../operating-model/PRIVACY-IMPACT-ASSESSMENT.md), [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md)) |
| **Rhythm** | Weekly clock check; quarterly review of vendors and retention; privacy impact assessment before a new data use |
| **Rule** | The student controls sharing and AI context; institutional visibility needs explicit policy; guardian visibility needs verified relationship and consent |
| **Decision** | Class A for a new data class or classification floor |

### Accessibility

| | |
| --- | --- |
| **Owner / stop** | Accessibility owner decides remediation priority. The independent check is the **qualified external evaluator**. A critical barrier with no equivalent path withdraws affected claims and blocks the motion |
| **Evidence** | Manual assistive-technology and keyboard review of the golden path; zoom and 320px checks; a conformance register of components and defects; remediation and retest ([`ACCESSIBILITY-GOVERNANCE.md`](../../operating-model/ACCESSIBILITY-GOVERNANCE.md)) |
| **Rhythm** | Per release for the golden path; quarterly retest; annual independent review |
| **Rule** | Accessibility acceptance criteria are in every story; accessibility task success is a guardrail on growth key results |
| **Decision** | Class A for any conformance statement; wording through counsel |

### Pricing

| | |
| --- | --- |
| **Owner / stop** | Founder decides the price book; the **deal desk** applies it. Finance/CPA is the independent check on revenue recognition and tax |
| **Evidence** | An approved price book; discount bands; cost per AI outcome and gross margin; [deal-desk record](../../operating-model/COMMERCIAL-GOVERNANCE.md) for every exception |
| **Rules** | Free or institution-sponsored access to core accessibility and safety is never gated. Premium AI has guardrails and budget controls so a student is never surprised by a bill. Marketplace pricing only after consumer protection, provider governance, refund, tax and operational capacity are mature. Pricing is not stated publicly until approved (CLM-015 is **prohibited** today) |
| **Rhythm** | Quarterly pricing and package review; discount-band review at each QBR |
| **Decision** | Class B (A for a multi-year or non-standard commercial structure) |

### Risk

| | |
| --- | --- |
| **Owner / stop** | The founder owns the register; each risk has an owner. **P0/P1 risks are never waivable**; P2/P3 may be accepted by the founder, with an expiry, as a recorded two-key act where a second person exists |
| **Evidence** | A register with likelihood, impact, owner, treatment, review date, linked evidence ([`RISK-REGISTER.md`](../RISK-REGISTER.md), [`RISK-GOVERNANCE.md`](../../operating-model/RISK-GOVERNANCE.md)) |
| **Rhythm** | Weekly new and changed; monthly review of the top ten; quarterly full review and severe-but-plausible scenarios ([`QUARTERLY-OPERATING-REVIEW.md`](../QUARTERLY-OPERATING-REVIEW.md#risk-and-scenario-review)) |
| **Appetite** | See below |

**Risk appetite `[PROPOSE]`:**

| Category | Appetite | Meaning |
| --- | --- | --- |
| Cross-tenant data exposure; unauthorized access to student records | **Zero** | Any suspected case stops the motion |
| Unsupported legal, compliance or accessibility claim | **Zero** | Remove first, investigate second |
| High-impact AI action without human confirmation | **Zero** | Block |
| Data loss with no tested recovery path | **Very low** | No live-data activation without a drill |
| Over-commitment beyond owner capacity | **Low** | Capacity covenant ([08](08-continuity.md#capacity-covenant)) |
| Reliability shortfalls on non-critical journeys | **Moderate** | Within the error budget |
| Product experimentation, onboarding and copy tests | **High** | Reversible and consent-respecting |
| Financial risk | Set by runway trigger and board approval `[DECIDE]` | |

### Public claims

| | |
| --- | --- |
| **Owner / stop** | The **claim owner** (founder until a hire) maintains the register. Each claim row lists required reviewers; **any named reviewer can stop its use**. Counsel approves legal-sensitive categories |
| **States** | `VERIFIED` → `CONDITIONAL` → `ROADMAP` → `PROHIBITED`, as in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md). An approved *use* is a separate state: exact words, channel, audience, evidence, expiry |
| **Process** | Draft the exact words and takeaway → attach evidence and limits → named reviewers sign → approve for a channel with an **expiry** → publish → on expiry or contradiction, **withdraw from every channel** |
| **Clocks** `[PROPOSE]` | Contradicted or expired claim withdrawn within 1 business day; found live outside the register treated as an incident |
| **Never** | Customer names, logos, quotes, outcomes, pricing, uptime, security/compliance conclusions or accessibility conformance without the specific approval the register requires |
| **Sources** | [`LEGAL-CLAIMS-APPROVAL-POLICY`](../../legal-drafts/LEGAL-CLAIMS-APPROVAL-POLICY.md), [`MARKETING-CLAIM-REVIEW-MATRIX`](../../legal-drafts/MARKETING-CLAIM-REVIEW-MATRIX.md) |
| **Decision** | Class A for a claim outside the library |

## How it scales

| Stage | Change |
| --- | --- |
| **Pre-seed** | Trust Review with outside advisor and counsel; domain owner is the founder; independence is external |
| **Seed** | First security and privacy capacity; Trust & Risk sub-group; AI quorum seats filled by real people |
| **Series A** | Domain owners are different people from product and engineering; Audit & Risk committee takes the quarterly session; full AI board |
| **Growth** | Separate Trust committee; per-domain forums; internal audit function |

## What to delete

If a domain's forum has not made a decision in two quarters, fold it into the Trust Review. If a register row has no owner action attached for two quarters, archive it with the reason.
