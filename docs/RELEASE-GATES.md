# Release gates for the private beta and the first university pilot

Full-beta programme, written 30 Sep 2026. These are the places the owner's readiness analysis says are still weak, turned into **gates**: each names what "passed" means, what the repository proves today, and what is missing. A gate is **MET** only with dated evidence a stranger could check; otherwise it is PARTIAL, UNMET, or an OWNER decision. Nothing here is a claim that Semester is ready.

**Provenance.** The list comes from the owner's message of 30 Sep 2026 and from the readiness-gap analysis the owner attached ("anything I have missed…", the multi-university-pilot checklist). A document titled "any place that is still weak and needs further dev" was not among the files this session received; if it is a different file, its list needs reconciling with this one.

**Sequence the analysis recommends, and this page keeps:** a tightly controlled individual private beta (10–30 students) → one narrow single-university concierge pilot (25–75 students, minimal or curated data, no official registration execution) → only then 2–3 design-partner universities on the same workflow.

Evidence goes in `docs/evidence/` (today it holds only the AI runs of 29 Sep). Status is as of `main` + this branch; the current state of the SQL and app gates is in the pull request.

## The gates

### G1 — A real account, end to end: sign up → verify → recover → use → export → delete

| | |
| --- | --- |
| **Pass when** | One scripted run, in CI against a real (local) Supabase stack, creates an account, confirms the address, signs out, recovers the password through the in-app dialog, adds a course, exports the account, deletes it, and shows no row left; plus a documented manual fallback and response timeline for export/delete requests. |
| **Today** | Sign-up/verify/recovery/settings built (recovery dialog and change password/email, M1). CI's `account-sync` job signs in on two devices against a local Supabase (`app/scripts/account-sync.mjs`). Export and erasure are proved in SQL and unit tests (`deletion.check.sql`, `erasure.test.ts`, 846-line suite). The golden path covers add-course → deadline → degree. |
| **Missing** | The single scripted run above does not exist; sign-up→export→delete has never been driven through the real Auth path in one test. No in-app session list. Erasure fails closed for staff who wrote to four immutable tables. The data-subject-request queue exists but has no screen or named answerer (owner decision). |
| **Status** | PARTIAL |

### G2 — Tenant isolation, proved before a second institution

| | |
| --- | --- |
| **Pass when** | Negative cross-school tests pass in CI for every route into another school's data; at least one school has members-only rooms switched on with its readiness evidence filed; multi-institution use does not start before then. |
| **Today** | Row-level security on every table (`rls-coverage`), more than seventy SQL policy suites, the integration RLS matrix. Members-only course rooms per school are **built and off for every school** (`docs/SCHOOL-MEMBERSHIP-ENFORCEMENT.md`, 32 checks, six guards shown red). |
| **Missing** | No school is switched on; that runbook's readiness evidence is unmet. Room *keys* are chosen by the client. Classmates-adjacent tables beyond rooms/messages/reactions/enrollments were not audited for school scoping. |
| **Status** | PARTIAL — built, not enabled |

### G3 — An explicit school deletion / offboarding decision

