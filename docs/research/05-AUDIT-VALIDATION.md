# 05 · Repository audit validation

The question: **which existing capabilities solve real needs, and where do
assumptions need testing?** This page answers it as far as the evidence now
allows, which is less far than the build suggests.

Source: the audit PDF (a third-party, model-generated review of this
repository plus a rebuild plan, 86 pages) and the tree at `dac31c9`.

## The short answer

1. **No capability has user-need evidence.** [`VALIDATED.md`](../../VALIDATED.md)
   records zero users, zero retention and zero willingness-to-pay observations;
   nothing since has changed that. What the repository proves is that things
   *exist and behave as built*. It cannot show they are needed.
2. **The audit is a hypothesis generator, not a finding.** It contains almost
   no checkable claims about the repository and no evidence about users,
   buyers or price (Part A).
3. **Where its repo-facing claims can be checked, they mostly hold** (Part B),
   which says the build is as broad as claimed. Breadth is not demand.
4. **Fifty testable assumptions** sit behind the capabilities, all at C0,
   in [`repository/register.json`](repository/register.json). Part C maps them.

## Part A · What the audit is, in evidence terms

Class: `desk`, ceiling C1 ([`01`](01-EVIDENCE-MODEL.md)).

| Feature | Consequence |
| --- | --- |
| It is a model-assisted chat transcript, with the founder's own prompts embedded in it | The thesis ("replace all school and education systems in one place") is the founder's, restated; agreement from the audit is not independent confirmation |
| Pages 1–12 and 13–86 differ in kind | Pages 1–12 describe the repo and a target architecture. Pages 13–86 are a forward specification: role prompts, a proposed schema, SLOs, runbooks. I read pages 1–12; pages 13–86 were read by a delegated reader whose report I rely on without re-reading every page |
| Pages 13–86 carry no checkable claims about the repo | No file sizes, counts or live-versus-mock inventory; the repo appears as "the existing monolith" and "a blueprint". The plan lists an inventory as something *to be produced* |
| Its sources are standards and regulation (NIST AI RMF, FERPA, WCAG, LTI, incident response) and generic vendor pages | None is evidence about students, institutions or demand. In at least two places the footnotes cited do not support the sentence they follow (the "ambition" and "rich blueprint" sentences on p.20 cite NIST and a state special-education records page); the reader flagged this, I did not check every footnote |
| It states its own gap | The Product Research Lead prompt (p.83) says to "determine which existing capabilities solve real needs", and not to "treat stakeholder opinions or feature requests as validated product truth". The audit concedes the research is missing |

## Part B · The audit's repo-facing claims, checked

Measured on `dac31c9`, 2026-10-04. Re-run the command to re-check.

| Audit claim (PDF page) | Check | Result | Verdict |
| --- | --- | --- | --- |
| "Roughly a hundred named experience screens" (p.5) | `find app/src/screens -name '*.tsx' ! -name '*.test.tsx' \| wc -l` | **119** files (89 at the top level) | Holds, definition-dependent |
| "A monolithic `App.tsx`" (p.5) | `wc -l app/src/App.tsx` | **1,649** lines; the app shell, not the largest file | Large, not the largest; "monolithic" is a judgment this count does not settle |
| "Very large individual screen files such as Calendar, Sheet, Write, Today, University" (p.5) | `wc -l` on each | Sheet **4,749**, Calendar **3,005**, Write **2,718**, Today **2,123**, University **1,539** | Holds; the five named are among the largest |
| "Large client store/shape files" (p.5) | `wc -l app/src/state/shape.ts` | **2,828** lines | Holds |
| Supabase "checks for tenancy, RLS, LTI, SCIM, grades, records, guardians, ledger chains, legal holds, deletion, retention, integrations, rate limits, support access" (pp.5–6) | `ls supabase/*.check.sql` | **106** check suites, including `lti*`, `scim-gateway`, `k12-guardians`, `ledger-chains`, `legal-holds`, `retention-sweeps`, `rate-limits`, `support-access`; **171** migrations; **535** `create policy` statements; **16** edge functions | Holds |
| "Much of the breadth is implemented as a very large client-side React/Vite experience … rather than a cleanly bounded, production-grade, independently operable platform" (p.4) | Capability registry and target-architecture decision | Highest status in [`CAPABILITY-STATUS-REGISTRY.json`](../market-readiness/CAPABILITY-STATUS-REGISTRY.json) is `DESIGN_PARTNER`; institutional integrations `BLOCKED`. [`D-1144`](../decisions/D-1144.md) reaches the same direction independently and proposes strangler conversion | Consistent; not a user-evidence claim |
| "A screen, mock action, client-side state transition, or test fixture is not a live capability" (p.6) | Text match: files under `screens/` mentioning mock, demo or sample | **27** screen files match; a word match, not a classification | Cannot be settled by count; the classification the audit asks for is a task, not a result |
| "Every capability live from inception" (p.2 thesis) | Capability registry | Zero of 16 capabilities above `DESIGN_PARTNER`; the registry's own rule bars higher status without evidence outside the repository | Thesis aspiration, contradicted by the repository's own status register today |

