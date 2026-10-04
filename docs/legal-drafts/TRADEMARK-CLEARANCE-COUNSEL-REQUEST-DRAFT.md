> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Trademark clearance: request to counsel (draft)

| Control | Value |
| --- | --- |
| Status | **DRAFT — NOT SENT.** No counsel has been engaged or assigned |
| Prepared | 2026-10-04 |
| Sender | Harrison Rubin (founder; claim-owner and legal-coordination primary per the claims register) |
| Queue rows | `L2` (trademarks, brand usage, domains, digital assets) and `Q-10` in [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md); backlog item B-42 in [`BRAND-PLATFORM.md`](../BRAND-PLATFORM.md) |
| Facts in this draft | Read from the repository on 2026-10-04. **Anything about the company, its owners, its first use or its domains is marked `[FOUNDER TO SUPPLY]`** because the repository cannot establish it |

## 1. What we are asking for

We would like counsel to advise on, and where appropriate carry out, trademark
clearance and filing strategy for the names and marks in §4. Specifically:

1. A **clearance search and written opinion** for the priority marks (§4, rows
   1–3), covering registered and pending marks and common-law use.
2. **Registrability and strategy** for the word "Semester" and for the logo,
   given the concern in §5.
3. **Which of the secondary names and phrases are worth protecting** and which
   should be treated as descriptive labels.
4. **Interim usage rules** (§8) until the opinion exists.

