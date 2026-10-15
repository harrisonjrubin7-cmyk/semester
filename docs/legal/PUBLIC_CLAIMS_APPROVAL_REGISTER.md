# Public claims: Phase 0 reconciliation view

> **Not legal advice. Every item below is a question for qualified counsel (and, where marked, an accountant, accessibility assessor or the claim owner). Nothing here approves, withdraws or edits any public claim.**

| Field | Value |
| --- | --- |
| Purpose | Find public and in-app statements that exceed the evidence the repository holds, and reconcile them with the controlled register. Adds findings; does **not** copy the register |
| Controlled register (authoritative, linked not copied) | [`../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (CLM-001 to CLM-018); withdrawal procedure [`../CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md); machine register `app/src/lib/ops/claims.ts` (40 capability claims) rendered and checked by `app/src/lib/ops/claims.test.ts` |
| Scope | `company-site/index.html` (3,238 lines), `company-site/site.js` (1,585 lines), app copy under `app/src` |
| Date | 2026-10-04 |
| Status | **Phase 0 baseline — evidence-cited, not a readiness claim** |
| Method | `git grep -n -I -i -E` over the site and `app/src` for compliance, security, FERPA, SOC 2, WCAG, "replace", price, customer, uptime and outcome words; reading each hit in context; comparing against CLM rows and `claims.ts` statuses (`awk` count: 0 of 40 claims are `available`) |

## 1. Where the two registers stand

| Check | Result | Evidence |
| --- | --- | --- |
| Capability claims promoted above evidence in `claims.ts` | None found: 1 `built-tested`, 19 `in-preparation`, 20 `planned`, 0 `available` | `app/src/lib/ops/claims.ts:123-647`; `problems()` at `claims.ts:737` refuses overstated claims |
| Site refuses "replace" claims | Yes: "Today it does not replace your SIS, LMS, degree audit or official records" | `company-site/index.html:515-520`; matches CLM-006 |
| Site states no customers | Yes | `company-site/index.html:445` ("Semester has no customer results yet"); CLM-013 |
| Site states SOC 2 / ISO not held | Yes | `company-site/site.js:948`, `site.js:938`; CLM-010 |
| What the machine register does **not** cover | Prices, savings, timelines, support hours, affiliation, third-party statistics, taglines | `claims.ts` header ("What is not a claim": numbers are held by `site.test.tsx` and `plans.test.ts`) |

The findings below are therefore mostly in categories the machine register leaves to other tests. Whether `app/src/site/site.test.tsx` and `plans.test.ts` guard them was **not** established (tests not run in Phase 0).

## 2. Claims that exceed evidence

Severity: P1 = must be resolved before any pilot or invitation; P2 = resolve before broader publication. "Register" = the controlled-register row the statement collides with.

