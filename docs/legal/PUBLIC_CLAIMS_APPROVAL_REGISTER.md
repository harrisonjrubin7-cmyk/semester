> **DRAFT FOR QUALIFIED LEGAL REVIEW. Working list, not legal advice. It approves no public claim.**

# Semester — public claims approval register (program view, Phase 0)

| Control | Value |
| --- | --- |
| Date | 2026-10-04 (America/Chicago) |
| Status | **PROGRAM VIEW. The controlled register is [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (CLM-001…CLM-018), enforced by `app/src/lib/ops/claims.test.ts`, with the site-claim ledger in `ops/claims/README.md` (40 claims; 0 "Available now", 0 "Limited beta").** This page does not approve, withdraw or reword any claim. |
| Withdrawal procedure | [`docs/CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md) |
| Approvers | Claims owner: Harrison Rubin. Counsel and specialist approvers **unassigned** |

## 1. The program's prohibited claims → controlled classification

The program prohibits these public claims unless the specific claim has evidence and approval.

| Prohibited claim (program §1) | Controlled row | Evidence available today | Result |
| --- | --- | --- | --- |
| "replaces every university system" | CLM-006 PROHIBITED | none; `ADAPTERS=[]` (V) | **Do not publish** |
| "fully compliant" / FERPA, COPPA, GDPR, PCI, SOC 2, HIPAA, ISO 27001 | CLM-010 PROHIBITED | none | **Do not publish** |
| "secure by default" | CLM-010 | none; independent assessment absent | **Do not publish** |
| "official grades" | CLM-006 and records rows | `gradebook_release` exists; no tenant | **Do not publish** |
| "guaranteed" | CLM-010, CLM-015 | none | **Do not publish** |
| "works with every institution" | CLM-006/017 | zero adapters (V) | **Do not publish** |
| "institution-ready" | CLM-010, `GO-NO-GO-DECISION.md` | paid/broad institutional = NO-GO | **Do not publish** |
| "replacement-ready" | CLM-006 | none | **Do not publish** |
| VPAT / ACR / WCAG conformance | CLM-008 PROHIBITED | no VPAT in repo; no manual assessment | **Do not publish** |
| Pricing, discount, savings, paid availability | CLM-015 PROHIBITED / `[PRICE TO BE CONFIRMED]` | no approved price book; checkout held (V) | **Do not publish** |

## 2. Phase 0 scan of the live public surface

Scan scope: `company-site/index.html`, `company-site/site.js`, `app/src/site/*.tsx`. Searched for the program's prohibited phrases. **No hit for** "FERPA compliant", "SOC 2" as a held credential, "secure by default", "works with every", "institution-ready", "HIPAA", "official grades". The surface is otherwise conservative; `ops/claims/README.md` reports 0 claims "Available now".

| # | Location | Text (abridged) | Controlled row | Finding | Action | Mark |
| --- | --- | --- | --- | --- | --- | --- |
| PC-1 | `company-site/index.html:621` | "Annual · save 38%" | CLM-015 | A **savings figure** derived from $7.99/$59, a price CLM-015 prohibits publishing, and which D-1154 supersedes | Withdraw or obtain approval (PL-03) | V |
| PC-2 | `company-site/index.html:623`, `:637` | Plus "$7.99 a month or $59 a year (planned; not yet on sale)" | CLM-015; `no-sale` | A published price against CLM-015, labelled planned | Counsel + finance decide (PL-03) | V/A |
| PC-3 | `company-site/index.html:660` | Institution "From $15K / yr (<5K students) · $35K (5–20K) · $75K (20K+)" | **none** | **Uncovered by any register row**; conflicts with finance model, `deal-desk.ts`, `launchkit.ts`, D-1154 | Withdraw until a price book exists (PL-03) | V |
| PC-4 | `company-site/site.js:48` | "Every screen uses Semester's source labels, student-controlled sharing and WCAG 2.2 AA standards." | CLM-007/008 | Reads as conformance for **every screen**; the rest of the site says "built toward / target / not a WCAG audit" | Reword to a target (PL-04) | V |
| PC-5 | `company-site/site.js:737` | "Are you FERPA compliant?" → "…FERPA-aligned contractual and technical controls" | CLM-010 | "Aligned" is not "compliant" but sits next to a compliance question; counsel to approve wording | PL-05 | V |
| PC-6 | `company-site/site.js:605` | Trust-center row "Student data addendum — FERPA-aligned term…" status "Draft published" | CLM-010 | Status wording present; counsel to confirm | PL-05 | V |
| PC-7 | `company-site/index.html:~1192` | "No new module launches unless it replaces, improves or connects an existing workflow" | CLM-006 | Internal scope rule on a public page; reads as a replacement claim | Reword | A |
| PC-8 | `app/src/site/more.tsx:157`; `index.html:517,518,2506,2946` | "does not replace your SIS/LMS" | CLM-006 | **Compliant** (negation, covered) | none | A |
| PC-9 | `index.html:2572,2668` | SOC 2 "Later / Required… (months)" | CLM-010; `soc2` Planned | **Compliant** (planned, not held) | none | A |
| PC-10 | `index.html:1443,1453-1458,2430`; `app/src/site/render.tsx:49`, `pages.tsx:500` | "built toward / WCAG 2.2 AA target… not a WCAG audit"; VPAT "planned" | CLM-007/008 | **Compliant** | none | A |

## 3. Claims the product's own code or docs make

| # | Location | Statement | Issue | Mark |
| --- | --- | --- | --- | --- |
| PC-11 | `ops/billing/README.md` | "The owner confirmed legal and independent reviews complete on 2026-10-01" | Contradicts `LEGAL-REVIEW-QUEUE.md` Q-00 (counsel unassigned). Treat as unreviewed self-attestation (PL-01) | A |
| PC-12 | `docs/DEFINER-RLS-REGISTER.md` B13 | "Restore drills and rollback" status **held** | The drill has never run (`RESTORE.md` L295–307, V). "Held" means procedure + tests exist, but reads as readiness | V |
| PC-13 | `app/src/lib/plans.ts` | "Plus and Pro are planned, not on sale" | **Compliant**; `salecopy.test.ts:18` holds the hold | A |

## 4. Claims the program wants to make, and the evidence each still lacks

None of these may be said today. Each needs the listed evidence **and** a controlled-register row with an approver.

| Desired claim | Missing evidence |
| --- | --- |
| "Market-launched" | A supported launch: staffed support, status, drills, price authority, counsel-approved terms |
| "Pilot-ready" | Named customer, executed paper, target-tenant isolation test, one adapter, drills on target |
| "Contract-ready" | Counsel-approved MSA/DPA/pilot forms, entity, price book, authority matrix |
| "Institution-ready" | All paid-pilot gates + independent assurance (`GO-NO-GO-DECISION.md`: RED) |
| "Mass-user-ready" | HTTP-level load/soak, telemetry, rota, SLOs, capacity proof (`sre/capacity.ts` "unproven") |
| "Secure" | Independent assessment, clean DAST, no open P0/P1 (FR-003/004) |
| "Accessible" | Qualified manual evaluation + approved ACR/statement (FR-007) |
| "Operational" | On-call rota, tested paging, hosted status with history |
| "Replacement-ready" | Never without authority, migration, reconciliation, recovery and customer approval (CLM-006) |

## 5. Decision for the claims owner

Adopt PC-1…PC-7 and PC-11/PC-12 into `ops/claims/README.md` and `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` as either **corrected** or **withdrawn**, using the withdrawal runbook, *before* any outbound campaign. Phase 0 changes no public copy.
