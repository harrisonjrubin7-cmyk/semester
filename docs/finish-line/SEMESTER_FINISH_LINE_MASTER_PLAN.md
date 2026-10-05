# Semester finish-line master plan

| | |
| --- | --- |
| **Version** | 0.1 (first issue) |
| **As of** | 2026-10-05, `origin/main` at `790ebbf` |
| **Owner** | Harrison Rubin. The accountability matrix names one person for every seat and every backup is `UNASSIGNED`. |
| **Next review** | 2026-10-11, with the weekly program status |
| **Status** | Control document. It asserts no product capability. |

This directory is the finish-line control system. It does not replace the
repository's existing registers; it reads them against the code and says what
is true on the day it was written.

## Doctrine

Semester is the unified, AI-native operating system for education.

- Build everything natively.
- Integrate responsibly.
- Replace only with proof.
- Operate every domain as one system.

The long-term vision is not narrowed anywhere in this directory. What is
narrowed is the **use of the word "complete"**. A feature, screen, table,
migration, mockup, document or integration draft is not complete because it
exists. It is complete when it has code, a test that has been seen to fail
without the code, evidence, a named owner, and operational support
([definition](SEMESTER_COMPLETION_DEFINITION.md)).

## The headline truth on 2026-10-05

Four read-only audits plus one baseline run produced these findings. Each is
sourced to a file in the register that follows.

1. **The code base is large and its automated gates are green.** On this commit
   `npx tsc -b` exits 0, `npm run lint` exits 0 (warnings under the repository's
   cap of 25, and the style, label and term audits report ok), and `npm test`
   passes 1,423 of 1,424 files and 22,897 tests, with 1 file and 69 tests
   skipped (about 9.5 minutes). `test:shuffle`, `check:university`, `build` and
   the 111 SQL check suites were **not** run for this document, so nothing here
   claims them.
2. **There is no customer.** No signed pilot, order form, contract or named
   customer exists anywhere in the repository. The 2026-10-03 go/no-go decision
   is: design-partner discovery with synthetic data GO; individual unpaid
   validation CONDITIONAL GO; **paid institutional pilot NO-GO; broad enterprise
   sale NO-GO**.
3. **No domain is authoritative.** The domain register computes "0 of 14
   replaceable". The adapter registries are empty arrays on purpose. Every SIS,
   degree-audit, advising, career and bursar integration is a mock plus a
   contract test. See [domain gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md).
4. **`main` is unprotected.** The audit read the GitHub API: branch protection
   returned 404 and the ruleset list was empty, while `.github/rulesets/main.json`
   is defined and unapplied. 26 of the latest 30 `main` runs were red on
   4 October. This is the cheapest P0 on the list. It was read once, on
   2026-10-05, by an audit agent. Re-read it before relying on it.
5. **Security controls are real where they are tested, and some claimed ones are
   not.** The RLS, grant and definer sweeps run in CI and plant probes that must
   be caught. A generic cross-tenant sweep does not exist, tenant membership
   enforcement is off for every school, GraphQL exposure is not mitigated, `anon` still holds row-level DML on 32 tables (the TRUNCATE-class privileges were revoked on 2026-10-05, D-1251), a
   restore from provider backup has never been done, and `fetchcal` makes the
   request before it checks where a redirect landed (confirmed in code during
   this audit: `redirect: 'follow'` at `supabase/functions/fetchcal/index.ts:194`,
   the landing-address check at line 207).
6. **The pilot loop is real for individual students and absent for an
   institution.** Of the 18 pilot steps, five have working code for students;
   steps 1–4, 6–8 and 13 have tables or libraries but no operator or champion
   screen; steps 14–18 are blank templates or pure functions. See
   [pilot factory](SEMESTER_PILOT_DELIVERY_FACTORY.md).
7. **The documentation outruns the operation.** About 300 documents exist.
   Several contradict each other (60 of 60 capabilities "verified" against 30
   PARTIAL and 11 PLANNED) and several are stale. One person holds every seat.

## How the documents fit

