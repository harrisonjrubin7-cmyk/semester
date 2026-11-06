# K-12 and alumni prompts: what is authorised, what is built, what is not

Source: `Semester-K12-and-Alumni-Claude-Prompts`, the owner's PDFs of 29–30
September 2026. Every line in those PDFs is cut off at the page edge, so each
bullet stops mid-sentence. This ledger treats the readable words as evidence
and never as permission to invent what follows them. For each prompt it says
what the readable text says, where it stops, and what was done about it.

Standing rules held by everything below (owner's instruction of 30 Sep 2026):

- nobody under 13 holds an account (D-139);
- every table is tenant-isolated by row-level security;
- the three alumni consents are separate answers, each the graduate's own;
- no current student's record reaches fundraising (DO-NOT-BUILD rule 14);
- nothing here deploys, charges, messages anyone, or merges without separate
  authorisation;
- **built** and **tested** below describe repository implementation and test
  evidence as observed on 15 October 2026, not production deployment,
  configuration or use unless a row expressly says so.

## State per prompt

| Prompt | The readable text says | Where it stops | State |
| --- | --- | --- | --- |
| K1 edition | `schools.edition` (`higher_ed` default), a `useEdition()` hook, an edition-aware terminology map, register rows K12-001 to 003 | The row list; the check values; the hook's and map's file names | As observed on 15 October 2026, the schema in [#1022](https://github.com/harrisonjrubin7-cmyk/semester/pull/1022) is merged on main. The hook and terms map are **not built**: with no consumer and no stated terms they would be inventing behaviour. Register rows `K12-001` to `K12-003` **already exist and are tested** on main in `docs/REINFORCEMENT-REGISTER.md` (from `app/src/lib/reinforceregister.ts`), under different wording from the prompt's proposed master-register rows; the owner's note ("not added") refers to the master-register rows only. |
| K2 guardians | Links, an immutable history, a server read rule, rights that move at 18, staff-only link creation, Family screen untouched for higher-ed | The relationship values, the read rule's conditions | Core in #1022. The rights are `full`, `view_only`, `none`. **Link requests** and the **Family switch for K-12 tenants** are named by the owner's progress note as still to do, and are **not built**; see decisions 1 and 2. |
| K3 parent portal | Today shows one child at a time with a switcher; Courses, Calendar, Support views; several children and several guardians; five states per view; notifications only through `lib/notify.ts` | What Courses shows "from the gradebook when…"; what each permission level shows; the notification tiers | **Partially built, not a parent portal.** Main renders one consent-bound, audited guardian Calendar projection from `SharedWithYou`, with loading, ready, denied, stale and error states (`GuardianProjection.tsx`; `20261009230000_guardian_projection_foundation.sql`). Today, Courses, Support and a child switcher are **not built**. Those gaps still need decisions 2 and 3, and attendance still has no source on main. |
| K4 messaging | Teacher–guardian threads on the existing message and moderation tables; announcements by capability; per-guardian language and translation; quiet hours | Who may be in a thread; the translation provider; how a translation is stored | **Not built.** Sending a message is outward-facing and excluded by the owner's instruction; translation needs decision 4. |
| K5 standards, report cards, attendance | Standards, grading periods, report-card templates, attendance codes, history rows, replacement-map rows K12-005 and 006 | Almost every field list; the scoring rules themselves | **Not built.** The prompt asks for "each scoring rule against hand-worked fixtures" but the rules are not in the readable text. No attendance table exists on main. |
| K6 forms, conferences, fees | Reuse `forms`/`form_responses` and `appointments`; a per-student fee ledger with payment through Stripe; privacy disclosures | Who satisfies a form's rule; the booking-race rule; the fee ledger's fields | **Not built.** Fees move money and are excluded until authorised. |
| K7 under-13, rostering, site | A COPPA account flow, OneRoster 1.2 import, `/k12/` pages | — | The account flow is **superseded** by D-139 (no under-13 accounts). The `/k-12/` site page **already exists** (`app/src/site/k12.tsx`, registered in `render.tsx`, D-141, held by tests); whether the prompt's `/k12/` spelling means an alias or further pages (`/k12/parents/`, `/k12/teachers/`) is not readable. Main also has D-160's private roster-import foundation: CSV/REST configuration pointers, staged and current rows, manifest validation, removal holds, promotion and rollback (`20260930220000_roster_import_staging.sql`). It has no OneRoster client, network call, app reader or real import, so OneRoster itself remains unauthorised and unimplemented. |
| A1 alumni foundation | Alumni profiles, consents, a graduation action, "no current student's data may be read by any advancement code", a link to `alumni_mentor_offers` | The columns; how the mentor-offer link works | As observed on 15 October 2026, the core exists only on the open, non-draft [#1023](https://github.com/harrisonjrubin7-cmyk/semester/pull/1023) branch and is not on main. The ADV register rows were dropped by the owner's note. Main already has `alumni_mentor_offers`, the consent-on-both-sides request/answer workflow and a tested `MentorFinder`; only the proposed association from #1023's alumni profile to that existing offer is **not built**, because its behaviour is cut off. |
| A2 gifts | Funds, campaigns, Stripe Checkout (one-time and recurring), cancel as easily as start, a matching-gift prompt, seven-year retention, a kill switch | Every field list; the receipt and consent-before-checkout details | **The gift flow is not built.** Main has a tested, configuration-gated **individual-subscription** substrate: hosted Stripe subscription Checkout, signed webhooks, cancellation, checkout/subscription records and a seven-year purge for individual financial records. That is reuse evidence, not a claim that billing is configured or live, and it does not implement charitable funds, campaigns, one-time or recurring gifts, gift consent, receipts, matching or a gift kill switch. Charging remains excluded by the owner's instruction; charitable-solicitation registration and receipt wording still need legal review before a school takes gifts. |
| A3 receipts, donor portal | Automatic receipts, a donor portal, withdrawing consent removes a donor from every list | Receipt contents; portal fields | **Not built.** Depends on A2. |
| A4 staff console | Roles `advancement_admin`, `gift_officer`, `gift_processor`; offline gift entry with a second person; pledges; portfolios; Stripe reconciliation; an audit log of donor reads | Every capability list | **Not built.** Depends on A2. |
| A5 giving days, events, community | A public giving-day page, events, class notes, a directory of those who opted in | Almost everything | **The alumni-specific flow is not built** and depends on A2. An events table does exist: `public.community_sessions`, with participant and capacity handling. D-1287 decides that future events reuse and extend it rather than add a parallel table; the alumni-specific extension and workflow remain missing. |
| A6 reporting, site | Campaign, fund and donor reports; small-cohort suppression; `/solutions/advancement/` | The suppression threshold and the report list | **Reporting is not built** and depends on A2 to A5. The tested `/solutions/advancement/` page already exists (`app/src/site/advancement.tsx`, registered in `render.tsx`), but it describes every part as *planned*, says nothing is live and makes no production-capability claim. |

## Decisions the owner still has to make

1. **Guardian link requests (K2).** How does a guardian name a student without
   the form becoming a way to find out who attends a school? The readable text
   says only that requests exist. Candidates: the school invites the guardian
   (staff start it), or the guardian answers a code the school gave them. Until
   this is decided, staff record links directly, as #1022 already allows.
2. **The Family screen for K-12 schools (K2).** What a K-12 tenant sees instead
   of the adult student's consent screen depends on the parent portal, which is
   not built.
3. **What each guardian right shows (K3).** `full` and `view_only` exist;
   which views each unlocks is not stated.
4. **Translation (K4).** The provider, and whether guardian messaging ships
   before a moderation review.
5. **Attendance (K3, K5).** No attendance table exists on main; Core Prompt 5
   would have built it and has not landed.
6. **Register rows (K1, A1).** Reinforcement-register rows `K12-001` to
   `K12-003` exist and are tested. The owner's note says the proposed
   master-register K12 and ADV rows were not added; whether they should be, and
   how they differ from the existing rows, is open.
7. **A2 onward.** Legal review of charitable solicitation and receipts, and the
   K-12 and advancement prices in `lib/plans.ts`, are the owner's, not code's.

## What was done instead of guessing

Nothing in this list was built from a guessed remainder of a cut-off sentence.
As observed on 15 October 2026, the two foundations that the prompts and the
owner's progress note make unambiguous were rebuilt and reconciled against the
main available to each branch. #1022 is merged on main, where the K-12
takeover-map row is *in preparation*. #1023 remains an open, non-draft branch
and is not on main; only that branch moves the advancement row from *planned*
to *in preparation* and tests that the row cannot stay *planned* while its
tables exist.