**Side finding (document drift).** `VALIDATED.md` was written at `1c305ee`,
21 September: 37 migrations, 93 policies, 19 check files, 12,046 tests, and
"the product cannot take money today". Today: 171 migrations, 535 policies,
106 check suites, a live individual Plus checkout
([`BILLING-LIVE-ACCEPTANCE-2026-10-03.md`](../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md)).
Its "not validated" half (zero users, retention, willingness to pay) still
stands; its payment row and its counts are stale. Fixing that is a separate
change.

## Part C · Capability by capability

### C1 · The sixteen registry capabilities

"Built" means `CAPABILITY-STATUS-REGISTRY.json` status and its cited
repository evidence. "Need" means evidence that users want or need it. Floors
are not demand questions.

| Capability (registry id) | Built (status) | Need evidence | Assumptions | First test |
| --- | --- | --- | --- | --- |
| `account-auth` | `DESIGN_PARTNER` | None | ASM-008 | Interviews on sign-in and data location |
| `manual-setup` | `DESIGN_PARTNER` | None | ASM-007, ASM-009, ASM-018 | First-win usability (U2, U3); import accuracy in pilot |
| `daily-planning` | `DESIGN_PARTNER` | None | ASM-005, ASM-006, ASM-042, ASM-043 | Diary + pilot ([`07`](07-PILOT-AND-LONGITUDINAL.md)) |
| `tenant-isolation` | `DESIGN_PARTNER` | n/a — **floor** | — | None for demand. Independent review is the evidence |
| `role-access` | `DESIGN_PARTNER` | n/a — **floor** | — | Institution-admin workflow observation (understandability only) |
| `pilot-control-plane` | `DESIGN_PARTNER` | None | ASM-030 | Security-review interviews with a real questionnaire |
| `data-rights` | `DESIGN_PARTNER` | None | ASM-049 | Usability U8 |
| `audit` | `DESIGN_PARTNER` | n/a — **floor** | — | None for demand |
| `degraded-mode` | `DESIGN_PARTNER` | n/a — **floor** | — | None for demand |
| `support` | `INTERNAL` | None | ASM-028, ASM-029 | Student-affairs interviews and blueprint |
| `institutional-integrations` | `BLOCKED` | None | ASM-002, ASM-003, ASM-024, ASM-039 | Registrar and IT interviews; artifact review |
| `aggregate-reporting` | `DESIGN_PARTNER` | None | ASM-032 | Institutional-research interviews |
| `ai-assistance` | `DESIGN_PARTNER` | None | ASM-010, ASM-011, ASM-021, ASM-040 | Usability U7; faculty interviews |
| `high-impact-ai` | `BLOCKED` | n/a — **prohibited scope** | — | No research proposed: a prohibition, not a demand question |
| `institutional-contracting` | `BLOCKED` | None | ASM-031 | IT and procurement interviews |
| `individual-ga` | `BLOCKED` | None | ASM-004, ASM-012, ASM-013 | Pilot retention; pricing interviews |

**Floors.** Tenant isolation, role access, audit and degraded mode are
non-waivable gates ([`BETA_EXIT_CRITERIA.md`](../../BETA_EXIT_CRITERIA.md)).
Research neither justifies nor waives them. It only asks whether the people
who must operate or understand them can.

### C2 · The audit's seventeen product surfaces

Rows come from the audit's capability requirements matrix (pp.8–9). A
**surface** is not a registry capability; this is the audit's list. `Built` is
what the tree shows, with line counts where one screen carries it.