| | |
| --- | --- |
| **Pass when** | The owner records what happens when a school leaves, and a test proves it. |
| **Decision** | D-1021 (30 Sep 2026, owner): a school row is never deleted. It leaves through an audited case — preflight inventory, approval by both sides, access disabled, export recorded and verified by a second operator, soft-archive with a retention window, restoration by a different operator, purge eligibility only after the window with no live legal hold and a third person's separate authorization. |
| **Today** | Built and proved in `supabase/school-offboarding.check.sql` (98 checks, cross-school and recovery cases included, twelve guards shown red). Runbook: `docs/SCHOOL-OFFBOARDING.md`. `delete from schools` is refused for every role. |
| **Missing** | Rehearsed once on a hosted Supabase preview database with synthetic data, by the author (`docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`); not yet by a second person, and never used. The migration is now recorded in production, but the post-deploy procedure has not been rehearsed there. **The purge itself is not built** (the school-row trigger refuses every delete until it is). The export file is generated elsewhere. Legal holds are read from `public.legal_holds` (#1012), and nobody has yet placed one. Counsel has not set the retention window or the fate of a former school's student work. |
| **Status** | PARTIAL — procedure built and tested locally; not rehearsed; purge not built |

### G4 — Source and freshness labels everywhere they are claimed

| | |
| --- | --- |
| **Pass when** | Every fact shown from a source carries one of the five labels (Institution verified, Imported, Student entered, Estimated, Needs review) and either a real "updated" time or the words "Update time not recorded"; a test enforces it on the pilot-critical screens. |
| **Today** | Labels exist and are DB-checked on four tables (`source.test.ts`). Today's commitments and actions carry them; unknown age now says so in words (M2). Degree, Grades and Registrar are held to the badge by `decisionlabels.test.ts`. The graduation simulator and study abroad now carry a badge and "not an official degree audit / credit evaluation" wording, and an advisor share now lists where each part came from, what it assumes and the day it was prepared (older shares open without it). |
| **Missing** | The registration cart and ranked backups, and the core student tables (`notes`, `courses`, `tasks`), carry no per-record authority label. Course dates have no stored last-checked time, so "Updated N days ago" cannot be honest yet; the badge says "Update time not recorded". |
| **Status** | PARTIAL |

### G5 — Restore and rollback evidence

| | |
| --- | --- |
| **Pass when** | A timed restore of a real backup is performed, recorded in `docs/evidence/`, and the rollback procedure is rehearsed by someone other than its author. |
| **Today** | `ROLLBACK.md` (measured timings). CI rehearses a logical dump and restore on every change (`restore.sh`, `rehearse.sh`). |
| **Missing** | A logical rehearsal is filed (`docs/evidence/restore/2026-09-30-logical-rehearsal.md`). `RESTORE.md` is explicit that the production restore has **never been done**; there is one operator; the institution gateway's journal has no backup. |
| **Status** | UNMET |

### G6 — Accessibility testing evidence

| | |
| --- | --- |
| **Pass when** | Keyboard, mobile, 200% zoom/reflow, contrast, labels, dialogs, error states and a **screen-reader pass** are done for every pilot journey, results filed, known limitations published; no conformance claim beyond the evidence. |
| **Today** | Automated: axe over the rendered app, focus/modal/field-error/motion tests, contrast ramp tests, an accessibility smoke in CI. New forms use the shared field-error and dialog helpers. |
| **Missing** | No human assistive-technology pass, no ACR/VPAT, no filed results. |
| **Status** | PARTIAL — automated only |

### G7 — AI evaluation sets, run and filed

| | |
| --- | --- |
| **Pass when** | An injection red-team and a model-quality evaluation set are run against the model actually in use, scored, and filed with the model named; a failing score blocks release; run again on any model or prompt change. |
| **Today** | Both exist. `docs/evidence/ai/` holds a kill-switch drill (held) and a prompt-injection red-team of 29 Sep 2026 against `claude-opus-5` through the shared-key proxy: **21 cases, none followed the injected instruction**. The model-quality set is `app/src/ai/modelquality.live.test.ts` (`npm run eval:model-quality`). |
| **Missing** | No filed model-quality run. One model, one date, 21 cases — a start, not coverage. The shared key was unset/erroring on 29 Sep (owner). No release gate wired to a score. |
| **Status** | PARTIAL |

### G8 — Integration and data-quality reconciliation

| | |
| --- | --- |
| **Pass when** | For every integration turned on: reconciliation runs against the real source, discrepancies and duplicates are reviewed, freshness is shown, disconnect revokes and purges. For the beta: no integration is on. |
| **Today** | Drift, reconcile, freshness and retry logic is written and tested as library code; connection control plane, dead-letter and reconciliation tables exist. Adapter registries are **empty on purpose** (a test enforces it). |
| **Missing** | No adapter, so nothing has ever reconciled against a real source. Student OAuth tokens sit in `localStorage`. No revocation cascade. |
| **Status** | UNMET, and correctly off |

### G9 — Institutional launch tooling

| | |
| --- | --- |
| **Pass when** | A pilot can be started, run and ended by someone other than the author: cohort, sponsor, data scope, feature flags per school/cohort/role, weekly review, support routing, offboarding. |
| **Today** | Operations console, approvals, break-glass, tenant rollout and plan tables, release cohorts on flags (main), the pilot problem log, a 26-week pilot framework, the membership-enforcement runbook. |
| **Missing** | No admin-facing guide; incident owners are unassigned; support inbox is a personal address; offboarding (G3) has no mechanism; no pilot SOW/DPA reviewed by counsel; no baseline survey collected. |
| **Status** | PARTIAL |

### G10 — Policy, checkout and public claims agree

| | |
| --- | --- |
| **Pass when** | Terms, Privacy, Refund/Cancellation, Acceptable Use and AI Use are final and public; they, the pricing page and the checkout say the same thing; no "proposed terms" remain before a real charge; a dedicated support inbox exists. |
| **Today** | `salecopy.test.ts` refuses stale "nothing can be bought" sentences everywhere a reader looks, including the legal drafts. Checkout builds its price from the server catalog; the webhook is signature-verified and idempotent. Live charges are off pending separate approval. |
| **Missing** | The policy documents in `docs/legal/` are **drafts with open `[DECIDE]` items and need counsel** (for example the refund policy's effective date). No Customer Portal. Refund and dispute events are recorded but change nothing. Pro and Access are not to be sold. Support address is a personal Gmail. |
| **Status** | UNMET for charging; blocked on counsel and owner |

## Do-not-claim boundaries (kept from the analysis)

Until evidence exists, Semester **must not say or imply**:

- official degree-audit accuracy, guaranteed graduation dates, live course seats, or registration eligibility;
- university integration, SSO, Canvas sync, or financial-aid information unless actually connected and contractually approved;
- AI-generated academic work that bypasses a faculty member's course policy;
- "lifetime" paid access, or that Pro or Access can be bought;
- **SOC 2, FERPA certification, HIPAA compliance, PCI certification, penetration-test completion, HECVAT completion, or accessibility conformance (WCAG/VPAT)** — none is held;
- that any institution's students are protected by members-only rooms, until a school is switched on and its evidence filed;
- that a data-subject request will be answered in any time, until someone is named to answer.

Added from the readiness synthesis of 30 Sep 2026 (`docs/PDF-EVIDENCE-GAP-MATRIX.md`; the six PDFs themselves are not in the repository):

- a **purpose-coded FERPA authorization** — a "legitimate educational interest" control that decides by tenant, role, relationship, purpose and data class — because none exists; access is decided by tenant, role and scope only, and no purposes have been defined by counsel;
- a **canonical person or source-authority model**, or that any system is the authority for a field a school has not agreed;
- a **versioned policy engine** with explanations and rollback;
- that **LTI 1.3 or OneRoster** has been certified, or has ever run against a real platform: the launch checks are code and tests only;
- a **recovery time or recovery point** figure, or that any dependency's failure has been drilled;
- that a **pilot target has been met**: every number in the pilot log is a target until measured, by method, with a second checker;
- that Semester is **ready for financial aid, payroll, general-ledger or system-of-record replacement** — including the student-accounts and dining modules already on main, which are built and off until a finance owner and specialist controls exist.

Do not launch first with financial aid, disability accommodations, health, immigration status, billing, housing, conduct, or parent access. Do not allow each campus to ask for a different product.

## What each gate needs from the owner

G1: nothing but time, plus the answerer for rights requests. G3: the offboarding decision above. G5: production access and a second operator. G6: a screen-reader user and time. G7: the shared key working. G9: a named incident owner, a support inbox, counsel on the pilot agreement. G10: counsel on the policy drafts, then the effective dates.

Every question that needs counsel is gathered in [`docs/COUNSEL-BRIEF.md`](COUNSEL-BRIEF.md), with what the code assumes today, so one conversation can close many.
