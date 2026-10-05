# Role cross-workflow map

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

Step-level status for 17 workflows and 319 steps is in [`SEMESTER_WORKFLOW_CATALOG.md`](../master/SEMESTER_WORKFLOW_CATALOG.md) and [`SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md): 203 of 319 steps not fully built, 75 with nothing built, 68 of the unbuilt steps P0. This page covers the ten workflows in the brief.

**Controlled-action pattern, as built.** Capability check, idempotency, audit write and a state guard exist in three flows. No flow writes an outbox event or a receipt row; `private.domain_outbox_events` has 0 rows on the live project and its only producers are the productivity commands. Impact previews are UI only.

| # | Workflow | Built | Server-side control | Missing | Class |
| --- | --- | --- | --- | --- | --- |
| 1 | Student ↔ Faculty | Gradebook (enter, moderate, release, regrade, export), Course Studio publish | Course-scoped capability, idempotency key, append-only versions, second-person moderation | Assignment authoring, submissions, feedback workspace, office hours (faculty side), passback invocation; gradebook flag is off at every school | Native but incomplete |
| 2 | Student ↔ Advisor | Student shares an agenda or snapshot; advisor reads it; student revokes | Live `academic_advisor` grant, expiry at most 120 days, payload at most 32 KB, audited reads | Caseload, appointments, referrals, outreach, notes, success plans | Native but incomplete |
| 3 | Student ↔ Registrar | Enroll, drop, withdraw, waitlist, registrar decide, override, term and section desk | `registration_enroll`, `registrar_decide`: capability, idempotency key, stale-seat guard, per-term advisory lock, `registration_audit_event` | Hold and completion feed (adapter registries are empty), time tickets issued by registrar, degree audit, graduation, transfer credit, reconciliation action, outbox | Native but incomplete; official handoff is integrated-only and unbuilt |
| 4 | Student ↔ Student Accounts | Ledgers, requests, payment plans, student view | `finance:request`, `finance:approve`, `finance:approve_high` separated; hash-chained ledgers | In-app hold handoff, refund and write-off executor, statements | Native but incomplete |
| 5 | Student ↔ Campus Services | Dining orders and ledger; office action feed; housing and library screens are student-local | `dining:operate`; `institution_action:publish` | Housing maintenance, booking, accommodation decision, library | Mixed |
| 6 | Student ↔ Career / Alumni / Employer | `ListingDesk`, `Opportunities`, `talent:search` over opted-in profiles | Opt-in and expiry in `talent` reads | Employer portal, applications, outcomes, alumni staff | Native but incomplete |
| 7 | Student ↔ Family | Invite, scoped grant, revoke, access events, export withholds guardian restrictions | `family_grants`, `guardian_link_restrictions`; `family.check.sql` | Guardian workspace UI; plans on `Family.tsx` are saved on the device only | Native but incomplete |
| 8 | Student ↔ Community | Membership, reporting, moderation queue, escalation agreements (two people), appeals | `community:*`; `community.check.sql` | Appeals UI completeness UNVERIFIED | Native; supportable for moderator and reviewer |
| 9 | Institution ↔ Semester | Rollout state machine, implementation tables, migration center, integration dashboard, offboarding RPCs | `tenant_rollout` exit gates, `school-offboarding.check.sql` | Tenant creation, pilot and implementation console views, QBR and renewal UI, offboarding UI | Native but incomplete |
| 10 | Semester ↔ Partner / Developer | none | none | Sandbox, scoped credentials, certification, marketplace, deprecation | Not started |

## Operator workflows (Semester team)

| Workflow | Built | Missing |
| --- | --- | --- |
| Approvals | `request_approval`, `decide_approval`, `console_act`; two-person; fresh MFA; audit before effect | Executors for eight of eleven duties; outbox; receipt row; never run in production |
| Break-glass | Request, close, review; four-hour cap; honoured by `has_capability` on a school | Never used in production |
| Support | Student tickets, operator queue, reply with notification outbox and dead-letter, time-limited student-approved access | Support lead, SLA view |
| Rollout and kill switch | `feature_kill_switch`, `tenant_feature_policy`, `tenant_rollout`; honoured by registration, dining, integration paths | Console control; release-level pause; engaged by table write today (RG-29) |
| Incident | Static playbooks | Declaration, commander, comms, postmortem (RG-30) |
| Pilot and implementation | Tables only | Views and workflows (RG-28) |

## Operator bypass to close first

Per [`docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md`](../ops/SECURITY_EXPOSURE_CLASSIFICATION.md) finding F-1, kill switch, provider registry, trust and GTM tables are browser-writable under RLS only, so a holder of the capability can change them without the approval path. Until fixed the Console cannot say it "cannot bypass approval" (RG-06).
