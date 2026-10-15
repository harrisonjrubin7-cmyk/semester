# Vendor Risk Register

**No vendor on this list has been risk-assessed yet.** Every row below is the
starting point for an assessment, not the result of one: the attestation column
records what each vendor says about itself publicly and marks it *to confirm*,
because no report has been obtained and read; the DPA column records what is on
file, which today is nothing; and the owner and review-date columns are blank
because nobody has done a review. A procurement reviewer should read this as a
list of the work, with the work not started.

The parties are exactly those in [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md),
whose source of truth is `app/src/lib/trust/subprocessors.ts`.
`app/src/lib/trust/vendorrisk.test.ts` fails if a party is added there and not
here, if a row here names a party that is gone, or if any row claims a review
date or an assessed status while `docs/evidence/` holds no assessment.

## Tiers

The tier is set by what reaches the vendor and on whose decision, which is the
same split the subprocessor register makes:

| Tier | Meaning | Review |
| --- | --- | --- |
| **High** | A subprocessor under Semester's account that receives student content or account data | Before a pilot with real students, then yearly, and on any change of terms, region or ownership |
| **Medium** | A subprocessor that receives request metadata only, or an institution-directed party the institution chose and contracts with | Before a pilot, then yearly |
| **Student-directed** | The student's own account at a service they connected. Not a subprocessor; Semester has no contract with it | No vendor assessment. The review is that the privacy screen still says truthfully what goes there before it happens |

## The register

| Party | Kind | Data shared | Hosting region | Security attestation (public, unverified) | DPA / terms on file | Risk tier | Owner | Last review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase | Subprocessor | Account email and sign-in records; every row a signed-in student syncs; usage counts; audit records. The whole database | us-west-2 (read from the project on 28 September 2026) | Vendor states a SOC 2 Type II report — to confirm; no report on file | None on file. Supabase publishes a DPA to sign — to confirm and sign | High | | |
| GitHub Pages | Subprocessor | Request metadata (IP address, user agent) when the app loads. No student content | Global CDN — to confirm | Vendor (GitHub) states SOC 2 and ISO 27001 — to confirm; no report on file | None on file. GitHub's customer terms include a DPA — to confirm which applies | Medium | | |
| Vercel | Subprocessor | Institution-scoped gateway requests from signed-in members of a connected institution; encrypted action bodies | To confirm — function region is a project setting | Vendor states SOC 2 Type II and ISO 27001 — to confirm; no report on file | None on file — to confirm and sign | High | | |
| Stripe | Subprocessor | Billing identity for a paying customer: name, email, the card (handled by Stripe alone; Semester never sees the number), subscription and invoice records; signed webhook events back to Semester | Global, US-headquartered — to confirm | Vendor states PCI DSS Level 1, SOC 1 and SOC 2 Type II — to confirm; no report on file | None on file. Stripe's Services Agreement includes a DPA — to confirm and countersign | High | | |
| Resend | Subprocessor | Lead-intake form contents and delivery address; for support replies, the student's account email, a pseudonymous support reference and the app link. The reply body and approved app context are never sent; transactional email only | To confirm | Vendor states SOC 2 Type II — to confirm; no report on file | None on file — to confirm and sign | Medium | | |
| Anthropic (Semester’s key) | Subprocessor | The text of the AI request a student makes (for example, a syllabus) | To confirm | Vendor states SOC 2 Type II and ISO 27001 — to confirm; no report on file | None signed. Published Commercial Terms and DPA recorded in [PROVIDER-TERMS.md](PROVIDER-TERMS.md): no training, 30-day retention, 48-hour breach notice. Not in force: no account under a Semester entity | High | | |
| OpenAI (institution-approved) | Institution-directed | The student's request and the approved sources it cites, once an institution approves the provider | To confirm per institution | Vendor states SOC 2 Type II — to confirm; no report on file | The institution's own agreement with the provider. Published Services Agreement, DPA and Student DPA recorded in [PROVIDER-TERMS.md](PROVIDER-TERMS.md); the Student DPA needs a signed Order Form. Semester's flow-down terms — to confirm | Medium | | |
| The institution’s LMS (LTI 1.3 platform) | Institution-directed | Launch verification traffic; a score only for a graded link the instructor placed | The institution's | The institution's vendor — assessed by the institution | The institution's own LMS contract; LTI registration record — to confirm per institution | Medium | | |
| Anthropic (student’s own key) | Student-directed | The student's AI request, from their browser, under their key | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| OpenAI (student’s own key) | Student-directed | The student's AI request, from their browser, under their key | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| Microsoft | Student-directed | Whatever the student's Microsoft account returns under the permission granted; writes only on request | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| Google | Student-directed | Whatever the student's Google account returns under the permission granted; writes only on request | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| Zoom | Student-directed | The student's own meeting list, read in their browser | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| Apple | Student-directed | The sign-in exchange the student starts | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| OpenStreetMap tile servers | Student-directed | IP address and the map area viewed | — | None known — community-run service | None — usage policy only (student-directed) | Student-directed | | |
| Nominatim and Photon (address lookup) | Student-directed | The text typed into the lookup box; position only if reverse lookup is on | — | None known — to confirm | None — usage policy only (student-directed) | Student-directed | | |
| Public institution source hosts | Student-directed | Public URL requests for availability checks; no Semester token or student content is sent to the host | — | Not assessed (student-directed) | None — public source access (student-directed) | Student-directed | | |
| Calendar and Canvas hosts the student links | Student-directed | The request to the address the student supplied, with their token, relayed by the `fetchcal` and `canvas` functions | — | Not assessed (student-directed) | None — no contract (student-directed) | Student-directed | | |
| The student’s browser push service | Student-directed | An encrypted notification for the student's device | — | Not assessed (student-directed) | None — the browser vendor's service (student-directed) | Student-directed | | |

## How a review is done

For each High and Medium row, before a pilot and then on the cadence in
*Tiers*:

1. **Obtain the evidence, do not quote the web page.** The current SOC 2
   Type II report (or ISO 27001 certificate with its statement of
   applicability), under NDA if that is how the vendor shares it. Read the
   period it covers, the exceptions noted, and the complementary user-entity
   controls it expects Semester to operate — those are Semester's obligations,
   and each needs a line in `docs/trust/SOC2-READINESS.md`.
2. **Sign or record the data-processing terms.** The DPA, its subprocessor
   list and notification clause, breach-notification window, deletion on
   termination, and the transfer mechanism if data leaves the US. File it, or a
   pointer to where it is held privately, under `docs/evidence/vendors/`.
3. **Confirm the hosting region** of the project or account actually in use,
   not the vendor's default, and write it in the row.
4. **Check the flow-down.** Whatever an institution's DPA requires of Semester
   must be something this vendor's terms let Semester promise. List any clause
   that cannot flow down.
5. **Record exit.** How data is exported and deleted if the vendor is dropped,
   and how long that takes. For Supabase this is `RESTORE.md`'s dump.
6. **Set the tier, owner and date** in the row, and note anything found. A
   finding that is accepted rather than fixed is written down as accepted, by
   whom.

A row may say *reviewed* only when steps 1 to 6 have evidence under
`docs/evidence/vendors/`. Until then the attestation column says *to confirm*.

## Triggers for an out-of-cycle review

- A new party in `app/src/lib/trust/subprocessors.ts` (the test forces a row
  here too).
- A vendor breach notice, change of ownership, or change to its DPA or
  subprocessor list.
- A change of region, plan or product that moves where data is processed.
- A new institution whose agreement adds a requirement.