| Document | Question it answers |
| --- | --- |
| [Completion definition](SEMESTER_COMPLETION_DEFINITION.md) | What does "done" mean, at each level? |
| [Release readiness register](SEMESTER_RELEASE_READINESS_REGISTER.md) | What is each capability's true state, and what blocks launch? |
| [Domain authority gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md) | Which domain may be called authoritative, and what is missing? |
| [Product coherence audit](SEMESTER_PRODUCT_COHERENCE_AUDIT.md) | Is it one system or disconnected modules? |
| [Security finish line](SEMESTER_SECURITY_FINISH_LINE.md) | Which security gates are closed, and which block a second tenant? |
| [Accessibility finish line](SEMESTER_ACCESSIBILITY_FINISH_LINE.md) | What is proven for accessibility, and by whom? |
| [AI assurance program](SEMESTER_AI_ASSURANCE_PROGRAM.md) | Which AI controls exist, and what is unmeasured? |
| [Migration factory](SEMESTER_MIGRATION_FACTORY.md) | How does an institution's data come in, get reconciled and go out? |
| [Pilot delivery factory](SEMESTER_PILOT_DELIVERY_FACTORY.md) | What is each step of the first pilot, and what runs today? |
| [Support and incident readiness](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md) | Who answers, and what has been drilled? |
| [Commercial readiness](SEMESTER_COMMERCIAL_READINESS.md) | Can a pilot be priced, contracted, delivered and converted? |
| [Company operating cadence](SEMESTER_COMPANY_OPERATING_CADENCE.md) | What happens weekly, monthly and quarterly? |
| [Evidence register](SEMESTER_EVIDENCE_REGISTER.md) | What evidence is needed, what exists, and how is a release gated? |
| [Risk burn-down](SEMESTER_RISK_BURN_DOWN.md) | Which risks are open, and what burns them down? |
| [90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md) | What happens by when, with what team, and the 12-month roadmap |
| [Master release checklist](SEMESTER_MASTER_RELEASE_CHECKLIST.md) | What must be true before any release or claim? |

The repository already holds registers that overlap these. This directory does
not duplicate them. It links to them and records where they disagree with the
code:

- `docs/EVIDENCE-REGISTER.md` (rendered from `app/src/lib/ops/evidence.ts`): the
  dated artifacts that exist.
- `docs/DOMAIN-REPLACEMENT-REGISTER.md`, `docs/DEFINER-RLS-REGISTER.md`,
  `docs/FEATURE-TRUTH-TABLE.md`, `docs/ROLE-LAUNCH-REGISTER.md`,
  `docs/MASTER-LAUNCH-READINESS-REGISTER.md`, `GO-NO-GO-DECISION.md`,
  `LAUNCH-RISK-REGISTER.md`, `docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`.

Where a register here and a register there disagree, **the code wins, then the
dated evidence, then the document**, and the disagreement is a row in the
[risk burn-down](SEMESTER_RISK_BURN_DOWN.md).

## Material that landed on `main` while this was written

`main` took 21 commits between this program's start and its first push
(CLAUDE.md warns that sessions converge). Merged in before pushing:

- **D-1251** (`docs/decisions/D-1251.md`): `TRUNCATE`, `TRIGGER`, `REFERENCES`
  and `MAINTAIN` revoked from `anon` and `authenticated`, applied to production on
  2026-10-05, held by `supabase/client-privileges.check.sql`; the shared AI key
  refuses school accounts; a guard that `pages.yml` is the only Pages deployer.
  This closes part of what an earlier draft of this directory listed as open
  (DR-04); the documents here were corrected.
- **Phase 0 audits** of the operations console (`docs/ops/OPERATIONS_CONSOLE_CURRENT_STATE.md`,
  production read 2026-10-05) and the public site
  (`docs/marketing/COMPANY_SITE_CURRENT_STATE.md`, source inspection). They agree
  with the register here and add: the console's approval path has **0 production
  rows**; the company site has two public stacks. They were linked from the
  register, not otherwise reconciled.

No landed commit applied branch protection, fixed `fetchcal` (that is the follow-up PR to this one), built the
cross-tenant sweep, or created a `docs/finish-line/`. The grep for those was run
again immediately before pushing.

## Phases and where each stands