We are **not** asking counsel, in this request, to decide ownership of the
product (see §2), to approve any marketing claim (that runs through
[`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)),
or to draft contracts.

## 2. Threshold dependencies, which this request does not resolve

Filing in the wrong name, or by an entity that does not own the mark, is worse
than not filing. Counsel should know these are open:

| Dependency | State |
| --- | --- |
| **Legal entity**: name, type, jurisdiction, formation date, good standing | Not confirmed. The formation items in [`CORPORATE-GOVERNANCE-CHECKLIST.md`](../company/CORPORATE-GOVERNANCE-CHECKLIST.md) are unchecked. `[FOUNDER TO SUPPLY]` |
| **Ownership of the work and the name** | Open. [`IP.md`](../../IP.md) §1 sets out a question about whether the founder's university policy gives the institution any claim, and drafts a written inquiry to the university. It has not been answered in the repository. Counsel should decide whether this must be settled before any filing |
| **Assignment chain** from founder and any contributors to the entity | Not documented here. `[FOUNDER TO SUPPLY]` contributor and vendor list |
| **Who may use the marks today** | Only the founder and the product as built; no licence or partner has been granted any mark |

## 3. Where the marks are used today (verified)

- Public site: `company-site/` (the sitemap references `https://www.semester.website`; registrant, registration date and registrar of the domain are `[FOUNDER TO SUPPLY]`).
- Application: `app/` (web).
- **No `™`, `SM` or `®` is shipped on any Semester mark.** The only `®` found in the shipped surfaces is a third-party mark on the site (§7).
- **Native iOS or Android binaries, app-store listings and social handles:** none found under `app/`; not searched elsewhere. `[FOUNDER TO SUPPLY]` any reserved handles or store names.
- **First use in commerce:** unknown. The repository's history shows when work was recorded, not when a mark was used in commerce. Nothing has been sold: individual prices are labelled planned and checkout is closed (`CLM-015`).

## 4. Marks and candidate marks

"Evidence of use" is the repository path; the count is the number of non-test files that print the string, as of 2026-10-04.

| # | Mark | Kind | Evidence of use | Question for counsel |
| --- | --- | --- | --- | --- |
| 1 | **SEMESTER / Semester** | Word mark; name of the product and company | Site and app throughout | Registrable, and clear? See §5. Classes and territories to advise |
| 2 | **Three-slab mark** (`app/src/components/mark.data.ts`, `company-site/icon.svg`) and the **wordmark lockup** | Design mark; composite | App icon, favicon, site header | Protectable as a design mark and as a composite? Who is the author and owner of the artwork? `[FOUNDER TO SUPPLY]` |
| 3 | **Ask Semester** | Feature name (the AI assistant) | 30 files | Distinct enough to file with #1, or covered by it? |
| 4 | **Course Studio**, **Study Studio** | Feature names | 37 and 22 files | Likely descriptive. Worth protecting at all? |
| 5 | **Today, My Path, Plan, Search, Me** | Navigation labels | 36 files for "My Path" | We treat these as ordinary words and do not intend to claim them. Confirm |
| 6 | The nine **owned terms** in `app/src/lib/vocabulary.ts`, e.g. *Student Action Layer*, *Source-Aware Student Experience*, *Governed Campus AI*, *No Wrong Door*, *Student Data Agency*, *Decision Packets* | Coined or adopted phrases | 4–9 files each for the four I counted (*Student Action Layer* 5, *No Wrong Door* 9, *Governed Campus AI* 4, *Decision Packets* 5) | Several are ordinary phrases, and *No Wrong Door* is in wide general use. Which, if any, can be ours? Which should we stop treating as ours? |
| 7 | **Taglines**: "One clear next step.", "Know what's next. Know where it came from.", "Your semester, with sources.", "Beside your systems, not instead of them.", "Status is part of the product.", "You decide what's shared." | Candidate taglines, **not in public use** | [`BRAND-PLATFORM.md`](../BRAND-PLATFORM.md) §1.9; copy-register rows `M-37`–`M-42` | Are any registrable, or only worth a clearance check against use by others? |
| 8 | Partner tiers **Registered / Verified / Strategic** | Programme names | Site partner page | Likely descriptive. Any concern with "Verified" as a certification-style term? |

The proposed "Source Line" graphic device is a design proposal and does not exist
in the product; it is not in this inventory.

## 5. The preliminary view already in the repository, and why it needs counsel

[`IP.md`](../../IP.md) §2 is a **non-attorney, AI-drafted preliminary analysis**. It
states a view that "Semester" is very likely descriptive for software that plans a
semester, possibly generic, and so likely not registrable on the Principal
Register as a word mark alone. It lists routes (Supplemental Register, acquired
distinctiveness, a composite mark, a distinctive house brand) and recommends not
filing the word alone yet.

We have **not** verified any of that. We ask counsel to confirm, correct or reject
it, because the decision it points at (keep the name and add a distinctive
element, or choose a protectable house mark) is cheapest before a fundraise and
before launch.

## 6. Search status: none performed

- **No clearance search has been run by anyone.** `IP.md` says the USPTO databases
  were unreachable from the environment where it was written, and that the search
  is the founder's to run.
- On 2026-10-04 `tmsearch.uspto.gov` and `tmdn.org/tmview` returned HTTP 200 from the
  environment used to prepare this draft, but a programmatic query to the USPTO
  search endpoint failed (HTTP 405), so **no results were obtained**. This is
  recorded so nobody assumes a search happened.
- The founder's own knockout steps are in `IP.md` §2 ("The search to run anyway"):
  USPTO for "semester" in Class 9 and Class 42 reading the goods text, a
  common-law check (app stores, web, domains), dated notes. The table below is for
  those results; counsel's search supersedes it.

| Date | Database or source | Query | Result | Run by |
| --- | --- | --- | --- | --- |
| `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

## 7. Third-party marks on shipped surfaces

The public site names other parties' products in compatibility and comparison
context, as counted on 2026-10-04: Canvas (15 mentions), Microsoft (6), Google (4),
Brightspace (2), Blackboard (2), Anthropic (2), and VPAT® (15, one with the ®
symbol). The product's AI feature calls Anthropic's service by default.

Please advise on **nominative or descriptive use**, on whether any of these
statements implies affiliation or endorsement, and on the use of "VPAT" given that
no VPAT or ACR has been completed (`CLM-008`). Draft usage rules are in
[`TRADEMARK-BRAND-USAGE-GUIDELINES-DRAFT.md`](TRADEMARK-BRAND-USAGE-GUIDELINES-DRAFT.md).

## 8. Interim operating rules (business rules, for counsel to confirm or change)

Until counsel responds:

1. Use no `™`, `SM` or `®` on any Semester mark.
2. Add no new product or feature names. New names go through the naming test in
   [`BRAND-PLATFORM.md`](../BRAND-PLATFORM.md) §1.8 and then to counsel.
3. Keep the taglines in §4 row 7 as candidates; use none in public copy without
   its register row approved.
4. Do not register domains or handles for the candidate marks, and do not
   describe the product as "trademarked", "registered" or "protected".
5. Reference no institution's or customer's name or logo (`CLM-013`).

## 9. What we will do with the result

Counsel's memo goes into [`IP-ASSET-INVENTORY-TEMPLATE.md`](IP-ASSET-INVENTORY-TEMPLATE.md)
and the "Marks covered" and "Territories/classes/status" fields of the usage
guidelines. A decision to keep or change a name is recorded as a decision file
named for its pull request number. This is **Tier 3** in the brand approval
system (`BRAND-PLATFORM.md` §8.2): it needs counsel's written result.

The founder sets budget, jurisdictions and timing. **No date, fee or timeline is
proposed here**, because the repository holds no basis for one.

## 10. Attachments to send with this request

- `app/src/components/mark.data.ts` and `company-site/icon.svg` (the mark).
- `docs/BRAND-PLATFORM.md` (the identity, §1.8 naming and §1.9 taglines).
- `app/src/lib/vocabulary.ts` (owned terms).
- `IP.md` (the preliminary analysis in §2 and the ownership question in §1).
- `LEGAL-REVIEW-QUEUE.md` rows `L0`, `L2`, `Q-10`.

## 11. What this draft did not do

- It engaged no counsel and sent nothing.
- It ran no clearance search and states no legal conclusion about any mark.
- It did not confirm the legal entity, ownership, first use, domain registration,
  or any social or store name.
- It did not review the artwork's authorship.
