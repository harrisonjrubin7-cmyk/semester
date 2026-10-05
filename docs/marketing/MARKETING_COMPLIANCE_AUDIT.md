# Marketing compliance audit

Date: 2026-10-05. Scope: public claims and content assets on `company-site/` and
`app/src/site/`, read against the controlled register
([`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md),
CLM-001–018), the copy register in
[`docs/gtm/BRAND-AND-MARKETING-STRATEGY.md`](../gtm/BRAND-AND-MARKETING-STRATEGY.md) §8.2,
the older [`docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md`](../legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md)
(C-01–C-15) and [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md).

**This audit approves nothing and changes no copy.** Classification states what
the evidence supports; it is not an approval. Where evidence or authority is
unclear the rule from the register applies: do not publish. Quotes are exact; line
numbers are from the survey at `790ebbf` and have drifted in places, so match on the text.

## 1. Classification vocabulary

`V` Verified and approved · `VR` Verified but needs review date · `D` Draft/internal
only · `ME` Missing evidence · `S` Stale · `DUP` Duplicate · `U` Unsupported: remove or
rewrite · `L` Requires legal review · `SEC` security review · `P` privacy review ·
`A` accessibility review · `CA` customer approval · `LP` logo permission · `TD` testimonial
disclosure.

**Count of `V` across everything below: zero.** The only approval recorded anywhere
is CLM-001's Product/Engineering approval for *controlled demo or internal use*. No row
in the controlled register is approved for unrestricted public use, and the copy
register has no row at status "Available now".

## 2. Claims found on the live surfaces

| # | Where | Exact text | Class | Why |
| --- | --- | --- | --- | --- |
| 1 | index.html:247 | "Private by design · Source-aware · Built for accessibility" | `ME` `A` `P` `L` | "Built for accessibility" sits beside the site's own statement that no manual screen-reader pass has happened. CLM-007 allows only the named automated-guard scope; CLM-008 prohibits conformance language. "Private by design" has no approved wording (CLM-009 needs exact controls and revision). "Source-aware" is CLM-018, proposed not approved |
| 2 | index.html:621 | "Annual · save 38%" | `U` | CLM-015 prohibits discount/savings; also C-02. **Remove or rewrite** |
| 3 | index.html:624, 637 | "$59 / year"; "Plus: $7.99 a month or $59 a year (planned; not yet on sale). Pro: priced at launch." | `ME` `L` | Amounts exist in the anon catalog, but approval is not recorded (M-14 ✋; CLM-015 `[PRICE TO BE CONFIRMED]`). The "planned; not yet on sale" qualifier is the only thing keeping it inside the register |
| 4 | index.html:645 | "Everything stays. Export and deletion are free on every plan, forever." | `U` `L` | "Forever" is an unbounded commitment (C-03) |
| 5 | index.html:660 | "From $15K / yr (<5K students) · $35K (5–20K) · $75K (20K+)" | `U` `L` | Institutional price floors; CLM-015; C-01. GO-NO-GO: paid pilot and broad sale are NO-GO. **Remove** until a price book is approved |
| 6 | index.html:662 | University OS "24/7 operations" | `U` | Contradicts the same site's "no 24/7 rota yet" and "there is one responder"; CLM-016 prohibits; C-05 |
| 7 | index.html:672 | "No hidden cancellation: Cancel from your account in two clicks." | `ME` `L` | Click-count claim with no UAT evidence (C-03 family); billing is held |
| 8 | index.html:2667 vs pricing | "24/7 on-call: there is one responder" | — | Internal contradiction with #6; keep the honest line, remove the other |
| 9 | index.html:~354 | "Semester doesn't use your course materials to train models" | `ME` `P` `L` | Absolute AI data claim; CLM-012 prohibits "non-training" absolutes. Needs provider-term evidence per provider |
| 10 | index.html:~347 | "Never presented as an official decision" | `VR` `P` | Scoped design statement; backed by source labelling, but "never" needs a test reference |
| 11 | index.html:~515 | "Today it does not replace your SIS, LMS, degree audit or official records" | `VR` | Matches CLM-006 corrective position; keep |
| 12 | index.html:~419 | "Semester has no customer outcome claims yet." | `VR` | A true negative statement. Keep until an approved case study exists, then change it |
| 13 | index.html:436–445 | Stats 75% / 55% / 47.5% / "#1 requested feature: one place for every deadline" | `ME` `L` | Third-party survey figures "as summarised in Semester's market analysis". Needs the original source, population, date and publisher permission, and must not read as a Semester result |
| 14 | site.js:783 | "99.9% sample tenant uptime, 68% plan completion, 412 of 612 activated" | `U` | Labelled "Sample figures, not measurements" (C-15). Uptime-shaped numbers conflict with CLM-016 even when labelled; **recommend removal** |
| 15 | site.js:743 | "Internal security, privacy and accessibility audit completed: 18 findings, 4 launch blockers" | `ME` `SEC` | Untraceable count (C-08); no linked artifact |
| 16 | site.js:746, 651, 737 | "FERPA-aligned processing" | `L` `P` | CLM-010 prohibits FERPA "approved"; "aligned" is only supportable beside the alignment assessment, counsel and a signed DPA, which are pending |
| 17 | site.js:748–755 | Compliance rows: SOC 2 "Readiness assessment published · independent audit report pending"; ISO 27001 "Gap assessment published · not certified"; HECVAT "Draft response published…"; VPAT/ACR "Self-assessment published · formal… ACR pending"; WCAG 2.2 AA "Automated audit evidence published · no conformance claim"; FERPA "Alignment assessment published…" | `VR` `SEC` `A` `L` | Text is carefully qualified, **but all six render with the same green `st-av` "available" badge**, which reads as achieved. Visual state contradicts the text. Fix the badge before anything else on this table |
| 18 | trust page ~690 | "Green means a dated assessment or response is published and reviewable. It does not mean certified…" | `VR` | Honest, but it concedes the green badge means something other than what visitors assume |
| 19 | trust page ~712 | Commitments: no sale of Customer Student Data; no training of generalized or third-party models on identifiable data without separate written authorization; no AI official academic decisions; "Claim a certification or audit we don't hold" | `L` `P` `ME` | Contract-like promises. Need to be tied to a signed DPA or approved policy, not a marketing page |
| 20 | trust page | "Last formal audit: Not yet conducted · planned before general availability"; "VPAT / ACR: Will be published after the formal audit" | `VR` | True and appropriate; dates need an owner |
| 21 | accessibility page ~1443 | "We design and test toward WCAG 2.2 AA…" | `VR` `A` | Acceptable "toward" form (CLM-007) **only** with the scope and the no-ACR statement kept adjacent |
| 22 | accessibility page ~1446, 1458 | "1 high-impact known issue · 4 lower-impact known issues"; "axe-core (WCAG 2.0–2.2 A/AA and best practice)… No manual screen-reader pass yet" | `VR` `A` | Counts need a ledger link (`accessibility-issue-ledger.csv`) and a date. Evidence is desktop, 28 Sep |
| 23 | footer 3223; ~1443 | "Built at Vanderbilt"; "Founded 2026, Vanderbilt University" | `L` | University name and affiliation; C-11. Requires institutional permission (CLM-013-adjacent) and trademark review |
| 24 | index.html:247 / schema | JSON-LD `Organization` with `email: harrisonjrubin7@gmail.com`, founder, 3 `sameAs` | `ME` | Contact address in structured data is the company mailbox (owner-confirmed non-personal); the entity facts (founder, `sameAs`) are still unapproved (company-site-audit gap) |
| 25 | pricing, Pro button | "Join the waitlist" | `U` | Links to the contact form; **no waitlist exists** |
| 26 | pricing | Free: "Unlimited courses. Reading a syllabus uses AI, which has a monthly limit per account" | `VR` | Honest; limit is 60 generations per account per month (`supabase/functions/claude/index.ts:36`). Re-verify the number at each review |
| 27 | status page | "Up means this browser reached the service just now. It is not an uptime percentage" | `VR` | Good; CLM-016 satisfied |
| 28 | banner | "Semester is in a private beta · Prices are planned, not yet live · Request an invite" | `VR` | Matches CLM-003. Must change the moment the beta status does |
| 29 | home | Illustrative demo data chips; "Captured Oct 3, 2026 · Public fictional-data demo" | `VR` | Correct labelling pattern; keep and standardize |
| 30 | `#compare`, `#why-semester` | "Separate portals…" vs "One source-aware student action layer"; "Generic AI chat" vs course-aware | `ME` | No named competitor, but a comparison claim. Needs a sourced, dated evidence entry |
| 31 | sales audit (site.js:762) | ✓ "No unsupported SOC 2 / ISO / FERPA / WCAG claims" | `U` | A self-attested ✓ on the claims audit that this audit contradicts (rows 1, 16, 17). Remove the tick |
| 32 | resources page | "Case studies: None y[et]" | `VR` | True negative |
| 33 | all | Testimonials, customer logos, "trusted by", named institutions | — | **None found.** CLM-013 is prohibited today; the absence is correct |

## 3. Pricing in the data layer (public data exposure)

- `commercial_prices` active rows are anon-readable: free `$0/mo`; plus `$7.99/mo`
  (799) and `$59/yr` (5,900) after `20260929131000_plus_price.sql` (D-134); **pro has no row**;
  institutional plans are `quote` rows with a null amount.
- `plans.ts` mirrors it (`monthly: 7.99, yearly: 59`); `plans.test.ts` and
  `companysitepricing.test.ts` hold the mirror.
- **There is no approval column.** The register's CLM-015 says `[PRICE TO BE CONFIRMED]`
  and M-14 is ✋ "Decided (D-134); approval record open". Anything that renders catalog
  prices as approved would assert an approval the repository does not record. Any new pricing
  page must render price **only** when an approval record exists, and otherwise show
  "request pricing". See [`LEAD_INTAKE_AND_CONSENT_SPEC.md`](LEAD_INTAKE_AND_CONSENT_SPEC.md) §7 and
  [`MARKETING_SITE_BACKLOG.md`](MARKETING_SITE_BACKLOG.md) item P0-08.

## 4. Defects that are not wording

| ID | Defect | Severity |
| --- | --- | --- |
| F-01 | **[checked]** `security_report` and `privacy_request` are not `cta_routes` keys; both forms 400 | High: the vulnerability-report and privacy-request paths are broken |
| F-02 | Compliance rows share the "available" green badge | High: visual claim contradicts text |
| F-03 | `lead-intake` stores no consent version/timestamp, checks no suppression, writes no audit event, has no structured attribution | High for the lead-intake requirement; Medium as a standing risk (an opt-in is recorded only as a field) |
| F-04 | Catch-all rewrite: unknown URLs return 200 + the home shell; canonical/title set by JS; no `<noscript>` | Medium (SEO and A11y: blank page without JS) |
| F-05 | `app/src/site` never sets canonical/OG/sitemap (no `SITE_ORIGIN`) | Medium |
| F-06 | CSP `script-src` still allows cdnjs and jsdelivr plus an unused hash | Low–Medium |
| F-07 | All product CTAs point to a personal GitHub Pages host | Medium (trust, link rot, no custom domain) |
| F-08 | One mailbox (`harrisonjrubin7@gmail.com`, owner-confirmed non-personal) is the public contact, the form fallback and the JSON-LD email. Not a defect in itself; the open question is operational: who monitors it, who else has access, and whether a stated response time can be kept | Low (continuity) |
| F-09 | "Join the waitlist" with no waitlist | Medium (deceptive-path pattern) |
| F-10 | `claims_register` and `content_register` empty and unread; the markdown is the only control | Medium: the "publishes only approved content" requirement has no runtime enforcement |
| F-11 | `sitemap.xml` is hand-maintained and omits two views | Low |
| F-12 | Dark-only theme, no `prefers-color-scheme`, no light theme | Low–Medium (A11y preference, WCAG 1.4.x is not violated by dark-only itself) |
| F-13 | `og:title` ≠ `<title>`; no `og:image` | Low |

## 5. FTC testimonial / endorsement surface

No testimonial, review, endorsement, "trusted by", logo or case study is published.
No incentive programs are described that condition on sentiment. Ambassadors,
`refer` and `fellows` pages exist on company-site; **the relationship-disclosure
requirement applies to any content those programs produce** and no disclosure mechanism
exists yet. Policy: [`FTC_TESTIMONIAL_AND_CLAIMS_POLICY.md`](FTC_TESTIMONIAL_AND_CLAIMS_POLICY.md).

## 6. Review routing

| Item | Owner of decision | Reviewers still unassigned |
| --- | --- | --- |
| Rows 2, 4–7, 13, 14, 25, 31 (remove/rewrite) | Claim owner (H. Rubin) | none needed to *remove* |
| Rows 1, 16, 17, 21, 22 | Claim owner | Accessibility, Legal, Privacy |
| Rows 9, 19, 23, 24 | Claim owner | Legal, Privacy, Security |
| Row 3 and the data layer | Founder/Finance | Tax, Legal |
| Everything | Counsel is **unassigned** in the register | Counsel |

## 7. What this audit recommends but does not do

Removal and rewrite of rows 2, 4, 5, 6, 14, 25 and 31 and the badge fix (F-02) are
independent of any new build and reduce exposure today. They are listed as
backlog items P0-01 to P0-03 and need the claim owner's go-ahead because they edit
production copy; this phase does not touch it.
