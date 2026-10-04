# Training plan and Semester Academy

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — CURRICULUM PARTLY WRITTEN, NO SESSION EVER DELIVERED, NO TRAINER OR BACKUP ASSIGNED** |
| Owner | Enablement lead seat; each customer's champion co-owns delivery inside their institution |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | the [training workstream gate](METHODOLOGY.md#training-workstream-gate-stored-stage-train); [in-product requirements](IN-PRODUCT-ENABLEMENT.md) |
| Builds on | [`../LAUNCH-CONTENT-AND-TRAINING.md`](../LAUNCH-CONTENT-AND-TRAINING.md) (the launch package and its readiness register), [`../launch/FIRST-DAY-CHECKLISTS.md`](../launch/FIRST-DAY-CHECKLISTS.md), [`../FACULTY-ENABLEMENT.md`](../FACULTY-ENABLEMENT.md) |

The Academy is the one place every audience learns Semester, in the same order
and the same words, whichever institution they belong to. It is a catalog of
modules, a sandbox to practice in, and a rule for what counts as trained. It is
not a learning-management system, and it does not track people.

## Principles

1. **Practice beats completion.** An operator is ready when they have *done the
   critical tasks on a sandbox*, observed — not when they have clicked through a
   module.
2. **No per-person completion table.** The existing launch plan holds this line
   and it stands: Semester does not need to know which staff member finished
   which module, and a completion table is a surveillance table with a friendlier
   name. If a school needs completion records for its own compliance, they belong
   in its own learning system. What Semester records is **role-level rehearsal
   evidence** (which seat, which tasks, which date, observed by whom) and, for
   Semester's own staff, seat readiness as a condition of production access.
3. **Same words as the product.** Every module names the screen it happens on,
   typed as a `Screen`, so a module pointing at a screen the app no longer has
   fails the type check (the first-day checklists already work this way).
4. **Accessible by construction.** Every asset has one title, no skipped heading
   levels, descriptive link text, alt text, and for video a caption and a
   transcript. Plain language, one idea per module. A module that fails these is
   not `READY` (the checks in `content.test.ts`).
5. **Never claim what the evidence does not.** No module states a compliance or
   certification claim, a figure, or a capability the product does not have.
6. **Voluntary and low-stakes for students.** Student onboarding is optional, has
   no effect on grades or standing, and is never a precondition to the school's
   services.

## Audiences, outcomes and curriculum

State shorthand: **READY** = file exists and passes the content checks;
**PLANNED** = not written. `READY` rows cite the file; nothing is marked ready
that has not been written and checked.

### Students

*Outcome:* in the first session, reach Today, understand one prioritized action
and where it came from, and know how to get help and control their data.

| ID | Module | Format | Length | Screen | Status |
| --- | --- | --- | --- | --- | --- |
| S1 | What is Semester? | 60-second script + captioned video | 1 min | `home` | script written; video needs captions and a transcript before it counts |
| S2 | Quick start | guide | 10 min | `home` | READY — [`STUDENT-QUICK-START.md`](../launch/STUDENT-QUICK-START.md) |
| S3 | First-day checklist | checklist | 10 min | listed per step | READY — [`FIRST-DAY-CHECKLISTS.md`](../launch/FIRST-DAY-CHECKLISTS.md) |
| S4 | Your data, your controls, and AI | in-product Privacy screen + guide | 8 min | privacy | in progress — the Privacy screen states each claim and a test holds it; a guide for the school's own AI policy waits on that policy |
| S5 | Sources and freshness: why you can trust a date | guide | 5 min | source details | PLANNED |
| S6 | Accessibility and display options | guide | 5 min | settings | PLANNED — waits on conformance evidence so it describes what was tested |
| S7 | Getting help | in-product guidebook | 3 min | `help` | exists as a screen |
| S8 | Orientation slide for the school's own session | slide | 1 slide | — | PLANNED |

*Rehearsal task (cohort-level, optional):* a student reaches Today, finds an
action's source, snoozes one, and finds the export.

### Faculty

*Outcome:* set up a course, publish what students need, and know exactly what
Semester does and does not do with grades and student work.

| ID | Module | Format | Length | Status |
| --- | --- | --- | --- | --- |
| F1 | Faculty quick start | guide | 15 min | READY — [`FACULTY-QUICK-START.md`](../launch/FACULTY-QUICK-START.md) |
| F2 | Course set-up and the syllabus path | guide + sandbox task | 20 min | PLANNED |
| F3 | What Semester does not do: grades, official records, AI limits | guide | 8 min | PLANNED (draws on [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md)) |
| F4 | Accessibility of course materials | guide | 10 min | PLANNED |
| F5 | Getting help and reporting an issue | guide | 3 min | PLANNED |

