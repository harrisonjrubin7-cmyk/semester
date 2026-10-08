# Vendor Risk Register (consolidated working view)

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL - NO VENDOR HAS BEEN ASSESSED, NO DPA IS SIGNED, NO PROVIDER IS APPROVED BY THIS DOCUMENT** |
| Owner | Harrison Rubin (interim vendor-management and privacy owner; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: security] [REVIEW: procurement] |
| Audience | Internal |

> Operating document, not legal advice. Inventory is not approval ([SUBPROCESSOR-GOVERNANCE-PROGRAM.md](../../trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md)). Vendors below are exactly the parties in `app/src/lib/trust/subprocessors.ts`; none was added from outside that list.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/trust/VENDOR-RISK-REGISTER.md](../../trust/VENDOR-RISK-REGISTER.md) | The canonical register: tiers, per-vendor data, region, public attestation (unverified), DPA on file, owner and review blanks; the six-step review method; out-of-cycle triggers; held to `subprocessors.ts` by `app/src/lib/trust/vendorrisk.test.ts` | One flat table with next-review dates, a rating column and a flow-down/exit prompt per vendor; a list of tools outside the register that need a decision | The canonical register is test-held and refuses a "reviewed" status without `docs/evidence/` proof; dated planning columns do not belong there |
| [docs/trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md](../../trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md) | Program rule and control map (`INCOMPLETE / NO PROVIDER APPROVED`) | Referenced for the approval record fields | Canonical |
| [docs/SUBPROCESSORS.md](../../SUBPROCESSORS.md) and `app/src/lib/trust/subprocessors.ts` | The 19 parties (count as generated in CONTROL-FACTS.md at revision 5eba494: 6 subprocessors, 2 institution-directed, 11 student-directed) | Mirrors every party | Source of truth |
| [docs/trust/PROVIDER-TERMS.md](../../trust/PROVIDER-TERMS.md) | Published AI provider terms read on 2026-09-29, quoted verbatim, "Nothing on this page is signed" | DPA-status column quotes its standing | Canonical |
| [docs/privacy-operations/03-VENDOR-REVIEW-PROCESS.md](../../privacy-operations/03-VENDOR-REVIEW-PROCESS.md), [docs/market-readiness/VENDOR-DUE-DILIGENCE-PACK.md](../../market-readiness/VENDOR-DUE-DILIGENCE-PACK.md), [docs/legal-drafts/VENDOR-PRIVACY-REVIEW-TEMPLATE.md](../../legal-drafts/VENDOR-PRIVACY-REVIEW-TEMPLATE.md) | Intake gate, due-diligence pack, review template | The review steps are not repeated; each High/Medium row points to them | Canonical |
| [docs/trust/DPA-CHECKLIST.md](../../trust/DPA-CHECKLIST.md) | Customer DPA requirements (`NOT_STARTED` as signed) | Flow-down column | Canonical |
| [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | CER-B10..B12, B19 | Linked | Same folder |

## Gate (what may be done now versus held)

| Item | Status |
| --- | --- |
| Reviewing vendors' public documents and obtaining reports under NDA | NOW |
| Describing the subprocessor register as a draft in discovery | NOW |
| Publishing the list as "approved" or "verified"; naming any vendor as approved by an institution | HELD |
| Sending real student or customer data to any vendor beyond what the current unpaid, invitation-only state already does | HELD for institutional data until reviews, DPAs and customer approval exist (blockers 4 and 7) |
| Any institution-specific approval of an AI provider | HELD (none has enabled one) |

## Entity fact to resolve first [REVIEW: counsel]

`docs/trust/PROVIDER-TERMS.md` says Semester has no legal entity yet and that no account is under a Semester entity; `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` records an owner attestation (2026-09-28) of a single-member LLC. The two are not reconciled in the repository. Vendor DPAs need a contracting entity, so this is a precondition for CER-B11 (GO-NO-GO blocker 5: entity facts).

## Rating and review rules

- **Rating** is the tier in the canonical register: **High** = subprocessor under Semester's account receiving student content or account data; **Medium** = subprocessor receiving request metadata only, or an institution-directed party; **Student-directed** = the student's own account at a service they connected (no contract, no vendor assessment; the review is that the privacy screen still says truthfully what goes there). No numeric score exists and none is invented.
- **Region** is [ASSUMPTION] unless the canonical register records a reading from the project. Only Supabase has one (us-west-2, read from the project on 2026-09-28).
- **Review status** `Not assessed` for every vendor today. A row may say reviewed only when the six steps have evidence under `docs/evidence/vendors/` (none exists).
- **Next review** dates are [ASSUMPTION]: High before any real-data pilot and no later than 2026-12-04 (end of days 31-60 in [CLOUD_SECURITY_PLAN.md](CLOUD_SECURITY_PLAN.md)); Medium by 2027-01-05; then annually and on any change of terms, region, ownership or product.

## 1. Register

| # | Vendor | Kind | Data touched (from `subprocessors.ts`) | Purpose | Region | DPA / terms status | Review status | Rating | Next review [ASSUMPTION] | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Supabase | Subprocessor | Account email and sign-in records; what a signed-in student chose to sync; usage counts; audit records (effectively the whole database) | Database, authentication, storage of synced rows, Edge Functions | us-west-2, read from the project 2026-09-28 [VERIFIED] `docs/trust/VENDOR-RISK-REGISTER.md` | None on file; vendor publishes a DPA to sign - to confirm and sign | Not assessed | High | 2026-12-04 | Harrison Rubin (interim) | `supabase/config.toml`; `app/src/lib/cloud.ts`; `RETENTION.md` |
| 2 | GitHub Pages | Subprocessor | Request metadata (IP address, user agent) when the app loads; no student content | Serves the static web app | Global CDN - to confirm [ASSUMPTION] | None on file; GitHub terms include a DPA - to confirm which applies | Not assessed | Medium | 2027-01-05 | Harrison Rubin (interim) | `.github/workflows/pages.yml` |
| 3 | Vercel | Subprocessor | Institution-scoped requests from signed-in members of a connected institution; encrypted action bodies (gateway not yet deployed) | Runs the institutional gateway as serverless functions | To confirm - function region is a project setting [ASSUMPTION] | None on file - to confirm and sign | Not assessed | High | 2026-12-04 | Harrison Rubin (interim) | `app/vercel.json`; `app/api/institution/[...path].ts` |
| 4 | Anthropic (Semester's key) | Subprocessor | The text of the AI request a student makes (e.g. a syllabus) | AI features for signed-in students without their own key, metered per account | To confirm [ASSUMPTION] | Published Commercial Terms and DPA recorded (no training; 30-day default retention; 48-hour breach notice) but **not in force**: no account under a Semester entity; none signed [VERIFIED] `docs/trust/PROVIDER-TERMS.md` | Not assessed | High | 2026-12-04 | Harrison Rubin (interim) | `supabase/functions/claude/index.ts`; `app/src/lib/privacy.ts` |
| 5 | Stripe | Subprocessor | Billing identity (name, email), plan and price; card data handled by Stripe alone; Semester keeps customer/subscription references; signed webhook events back | Payments for a paid plan; inactive until keys are set | Global, US-headquartered - to confirm [ASSUMPTION] | None on file; Stripe's Services Agreement includes a DPA - to confirm and countersign | Not assessed | High | 2026-12-04 | Harrison Rubin (interim) | `supabase/functions/billing-webhook/index.ts`; `docs/COMMERCIAL-CORE.md` |
| 6 | Resend | Subprocessor | Site-form contents and delivery address; for opted-in support replies, student email, a support reference and app link (never the reply body) | Transactional email; inactive until key and sender are set | To confirm [ASSUMPTION] | None on file - to confirm and sign | Not assessed | Medium | 2027-01-05 | Harrison Rubin (interim) | `supabase/functions/lead-intake/index.ts`; `supabase/functions/support-reply-notify/index.ts` |
| 7 | OpenAI (institution-approved) | Institution-directed | The student's request and approved sources, once an institution approves the provider | AI over approved course sources through the gateway | Per institution - to confirm [ASSUMPTION] | Institution's own agreement; published OSA, DPA and Student DPA recorded; **not in force** (no institution has enabled the provider; flow-down terms not written) [VERIFIED] `docs/trust/PROVIDER-TERMS.md` | Not assessed | Medium | 2027-01-05 | Harrison Rubin (interim) | `app/server/institution/providers/openai.ts` |
| 8 | The institution's LMS (LTI 1.3 platform) | Institution-directed | Launch verification traffic; a score only for a graded link the instructor placed | Course launch, deep linking, quiz score | The institution's | The institution's own LMS contract; LTI registration record per institution | Not assessed (institution's vendor) | Medium | Per institution | Harrison Rubin (interim) | `supabase/functions/lti/index.ts`; `supabase/lti.check.sql` |
| 9 | Anthropic (student's own key) | Student-directed | The student's AI request from their browser under their key | AI with a student-supplied key | n/a | None - no contract | Not assessed (student-directed) | Student-directed | 2027-01-05 (privacy-screen truth check) | Harrison Rubin (interim) | `app/src/lib/claude.ts` |
| 10 | OpenAI (student's own key) | Student-directed | Same, under the student's key | Same | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/openai.ts` |
| 11 | Microsoft | Student-directed | Whatever the student's account returns under the permission granted; writes only on request | Sign-in; the student's Outlook, OneDrive, To Do | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/connect.ts` |
| 12 | Google | Student-directed | Same for Calendar, Gmail, Drive, Tasks | Sign-in and the student's Google services | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/connect.ts` |
| 13 | Zoom | Student-directed | The student's own meeting list read in their browser | Connect Zoom meetings | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/connect.ts` |
| 14 | Apple | Student-directed | The sign-in exchange the student starts | Sign in with Apple | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/connect.ts` |
| 15 | OpenStreetMap tile servers | Student-directed | The student's IP address and the map area viewed | Map images | n/a | None - usage policy only | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/findplace.ts` |
| 16 | Nominatim and Photon (address lookup) | Student-directed | Text typed into the lookup box; position only if reverse lookup is on | Address to map position, only if the student turned lookup on | n/a | None - usage policy only | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `app/src/lib/geocode.ts` |
| 17 | Public institution source hosts | Student-directed | A request to the public URL the student chose; no Semester token, reflections or excerpt sent | Availability check of a public source | n/a | None - public access | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `supabase/functions/productivity-sourcecheck/index.ts` |
| 18 | Calendar and Canvas hosts the student links | Student-directed | The request to the address the student supplied, with the token they supplied | Relay a calendar feed or Canvas instance that refuses browser requests | n/a | None | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `supabase/functions/fetchcal/index.ts`; `supabase/functions/canvas/index.ts` |
| 19 | The student's browser push service | Student-directed | An encrypted notification for the student's device | Reminders the student switched on | n/a | None - the browser vendor's service | Not assessed (student-directed) | Student-directed | 2027-01-05 | Harrison Rubin (interim) | `supabase/functions/push/index.ts` |

## 2. Per-vendor follow-ups for High and Medium rows [DRAFT]

Use the six-step review in [docs/trust/VENDOR-RISK-REGISTER.md](../../trust/VENDOR-RISK-REGISTER.md) ("How a review is done"). Vendor-specific prompts:

| Vendor | First questions | Flow-down / exit prompt |
| --- | --- | --- |
| Supabase | Current SOC 2 report period and exceptions; confirm backup window and PITR on the project; confirm region; sub-processor list | Exit is `RESTORE.md`'s dump; confirm deletion on termination timing; a deletion replay after restore is Semester's job |
| Vercel | Function region setting; logging retention; whether the gateway will be deployed there at all (hosting decision, ARCHITECTURE.md C-4) | Confirm a flow-down for institution DPA requirements before deploying the gateway |
| Anthropic | Contracting entity (see Entity fact above); retention setting; no-training clause already published; flagged-content retention (published article says up to two years) | A fixed 48-hour breach window could be flowed down to an institution only once a DPA is signed |
| Stripe | PCI scope confirmation (Semester never sees card numbers); countersigned DPA; webhook secret handling | Export of customer/subscription references |
| GitHub Pages | Whether any request logs include student identifiers; DPA applicable | Static files are reproducible from the repository |
| Resend | What is retained from form and support-notice sends; region | Sender and key rotation per `SECRETS.md` |
| OpenAI (institution-approved) | Not Semester's contract: institution signs; Semester drafts flow-down terms | Per institution |

## 3. Tools in the repository outside the subprocessor register [DRAFT]

These appear in `.github/` or build files, are not in `subprocessors.ts`, and are listed so someone decides whether they are "ordinary dependencies" or parties that need a register row. Nothing is claimed about their data handling beyond what the cited file shows.

| Tool | Where it appears | What it plausibly touches (from the file) | Decision needed |
| --- | --- | --- | --- |
| GitHub (repository host, Actions, Dependabot, CodeQL) | `.github/workflows/*.yml`, `.github/dependabot.yml` | Source code and CI logs; repository secrets stored in GitHub Actions | Confirm treatment as an ordinary dependency versus subprocessor (the register lists only GitHub Pages) [REVIEW: privacy] |
| StackHawk (HawkScan) | `.github/workflows/hawkscan.yml`, `stackhawk.yml` | Scan results about a static preview; "scan results live in StackHawk"; API key is a repository secret | Confirm it never receives student data (scope is a static preview); record as a dependency or a vendor [REVIEW: security] |
| Gitleaks | `.gitleaks.toml`, `ci.yml` | Runs inside CI; downloaded binary checked against a published checksum | Ordinary dependency |

## 4. Triggers for an out-of-cycle review

A new party in `subprocessors.ts` (the test forces a row in the canonical register); a vendor breach notice, ownership change, or change to its DPA or subprocessor list; a change of region, plan or product that moves where data is processed; a new institution whose agreement adds a requirement; any Edge Function that starts calling a new host.

## Evidence state

All vendor facts are copied from the canonical register and `subprocessors.ts` at `5eba494`. No attestation has been read, no DPA signed, no region confirmed except Supabase.

## Claim ceiling

Permitted: "Semester maintains tested technical party and draft vendor-risk inventories." (SUBPROCESSOR-GOVERNANCE-PROGRAM.md). Not permitted: approved subprocessors, verified attestations, signed DPAs, residency, zero retention, no training, complete deletion.

## Prohibited claims

"Our vendors are SOC 2 compliant" (vendors state it publicly; none read), "data stays in the US", "no data is used for model training" as a Semester assurance, "approved by [institution]".

## Professional review required

Counsel [REVIEW: counsel] for entity, DPAs and flow-down; privacy lead [REVIEW: privacy] for roles and regions; security reviewer [REVIEW: security] for attestations; procurement reviewer [REVIEW: procurement] for customer approvals. None named in the repository.
