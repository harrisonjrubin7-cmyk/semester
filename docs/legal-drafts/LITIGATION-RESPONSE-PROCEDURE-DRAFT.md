> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester litigation, subpoena and third-party demand response procedure — draft

**Status:** requires qualified human counsel review. This procedure routes and preserves. It does not decide whether to comply, object, or produce, and no member of staff may produce data in response to any demand without a recorded counsel decision.
**Owner:** Harrison Rubin (coordinator). Counsel unassigned.
**Related:** [`LEGAL-HOLD-PROCEDURE-DRAFT.md`](LEGAL-HOLD-PROCEDURE-DRAFT.md), [`LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md`](LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md), [`DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md`](DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md), `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`.

## 1. What counts as a demand

Complaint or claim letter · demand letter · subpoena (civil, criminal, administrative) · court order · regulator inquiry or civil investigative demand · warrant or emergency disclosure request · institution's request for records tied to its own dispute · discovery request to a customer that reaches Semester-held data · preservation letter · arbitration or small-claims notice · data-subject request that is actually a litigation tactic. If unsure, treat it as a demand.

## 2. Intake (same business day)

Whoever receives it: do not reply, do not forward outside the circle, do not search data. Send to the coordinator with the original, envelope and time received. The coordinator opens a matter record:

| Field | Content |
| --- | --- |
| Matter id and date/time received, by what channel | |
| Issuer, case/inquiry number, court or agency | |
| Type (§1) and what it demands | |
| Stated response date and its source (document, rule, agreement) | Business preference is not a legal deadline |
| Subject individuals / tenants / data named | |
| Customer or institution affected | |
| Counsel assigned (or "needs assignment") | |
| Conflicts or sensitivities (minor, student record, gov't) | |

## 3. Counsel gate (`requires qualified human counsel review`)

Counsel decides, and records with date: validity and service · jurisdiction · whether the demand is directed at Semester or at the customer · whether the customer contract or DPA requires notice to, or cooperation with, the customer first · whether education-record, minor, or other protective rules restrict disclosure · whether to object, narrow, seek protective order, or comply · privilege and confidentiality handling · whether affected individuals or the institution are notified (and whether the demand bars notice).

## 4. Preservation

On counsel's instruction, or immediately on a preservation letter or reasonable anticipation of a claim as counsel states it, open a legal hold under the hold procedure: scope by custodian, system, tenant, date range; suspend ordinary deletion for scoped data; note provider backup tails honestly (the repository shows no mechanism to suspend provider backup expiry — record the gap and compensating action). A pending subject-rights deletion request touching held data is answered per counsel's instruction, with the requester's status visible, not silently dropped.

## 5. Collection and production

Only a designated, logged operator collects, using least-privilege read paths; no bulk export outside the approved route. Record: query, scope, who ran it, when, hash of the output, who reviewed. Counsel reviews before release. Produce the minimum responsive set in the form counsel approves. Do not produce another tenant's data; redact third-party personal data as counsel directs. Keep a copy of exactly what was produced.

## 6. Communication

External statements about a matter come from counsel or the authorised sender only. Internal discussion stays in the privileged channel counsel designates. No public commentary, no marketing claim changes (such as removing a statement) without checking with counsel whether that affects preservation.

## 7. Close-out

Counsel records disposition. Hold released only by counsel in writing (hold procedure). Retention of the matter file follows the records schedule; the privileged file is kept as counsel directs. Post-matter review: did the data map let us scope quickly? did a product behaviour create exposure? Update the registers.

## 8. Decision-rights table

| Step | Who decides | Who cannot |
| --- | --- | --- |
| Treat as demand and open matter | Coordinator | — |
| Comply / object / narrow | Counsel | Engineering, support, marketing |
| Notify customer or data subject | Counsel (with contract review) | Support on its own |
| Apply and release a hold | Counsel | Data owner alone |
| Collect and produce | Designated operator on counsel's instruction | Anyone else |

## 9. Open questions for counsel

Registered agent and service address · who receives process today · whether a litigation hold template is needed per matter type · outside-counsel panel and retainer · insurer notice conditions · handling of demands directed to institution customers that reach Semester-held data · cross-border demands · whether Semester wants a published transparency/legal-process policy.