| Surface (`id`) | Built in the tree | Need evidence | Assumptions | Cheapest decisive test | Evidence weight today |
| --- | --- | --- | --- | --- | --- |
| `student-home` | Today screen, 2,123 lines | None | ASM-041 | Diary + interviews | Strong build, no need evidence |
| `calendar` | Calendar screen, 3,005 lines | None | ASM-050 | Diary and interviews | Same |
| `courses-degree` | Degree, Registrar, Registration screens; academic-record and registration check suites | None | ASM-025, ASM-044 | Usability U4, interviews with advisors and registrar staff | Same |
| `learning-assessment` | Gradebook, Course Studio check suites | None | ASM-020 | Faculty contextual interviews | Same |
| `study-tutoring` | Study, Exam, Solve, Essay screens | None | ASM-045 | Pilot (reuse), diary | Same |
| `docs-sheets-decks` | Write, Sheet, Deck screens | None | ASM-015 | Concept test against participants' current tools | Large build, no demand test; a high-cost surface |
| `ai-executive-assistant` | Ask tab; AI governance libraries | None | ASM-040 | Usability U7 | Same |
| `campus-life` | Dining, Housing, Maps, Directory, Athletics, Activities screens | None | ASM-017 | Interviews: what do you use for this today | Same |
| `communication-community` | Community, People, Classmates, Connect, Meet screens | None | ASM-046 | Interviews: existing channels | Same; also a moderation duty |
| `family-portal` | Family screen; family, family-invites, family-share and k12-guardians check suites | None | ASM-016, ASM-033, ASM-034 | Paired interviews, student and guardian separately | Hard-to-reverse consent model: needs C3 first |
| `finance-payments` | Student payment plans and ledger check suites; Plus billing live for individuals only | None | ASM-026, ASM-027 | Finance-office interviews | Institutional side absent |
| `career-alumni` | Career, Opportunities, Applying, Pathway screens | None | ASM-035, ASM-036, ASM-037 | Employer and alumni interviews | Large build, two-sided demand untested |
| `marketplace` | `listings` check suite; no dedicated screen found | None | ASM-038 | Partner interviews, concept test | Least built, least evidenced; the audit itself gates it on maturity |
| `staff-faculty` | Advisor and Course Studio suites | None | ASM-022, ASM-023, ASM-047 | Advisor workflow observation | Same |
| `institution-console` | Console, Agreements, University, Data screens | None | ASM-031, ASM-048 | IT interviews, config observation | Same |
| `support-trust` | Help, Support, Trust Room screens; help and support check suites | None | ASM-028, ASM-029 | Service blueprint walk-through | Same |
| `data-reporting` | Reports screen (78 lines); reports check suite | None | ASM-032 | Institutional-research interviews | Thin build, no demand evidence |

(Assumption ids resolve in `register.json`; the test fails if any surface has
none.)

### C3 · What the thesis needs to be true

The audit's bet: *everything works in one place, native from the start,
replacing the incumbents*. Decomposed into what research can test:

| Claim inside the thesis | Register | Direction of the cheapest test |
| --- | --- | --- |
| Students prefer one app to several | ASM-001 | Interviews: what would you keep separate |
| Individuals adopt without a mandate | ASM-004 | Pilot retention |
| Institutions will replace, not just coexist | ASM-002 | Institutional interviews and artifacts |
| Institutions will open data to a student-originated vendor | ASM-003 | IT and registrar interviews |
| Native matters (offline, collaborative editing) | ASM-014, ASM-015 | Interviews, diary; concept test |
| Two-sided markets exist (employers, partners, alumni) | ASM-035, ASM-038, ASM-037 | Cold interviews; defer concept tests |

**Replacement claims are already prohibited** in public copy
([`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md),
CLM-006). So research on replacement is internal strategy research and no
result converts into a public statement without the claims process and the
evidence level `01` requires.

## Part D · What to do with the answer

| If the finding is… | Then |
| --- | --- |
| A capability the build has, with no need evidence (most of them) | Keep it behind its flag; do not market it; test the cheapest assumption first; do not extend it |
| A need with C2 and no capability | Candidate for the next increment, as a bet if below the decision's minimum |
| A capability whose assumptions are refuted at C2+ | Propose retirement; the refutation stays on record |
| A surface with large build and no demand test | First candidates for concept tests, since sunk cost is the risk |
| A floor | Not subject to research |

The order of work follows evidence cost against decision value, not the
audit's program increments. The audit orders by dependency; this page orders
by what a cheap study could kill, and the first study is already defined in
[`VALIDATED.md`](../../VALIDATED.md): ten real users and thirty days.
