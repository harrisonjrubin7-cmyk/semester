# Public content governance

Status: proposed. Makes the existing governance tables (`claims_register`,
`content_register`, `cta_routes`) the runtime source for what the public site may show,
so the markdown register stops being the only control.

## 1. Today

`claims_register` and `content_register` exist with sound constraints and **no rows and no
reader**. The working control is `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` (CLM-001–018), the
copy register (M-rows) in `docs/gtm/BRAND-AND-MARKETING-STRATEGY.md` §8.2, and tests that
read those markdown tables (`copyregister.test.ts`, `clm018.test.ts`, `withdrawal.test.ts`).
The strategy doc proposes moving the register into data; that has not happened.

## 2. Content object (every public item)

`slug`, `title`, `audience`, `kind` (page, resource, faq, case study, update, trust item),
`body` or section blocks, `visibility` (`public` | `institutional` | `nda` | `internal`),
`review_state`, `owner_id`, `reviewer_id`, `source_basis` (evidence reference),
`claim_ids[]` (rows in `claims_register` the text relies on), `accessibility_reviewed_on`,
`legal_reviewed_on` / `security_reviewed_on` / `privacy_reviewed_on` where applicable, `version`,
`published_at`, `last_reviewed_at`, `next_review_at`.

`content_register` already carries owner, reviewer, review state, source basis, claim link and
review dates. **Migration needed (additive):** `visibility`, per-specialist review dates,
`version`, and a many-to-many `content_claims` table because one page relies on several claims.
New column names are proposals until the migration is reviewed.

## 3. Public eligibility (one predicate, tested)

An item is returned by a public read model only if **all** hold:

1. `review_state = 'published'` and `visibility = 'public'`;
2. `now() < next_review_at` (expired items disappear, they do not linger);
3. every linked claim has `status = 'active'` and `now() < review_by`; `active` already requires
   `control_id`, `review_by`, `approved_by`;
4. an evidence reference exists for any sensitive claim class (security, privacy, accessibility,
   compliance, pricing, outcome);
5. where the class requires it, the matching specialist review date is present and in range;
6. not withdrawn.

Draft, expired, internal, customer-specific, unapproved or NDA-controlled material is never
returned. The read model returns an empty set rather than an error when nothing qualifies.

## 4. Status machine

`draft → editorial → product_accuracy → specialist (security / privacy / accessibility / legal as applicable) → customer_approval (where applicable) → approved → scheduled → published → review_due → updated | retired | withdrawn`.
Transitions are recorded with who and when. The owner cannot approve their own item
(mirrors the existing rule in `gtm_campaign_reviews`). A claim moving to `expired` or
`retired` hides every dependent item on the next read.

## 5. Roles

Claim owner (today: Harrison Rubin, single owner and sole CODEOWNER); editorial reviewer;
product-accuracy reviewer; Security, Privacy, Accessibility, Legal reviewers (**unassigned**);
withdrawal owner. Because one person currently holds several roles, the register's
"owner cannot be sole approver of a prohibited-class claim" rule cannot be satisfied in
practice until reviewers are named; the system must surface that as an open item, not hide it.

## 6. How a page uses it

A page is a template plus slots that reference content or claim ids. The renderer resolves
each slot through the eligibility predicate at build or request time. A slot with no eligible
content renders its **designed empty state** ("in preparation", linked to the status page),
never raw draft text and never a blank hole. A CI test fails the build if a page
contains a literal string that matches a claim marked prohibited, expired or withdrawn.

## 7. Change control

Copy changes follow the repository's PR flow. A change to prohibited-class copy needs the
named specialist's recorded approval before merge. Decisions are recorded as
`docs/decisions/D-<pull request number>.md` (see CLAUDE.md), after the PR is open. Withdrawals
follow `docs/CLAIM-WITHDRAWAL-RUNBOOK.md`.
