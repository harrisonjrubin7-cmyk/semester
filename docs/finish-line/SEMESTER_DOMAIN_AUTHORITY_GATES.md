# Semester domain authority gates

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |
| **Result** | **0 of 14 domains may be labeled authoritative.** |

## The rule

No domain may be labeled authoritative until **every applicable gate** passes.
A gate is not applicable only by a written decision with a reason (a column
below marked `n/a` carries its reason in the notes). A user interface existing
is not a gate. The repository agrees: `docs/DOMAIN-REPLACEMENT-REGISTER.md`
computes "0 of 14 replaceable" and `docs/UNIVERSITY-OS-ARCHITECTURE.md` says
Semester is the system of record for none of them today.
`app/src/lib/governance/data-contracts.ts` names an external record-holder for
every domain.

## The 21 gates

| # | Gate | Passes when |
| --- | --- | --- |
| 1 | Functional parity | A matrix against the incumbent's used features is filled and every used feature is present or consciously excluded |
| 2 | Data authority | The domain's records are declared authoritative in a data contract the institution signed |
| 3 | Data model completeness | The model covers the incumbent's required record types and lifecycle states |
| 4 | Tenant isolation | A cross-tenant denial suite covers every table in the domain and runs in CI |
| 5 | Accessibility | Conformance evidence from a qualified reviewer, including assistive-technology testing |
| 6 | Security | Threat model, scope-checked privileged functions, independent assessment |
| 7 | Privacy | Classification, retention, consent, export and erasure, and a signed DPA |
| 8 | Auditability | Every sensitive action is logged in a tamper-evident, searchable trail |
| 9 | Integration | A real connector to the system of record passes real-source acceptance |
| 10 | Migration | A rehearsed migration of real data with signed-off exceptions |
| 11 | Reconciliation | Reconciliation against the incumbent has run on real data with zero unexplained differences |
| 12 | Dual run | Enough distinct periods in parallel with the incumbent with agreed tolerances |
| 13 | Rollback | A rollback to the incumbent has been exercised, not described |
| 14 | Support | Named, staffed support with a severity model and a backup |
| 15 | Monitoring | Alerts on the domain's critical paths reach a person |
| 16 | SLO | An SLO is measured for the domain and has been met for a stated window |
| 17 | Training | Role-specific training delivered and recorded |
| 18 | Documentation | Operator, user and exit documentation current and dated |
| 19 | Institutional approval | The institution's named approvers have signed |
| 20 | Commercial readiness | An executed agreement and price cover the domain |
| 21 | Outcome proof | Measured results against agreed metrics, shared with the institution |

## Scorecard

Legend: `○` no evidence in the repository · `◐` partial — a mechanism, a
synthetic-data check, or a self-run artifact exists · `n/a` not applicable (see
notes). **No cell is `●`.** `●` would require target-environment, third-party or
customer evidence, and none exists for any domain. A `◐` never counts toward a
pass.

| Domain | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | Passed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Learning | ○ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Course platform (Course Studio) | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| AI | n/a | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | n/a | n/a | n/a | ◐ | ◐ | ○ | ○ | ○ | ◐ | ○ | ◐ | ○ | 0 |
| Advising | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Registration | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Academic record | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Gradebook | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Degree planning | ○ | ○ | ◐ | ◐ | ○ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Student account | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Campus services | ○ | ○ | ◐ | ◐ | ○ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Career | ○ | ○ | ◐ | ◐ | ○ | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Family | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | n/a | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Institutional governance | ○ | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ◐ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | 0 |
| Company operations | n/a | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ◐ | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ○ | ◐ | n/a | ◐ | ○ | 0 |

**Notes on `n/a`.**

- *AI:* there is no incumbent AI system to match, migrate or dual-run, so
  gates 1, 10, 11 and 12 do not apply. Gates 9, 13, 14 and the AI-specific
  controls are in the [AI assurance program](SEMESTER_AI_ASSURANCE_PROGRAM.md).
- *Family:* no system of record exists to integrate with or migrate from;
  sharing is student-controlled. Gates 9–12 do not apply. Gate 1 is `○`
  because no family-member surface exists.
- *Company operations:* these are Semester's own operations. There is no
  institution to approve them (19), and no incumbent to migrate from or
  dual-run (1, 10–12).

**Where the `◐` come from.** Gates 2–4, 6–8 and 18 are `◐` wherever a
migration, a `.check.sql` suite and a document exist for the domain (see the
[register](SEMESTER_RELEASE_READINESS_REGISTER.md), sections C and D). They are
synthetic or self-run evidence. Gate 9 is `◐` only where a real protocol
exists (LTI 1.3 for learning, course platform and gradebook; Stripe for company
operations; SAML, SCIM for governance). Gate 20 is `◐` for company operations
because one live monthly checkout was accepted
(`docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`) and for AI because the
spend meter and plan models exist. Gate 11 is `◐` for student accounts only
because reconciliation tables and logic exist.

