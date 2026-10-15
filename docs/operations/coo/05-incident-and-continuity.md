# 05 · Incident management and business continuity

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — PROCESS NOT EXERCISED; RECOVERY TARGETS NOT MEASURED** |
| Owner seat | `operations`; `security` holds the security-incident playbooks (vacant; the Founder is acting) |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`INCIDENT-RECOVERY-PLAYBOOK`](../../INCIDENT-RECOVERY-PLAYBOOK.md), [`INCIDENT-COMMUNICATIONS`](../../operating-model/INCIDENT-COMMUNICATIONS.md), [`ON-CALL-AND-ESCALATION-POLICY`](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md), [`BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN`](../../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md), [`DEGRADED-MODE-MAP`](../../DEGRADED-MODE-MAP.md), [`ROLLBACK`](../../../ROLLBACK.md), [`RESTORE`](../../../RESTORE.md) |
| Claim ceiling | Semester may say it has documented incident and continuity procedures and a dated logical dump-and-restore rehearsal. It may not claim on-call coverage, proven disaster recovery, any recovery time or recovery point, or institutional incident readiness. |

## Principles

1. **Restore a verified safe state, not a green light.** A healthy status check is not recovery; the verification in the playbook is.
2. **Suspected cross-tenant exposure is SEV1 until disproven, not until confirmed.** The asymmetry is deliberate.
3. **Containment precedes diagnosis for suspected exposure.** Revoke first; understand afterwards.
4. **Never weaken a control for availability.** No relaxation of authentication, authorization, consent or policy to restore service.
5. **University contacts hear from Semester before they hear from their students.**
6. **Do not retry an ambiguous official write.** Block and reconcile.
7. **Private student content is never part of a routine incident view.** Plans, notes, reflections, energy selections and unshared context packets stay out.
8. **One named owner.** An incident has a person in charge, never a channel.

## Severity crosswalk

