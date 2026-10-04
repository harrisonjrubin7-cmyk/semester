# 1 · Board, committees, cadence and packet

> **PROPOSED — NOT ADOPTED.** Board and director matters depend on the legal entity and on any financing terms. Everything marked `[COUNSEL]` needs qualified review. See the [README](README.md).

The existing [`BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md`](../BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md) is the detailed monthly update. This page adds what it lacks: who sits, what they decide, when, and the packet that makes a meeting short.

## Stage plan

A stage is entered on **evidence** (see [04](04-organization-and-hiring.md#stage-triggers)), not on a financing announcement.

| | Pre-seed (today) | Seed | Series A | Growth |
| --- | --- | --- | --- | --- |
| **Governing body** | Founder as sole decision-maker `[COUNSEL: confirm entity, director/manager]` plus a non-fiduciary **Advisory Council** | Small formal board; terms follow the financing `[COUNSEL]` | Formal board with investor representation | Formal board with a lead independent director |
| **Seats** | 1 + up to 5 advisors | 3 | 5 | 7 |
| **Who sits** | Founder; advisors by capability (below) | Founder(s) ×2, plus 1 independent or lead investor | 2 founder/common, 2 investor, 1 independent with higher-ed or regulated-data operating experience | 2 founder/common, 2–3 investor, 2 independent |
| **Authority** | Advisors hold none. Their leverage is a written, limited **pause-review right** ([02](02-decision-rights.md#escalation-rules)) and a standing right to ask | Board approves reserved matters ([below](#reserved-matters)) | Same, plus committee approvals | Same, plus annual CEO and board review |
| **Committees** | None formal. A quarterly **Trust Review** (advisory) | None formal. **Trust & Risk** sub-group of two, quarterly | **Audit & Risk** (includes trust, privacy, security, continuity as standing items) and **Compensation** | Audit & Risk, Compensation, Nominating & Governance, and a separate **Trust** committee (privacy, security, AI, accessibility) |
| **Meetings** | Monthly written note; quarterly 90 min; annual half-day | Monthly written; quarterly 2.5 h; annual strategy day | Monthly financials; quarterly 3 h; committees quarterly; annual strategy | Same, plus executive session at every meeting |
| **Outside voices** | Student on the Advisory Council | Student Advisory Council (not a board seat) | Student and Institutional Advisory Councils with written-response rights | Same |
| **Trigger to enter** | Now | First outside financing closes, or a signed institutional agreement plus a first non-founder employee, whichever is first `[DECIDE: F8]` | Series A closes | Repeatable multi-institution delivery evidenced |

**Why a Trust committee earlier than most companies:** Semester's product promise is that students' records, consent and accessibility are handled correctly. That is a board-level risk from the first institution, not a compliance afterthought. It is kept small and advisory until a board exists, so it does not become five boards for one person.

## Advisory Council

Up to five, each with a signed advisor agreement `[COUNSEL]`. Advisors are **not counsel**: privileged advice comes from retained counsel only.

| Seat | Role it plays | What it covers | What it must not be |
| --- | --- | --- | --- |
| Higher-ed operator | The buyer's truth: registrar, CIO, student-affairs or procurement experience | Whether an institution would actually adopt, buy and sign off | A customer endorsement; claims about a named school need that school's permission |
| Operator and stop-holder | Has run a company through a hard year; holds the **pause-review right** | Founder check, continuity ([08](08-continuity.md)), governance proportionality | A co-founder or informal CEO |
| Privacy and student-data practitioner | Practice experience in student-record and minors' data | Consent design, data-rights runbooks, incident clocks | Counsel; the author of legal conclusions |
| Learning/AI integrity voice | Faculty or learning-science practitioner | AI scope, academic-integrity boundaries | The same person as the accessibility evaluator |
| Student or early-career user | A current student, rotated every two terms | Whether a change feels respectful and clear | A volunteer for unpaid work; paid per F11 |

**Independence rule:** the person who produces independent evidence (security assessor, accessibility evaluator) is a paid, scoped consultant, not an advisor, and does not also approve their own report.

**Terms:** twelve months, renewable; reviewed at the annual governance review; either side may end it at any time.

**Advisor agreement essentials** `[COUNSEL]`: scope and expected time (about two hours a month `[HYPOTHESIS]`), confidentiality, IP assignment for anything contributed, conflicts disclosure, compensation or equity treatment, no authority to bind the company, the exact definition and limits of the pause-review right, termination.

## Skills coverage

Fill the gap the stage actually has. A director is added when an advisor can no longer carry the weight.

| Capability | Why Semester needs it | Pre-seed source | Seed | Series A and later |
| --- | --- | --- | --- | --- |
| Higher-ed buyer insight | Procurement, governance and accreditation shape every deal | Advisor | Advisor or independent director | Independent director |
| Student-data privacy and ed-law | The promise being sold | Counsel + practitioner advisor | Trust & Risk sub-group | Trust (or Audit & Risk) committee |
| Security and AI risk | Tenant isolation and bounded AI are the product | Fractional CISO or assessor (consultant) | Same | Director or committee member with the background |
| Accessibility | Institutions buy only what they can defend | Qualified evaluator (consultant) | Same | Standing agenda item |
| SaaS finance, unit economics | Pricing, AI cost, runway | CPA (consultant) | Investor or independent director | Audit & Risk chair |
| Enterprise go-to-market | Long cycles, security questionnaires | Higher-ed operator advisor | Investor or advisor | Director or committee member |
| People and org scaling | First hires set the culture | Operator advisor | Investor or independent | Compensation chair |
| Student voice | The people it is used on | Student advisor | Student Advisory Council | Same, with written responses |

## Reserved matters

Items that need more than the founder's signature. At pre-seed the advisors are consulted and the founder decides, because advisors hold no legal authority `[COUNSEL]`. The consult is still recorded in the decision log.

| Matter | Pre-seed | Seed | Series A and later |
| --- | --- | --- | --- |
| Equity issuance, convertible instruments, financing terms | Consult; counsel drafts | Board approves | Board approves, subject to financing documents |
| Annual plan and budget | Consult | Board approves | Board approves |
| Hire or dismissal of function leads; leadership compensation | — | Board consulted | Compensation committee approves |
| Contract with non-standard liability, data, uptime or exit terms | Counsel + operator advisor consulted | Board consulted above threshold | Board approves above threshold |
| First activation of a tenant with live data | Gates in code + counsel + operator advisor consulted | Board informed; gates | Board informed; Trust committee has reviewed |
| New paid or broad market motion | Consult | Board approves | Board approves |
| New high-risk AI use category (assessment, grading, anything consequential) | Minimum AI quorum ([06](06-domain-governance.md#ai)) | Trust & Risk reviews | Trust committee approves |
| Material security or privacy incident | Advisors informed within 24 hours | Same | Same; Audit & Risk chair on call |
| Related-party transactions | Disclosed; counsel reviews | Disinterested directors approve | Audit & Risk approves |
| Change of counsel, CPA or insurer | Informed | Informed | Audit & Risk approves |
| Pause, sale, merger or wind-down | Counsel + advisors consulted | Board approves | Board approves |
| Activation of the continuity plan ([08](08-continuity.md)) | Interim operator acts; advisors informed | Chair informed | Chair informed |

## Reporting cadence

| Report | Audience | When | Length | Contents |
| --- | --- | --- | --- | --- |
| **Monthly note** | Advisors / board | By the 5th business day | 1–2 pages | Scorecard, three wins, three misses, runway, asks ([template](templates.md#monthly-advisor-note)) |
| **Quarterly packet** | Advisors / board | Sent 5 business days before the meeting | ≤ 6 pages + appendix | [Board packet](#board-packet) |
| **Annual strategy session** | Advisors / board | Once a year, after the Q-end review | Half to full day | Strategy memo, plan, org and hiring, governance review |
| **Committee report** | Board | Quarterly | 1 page | Findings, exceptions, decisions requested |
| **No-surprises notice** | Advisors / board chair | Within 24 hours of a trigger | 5 sentences | Triggers: material security or privacy incident; unsupported public claim found live; loss or incapacity of a Tier-1 key person; legal threat or regulator contact; a customer escalation to its executive sponsor; runway below the approved trigger |

A note that is late twice in a row is a signal about capacity, not discipline. It is raised in the next QBR as a capacity item ([03](03-okrs-planning-metrics.md#quarterly-business-review)).

## Board packet

The packet is built so the meeting can start at the decisions. If there is nothing to decide, shorten the meeting.

**Order, with page budget:**

| # | Section | Pages | Rule |
| --- | --- | ---: | --- |
| 1 | **Cover memo and decision asks** | 1 | Decisions first. Each ask states options, a recommendation, the authority needed, and a deadline |
| 2 | **Bad news and changed assumptions** | 0.5 | Before the good news |
| 3 | **Scorecard** | 1 | The [executive scorecard](03-okrs-planning-metrics.md#operating-metrics). Every number carries source, definition, period, and one of: observed, estimated, proposed, unavailable |
| 4 | **Commitments from last meeting** | 0.5 | Done, late, dropped; no silent carry-over |
| 5 | **Trust ledger** | 1 | Open P0/P1 risks, security and privacy exceptions with expiry dates, claims expiring or withdrawn, incidents, data-rights request clocks, AI evaluations due |
| 6 | **Market motions** | 0.5 | GO / GO WITH CONDITIONS / PAUSE / NO-GO for each, with conditions and expiry |
| 7 | **Cash, runway, plan variance** | 0.5 | Confirmed figures only; "not available" is acceptable and is labelled |
| 8 | **People, capacity and key-person** | 0.5 | Named seats and backups, gaps, hiring status, founder capacity for the next quarter |
| 9 | **Appendix** | — | Annual plan, financials, risk and evidence registers, release scorecard, decision log extract, prior packet |

**Packet rules:**

- **T−5 business days** packet sent; **T−2** written questions due, answered in writing before the meeting.
- No metric without a definition. No claim from the "prohibited" list in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) appears in any packet.
- Customers are not named without that customer's written permission.
- Privileged, personnel, security-sensitive and customer-confidential material stays in a controlled system and is linked, not pasted ([`BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md`](../BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md#9-appendix)).
- A packet that arrives late is not pre-read; its decisions move to the next meeting unless the founder invokes the no-surprises path.

## Meeting mechanics

| Item | Rule |
| --- | --- |
| Agenda (quarterly, 2.5 h) | Decisions 60 min · strategy deep-dive on one topic 45 · trust and risk 30 · executive session 15 |
| Quorum and voting | Per governing documents and financing terms `[COUNSEL]`; pre-seed has none (advisors advise) |
| Minutes | Draft within 5 business days; decisions, abstentions, **dissent recorded by name and reason** |
| Consent agenda | Routine items approved in one vote; any member may pull an item |
| Conflicts | Disclosed at the start of each meeting; recusal recorded |
| Executive session | Every quarterly meeting from Series A; at pre-seed the operator advisor and founder meet alone quarterly |
| Evaluation | Annual: what decisions did the board improve, what was noise |
| Onboarding a member | Read this folder, the operating-system page, the last two packets; 60-minute conversation with the founder |
| Insurance | D&O and related cover explored with a broker before any formal board seats `[COUNSEL]` |

## What to delete

If a board or advisor meeting produces no decision and no changed plan for two consecutive quarters, replace it with the written note and keep only the annual session.