## Gates that fail for every domain

These seven are the structural blockers. They need a customer, a real source
system or a person, and cannot be closed by code alone.

| Gate | Why every domain fails | What closes it |
| --- | --- | --- |
| 9 Integration | `ADAPTERS` is an empty array in two registries and the generated function registry; every SIS, degree-audit, advising, career and bursar integration is a mock plus a contract test; no live inbound webhook endpoint exists | One real connector accepted against a real source |
| 10 Migration | The migration CLI, ten domain specs and workbooks exist and have **never been run against a real institution** | A rehearsed real migration with signed exceptions |
| 11 Reconciliation | Reports exist for synthetic data only | A real-data reconciliation run |
| 12 Dual run | Comparison of supplied exports exists; nothing runs in shadow | Distinct real periods in parallel |
| 13 Rollback | Rehearsal-readiness logic only; production has never been restored | One exercised rollback |
| 19 Institutional approval | `named-tenant-approval.ts` is a mechanism; Vanderbilt is `approval-pending` and the file says repository evidence is not tenant approval | Signed approval by named approvers |
| 21 Outcome proof | Outcome tables and blank templates | Measured pilot outcomes |

## Domain notes

Each domain: what the repository has, what it cannot claim, and the first gate
to work. Detail is in the register.

| Domain | Built (synthetic/self-run) | Cannot claim | First gate to work |
| --- | --- | --- | --- |
| Learning | Study, Guide, Drill, Lesson, CourseHub, spaced repetition; Canvas via the student's own token; LTI launch | Faculty side is sandbox; derived and student-owned only | 9, then 17 |
| Course platform | `course_ai_rules`, `course_guidance`, `study_packs` and their RPCs | A course shell, roster, submissions, question banks, rubric levels, QTI or Common Cartridge export | 1 (write the parity matrix), 3 |
| AI | Shared-key function, institution gateway, data-class ceiling T2 (D-1260), spend meter, kill switch | Device-key routes outside the kill switch; no filed quality baseline | AI-specific gates in the [AI program](SEMESTER_AI_ASSURANCE_PROGRAM.md) |
| Advising | Student-controlled advisor share with expiry, meeting mode, reconciliation | Case model, caseloads, advisor notes, an EAB/Starfish connector | 3 |
| Registration | Transactional ledger: terms, sections with seats, waitlist, holds, overrides, idempotent enroll/drop/withdraw | **A SIS adapter** (`writeback.registration_submit`: "not built"); off at every school | 9 |
| Academic record | Append-only ledger, proposer ≠ approver, hash chains | Transcript issuance; official export formats | 3, 9 |
| Gradebook | Append-only entries, second-person moderation, release, regrade, registrar JSON export | Passback proven against a real LMS; the domain register still says "no gradebook of record" and must be updated | 9 |
| Degree planning | Student-entered estimate | An audit engine; registrar certification; DegreeWorks/uAchieve connector | 2, 3 |
| Student account | Append-only entries, payment plans, reconciliation tables | A payment provider; amounts are entered by hand | 9 |
| Campus services | Dining orders and balances (10 tables) | Housing has no migration (sandbox only); CBORD, Handshake, Campus Groups, Rave, GTFS are mocks | 9 |
| Career | Talent profiles, mentorship, opportunities, skill claims | A real employer; a credential an employer can verify | 3 |
| Family | Student-controlled invites, grants, shares, guardian links with restrictions | A family-member surface; K-12 guardian flows in production | 1, 5 |
| Institutional governance | Control-plane tabs, rollout, offboarding case workflow, SSO/SCIM mechanisms, legal holds | Staff operations console for a university; real IdP acceptance | 4, 19 |
| Company operations | Operator console, Stripe billing (live monthly acceptance), GTM tables | Annual charge, refund, failed renewal, dispute; any institutional invoicing | 20, 14 |

## Keeping this honest

- The scorecard is a table in a document. A guard (`app/src/lib/ops/finishline.test.ts`)
  refuses any register row at `authoritative` without a cited evidence file. It
  does not yet read this scorecard. Reading it is a follow-up
  ([90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md), action 8).
- `docs/DOMAIN-REPLACEMENT-REGISTER.md` is stale on registration and gradebook
  (it cites only the sandbox for registration and has no row for the gradebook
  migration). Its authors should reconcile it to this table or this table to it.
  Until then the code and `20260929300000`/`20260929310000` win.
- `docs/CAPABILITY-PARITY-MATRIX.md` is a **screen-width** matrix, not functional
  parity. Gate 1 therefore has no evidence for any domain.
