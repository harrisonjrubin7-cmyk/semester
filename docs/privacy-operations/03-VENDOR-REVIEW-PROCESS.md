# 03 · Vendor and subprocessor review process

**Status `DESIGNED`. 4 October 2026. Owner: privacy seat with the security owner (both vacant or interim).**

> Not legal advice. **Whether a party is a processor, subprocessor or independent controller, and what contract terms are required, are [COUNSEL REQUIRED].** The register of *who* is in [`SUBPROCESSORS.md`](../SUBPROCESSORS.md) (rendered from `app/src/lib/trust/subprocessors.ts`, 19 parties, held to the CSP and edge functions by `subprocessors.test.ts`). The security review method is in [`trust/VENDOR-SECURITY-REVIEW-PROGRAM.md`](../trust/VENDOR-SECURITY-REVIEW-PROGRAM.md) and [`trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md). This file is the **privacy** gate and cycle that sits in front of them. It does not duplicate their questions.

## 0. State today

Zero vendor reviews are complete. The register's *Last review* and *Owner* columns are blank, `docs/evidence/vendors/` does not exist, no provider contract is signed (D-147), and the shared AI key is off until provider-activation rows are recorded. `vendorrisk.test.ts` already **fails** if a row claims a review date or "assessed" without evidence, so the honest state is enforced.

## 1. Intake gate: nothing reaches personal data without passing it

A vendor enters the process when **any** of these happens. The author of the change opens the intake; the test catches only the first.

| Trigger | Detected by |
| --- | --- |
| A new host appears in the CSP, an Edge Function, or a gateway provider | `subprocessors.test.ts` fails |
| A deployment setting (`VITE_CLAUDE_PROXY`, `VITE_ICS_PROXY`, `VITE_OAUTH_PROXY`, `VITE_UNIVERSITY_GATEWAY_URL`, repository variables) points at a new third party | The build warning; **not** CI for repository variables |
| A **company-site or marketing** tool is added: script CDN, embed, form handler, email or SMS sender, CRM, scheduler, event tool | **Nothing detects this today** (see §6) |
| An institution configures a provider for its tenant | Tenant configuration review |
| An existing vendor changes terms, region, subprocessors, or breaches | Out-of-cycle trigger in `VENDOR-RISK-REGISTER.md` |

**Rule:** no personal data, test data derived from real people, or production credential goes to a vendor until the intake's status is `approved-for-use`. A pilot with synthetic data may proceed at `approved-for-test`.

## 2. Tiering

| Tier | Test | Examples | Depth |
| --- | --- | --- | --- |
| P1 | Receives T2+ data about identifiable people, in volume, or can read production data | Supabase, Anthropic (Semester key), Stripe, Resend, Vercel gateway | Full review and signed terms before use |
| P2 | Receives limited personal data (IP, email) or only static content | GitHub Pages, a script CDN, a map-tile host | Short review, terms reviewed, minimisation proven |
| P3 | Student-directed; Semester has no contract and does not receive the data | Google, Microsoft, Zoom, Apple, OpenStreetMap, push services | Disclosure accuracy only; no DPA; re-check the scope list yearly |
| P4 | Institution-directed | OpenAI via gateway, the institution's LMS | Institution's choice; Semester reviews the connection and the data class ceiling |

Misclassifying a P3 as P1 overstates control; misclassifying a P1 as P3 understates where data goes. Re-tier on any change to what is sent. Tiering is an engineering classification; **legal characterisation is [CR]**.

## 3. The privacy checklist (one page per vendor; the security questions live in the existing programme)

| # | Question | Evidence to attach | Fail means |
| --- | --- | --- | --- |
| 1 | What exactly is sent, by which code path, and what class (T0–T6) is the highest field? | Link to the code and the register row | Do not enable |
| 2 | Is it the minimum? Could a pseudonym, a hash, or nothing be sent? | Minimisation note | Reduce before use |
| 3 | Purpose limitation: do the vendor's terms allow it to use the data for its own purposes (training, analytics, advertising)? | Quote of the clause | Refuse for T2+ **[CR]** |
| 4 | Training and retention: stated retention, deletion on request, deletion on termination, deletion at our instruction | Terms, DPA | Record the tail in `RETENTION.md` |
| 5 | Region and transfer: where processed, where support staff access from | Provider documentation | **[CR]** transfer mechanism |
| 6 | Its subprocessors and how we are told of changes | Terms | Needed for the customer notice in §5 |
| 7 | Incident notice: how fast, to whom, in what form | Terms | Feeds 05 (vendor-incident intake) |
| 8 | Rights assistance: how it helps us honour access, erasure, restriction | Terms or support doc | Add to 02 §6 |
| 9 | Student-data terms: school-official or equivalent terms the institution will ask for | DPA-CHECKLIST row | **[CR]** |
| 10 | Minors: does anything go to a vendor for a 13–17 account that the in-app exclusions would block? | Code check | Block |
| 11 | Exit: how the data comes back or is destroyed | Terms | Plan in the offboarding doc |
| 12 | Fallback: does a native Semester path still work when the vendor is down or removed? | Test | Not "connected when available" |

Outcome is one of `approved-for-use`, `approved-for-test`, `conditions` (list them with dates), `refused`. **Counsel signs P1 and any P2 with a transfer or a training clause [CR].** The signed or reviewed terms and the checklist go in `docs/evidence/vendors/` together with an `ops/evidence.ts` record, which is also what unlocks a "reviewed" claim in the register.

## 4. Cycle

| Event | When | Who | Output |
| --- | --- | --- | --- |
| Intake review | Before first use | Author of the change + privacy seat | Checklist, outcome |
| Annual review | Each anniversary; P1 yearly, P2 every 18 months, P3 yearly scope check | Privacy seat | Updated row, dated |
| Terms-change check | Quarterly sweep of vendor terms and subprocessor lists | Privacy seat | Diff note |
| Out-of-cycle | Breach, acquisition, region move, price or terms change, new subprocessor | Anyone → privacy seat | Re-review within 14 days **(proposed; not a commitment)** |
| Offboarding | Vendor removed | Engineering + privacy | Deletion confirmation, register and CSP updated, PIA updated |

Calendar the dates in [`legal-drafts/LEGAL-COMPLIANCE-CALENDAR.md`](../legal-drafts/LEGAL-COMPLIANCE-CALENDAR.md); a review nobody has scheduled does not happen.

## 5. Change notice to institutions (subprocessor change)

If an institution agreement requires notice of subprocessor changes, the process is: privacy seat drafts the notice from the register diff; counsel approves the wording and the notice period **[CR]**; the notice is sent through the account owner; any objection is logged and routed to counsel. **No such notice or objection window may be promised** until the contract position exists. The public register must not change before the notice goes out.

## 6. Coverage gaps to close first

| Gap | Why it matters |
| --- | --- |
| Company-site hosting and third-party loads (`cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, YouTube-nocookie iframe, `i.ytimg.com`) are in no register | The register is driven by the *app's* CSP; the site has its own. The site says it sets no cookies and runs no third-party analytics: true for analytics, but these hosts still see visitor IP addresses |
| Resend is registered but its **site-form path** and **opted-in support path** have different data | Row exists; confirm the checklist covers both |
| No marketing, CRM, event or SMS vendor is approved, yet `gtm_consent` models email, SMS and push | Any future sender is a P1 intake on day one |
| `VITE_*` settings supplied as repository variables bypass CI | Add a deploy-time check or an owner attestation each release |
| `GitHub Pages` and `Vercel` are listed for the app and gateway only | Confirm the site's hosting is the same party or add it |

## 7. Adding a party touches four places

Adding or removing a row in `subprocessors.ts` forces (by test) matching entries in `SUBPROCESSORS.md`, `VENDOR-RISK-REGISTER.md`, and the `NAMED_AS` map for `docs/legal/PRIVACY-POLICY-DRAFT.md`. The intake record is the fifth, and the only one no test requires.