### Staff and advisors

*Outcome:* use the staff and advising workflows they are authorized for, hold the
privacy line, and escalate correctly.

| ID | Module | Format | Length | Status |
| --- | --- | --- | --- | --- |
| A1 | Advisor quick start | guide | 15 min | READY — [`ADVISOR-QUICK-START.md`](../launch/ADVISOR-QUICK-START.md) |
| A2 | Consent, sharing and what you may see | guide | 10 min | PLANNED |
| A3 | Advisor meeting mode | guide + sandbox task | 15 min | PLANNED ([`../ADVISOR-MEETING-MODE.md`](../ADVISOR-MEETING-MODE.md)) |
| A4 | Escalation and crisis routing | guide | 10 min | PLANNED, must match [`../CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md) and the school's own routes |

### Administrators (the school's university administrator, registrar, implementation manager, integration admin)

*Outcome:* operate the tenant without Semester in the room.

| ID | Module | Format | Length | Status |
| --- | --- | --- | --- | --- |
| D1 | Day-to-day operations | guide | 30 min | READY — [`ADMIN-OPERATIONS-GUIDE.md`](../launch/ADMIN-OPERATIONS-GUIDE.md) |
| D2 | Roles, grants and reviews | guide + sandbox task | 20 min | PLANNED |
| D3 | Configuration Studio: draft, publish, roll back — and what is only recorded | sandbox task | 30 min | PLANNED |
| D4 | Integrations: approve, watch, pause, replay, disconnect | sandbox task | 45 min | PLANNED ([`../INTEGRATION-OPERATOR-RUNBOOK.md`](../INTEGRATION-OPERATOR-RUNBOOK.md)) |
| D5 | Migration Center: read the gates, approve at cutover | sandbox task | 30 min | PLANNED |
| D6 | Student asks: rights requests, exports, deletion | guide + sandbox task | 25 min | PLANNED ([`../DATA-RIGHTS-REQUEST-RUNBOOK.md`](../DATA-RIGHTS-REQUEST-RUNBOOK.md)) |
| D7 | Incidents and communication | tabletop | 45 min | PLANNED |
| D8 | Offboarding, from the school's side | guide | 20 min | PLANNED ([`OFFBOARDING-AND-EXPORT.md`](OFFBOARDING-AND-EXPORT.md)) |

### Support (Semester's own seats and the school's help desk)

*Outcome:* verify identity and tenant, classify by harm, route to the right
owner, close the loop, never exceed their authority.

| ID | Module | Format | Length | Status |
| --- | --- | --- | --- | --- |
| P1 | The support loop and severity (P0–P3) | guide | 20 min | PLANNED, from [`../commercial/SUPPORT-OPERATIONS.md`](../commercial/SUPPORT-OPERATIONS.md) |
| P2 | Identity, tenant and authority checks before any account talk | guide + role-play | 20 min | PLANNED |
| P3 | What support never says: academic, legal, medical, financial advice | guide | 10 min | PLANNED |
| P4 | Consented diagnostics and access: time-limited, audited, revoked at close | sandbox task | 20 min | PLANNED |
| P5 | Escalation: incident, security, privacy, accessibility, safety | tabletop | 30 min | PLANNED |
| P6 | Hypercare rota and handoff | guide | 15 min | PLANNED — [`HYPERCARE-AND-HANDOFF.md`](HYPERCARE-AND-HANDOFF.md) |

### IT and identity

*Outcome:* run identity, SCIM and connections safely and recognize a failure.

| ID | Module | Format | Length | Status |
| --- | --- | --- | --- | --- |
| I1 | SSO and SCIM lifecycle: what happens at deprovision | guide + sandbox task | 40 min | PLANNED ([`../SSO-TENANT-ONBOARDING.md`](../SSO-TENANT-ONBOARDING.md), [`../SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md)) |
| I2 | LTI registration and grade-passback ordering | sandbox task | 30 min | PLANNED ([`../LTI-1.3-LAUNCH-RUNBOOK.md`](../LTI-1.3-LAUNCH-RUNBOOK.md)) |
| I3 | Credentials: pointers, rotation, revocation | guide | 15 min | PLANNED |
| I4 | Reading health: freshness, errors, kill switch | sandbox task | 25 min | PLANNED |
| I5 | Security review and the trust room | guide | 20 min | PLANNED ([`../trust/README.md`](../trust/README.md)) |

## Seat readiness (the "certification" that matters)

Applies to **operator seats**: the school's administrators and IT, and
Semester's support and implementation seats. It is one record per seat per
tenant, not a transcript.