| Phase | Ask | State on 2026-10-05 |
| --- | --- | --- |
| 0 Verify current truth | Source-of-truth map before any new feature | **Issued** as the [readiness register](SEMESTER_RELEASE_READINESS_REGISTER.md). It is a first pass: it rests on four static audits and one gate run, not on every file. Rows say so. |
| 1 Product coherence | Repair disconnected experience | **Audited**, not repaired. [Findings and the repair order](SEMESTER_PRODUCT_COHERENCE_AUDIT.md). No product code was changed by this program step. |
| 2 Foundation gates | Verify and close | **Audited**. 4 gates verified by CI test, the rest open. [Security](SEMESTER_SECURITY_FINISH_LINE.md). |
| 3 First pilot | Make the Registration Readiness Pilot deployable | **Not deployable.** [Gap by step](SEMESTER_PILOT_DELIVERY_FACTORY.md). |
| 4 Domain replacement | 21-gate scorecard | **Scorecard issued.** Every domain fails gates 9–13, 19 and 21. |
| 5 Company readiness | Build or reconcile | **Reconciled** in [commercial](SEMESTER_COMMERCIAL_READINESS.md). Most artifacts are templates or hypotheses. |
| 6 Release evidence | Evidence register and a gate on "production-ready" | **Register and guard test issued.** |
| 7 Operating rhythm | Weekly, monthly, quarterly | **Defined**, [not yet adopted](SEMESTER_COMPANY_OPERATING_CADENCE.md). |

## Rules for work taken from this plan

1. **Check main first.** `CLAUDE.md` requires `git fetch origin main` and a
   grep for the defect before any task. Several sessions converge on the same
   finding.
2. **No new product feature until the register row for it exists.** The
   register now exists. A feature that is not a row is added as a row first.
3. **A decision takes its pull request's number** (`docs/decisions/D-<n>.md`).
   Nothing in this directory is a decision; the ones it asks for are listed in
   the [90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md) and each becomes its
   own file once its pull request is open.
4. **Do not remove or weaken a security control to pass a test.** Do not expose
   a sensitive table for convenience. Browser state is never the authority for
   a permission or a transaction.
5. **Human-only evidence is marked as such.** Counsel, signatures, customers,
   money, bank facts, staffed on-call and drills in a target environment cannot
   be produced by editing this repository. They appear as `needs human
   evidence`, never as done.
6. **A clean reading is a claim about the probe too.** Several rows here come
   from a static read. They are tagged `static` and want a runtime check before
   they are quoted outside the company.

## The next 25 actions, in priority order

The detail, owners and dates are in the
[90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md#the-next-25-actions). In order:

1. Re-verify branch protection on `main`, decide a reviewer rule a one-person repository can satisfy, apply it, and get `main` green.
2. Fix `fetchcal` redirect handling (check each hop before the request).
3. Close the BYO-key AI route's bypass of the kill switch and school AI-off policy.
4. Build the generic cross-tenant isolation sweep (TI-01/TI-04) and make it a CI gate.
5. Run the production restore drill and a PITR test; record date, owner, recovery point and time.
6. Mitigate GraphQL exposure and decide the remaining `anon` DML reduction and `authenticated` allowlist (D-1251 closed the TRUNCATE-class part).
7. Decide and apply the minimum alert path: probe failure to a person, with a non-personal security address.
8. Reconcile stale material to the code (domain register, tenant isolation doc, definer sweep header, data inventory counts, status documents, the four risk registers) and extend the finish-line guard to read the domain scorecard.
9. Define the exact pilot wedge and scope as a one-page offer, with the figures a founder decision supplies.
10. Engage counsel on the pilot agreement, DPA and public policies; assign a queue owner.
11. Record entity, signing authority, tax, insurance and bank facts (human evidence).
12. Approve one price book and reconcile the three conflicting number sets and the public-site price band.
13. Build the operator spine: tenant create, cohort import and invite screens over the existing RPCs.
14. Wire `pilotReadiness`/`pilotVerdict` and the `gtm_pilot*` tables to a screen.
15. Define and ship the activation and first-action events the pilot measures (needs a privacy decision on the three-mark limit).
16. Build the champion and pilot dashboard.
17. Source-label the institution-flavoured screens; wire "report incorrect information".
18. Put the keyboard, target-size and contrast sweeps in CI; run the manual assistive-technology pass.
19. File a model-quality baseline and a prompt registry.
20. Run the target-environment drills (restore, rollback, data rights, revocation, offboarding).
21. Commission the independent security assessment and a qualified accessibility review.
22. Build the 100-account target list and operate it in the CRM tables.
23. Run 15–25 buyer conversations; log each in the discovery evidence log.
24. Secure the first paid pilot only after the go/no-go conditions are met.
25. Convert measured pilot evidence into a conversion decision, case study and expansion plan.

Items 24–25 depend on a customer. Nothing in this repository can complete them.
