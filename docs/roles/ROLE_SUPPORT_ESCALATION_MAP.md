# Role support and escalation map

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

Full model: [`SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md`](../SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md) (§1.4 routing, §1.5 severity, §1.7 escalation, §3 support access, §3.9 prohibited actions), [`CAMPUS-ESCALATION-POLICY.md`](../CAMPUS-ESCALATION-POLICY.md), [`CAMPUS-MODERATION-SOP.md`](../CAMPUS-MODERATION-SOP.md), [`INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md), [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md) (24 lines).

## Paths that exist

| Path | Who | Mechanism | Control |
| --- | --- | --- | --- |
| Student ticket | Any signed-in student | `open_support_ticket`, `my_support_thread`, `reply_to_my_ticket` | Student owns the thread; notification through `support_notification_outbox`, dead-lettered after retries; consent boundary |
| Operator queue | `support_agent` with `support:ticket` | `support_ticket_queue`, `support_reply` in Console | Fresh MFA on reply paths; audit |
| Time-limited support access | Student approves a supporter | `create_support_access`, `support_access_grant` (≤ 7 days, student and supporter differ), `support_access_windows` banner | Consent record FK; audited events |
| Institution help inbox | Office staff with `help_request:respond` | `send_help_request`, `HelpInbox.tsx` | School-scoped |
| Break-glass | `incident_responder` or `platform_admin` requests | `breakglass:request` → `break_glass_grant` (≤ 4 hours, scoped capabilities, review by someone else) | Two-person approval; never used in production |
| Community report | Any member | Reports, `Moderation.tsx` queue, `community:review`, `review_senior`, escalation agreements (one drafts, another activates) | `community.check.sql` |
| Data-subject request | Student | `data_subject_request`, `data_request:handle` | `answer-rights-requests.check.sql`; no privacy-office hand-off for correction or deletion beyond self-serve account deletion |
| Integration pause or replay | `integration_admin` | `integration_set_paused`, `integration_request_replay` | Capability |
| Kill switch | `university_admin`, `incident_responder` (`killswitch:engage`) | Table write to `feature_kill_switch` | No console control (RG-29) |

## Escalation by role (current)

| Role | First line | Escalates to | Gap |
| --- | --- | --- | --- |
| Student | Support ticket, help inbox | Support agent; office staff | No in-app hold handoff or tracking |
| Faculty, TA | Help inbox | Registrar or support | No faculty support queue |
| Advisor | Help inbox | Student-success leader | No leader role; no referral workflow |
| Registrar, admin | Support ticket | Support agent; Semester implementation | No customer-side escalation roster |
| Institution admin | Support ticket | Customer success; incident responder | Incident declaration not built |
| Moderator, reviewer | Moderation queue | `trust_safety_senior`; escalation agreement | Agreements need two people |
| Semester operator | Console command center | Another seat | One person holds every seat; no second approver exists (R-018 in `docs/program/RISK_REGISTER.md`) |
| Developer, partner | none | none | Not started |

## Prohibited and bounded

Support staff hold no standing access to academic records, finance or institution administration. Support reads minimum context for the case; exceptional access is a student-approved window or a two-person break-glass. `support-access.check.sql` and `company-roles-student-data.check.sql` hold this; the first line of defence is that company roles carry no student-record capability (`rolelaunch.test.ts` also asserts this for internal roles).

## Gaps (feed the register)

1. Incident severity, commander, communications lead and post-incident review have no tables or screens (RG-30).
2. Rota: 24/7 coverage does not exist; named owner and backup are the same person or unassigned ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)).
3. Schema-deploy failure and Edge Function 500s are invisible to monitoring; the one automated alert is AI spend (`MONITORING.md`).
4. No Sentry or APM was found; the signals are the hourly production smoke and a "main is red" issue.
5. Production restore has never been performed.
