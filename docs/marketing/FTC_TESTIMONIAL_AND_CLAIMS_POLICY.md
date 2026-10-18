# FTC testimonial, review and claims policy — public marketing

Status: **proposed operating policy; not legal advice and not counsel-approved.**
Counsel is unassigned in the register. It extends, and does not replace,
[`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md),
[`docs/legal-drafts/LEGAL-CLAIMS-APPROVAL-POLICY.md`](../legal-drafts/LEGAL-CLAIMS-APPROVAL-POLICY.md),
and [`docs/CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md).

Reference points for counsel to confirm (not asserted here as legal conclusions):
the FTC's final rule on consumer reviews and testimonials (16 CFR Part 465, 2024),
and the FTC's Endorsement Guides and related guidance on disclosing material connections.

## 1. Today's position

No testimonial, review, endorsement, customer logo, named institution, "trusted by"
statement or case study is published, and none may be until the tests below pass.
CLM-013 is `PROHIBITED TODAY`. Outcome claims (CLM-014) and prices (CLM-015) are
also prohibited. The site's own "no customer outcome claims yet" line is correct and stays
until an approved case study exists.

## 2. Never create, publish or imply

- Fake reviews or testimonials; AI-generated testimonials presented as human; quotes
  attributed to a nonexistent or non-using person.
- Testimonials from non-users presented as customers.
- Fabricated institution names or logos; "trusted by" or "used at" statements
  without a documented, current, permitted relationship.
- Edited quotes that change meaning; selective excerpting that reverses sentiment.
- Incentives conditioned on positive sentiment, or on a rating or review's content.
- Suppression, threats or intimidation of legitimate negative reviews.
- A single pilot's result presented as a typical or universal outcome.
- Undisclosed employee, founder, investor, advisor, ambassador, affiliate, family,
  partner or paid-influencer endorsement.
- "Independent review" or comparison pages that Semester controls, without disclosure.
- Review "gating" (inviting only likely-happy users to review).

## 3. Testimonial record (all fields required to render)

| Field | Rule |
| --- | --- |
| `id` | stable |
| `speaker` | real person or real organization, name and role as approved |
| `relationship` | `customer` · `student` · `institutional_admin` · `pilot_participant` · `employee` · `advisor` · `ambassador` · `partner` · `investor` · `family` |
| `experience_verified` + `evidence_ref` | the person actually used the relevant product or pilot; reference to the record (survey id, interview note, email) |
| `source` | `interview` · `survey` · `email` · `recorded_video` · `public_review` |
| `exact_quote` | verbatim as approved; **an edit creates a new record and a new approval** |
| `permission_to_publish` | written, for the exact quote **and** each placement |
| `placements` | allow-list: `website`, `sales_deck`, `case_study`, `social`, `webinar` |
| `org_permission`, `logo_permission` | separate booleans, separate written approvals |
| `incentive` + `incentive_description` | declared even when none |
| `material_connection` | text shown beside the quote when relationship is `employee`, `advisor`, `ambassador`, `partner`, `investor`, `family`, or any incentive was given |
| `outcome_context` | required if the quote states or implies a result |
| `owner`, `reviewer`, `approved_at` | named people; reviewer is not the owner |
| `review_due_at` | expiry; default 12 months, shorter if the product changed |
| `status` | `draft` → `editorial` → `product_accuracy` → `specialist` (security/privacy/accessibility/legal where applicable) → `customer_approval` → `approved` → `scheduled` → `published` → `review_due` → `updated` / `retired` / `withdrawn` |
| `withdrawn_at` | any withdrawal removes the quote from every channel, per the withdrawal runbook |

**Render rule.** A testimonial renders only if status is `published`, the current
placement is in `placements`, `permission_to_publish`, `experience_verified` and a
non-empty `exact_quote` hold, it is not past `review_due_at`, and it is not withdrawn.
A logo renders only if `logo_permission` is true. A material-connection line is rendered
**adjacent to the quote**, never in a footer. The component fails closed: any missing
or unparseable field renders nothing.

Required adjacent form, when applicable:

> "[Quote]" — Name, role, institution. Pilot participant, [term/year].
> [Received [relationship or incentive disclosure].]

## 4. Outcome and customer-result claims

A claim such as an activation rate, a support-friction change or a time saving needs
all of: metric definition; population; period; methodology; baseline; data owner;
approval; date; qualification (not necessarily typical); placement approval. The
page links to the methodology. An unsupported headline number is never displayed.
Pilot success measures in the pilot offer (activation, first meaningful action,
workflow completion, weekly active use, confidence, staff efficiency, support
burden) are **what will be measured, not what has been achieved.** Do not render
them as results.

## 5. Proof hierarchy

| Proof | May publish? | Needs |
| --- | --- | --- |
| Product screenshot | Yes if current | Product owner review; capture date; "illustrative / fictional data" label |
| Internal product metric | Usually not as an external claim | Definition, source, approval |
| Pilot metric | Only with permission and context | Customer approval, baseline, method, date |
| Customer logo | Only with permission | Written logo-use approval |
| Customer quote | Only with permission and real experience | Exact quote, approval, disclosure if needed |
| Case study | Only with customer and legal review | Customer sign-off, metric methodology |
| Security claim | Only if verified | Control evidence and Security reviewer |
| Accessibility claim | Only if scoped and evidence-backed | Audit/test scope and reviewer |
| Competitor comparison | Only if fair, current, sourced | Evidence register entry, dated |

Before verified customers exist, use only: current product screenshots labelled as
illustrative; workflow diagrams; the pilot framework labelled as proposed scope;
resources; demo recordings; explicitly labelled early-access or pilot-program material.
Do not use "trusted by", "proven to", "improves outcomes", "reduces support tickets"
or institution logos.

## 6. Incentives, ambassadors, referrals

Incentives for sharing or reviewing may exist only if not conditioned on positive
sentiment or on the content of the review, and are disclosed wherever the resulting
content appears. Ambassador, fellow, affiliate and referral programs (pages exist on
company-site) must give participants the exact disclosure text and a prohibition on
undisclosed endorsement, and must not script claims outside the register.

## 7. Negative feedback

Legitimate negative reviews are not suppressed, threatened or selectively hidden in
a misleading way. Feedback routes to `site_feedback` and `accessibility_barrier`
with their SLAs. Any displayed review set states the selection method.

## 8. Withdrawal and recheck

Per the withdrawal runbook: remove from every channel, log it, escalate a material
false claim through legal/security/privacy/customer-communication. `next_review_at`
passing without re-approval hides the item automatically; it does not stay live "until someone notices".

## 9. Open items for human review

Counsel to confirm the render rule and the disclosure placement; claim owner to name
the reviewer pool; Communications to confirm ambassador disclosure text.
