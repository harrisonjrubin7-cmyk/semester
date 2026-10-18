# Implementation Responsibility Matrix

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BLANK MATRIX — RESPONSIBILITIES AND AUTHORITIES UNASSIGNED** |
| Owner | Harrison Rubin — company-side implementation coordinator; customer sponsor and accountable workstream owners unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md`](../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md), [`INSTITUTIONAL-IMPLEMENTATION-GUIDE.md`](INSTITUTIONAL-IMPLEMENTATION-GUIDE.md), and [`../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md) |

## Use rule

Populate this matrix with named people or customer-accepted functions for the exact pilot/order and environment. `A` means final accountable decision authority, `R` performs the work, `C` is consulted and `I` informed. Joint acceptance must still identify each party's authority. A blank, ambiguous, unaccepted, unavailable or unbacked responsibility blocks the affected milestone; silence never transfers authority.

## Responsibility schedule

| Workstream / decision | Semester A / backup | Semester R | Customer A / backup | Customer R | C / I | Required evidence | Due / expiry | State / blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| problem, scope, cohort, exclusions and success | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | signed scope, scorecard and exclusions | `[TBD]` | blocked |
| commercial terms, procurement and signing authority | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | counsel/finance | executed authorized documents | `[TBD]` | blocked |
| data roles, map, notices, retention, rights and offboarding | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | privacy/records | approved data schedule/map and procedures | `[TBD]` | blocked |
| security, risk, assurance and residual-risk acceptance | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | security/counsel | findings, remediation, target acceptance | `[TBD]` | blocked |
| accessibility and accommodations | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | qualified reviewer | workflow test, barrier/accommodation route | `[TBD]` | blocked |
| identity, roles and access review | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | IAM/data owners | group/role matrix and target UAT | `[TBD]` | blocked |
| integrations, source authority and reconciliation | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | system owners | target sandbox, mapping and reconciliation | `[TBD]` | blocked |
| tenant/configuration/release/rollback/recovery | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | operations | target readback and exercises | `[TBD]` | blocked |
| communications, consent/invitation, training and UAT | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | users/support | approved materials, attendance and results | `[TBD]` | blocked |
| support, monitoring, incident and status communication | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | specialists | channels/rota/exercise/customer contacts | `[TBD]` | blocked |
| measurement, weekly review and change control | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | analyst/privacy | frozen sources, decisions and change log | `[TBD]` | blocked |
| go/no-go, pause/stop, conversion or closeout | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | all gate owners | signed decision and evidence manifest | `[TBD]` | blocked |

## Control rules

- Every accountable role needs authority, availability, backup, handoff and escalation.
- System/data owners approve their scope; implementation coordination does not create legal, security, privacy, academic-record or contracting authority.
- Request/propose/configure and approve/accept duties remain separate where required.
- One owner cannot self-attest missing independent or customer evidence.
- A date does not waive a gate; overdue dependencies escalate or move the milestone.
- New users, data classes, providers, integrations, writes, measures or commitments require change review and updated responsibility acceptance.

## Evidence state

**Repository evidence.** Implementation, legal, trust, engineering, commercial and support artifacts identify the decisions this matrix must assign.

**Operational evidence.** This matrix names no customer, accepted functions, backups, authority, dates, execution record or completed implementation.

**Missing test/proof.** Populate every in-scope row; verify authority and backup availability; rehearse handoffs/escalations; link current evidence; obtain company and customer acceptance; maintain changes through closeout.

## Claim ceiling

Semester may use this blank matrix to allocate implementation work and decision authority. Its existence does not make any role staffed or milestone complete.

## Prohibited claims

Do not claim assigned ownership, staffed delivery, joint accountability, accepted RACI, implementation readiness, customer sign-off or operational coverage while required fields remain blank or unverified.
