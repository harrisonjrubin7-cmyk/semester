# Workflow expansion register + contract (14 Oct)

From "map out and continue mapping out…pdf". The register (28 workflow families) and contract are filed unchanged. Every readiness field in the register is **Unverified** — correct, nothing here changes that.

## Mapping corrections — applied at the source
The PDF found seven steps the word-matcher linked to the wrong domain. Fixed in `ui_kits/workflow-runner/runner-data.js` (`RUNNER.stepScreen`), which the runner now reads before falling back to word matching, so every generated view picks it up:

| Step | Was | Now |
|---|---|---|
| Hold office hours | Financial account | C · Office hours |
| Assign capacity/waitlists | AI gateway | E · Capacity management |
| Approve/deny exception | Developer platform | E · Overrides |
| Review support request | Financial-support handoff | D · Support request history (general intake; financial is one category) |
| Find campus resource | Course resources | B · Campus services |
| Admin training | AI gateway | K · Admin training |
| Launch readiness gate passed | Student workspace | K · Launch readiness gate passed |

All seven targets exist in the master catalog.

## Classify the gap findings before adding UI
From the Oct 5 inventory: 84 steps without a screen, 13 roles without a workflow, 419 screens no workflow references. Background validation steps often need no screen, and public marketing pages need no academic workflow. Classify each as *needs screen / background step / out of scope* first.

## Register rows → where they're already prototyped
| ID | Domain · capability | Existing kit(s) |
|---|---|---|
| PROP-WF-001 | Identity · Account and institutional membership | semester-account, platform |
| PROP-WF-002 | Student workspace · Daily action loop | student, course-workspace |
| PROP-WF-003 | Planning · Degree and term planning | academic-records (degree audit), governed-workspace prereq |
| PROP-WF-004 | Registration · Enroll waitlist add drop withdraw | readiness-pilot, registrar-replacement (enrollment engine) |
| PROP-WF-005 | Faculty · Course setup and publishing | course-studio |
| PROP-WF-006 | Learning · Syllabus ingestion | course-workspace, study-studio |
| PROP-WF-007 | Learning · Study and mastery | study-studio |
| PROP-WF-008 | Assessment · Assignment submission | course-workspace, academic-records |
| PROP-WF-009 | Grades · Feedback grade release and correction | academic-records (gradebook) |
| PROP-WF-010 | Advising · Advising and success plan | role-workspaces, academic-records (plan lock) |
| PROP-WF-011 | Tutoring · Tutoring and peer mentoring | every-screen D/G |
| PROP-WF-012 | Support · Service request and referral | ops-inbox, every-screen D |
| PROP-WF-013 | Accessibility · Accommodation and accessible delivery | every-screen G (accommodations) |
| PROP-WF-014 | Registrar · Catalog sections and academic calendar | registrar-replacement |
| PROP-WF-015 | Registrar · Transfer degree audit graduation transcript | academic-records (transcripts) |
| PROP-WF-016 | Admissions · Prospect application and matriculation | every-screen B (admissions) |
| PROP-WF-017 | Student accounts · Charges payment plans refunds and holds | native-finance |
| PROP-WF-018 | Aid · Scholarships aid and eligibility | native-finance, every-screen F |
| PROP-WF-019 | Campus · Housing dining spaces transit and jobs | every-screen G |
| PROP-WF-020 | Community · Organizations events marketplace and moderation | community, network |
| PROP-WF-021 | Career · Evidence portfolio opportunities and hiring | network (careers) |
| PROP-WF-022 | Alumni · Alumni and lifelong learning | network (alumni) |
| PROP-WF-023 | Privacy · Family advisor sharing export correction deletion | network (family), security-assurance |
| PROP-WF-024 | AI · Governed assistance and bounded agents | agent-ops, governed-workspace |
| PROP-WF-025 | Integration · Connect sync reconcile and domain replacement | live-integration, registrar-replacement migration |
| PROP-WF-026 | Institution · Tenant configuration governance and rollout | console, pilot-launch, roles-access |
| PROP-WF-027 | Developer platform · Partner app certification installation retirement | slack-integration, live-integration |
| PROP-WF-028 | Operations · Release incident recovery renewal and company workflows | ops, release-package, assurance tranche |

Each row should adopt `semester_workflow_contract.json` (identity, scope, definition, authority, controls, completion, six readiness facts, ten acceptance suites) as it moves into the repo. The six readiness facts match the completion register's columns.

