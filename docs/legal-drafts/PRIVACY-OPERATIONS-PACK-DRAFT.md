> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester privacy operations pack — index, gap map and operating rules (draft)

- **Owner/backup:** `[TBD]` (the privacy seat is held by outside counsel per `SEMESTER-OPERATING-SYSTEM.md` and is unsigned; this pack names no responder)
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel plus the authorized company decision-maker
- **Prepared by:** privacy-operations workstream (not counsel). Everything labelled **COUNSEL-REQUIRED** is a decision this pack deliberately does not make.

## Plain-language summary

Semester already has a large privacy document set. This pack does **not** restate it. It (1) maps what exists to the privacy-operations areas, (2) names what is missing, (3) adds the operating templates that were missing, and (4) lists the counsel questions that gate them. Nothing here is a statement that Semester complies with any law.

## What exists, and where (do not duplicate)

| Area | Authoritative source | Notes |
| --- | --- | --- |
| Table-level data inventory | `docs/DATA-INVENTORY-AND-LINEAGE.md` (generated; never hand-edit) | Public tables only |
| Per-table retention | `RETENTION.md` (tripwire-tested) | Counsel has not approved the periods |
| Deletion and hold behavior | `erase_account()`, `docs/DATA-RETENTION-EXPORT-DELETION.md`, `supabase/deletion.check.sql` | The live suites did not run on the last validation host |
| Export | `export_my_data()`, `docs/trust/DATA-EXPORT-STANDARD.md` | No full-archive manifest (G-01/G-05, `docs/DATA-PORTABILITY-AND-OFFBOARDING.md`) |
| Classification tiers | `docs/trust/DATA-CLASSIFICATION-STANDARD.md` (T0–T6) | No field-to-tier map |
| Processing register | `docs/trust/PERSONAL-DATA-PROCESSING-REGISTER.md` | 7 rows, mostly `[TBD]` |
| Consent | `docs/CONSENT-SHARING-DESIGN.md`, `docs/trust/CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md` | No consent evidence register |
| Guardian/minor | `docs/security/guardian-data-model.md`, `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md` | Under-13 and dual-enrollment open |
| DSR | `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`, `data_subject_request` table | No screen, no owner |
| Subprocessors | `docs/SUBPROCESSORS.md` (generated from `app/src/lib/trust/subprocessors.ts`) | No DPAs signed |
| PIA | `docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md` (generated from `app/src/lib/governance/pia.ts`) | 6 surfaces owed |
| Incident | `SECURITY.md`, `docs/trust/INCIDENT-RESPONSE-PLAN.md` | Statutory notification not verified |
| Counsel queue | `LEGAL-REVIEW-QUEUE.md`, `docs/COUNSEL-BRIEF.md` | Privacy-operations rows added with this pack |

## What this pack adds

| Document | Fills |
| --- | --- |
| [`DSR-OPERATING-KIT-TEMPLATE.md`](DSR-OPERATING-KIT-TEMPLATE.md) | ID verification, templates, exceptions, request log, guardian/institution requests, clock table |
| [`PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md`](PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md) | Privacy incident triage, notification decision table, notice skeletons, breach log |
| [`PRIVACY-REVIEW-INTAKE-TEMPLATE.md`](PRIVACY-REVIEW-INTAKE-TEMPLATE.md) | Privacy-by-design review plus AI, marketplace, integration, analytics and marketing add-ons |
| [`MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md`](MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md) | Age gate, under-13 handling, dual enrollment, guardian verification and revocation |
| [`VENDOR-PRIVACY-REVIEW-TEMPLATE.md`](VENDOR-PRIVACY-REVIEW-TEMPLATE.md) | Vendor review record, change notification, deletion propagation |
| [`PROCESSING-REGISTER-EXPANSION-DRAFT.md`](PROCESSING-REGISTER-EXPANSION-DRAFT.md) | Missing processing activities and a field-to-tier seed map |
| Evidence-handling rules (below) | Where each kind of record lives |

## Operating rules (apply to every document above)

1. **No legal conclusions.** Roles (controller/processor/school official/service provider), lawful bases, response clocks, notification duties, minors' rules and transfer mechanisms are `[DECIDE]` until counsel records an answer in `docs/decisions/` with name and date.
2. **No promised response time.** The `data_subject_request` table carries a thirty-day due date as an internal queue marker. `docs/COUNSEL-BRIEF.md` C1 says no time is promised; keep it that way until counsel answers.
3. **Qualify the in-app promises.** `app/src/lib/privacy.ts` says no archive is kept after deletion and nothing is used to train anything. Those lines are test-held and sit in tension with provider backup tails in `RETENTION.md`. Do not repeat them elsewhere without the backup-tail qualifier. **COUNSEL-REQUIRED:** exact wording.
4. **Name roles, not people.** Use role titles. Do not assert staffing that does not exist.
5. **Evidence or it did not happen.** A procedure is "exercised" only with a dated record (see Evidence handling).
6. **Generated files stay generated.** Add a PIA surface in `pia.ts` then `npm run registers` from `app/`; add a subprocessor in `subprocessors.ts`. Never hand-edit the rendered files.
7. **Behavior before wording.** If a procedure cannot be run today (no operator screen, no owner), the notice must not describe it as running.

## Evidence handling

Two stores, because the repo enforces one of them.

| Record | Where | Why |
| --- | --- | --- |
| Dated rehearsal and tabletop results (DSR rehearsal, breach tabletop, deletion-propagation exercise) with no personal data | `docs/evidence/privacy/YYYY-MM-DD-<name>.md`, **plus** an entry in the evidence register (`app/src/lib/ops/evidence.ts`) | `app/src/lib/ops/evidence.test.ts` fails on any file under `docs/evidence/` that has no register record, and on a record whose file does not state its date. The existing rights runbook already points rehearsals here |
| Request logs, breach log, vendor review records, completed review intakes, counsel decision notes | A restricted privacy records store `[DECIDE: location, access list, retention]`, not the repository | They can hold sensitive detail and privileged material. Only ids, counts and role titles may be quoted in the repo |

Counsel answers go to `docs/decisions/D-<pull request number>.md` as `CLAUDE.md` requires.

## Governance cadence

| Cadence | Activity | Output |
| --- | --- | --- |
| Per request | Work the DSR kit | Log row plus evidence |
| Per change | Privacy review intake before merge of any new data use | Completed intake; `pia.ts` row if a surface |
| Monthly | Vendor change check, open-request ageing, consent-withdrawal sample | Dated note in the privacy records store |
| Quarterly | DSR and breach tabletop rehearsal; inventory vs. schema reconciliation | Dated rehearsal record |
| Pre-launch / per geography | Counsel queue review | Queue rows closed or re-dated |

## Activation blockers

- Qualified counsel has not reviewed this pack.
- No named owner or backup for DSR, breach or vendor review.
- No operator screen for `data_subject_request`.
- No DPAs signed; no per-vendor review records.
- Jurisdiction applicability register does not exist.