| Seat | Rehearsal the trainer observes | Pass |
| --- | --- | --- |
| University administrator | D2, D3, D6 on the sandbox | tasks done unaided; the backup administrator too |
| Registrar (publisher) | publish a draft prepared by someone else; roll a version back | done unaided |
| Integration admin | approve a scope; pause; replay; disconnect | done unaided |
| Migration approver | read the gate list; approve and reject a cutover | done unaided |
| Help-desk lead | classify five scripted cases; route each correctly | no wrong route on P0/P1 |
| Semester support seat | P1–P5 role-play incl. a P0 | no wrong route; no out-of-scope advice |
| Semester implementation seat | one named step from each workbook | done from the page, primary silent |

The record names the seat, date, tasks, trainer and result, and expires when the
workflow materially changes. A seat with no backup that has passed is still
`at_risk` ([seat rule](METHODOLOGY.md#seats-not-people)). Production access for a
Semester seat is conditional on its record.

## Training plan for an implementation (copy per tenant)

| When (relative to pilot start P) | Activity | Owner | Evidence |
| --- | --- | --- | --- |
| P-60d (phase 2) | Needs analysis: audiences, sizes, languages, accessibility needs, who trains whom | EL, champion | needs record |
| P-45d | Content check: school-specific facts in the content register have an owner and an expiry ([`../LAUNCH-CONTENT-AND-TRAINING.md`](../LAUNCH-CONTENT-AND-TRAINING.md) §1) | EL, customer data owners | register |
| P-30d | Sandbox tenant ready with synthetic data; train-the-trainer for the champion and faculty lead | EL | sandbox ready |
| P-21d | Administrator and IT rehearsals (D2–D7, I1–I5) | EL | seat readiness records |
| P-14d | Help desk and Semester support rehearsals incl. a tabletop incident | EL, SL | seat readiness records |
| P-10d | Faculty and advisor sessions (live, recorded with captions); office hours scheduled with named people | champion, EL | session record, calendar |
| P-7d | Student communications issued in the school's name ([`../launch/ANNOUNCEMENT-TEMPLATES.md`](../launch/ANNOUNCEMENT-TEMPLATES.md)) | customer comms | sent record |
| P-3d | Gate review: every operator and support seat ready, backups included; help routes tested | IL | gate record |
| P0 onward | Office hours; in-product help; weekly "what we learned" note to the champion | EL, CSM | log |

Training gate (exit of stored stage `train`): every operator and support seat
has its readiness record **and** a backup with its own; communications approved;
help routes verified end to end; no module the customer needs is `PLANNED`
without a written decision to defer it.

## Delivery model and scale

- **Self-serve first.** Guides and in-product help carry most learners.
- **Live for operators.** Administrators, IT, help desk and advisors get a live
  rehearsal with a trainer, recorded with captions and a transcript.
- **Champions train their own.** Train-the-trainer: the champion and faculty lead
  deliver student and faculty sessions from the Academy materials, so scale does
  not depend on one Semester trainer.
- **Office hours** need named people and times from the pilot; until then they
  are `NOT_STARTED` and are not promised.
- **Localization.** Plain-language standards and the localization plan
  ([`../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md`](../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md))
  govern; a language is offered only when its modules pass the same checks.

## Measuring training without tracking people

Report at cohort level and only above the privacy floor (n ≥ 10): share of
first-session goals reached, help-route use, support contacts per topic
(themes, not individuals), and rehearsal pass rate by *seat*. Do not report or
store who finished what. A topic that drives repeated support contacts is
a module or a product defect, and goes to the
[feedback loop](FEEDBACK-AND-ESCALATION.md).

## Maintenance

Each module has an owner seat and a review interval. A release that changes a
screen a module names reopens that module (the type check catches removed
screens; a release note catches changed behavior). Stale modules are marked
`PLANNED` again, not left `READY`.

## Evidence state

**Repository evidence.** Student, faculty, advisor and admin guides, first-day
checklists, announcement templates, FAQ and known-limitations pages exist and
are checked by content tests; contextual help exists in the product.

**Operational evidence.** No training session has been delivered, no trainer or
backup is assigned, no seat-readiness record exists, no office hours are staffed.

**Missing test/proof.** Write the PLANNED modules; deliver one rehearsal per
operator seat with a second person observing; run the training gate on a real
sandbox.

## Claim ceiling

Semester may describe the Academy as a planned curriculum and may share the
READY guides.

## Prohibited claims

Do not claim any person is trained, certified or competent; do not claim live
training, office hours or support are available; do not report completion
figures.