The repository uses SEV1–SEV4 for incidents ([playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md)) and P0–P3 for support priority ([04](04-support-operating-model.md#priority)). The audit's draft used SEV-0 to SEV-4. This table is the mapping; the SEV1–SEV4 definitions in the playbook are authoritative.

| Incident severity | Meaning | Audit draft | Support priority | On-call level | Declare and assign a commander | Typical audiences |
| --- | --- | --- | --- | --- | --- | --- |
| **SEV1** | Suspected cross-tenant exposure; systemic authorization or consent failure; widespread unsafe official write; total outage | SEV-0, and SEV-1 when platform-wide | P0 | P0 | within 15 min of detection | Executive, security, counsel, affected institutions, students |
| **SEV2** | Core workflow broken for many users, including a broad SSO or LTI outage or an integrity failure | SEV-1 (limited) and SEV-2 | P0 or P1 | P1 | within 30 min | Affected institutions and students; support |
| **SEV3** | Degraded or partial service; stale source; accessibility defect; limited AI-quality issue | SEV-3 | P1 or P2 | P2 | same business day | Support; the affected tenant |
| **SEV4** | Isolated low-impact, cosmetic or single-user defect | SEV-4 | P3 | P3 | planned triage | Release notes or the case |

**Flags** add handling to any severity and choose the communication audience and approvers.

| Flag | Raised when | Adds |
| --- | --- | --- |
| `EXPOSURE` | Data exposure is suspected or confirmed | Counsel engaged at once; the notification decision ([S-07](03-raci-and-decision-rights.md#support-and-incidents)); evidence preservation; the exposure field in the notice |
| `RECORD` | An official record, grade, enrolment or ledger may be wrong | Freeze the affected workflow; preserve before and after versions; reconcile against the authoritative source; never "fix" silently |
| `SAFETY` | A person may be at risk | The [crisis runbook](../../CRISIS-RESPONSE-RUNBOOK.md); the school's verified crisis contact; trust and safety |
| `AI` | A model may have exposed, advised or acted outside policy | Disable the route; preserve prompts, context, policy decisions, tool calls and outputs; the AI audience in the notice |
| `A11Y` | A barrier blocks a critical journey | The accessible alternative in the notice; the accessibility lead |

## Roles

| Role | Does | Stage 0 holder | Rule |
| --- | --- | --- | --- |
| **Incident commander (IC)** | Owns the response; sets severity; freezes deploys; orders containment and rollback; sets the update time; decides when to close | Founder | At SEV1 and SEV2 the IC does not do the hands-on fix where staffing allows |
| **Technical lead** | Diagnoses and executes containment and recovery | Founder | Reports to the IC |
| **Security lead** | Threat analysis, evidence, forensics | Founder (acting) | Independent review at close |
| **Communications lead** | Drafts and sends notices from approved templates | Founder | Approvers per [audience](../../operating-model/INCIDENT-COMMUNICATIONS.md#audiences) |
| **Customer lead** | Tenant liaison; the customer's incident contact | Founder | One voice to each tenant |
| **Scribe** | Timeline, decisions, evidence | A log tool and a written timer | Never the IC |
| **Counsel liaison** | Notification and contractual questions | Outside counsel | Engaged on any `EXPOSURE` flag |

**Stage 0 compensating controls.** One person in every role is the weakness, so: pre-written notice templates ([TPL-12](templates.md#tpl-12-incident-record-and-status-update)); a visible next-update timer set at declaration; a rule that no change is made without a one-line entry in the timeline; the incident reviewed by an outside reader within five business days; and a standing instruction to call counsel at the first `EXPOSURE` flag. These reduce the risk; they do not replace a second responder.

### Commander authority

The IC may, without further approval: freeze non-essential deployments and high-risk administrative changes; disable a feature flag, route or kill switch; roll back a release; revoke sessions and tokens; suspend a tenant or provider route (with the `operations` seat); engage counsel and vendors; and set the communication cadence. The IC may not accept a risk, give a legal conclusion or contact a regulator.

## The incident lifecycle

```
Detect → Declare and classify → Assign roles → Contain → Preserve evidence
→ Communicate (continuous) → Recover → Verify → Close → Review and improve
```

| Step | Target (SL0) | Required output |
| --- | --- | --- |
| **Detect** | n/a | Signal, source, first-known time, affected service and tenant |
| **Declare** | SEV1 15 min; SEV2 30 min | Incident record with a unique ID; severity and flags; commander named |
| **Assign** | With declaration | Technical, security, communications, customer and scribe named, or the compensating control noted |
| **Contain** | As soon as safe | Smallest unsafe path disabled; non-essential deploys frozen; evidence preserved |
| **Communicate** | First notice SEV1 30 min and SEV2 60 min after declaration; then at the audience cadence | Notice per the seven-element rule: what happened, who is affected, what is affected, what to do now, what Semester is doing, next update, where to get help |
| **Recover** | — | Restored to a known-good configuration, tested replica, approved route, or a read-only or source-only fallback; no control weakened |
| **Verify** | Before close | Security, privacy, integrity, accessibility, source and reconciliation conditions for the affected path proved; not only a status check |
| **Close** | — | Named commander; recovery verified; communications sent; access revoked; corrective actions assigned |
| **Review** | SEV1 and SEV2 within 5 business days of stabilization | Blameless review ([TPL-13](templates.md#tpl-13-post-incident-review)) |

An incident cannot close without a named commander, a recorded recovery verification, and, while active, a future next-update time. The executable contract is in `app/src/lib/incident-recovery.ts`.

### The first fifteen minutes

1. Open the incident channel and record with a unique ID.
2. Assign the commander and the roles that exist; note any compensating controls.
3. Record first-known time, detection source, affected systems and tenants, suspected data classification and severity.
4. Freeze non-essential deployments and high-risk administrative changes.
5. Preserve logs, traces, snapshots, queue state, connector state and audit records.
6. Check for tenant-isolation, sensitive-data, academic-record, billing, submission and authentication impact.
7. Contain only where it lowers risk without causing worse secondary effects.
8. Open support macros; set the status-page cadence.
9. Engage counsel for suspected privacy or security breach, contractual notification, law enforcement or regulator questions.
10. Set the next update time, even if nothing new is known.

### Detection, honestly

Today the hourly production smoke detects loss of the Pages shell, its deployed module and stylesheet, and the production Supabase REST edge ([playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md)). Application exceptions, workflow correctness and named-person alert delivery are not monitored; a user report is still the only signal for those. Closing that gap is a prerequisite for any SL2 rung on incidents and is tracked on the [reliability dashboard](09-dashboards-and-indicators.md#d5-reliability-and-incidents).

## On-call by stage

| Stage | Coverage | What is promised |
| --- | --- | --- |
| 0 | The Founder, best effort; no rota; no paging test | Nothing |
| 1 | Primary and a trained backup for business hours; a tested SEV1 path after hours (primary, then backup, then counsel) | Nothing to customers until the exercise passes (SL2) |
| 2 | Rota of at least four with business-hours coverage and extended hours at peaks; SEV1 after-hours path; secondary tier | Per contract at SL3 only |
| 3 | 24×7 primary and secondary for SEV1 and SEV2; follow-the-week; a manager on call | Per contract at SL3 only |

**Shift handoff** ([H-14](handoffs.md#h-14-on-call-shift-handoff)) at every rotation: open incidents, open cases at P0 or P1, pending changes, known fragile points, recent alerts, any scheduled maintenance, and anything the next person would be surprised by. The outgoing person remains reachable for one hour. A rota is tested monthly with a safe synthetic alert and a recorded acknowledgement.

## Runbook index

| Situation | Runbook |
| --- | --- |
| Identity, LTI or SSO failure | [Playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md#identity-lti-or-sso-failure) |
| Source or sync failure | [Playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md#source-or-sync-failure); [`INTEGRATION-OPERATOR-RUNBOOK`](../../INTEGRATION-OPERATOR-RUNBOOK.md) |
| AI model or policy-engine failure | [Playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md#ai-model-or-policy-engine-failure) |
| Student workspace recovery | [Playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md#student-workspace-recovery) |
| Official-write or reconciliation failure | [Playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md#official-write-or-reconciliation-failure) |
| Bad release | [`ROLLBACK`](../../../ROLLBACK.md); [`MIGRATION-AND-ROLLBACK-RUNBOOK`](../../engineering-operations/MIGRATION-AND-ROLLBACK-RUNBOOK.md) |
| Data loss or corruption | [`RESTORE`](../../../RESTORE.md); [`DATABASE-OPERATIONS-RUNBOOK`](../../engineering-operations/DATABASE-OPERATIONS-RUNBOOK.md) |
| Safety or crisis report | [`CRISIS-RESPONSE-RUNBOOK`](../../CRISIS-RESPONSE-RUNBOOK.md) |
| Data-rights request in an incident | [`DATA-RIGHTS-REQUEST-RUNBOOK`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md) |
| Suspected cross-tenant exposure | [Below](#security-playbook-a--suspected-cross-tenant-access) |
| Compromised account | [Below](#security-playbook-b--compromised-account) |

### Security playbook A · suspected cross-tenant access

| | |
| --- | --- |
| Trigger | A row-level-security alert, a suspicious query pattern, a user or customer report, a bug report, or an audit anomaly |
| Severity | SEV1 with `EXPOSURE` from the first minute |
| Contain | Disable the affected endpoint, query path, flag or integration; revoke active sessions and tokens if compromise is possible; pause background jobs and exports on the same path; preserve logs, query evidence, audit events, the deployment version and request IDs |
| Investigate | Identify tenant A, tenant B, the data classes, the records and the time window; whether exposure was view-only, modified, exported or automated; the connection-pool and session-context behaviour; the code, policy, migration, cache, search, analytics or support-tool path |
| Recover | Patch the authorization fault; add regression coverage for the exact failure; run a comprehensive cross-tenant scan for the same control class under production-like roles and connection reuse; validate; counsel decides notification duties and customer communications |
| Close | Root-cause analysis, owner and dates for every action, executive review, evidence archived under the private evidence store |

### Security playbook B · compromised account

| | |
| --- | --- |
| Trigger | Impossible travel, unusual device or session, user report, credential-leak signal, suspected takeover |
| Contain | Revoke sessions and refresh tokens; disable high-risk actions and record changes for the account; require step-up reauthentication and recovery verification; preserve sign-in, IP, device, MFA, audit and command history |
| Investigate | Scope and period; data accessed, exports, role changes, actions and connected accounts; persistence (new MFA enrolments, recovery changes, API tokens, delegated access) |
| Recover | Restore verified control to the owner; reverse unauthorized changes through auditable correction workflows; notify affected people per policy and counsel; improve detection and add regression tests |

## Communications

The audiences, approvers and update cadences are in [`INCIDENT-COMMUNICATIONS`](../../operating-model/INCIDENT-COMMUNICATIONS.md) and enforced by `compose()` and the incident-notice table. This page adds three rules. The **status page** is updated by the commander at every update time. **Customer-specific contacts** are named by the tenant at launch and held in the private operations system; the repository holds none. A **calm but incomplete notice beats a late one**, because readers fill the gap with the worst interpretation.

## Post-incident review and learning

| Rule | Detail |
| --- | --- |
| Blameless | Systems, signals and decisions are reviewed; people are not |
| Timing | SEV1 and SEV2 within 5 business days of stabilization. SEV3 and SEV4 get a written review when impact, communication or a missing guard warrants one |
| Contents | Timeline (measured, not remembered), impact, detection, response, what worked, what did not, root causes (five whys until a control is named), communications, corrective actions with owner and date |
| Actions | Each action has one owner and a due date, is classed *prevent*, *detect* or *mitigate*, and goes to the tracker. SEV1 actions close within 30 days, SEV2 within 60 |
| Regression test | Every SEV1 and SEV2 root cause gets a test that fails against a revert of the fix, then restored (the repository's standard for guards) |
| Recurrence | The same root cause twice opens a problem record and a structural fix owned by `engineering` |
| Learning | A monthly review reads all reviews of the month for patterns; the output goes to the knowledge base and the runbooks |

### Problem management

A **problem** is the cause behind repeated cases or incidents. Its record holds the known error, the workaround support may give, the root cause, the fix, the verification, and the closure. Known errors are visible to support and, where useful, published ([SL-DOC-01](04-support-operating-model.md#delivery-success-trust-and-partners)).

## Incident metrics

| Metric | Definition | Where it is read |
| --- | --- | --- |
| Time to detect | First-known to detection signal | [09 D5](09-dashboards-and-indicators.md#d5-reliability-and-incidents) |
| Time to declare | Detection to declaration | D5 |
| Time to mitigate | Declaration to the harm stopping | D5 |
| Time to recover | Declaration to verified recovery | D5 |
| Notice timeliness | Share of notices sent inside target | D5 |
| Recurrence | Incidents sharing a root cause in a trailing 90 days | D5 |
| Action closure | Corrective actions closed by due date | D5 |
| Review timeliness | Reviews held inside five business days | D5 |

## Exercise schedule

An unexercised process is a draft. The exercises below are the evidence that raises incident handling from SL0.

| Exercise | Frequency | Scenario | Pass condition |
| --- | --- | --- | --- |
| Pager and acknowledgement test | Monthly from Stage 1 | Safe synthetic alert to every rota | Acknowledged inside target; escalation tested |
| Tabletop | Quarterly | Rotating scenario ([below](#tabletop-scenarios)) | Roles filled by the people who would fill them; gaps logged as actions |
| Technical game day | Twice a year | Break something in staging or a disposable project; recover | Recovery verified by the method in the playbook |
| Restore exercise | Quarterly | Restore a production-shaped backup into a separate project; time it | Elapsed time and recovery-point gap recorded |
| Communications drill | Twice a year | Draft, approve and send a notice from a template | Approvers reached; send inside target |
| Key-person drill | Twice a year | [The founder-removal test](11-founder-to-team-transition.md#the-founder-removal-test) | Process run by someone else from the page alone |
| Annual full DR exercise | Annual | Full outage of the primary provider | Targets measured and recorded |

### Tabletop scenarios

Rotate through these so each runs at least once a year.

1. Suspected cross-tenant exposure reported by a customer's IT team.
2. A tenant administrator's account is compromised and changes roles.
3. The single sign-on provider fails on the first day of term.
4. A bad migration corrupts enrolment-linked records during registration.
5. The AI provider returns unsafe advice, or exposes content from another person's context.
6. The managed database provider has a regional outage.
7. A grade-release reconciliation shows a mismatch for one tenant.
8. The Founder is unreachable for two weeks during a pilot.
9. A safety report arrives during an outage.
10. A credential for the source repository or deployment account is stolen.

## Business continuity

Continuity prioritizes **safety, protected access, data integrity, essential academic journeys, transparent status and recoverable operation** ([plan](../../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md)). Semester's local-first design means most outages degrade *sharing and sign-in*, not a student's own week ([degraded-mode map](../../DEGRADED-MODE-MAP.md)).

### Business-impact and provisional recovery targets

The playbook leaves RTO and RPO unset until a timed restore proves them, and the repository's 30 September evidence shows the live project's backups were **never restored** and point-in-time recovery was **not confirmed** ([`RESTORE`](../../../RESTORE.md)). The target column below is therefore a **design target to be tested**, and the evidence column says what supports it today. No figure here is a promise.

| Tier | Services | Provisional design target (to test) | What the evidence supports today | Degraded mode while down |
| --- | --- | --- | --- | --- |
| **0** | Public site, resource and status pages | RTO 24 h; no data tier | A hosted static surface; no timed rehearsal | Status page on an independent route |
| **1** | Student planning, Today, resource discovery | RTO 8 h; RPO 1 h for shared state (device state is local) | Local-first design; shared state recoverability unproven | Device-held plan and notes; freshness labels |
| **2** | Sign-in, SSO, course access, assignments and submissions, integrations | RTO 4 h; RPO 15 min | Logical dump-and-restore rehearsal only; point-in-time recovery unconfirmed | Fail closed; official-system links; queued submissions held with receipts only after server acceptance |
| **3** | Grading, assessments, student-account ledger, official records | RTO 4 h; RPO 5 min; **block and reconcile** rather than guess | Ledger and history are append-only in the database; recovery unproven | Read-only; official source of record; no ambiguous write retried |

**Before any of these is stated outside the company:** read the provider's backup arrangements and recovery-point capability off the dashboard and record them; run a timed isolated restore of a real provider backup by the backup operator and a second trained operator; validate with the recovery-acceptance list; record measured figures for the *tested scope only*; counsel and finance approve contract language.

### Dependency map for continuity

| Dependency | Failure effect (from the degraded-mode map) | Continuity action | Owner seat |
| --- | --- | --- | --- |
| Static hosting for the app | First visits cannot load | Cached or installed copies continue; status route; redeploy path in [`ROLLBACK`](../../../ROLLBACK.md) | `engineering` |
| Managed database, auth and functions | Sign-in, sync, shared rooms, billing state, LTI launch fail | Local-first work continues; restore per [`RESTORE`](../../../RESTORE.md); vendor escalation | `engineering` |
| Payment provider | No new checkout; entitlement stays as last verified | Existing access unaffected; manual reconciliation | `finance` |
| AI provider | AI features refuse; deterministic features unaffected | Kill switch; fallback message; no model needed for rules | `engineering` |
| Institution gateway journal | Integration history lost; replay impossible | Backups of the journal are an open gate ([G5](../../RELEASE-GATES.md)) | `engineering` |
| A school's SIS, LMS or identity provider | That school's launches and sync fail | Native fallback; connector disabled safely | `data` |
| Email | Confirmation and recovery mail fails | Signed-in sessions unaffected; alternate recovery route | `operations` |
| Scheduler for background ticks | Retention sweeps and integration ticks stop | Weekly check; manual run | `operations` |
| The one operator | Nothing fails; nothing is fixed | [Founder transition](11-founder-to-team-transition.md); break-glass access | `founder` |

### Loss scenarios and continuity modes

| Scenario | Safe continuity mode | Recovery requirement |
| --- | --- | --- |
| Deploy failure | Serve the last safe compatible version or the status and help path | Rollback plus smoke and core-journey verification |
| Unsafe writes or integration uncertainty | Pause the connection and writes; read-only; preserve pending intent | Reconcile with the authoritative source; replay safely; prove no duplicate or lost official action |
| Identity provider failure | Refuse protected data and actions; public help and status only | Provider recovery; current-access verification; revoked-session test |
| Database loss or corruption | Isolate writes; preserve evidence; never overwrite production for a rehearsal | Approved isolated restore and complete validation |
| Vendor, region or network outage | Degrade only within approved boundaries; never fabricate freshness or official status | Provider or fallback decision; authoritative readback |
| Key-person or facility loss | Backup owners use current contacts, access, runbooks and decision authority | Access and communication rehearsal; transfer record |
| Account or domain lockout | Break-glass credentials in escrow, two-person retrieval | Escrow retrieval rehearsed; vendor recovery path documented |
| Vendor failure or insolvency | Exit plan for each tier-1 vendor ([06](06-vendor-quality-change.md#vendor-management)) | Data export and alternative tested for the critical vendors |

### Activation, priority and recovery order

**Activate** the continuity plan when an incident exceeds the provisional tier target, when a dependency is lost with no near-term recovery, or when the commander or the `founder` declares it. **Priority order in a shortage**, from the degraded-mode map's critical periods: registration and add/drop windows and term start; finals and grade release; a launch week for a live tenant; everything else. **Recovery sequence:** safety and access control first; data integrity second; tier 3, then tier 2, then tier 1 journeys; communications continuous.

### Recovery acceptance

Verify the restored version and configuration; authentication, access and tenant isolation; schema and policy controls; record counts and sampled content; audit continuity; deletions, holds and the retention tail; storage; secrets and scheduled jobs; integrations and source freshness; core student and staff journeys; monitoring and alerts; outstanding reconciliation; customer sign-off; and cleanup. Record measured RTO and RPO **only for the tested scope**.

## Related

[Service blueprint: an incident](service-blueprints.md#blueprint-3-an-incident) · [Handoffs H-12 to H-14](handoffs.md) · [Templates TPL-12, TPL-13](templates.md) · [01 Quarterly control review](01-operating-cadence.md#quarterly-control-review-half-day)
