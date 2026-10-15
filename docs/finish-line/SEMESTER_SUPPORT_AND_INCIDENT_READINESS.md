# Semester support and incident readiness

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin (sole responder; backup `UNASSIGNED`) |
| **Result** | **Red.** Mechanisms exist; the staffed service does not. |

## What exists

| Capability | Code / document | State |
| --- | --- | --- |
| Ticket intake | `support_tickets`, `support_ticket_messages`, `open_support_ticket`, `support_reply`, `support_ticket_queue`; `support-reply-notify` function; `SupportTicketsPanel.tsx`; `screens/Support.tsx` | built and tested; **send is behind `supportTickets`, off by default** |
| Help requests | `help_requests`, `HelpInbox.tsx` | built |
| Operator queue | `console/SupportQueue.tsx`; `support_access` break-glass windows (`support-access.check.sql`, 25) | built |
| Feedback | `feedback`, `SaySomething.tsx`, `beta_feedback` | built |
| In-product handoff | `ScreenGuide` with `FixThis` on every screen | built; 13 of 96 screens link to support directly |
| Triage, macros, severity map | `docs/support/internal/*` | documents |
| Support model | `docs/support/README.md` (status "PARTIAL"; "not staffed beyond one person"), `docs/commercial/SUPPORT-OPERATIONS.md` ("LAUNCH RED UNTIL CHANNELS, HOURS, OWNERS AND BACKUPS OPERATE") | document |
| SLA | `docs/trust/SLA.md` | "NOT_STARTED as a commitment"; the public site says the founder is on call with no 24/7 rota |
| Incident process | `SECURITY.md` (severity clocks: critical 2 days, high 14, medium 60, low 180), `docs/CRISIS-RESPONSE-RUNBOOK.md`, `docs/INCIDENT-RECOVERY-PLAYBOOK.md`, `docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md`, 16 runbooks `docs/sre/runbooks/RB-01..16` | documents; clocks held by `security.test.ts` |
| AI incident | `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`; one production kill-switch drill (2026-09-29) | drilled once |
| Status page | `app/public/status.html`, `status-incidents.json`, `status-feed.xml`, `lib/statusnotice.ts`; hourly `production-smoke.yml` probes | built |
| Tabletop | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` | repository walkthrough only |

## What is missing

1. **A support address.** `docs/LAUNCH-DECISIONS.md` #2 and the security
   contact are a personal Gmail. `docs/DEFINITION-OF-DONE.md` row 9 says
   "Support has no address yet."
2. **A second person.** One owner, no backup, no on-call rota
   (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`, `SECURITY.md`, `ROLLBACK.md`).
3. **Alert delivery.** Probes write to a `status-data` branch. Nothing pages a
   person. Detection is a manual read. `docs/sre/03-OBSERVABILITY.md` and F-08.
4. **A signed or stated service level.** SLOs are defined in code
   (`lib/governance/error-budgets.ts`) and unmeasured.
5. **Target-environment drills.** Restore, rollback, data rights, revocation and
   offboarding drills are open (EXT-011); the tabletop was documents only.
6. **Customer communication.** Templates exist; no sent notice.

## Minimum viable support for a pilot

A pilot cohort of at least 10 students over 26 weeks does not need 24/7. It
needs a promise it can keep. The public site's "24/7" and "6–8 week" claims
disagree with one responder and a 26-week pilot
(`commercial/READINESS_GAP_MATRIX.md`) and should be withdrawn or made true
before any pilot paper is signed.

| Item | Minimum | Evidence |
| --- | --- | --- |
| Channel | One monitored non-personal address plus in-app tickets on | message delivered and answered in a test |
| Hours and clocks | Business-hours window and first-response time stated in the pilot paper | pilot agreement |
| Severity | Four levels from `docs/support/internal/` mapped to response and update times | document + one worked example each |
| Escalation | Named backup who can act without the founder | assigned seat |
| Alerts | Probe failure and ticket-queue age reach a phone | induced failure received, timestamped |
| Status | Incident posted to the status page within the stated time | one dry-run post |
| Customer notice | Template for outage, data incident and AI incident | dry-run send to a test list |
| After action | Review within 5 working days of any P1/P2 | template filed |

## Severity ladder (to confirm against `docs/support/internal/`)

| Level | Meaning | First response | Updates |
| --- | --- | --- | --- |
| S1 | Cross-tenant exposure, data loss, security incident, registration-window outage | within hours, even out of hours during a window | at least every 2 hours |
| S2 | A core student path down for a cohort | same business day | daily |
| S3 | A feature degraded with a workaround | next business day | on change |
| S4 | Question, request, cosmetic | within 2 business days | on resolution |

The numbers are proposals for the founder to adopt, not commitments, and are not
yet in any agreement.

## Incident playbook gates

| Gate | Passes when | Today |
| --- | --- | --- |
| I-1 Detect | An induced probe failure reaches a person | not met |
| I-2 Triage | Severity assigned from the ladder within the clock | documents only |
| I-3 Contain | Kill switch exercised per surface (AI done; integration, community, GTM, trust room not) | partial |
| I-4 Communicate | Status and customer notices sent from templates | not met |
| I-5 Recover | Restore and rollback exercised in the target environment | not met |
| I-6 Learn | After-action written and actions tracked | not met |
| I-7 Backup | A second person has run I-1 to I-4 once | not met |

## Order of work

1. Non-personal support address; turn on `supportTickets` in the pilot build.
2. Alert path (see [SEC-05](SEMESTER_SECURITY_FINISH_LINE.md)).
3. Name a backup, even a part-time contractor or advisor, and run I-1 to I-4.
4. Target-environment drills, filed under `docs/evidence/`.
5. Rewrite public availability claims to what I-1 to I-4 support.