| # | Sev | Where (path:line) | What it says | Why it exceeds evidence | Register | Counsel question |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | P1 | `company-site/index.html:660`; `company-site/site.js:360` | Semester Access "From $15K / yr (<5K students) · $35K (5-20K) · $75K (20K+)" | A published institutional price. Appears in no document, model or code (`git grep '15K'` finds only these two lines); the deal-desk campus minimum is $75,000 (`app/src/lib/governance/deal-desk.ts:36`); `docs/commercial/PRICING-AND-PACKAGING.md` says no price may be published or quoted without a dated decision | CLM-015 (PROHIBITED) | Price publication, offer/acceptance exposure for public-sector buyers, procurement-law treatment of a published list price |
| C-02 | P1 | `company-site/index.html:621` | "Annual · save 38%" toggle | A savings claim. Arithmetically $59 vs 12 x $7.99 = $95.88 is 38.5%, but CLM-015 prohibits "price, discount, savings" and the same page says Plus is not on sale (`index.html:616`). Added deliberately in commit `d1f7c97` (2026-10-04) | CLM-015 | Is a "save X%" comparator allowed on a not-yet-sold plan; comparative-price substantiation rules by state |
| C-03 | P1 | `company-site/index.html:644-645`, `index.html:2429`, `index.html:1218` | Cancel "in two clicks"; "Everything stays. Export and deletion are free on every plan, forever" | "Forever" and "two clicks" are absolutes. Cancellation flow live-accepted for monthly only (`docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`); refund, failed-renewal and dispute paths not exercised; refund policy is a draft (`REFUND-AND-CANCELLATION-POLICY-DRAFT.md`) | CLM-015 | Auto-renewal and cancellation disclosure rules; wording of "forever" against the seven-year financial-record retention (`docs/COMMERCIAL-CORE.md` "Financial retention") |
| C-04 | P1 | `company-site/index.html:247` | Trust line: "Private by design · Source-aware · Built for accessibility" | "Built for accessibility" next to a product with no manual assistive-technology review (`claims.ts` `a11y-human` is `in-preparation`; `docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md` "Claims no conformance"). "Private by design" is a privacy-law term of art in some regimes | CLM-007, CLM-008, CLM-010 | Whether these taglines are puffery or a representation under accessibility and privacy law |
| C-05 | P1 | `company-site/index.html:662`; `company-site/site.js:32-33`, `site.js:346`, `site.js:848` | University OS scope "24/7 operations"; "24/7 P0/P1 support" listed as a feature; "Dedicated team; 24/7 critical once staffed" | The same site says "The founder... There is no 24/7 rota yet" (`index.html:1717`) and "24/7 on-call: there is one responder" (`index.html:2667`); `docs/trust/SLA.md` is `NOT_STARTED`. Some lines hedge ("once staffed" at `site.js:361`), others do not | CLM-016 (PROHIBITED) | Whether unhedged listing of 24/7 support in a package table is a service-level representation |
| C-06 | P1 | `company-site/site.js:360`; `company-site/index.html:593-601` | "Pilot in 6-8 weeks; institution launch in 8-12"; "Week 6 UAT" timeline | Pilots are fixed at 26 weeks (D-134, `docs/PAID-PILOT-FRAMEWORK.md`); no delivered implementation exists to support an 8-12 week figure | CLM-017 (roadmap: avoid dates) | Statement as a delivery commitment in a public-sector procurement context |
| C-07 | P2 | `company-site/site.js:743` | Trust update "Dated SOC 2, ISO 27001, HECVAT, VPAT/ACR, WCAG and FERPA evidence index published" | Lists the frameworks by name as published evidence while `site.js:948` says SOC 2 report "not held" and ISO certificate "not held". Qualified in the next field, but the headline is the claim a reader keeps | CLM-010 | Whether a headline naming SOC 2/ISO/FERPA is acceptable when each row is "readiness" |
| C-08 | P2 | `company-site/site.js:743` | "Internal security, privacy and accessibility audit completed: 18 findings, 4 launch blockers" | The figures appear nowhere else in the repository (`git grep -E '18 findings\|4 launch blockers' -- . ':!company-site'` is empty). Untraceable number on a trust page | CLM-009 | None legal until sourced; the claim owner must source it or withdraw it per `CLAIM-WITHDRAWAL-RUNBOOK.md` |
| C-09 | P2 | `company-site/site.js:651`, `site.js:737`, `site.js:754` | "Semester provides FERPA-aligned contractual and technical controls"; "FERPA-aligned processing" | Better than "compliant", and says "never FERPA certified". But CLM-010 refuses "FERPA ... approved" and `LEGAL-REVIEW-QUEUE.md` Q-04 lists school-official/vendor status as unanswered. "Aligned" is undefined | CLM-010 | Whether "FERPA-aligned" is permissible before the Q-04 memo |
| C-10 | P2 | `company-site/index.html:440-445` | 75% / 55% / 47.5% student statistics | Third-party survey figures with the source named in a note (`index.html:445`), "as summarised in Semester's market analysis". Provenance depends on an internal document, not the survey | CLM-014 (adjacent) | Attribution and permitted use of third-party survey data in marketing |
| C-11 | P2 | `company-site/index.html:872`, `index.html:1565`, `index.html:3223`, JSON-LD at `index.html:19` | "Founded 2026, Vanderbilt University"; "Founder · Vanderbilt University"; "Built at Vanderbilt" | Use of a university's name in company copy with no permission record in the repo. The queue already asks about contributor/university IP policy (Q-01) but not about name use. Also the JSON-LD `email` is a personal mailbox | CLM-013 (named institution; adjacent) | University name/mark licence; whether "built at" implies affiliation or endorsement; ownership under any university IP policy |
| C-12 | P2 | `company-site/index.html:208`, `236`, `243` (and others) | "Start planning free" / log-in links point to `harrisonjrubin7-cmyk.github.io/semester` | The signup and account host is a personal GitHub Pages address, while the site presents a company. Not a claim; an identity and terms-of-service question | none | Entity/domain ownership (Q-01), controller identification in the privacy notice |
| C-13 | P2 | `app/src/lib/privacy.ts:231` | In-app: "no archive kept after you delete your account. Nothing is used to train anything." | Absolute statements; `RETENTION.md` has a backup-tail position. Already queued as Q-09 row "Deletion wording versus backup tails" and COUNSEL-BRIEF H8 | CLM-012 | Already queued: approve wording that matches behaviour |
| C-14 | P2 | `company-site/index.html:623`, `index.html:641` | Free plan: "Unlimited courses. Reading a syllabus uses AI, which has a monthly limit per account" | Commit `268c60a` already corrected "unlimited syllabi". The in-app allowance copy says "60 a month" but the dollar meter (D-1231) can bind first, which D-1231 names as an activation precondition | CLM-015 | Disclosure of AI usage limits and metering to consumers |
| C-15 | P2 | `company-site/site.js:783`, `site.js:777`, `site.js:785` | Sample uptime 99.9%, 68% plan completion, "412 of 612 activated" | Labelled "Sample figures, not measurements" (`site.js:783`). Sample figures that resemble results are a known risk; label placement matters | CLM-014, CLM-016 | Whether the label is sufficient where the figure is displayed alone (accessibility of the disclosure) |

## 3. Prices stated publicly versus the pricing targets

| Public statement | Path:line | Recorded fact | Note |
| --- | --- | --- | --- |
| Plus $7.99 / month or $59 / year (labelled planned) | `company-site/index.html:637`; `company-site/site.js:146,358` | D-134; `app/src/lib/plans.ts:58` | Consistent with the repo. Differs from the audit target of $8.99 / $69 (see `commercial/READINESS_GAP_MATRIX.md` section 1) |
| Semester Access floors $15K / $35K / $75K | `company-site/index.html:660` | none | See C-01 |
| Pro "priced at launch" | `company-site/index.html:626,637` | no price in `plans.ts` | Consistent |

## Open questions / not verified

- `app/src/site/site.test.tsx` and `plans.test.ts` were not run; whether they already refuse C-01 or C-02 is unknown. Any fix to the site or `claims.ts` is outside Phase 0.
- No browser rendering was done: claims added by `company-site/site.js` at runtime (the Trust Center rows) were read from source, not seen on screen.
- Whether the claim owner has approved any of the wording above: the controlled register records approvals; none of C-01 to C-15 is registered as a CLM row.
- All "counsel question" cells are questions, not conclusions.