## Workflow contract schema + validation (14 Oct)
- `workflow_contract.schema.json` — your JSON Schema (draft 2020-12). Your results: valid example accepted, 14 invalid cases rejected.
- `validate-contract.mjs.txt` — semantic checks JSON Schema can't express: transitions name real steps and states, initial/terminal states exist, every state reachable, no transition leaves a terminal state, every failure code has a recovery path and every recovery path is raised by a step, recovery tests exist, readiness facts verified in order, no official write in personal/read-only/shadow mode. Rename to `.mjs`; run after schema validation: `node validate-contract.mjs contracts/*.json`.
- `contracts/registration.enroll.json` — full contract from `registration_recovery_matrix.csv`: 4 steps, 28 transitions, all 17 recovery paths with user messages and retry policies, 18 acceptance tests, readiness all unverified except a design prototype (reviewer still to be named).
- `contracts/registration.workflow.example.json` — your minimal example.

Checked here (in-browser, same logic): both contracts pass; six negative mutations all rejected. After merging the "every state can reach a terminal" check from your Python validator (audit-pack/), it caught two more dead ends in my contract — awaiting_information and awaiting_approval had no exit — now resolved by revalidation or denial (28 transitions). Building the full contract caught three modelling errors in my first draft — "enrolled" and "waitlisted_or_denied" were terminal but had outgoing transitions, and a correction re-opened a completed run. Corrections and drops are now separate workflows. Mode changed from `read_only` to `assist`: Semester submits, the SIS stays the writer.

## Audit pack (14 Oct)
`audit-pack/`: your Python validator, the 28-row loop completion register, the full audit spec and validation notes. The other CSVs in the pack are byte-identical to ones already filed. The two validators are complementary — Python adds "every state can finish"; the JS one adds terminal-exit, failure-code coverage and readiness order — so the JS one now includes both. Note from your validation notes, adopted: `human_authority_required` describes the institution's delegated rules; it doesn't mean every eligible enrollment is approved by hand.

## Engine v2, drop/correct, screen loops, tests (14 Oct)
- **engine/** — your v2 engine schema and pack (now `engine/pack/`). Your updated schema includes `delivery.transport` and rejects inline writes on its own; it validates all 25 documents here (ajv, draft 2020-12), including my drop and correct contracts, so it replaces my patched copy.
- **contracts/registration.drop.v2.json, registration.correct.v2.json** — the two workflows the enroll contract hands off to. Drop: deadline/min-load/aid-visa impact needs approval, academic and refund receipts kept separate. Correct: original kept, policy version must match the time of the original action, a second registrar approves the exact change, editing after approval voids it. Both valid against v2 and pass the semantic checks. The enroll contract is still v1; converting it is the next step.
- **ui_kits/master-catalog/screen-loops.js** — workflow loop for each of the 419 unreferenced screens (118 enter→act→receipt, 102 request→authorize→audit, 62 public content, …). Data only for now; the catalog doesn't display it yet.
- **tests/** — your recovery test cases and results, plus a crosswalk to the contract (17/17 agree after the REG-01 fix).

## Handoff fixes from your binding findings (14 Oct)
Checked against `handoff/semester-platform/supabase/migrations/`: BIND-01, BIND-02 and ONB-01/02 match the code. Patches (proposed, not applied):
- **101_controlled_actions_hardening.sql.txt** — `execute_action` now ACCEPTS (queues) instead of saying executed; `committed` needs effect proof via worker-only `ctl.record_effect` with fencing; idempotency scoped to tenant + actor + capability + key with payload-hash check and race-safe insert; `ctl.jobs` (lease, fence, attempts, dead letter) + `ctl.consumer_inbox`; compatibility view maps committed → executed for old clients.
- **111_onboarding_evidence.sql.txt** — `api.record_activation` (client named any definition) replaced by `api.evaluate_activation`, which derives activation from server-only `onboard.domain_events` for the assigned journey version; `api.complete_step` enforces order and requires a server attestation for verified steps, using 110's `onboard.progress`.

## Reference model fix
`tests/registration_recovery_reference_model.py`: the duplicate lookup ran after the freshness and authority checks, so retrying a committed request while the source was stale returned "awaiting information" instead of the original receipt (breaks REG-07). Moved it directly after identity/permission. Two tests added (`test_REG_07b`, `07c`): replay returns the original receipt when stale; replay still needs identity. Not run here (no Python).

## Registration contracts are all v2 (14 Oct)
`contracts/registration.enroll.v2.json` converts the enroll contract to the engine v2 schema: same 4 steps, 28 transitions, 17 recovery paths and 18 tests; retry policies mapped to v2 retry classes; compensation kinds set (projection repair for partial/timeout/refund, authorized correction for swap and wrong enrollment); each recovery path's from-states derived from the transitions. Valid against v2 (ajv) and the semantic checks. "Designed" is now **unverified** — the v1 file marked it verified with "reviewer: pending", which isn't evidence. v1 kept as `registration.enroll.v1.json`.

Enroll → drop → correct now share one schema and hand off by id.
