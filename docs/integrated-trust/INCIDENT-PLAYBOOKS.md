# Incident playbooks

<!-- Rendered from app/src/lib/ops/incidentplaybooks.ts by incidentplaybooks.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

15 scenario playbooks. The plan around them — roles, the first fifteen minutes, communications, evidence handling and what counsel decides — is in [incident response](INCIDENT-RESPONSE.md); the rehearsal schedule is the [tabletop calendar](TABLETOP-CALENDAR.md).

## Severity

Four scales are in use across the trust, engineering and security documents. `app/src/lib/incident-recovery.ts` is the only one a test holds, so this keeps it (SEV1 to SEV4) and lays the others against it. Choosing the scale is the founder's decision (RM-06); until it is made the documents keep disagreeing. The times are internal first-look targets, not a promise to anyone: the trust documents record that no acknowledgement or update clock is authorized while one person holds every role.

| Severity | Means | P scale | SECURITY.md word | Audit scale | First look (internal) |
| --- | --- | --- | --- | --- | --- |
| SEV1 | Suspected or confirmed cross-tenant exposure, a confirmed breach, an official record or grade changed without authority, or a broad outage of sign-in, submissions or registration. | P0 | Critical | SEV-0 (breach, exposure, record integrity) and SEV-1 (broad outage) | Same hour while a person is reachable |
| SEV2 | A core workflow broken for many users, one major tenant or integration down, or a privacy or safety event with limited scope. | P1 | High | SEV-2 | Same business day |
| SEV3 | A limited function broken with a workaround, a degraded integration, or an accessibility regression on a non-critical path. | P2 | Medium | SEV-3 | Next business day |
| SEV4 | A cosmetic or low-impact defect, or a question. | P3 | Low | SEV-4 | Planned triage |

## Message audiences

Rendered from `AUDIENCES` in `app/src/lib/governance/incident-comms.ts`. The composer refuses a message missing any of its required details. The intervals are what it enforces; they are not a promise to a customer.

| Audience | Approvers | Update every (min) | Tells the institution | Required details |
| --- | --- | ---: | --- | --- |
| Student-facing outage | Incident commander | 60 | yes | If a deadline was affected, contact |
| Institution admin outage | Incident commander | 60 | yes | — |
| Integration data delay | Integration owner | 240 | yes | Source system; Last successful sync |
| Security incident | Security owner, Legal | 60 | yes | Data exposure (Not indicated / Suspected / Confirmed / Unknown) |
| Privacy incident | Privacy owner, Legal | 60 | yes | Data classes involved; Data exposure (Not indicated / Suspected / Confirmed / Unknown) |
| Accessibility incident | Accessibility lead | 240 | yes | Accessible alternative route |
| AI quality incident | AI platform lead, AI governance chair | 240 | yes | Outputs to distrust; AI feature paused (Yes / No) |
| Marketplace/sponsor safety incident | Trust & Safety lead, Legal | 240 | yes | — |
| Community safety incident | Trust & Safety lead | 60 | yes | Campus crisis contact |
| Scheduled maintenance | Operations lead | 1440 | no | — |
| Feature rollback | Product owner | 1440 | yes | What you will see instead; Is your work affected (Yes / No) |

## Index

| Playbook | Default | Commander | Message | Counsel | Lever |
| --- | --- | --- | --- | --- | --- |
| [IR-01](#ir-01) | SEV1 | founder | security | yes | feature_kill_switch (global or per school) |
| [IR-02](#ir-02) | SEV2 | security | security | yes | sign out other devices; invite-only door |
| [IR-03](#ir-03) | SEV1 | founder | privacy | yes | kill.writeback |
| [IR-04](#ir-04) | SEV2 | trust | ai_quality | yes | kill.ai_generation |
| [IR-05](#ir-05) | SEV3 | engineering | integration_delay | no | kill.connection.<public id> |
| [IR-06](#ir-06) | SEV2 | engineering | student_outage | no | VITE_READ_ONLY (deploy), SEMESTER_READ_ONLY (gateway) |
| [IR-07](#ir-07) | SEV1 | operations | student_outage | yes | read-only mode |
| [IR-08](#ir-08) | SEV2 | security | privacy | yes | — |
| [IR-09](#ir-09) | SEV1 | trust | community_safety | yes | community and image-post switches (off in production) |
| [IR-10](#ir-10) | SEV2 | finance | student_outage | yes | billing-checkout hold |
| [IR-11](#ir-11) | SEV3 | accessibility | accessibility | no | — |
| [IR-12](#ir-12) | SEV2 | privacy | privacy | yes | — |
| [IR-13](#ir-13) | SEV2 | trust | marketplace_sponsor | yes | — |
| [IR-14](#ir-14) | SEV2 | security | security | yes | — |
| [IR-15](#ir-15) | SEV3 | operations | student_outage | no | — |

## IR-01

### Suspected cross-tenant access

**Trigger.** A row-level-security alert, an unusual query pattern, an audit anomaly, or a report from a user or institution.

**Default severity.** SEV1. **Commander.** founder. **In the room.** founder, security, engineering, privacy. **Message template.** `security`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Engage the narrowest kill switch that stops the path (kill.integration_sync, kill.sharing, or the affected connection), then the global one if the path is unknown.
- Revoke active sessions and tokens if account compromise is possible.
- Pause background jobs and exports that use the same path.

**Investigate.**

- Name tenant A, tenant B, the data classes, the records and the time window.
- Decide whether the exposure was viewed, exported, modified or automated.
- Inspect connection-pool and session-context behaviour, then cache, search, analytics and support-tool paths.

**Recover.**

- Patch the authorization fault and add the regression to the database suite.
- Run the cross-tenant scan for the same class of control across every table and function.
- Validate through production-like roles and pooled connections.

**Preserve first.**

- Request ids and deployment version for the window.
- audit_event, console_audit_event and access_log rows for both tenants, exported read-only.
- Database query statistics and function logs before the one-month provider log retention expires.

**Controls relied on.** [TC-SEC-01](CONTROL-FRAMEWORK.md), [TC-SEC-02](CONTROL-FRAMEWORK.md), [TC-REL-05](CONTROL-FRAMEWORK.md).

**Where this stands today.** Contained only by the switches; no alert detects it, and log retention caps how far back it can be scoped.

## IR-02

### Compromised account or credential stuffing

**Trigger.** Impossible travel, an unusual device, a user report, a leaked-credential signal, or a spike in failed sign-ins.

**Default severity.** SEV2. **Commander.** security. **In the room.** security, engineering, success. **Message template.** `security`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Sign the account out of other devices; require reauthentication and recovery verification.
- Disable high-risk actions on the account (payment, record changes, shares).
- For a spike, engage the invite-only door (set_invite_only) while sign-in limits are tuned.

**Investigate.**

- Establish the compromised window from sign-in, device and activity records.
- List data read, exports, role changes and connected accounts.
- Look for persistence: new multi-factor factors, recovery changes, tokens, delegated access, shares.

**Recover.**

- Restore verified control to the owner.
- Reverse unauthorized changes through the correction workflow, not by direct edit.
- Notify the user and, if an institution account, the tenant, as counsel advises.

**Preserve first.**

- Sign-in, device and activity records for the account.
- Share, grant and request rows created in the window.

**Controls relied on.** [TC-SEC-10](CONTROL-FRAMEWORK.md), [TC-SEC-11](CONTROL-FRAMEWORK.md), [TC-SUP-01](CONTROL-FRAMEWORK.md).

**Where this stands today.** There is no session list and no global revoke procedure; students have no multi-factor option.

## IR-03

### Official record or grade integrity

**Trigger.** An unexpected grade or record change, a reconciliation mismatch, a faculty or registrar report, or an audit anomaly.

**Default severity.** SEV1. **Commander.** founder. **In the room.** founder, data, engineering, privacy. **Message template.** `privacy`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Freeze the affected record workflow or grade-release job.
- Preserve before and after versions, approvals, integrations and actor identities.
- Do not overwrite or repair a record before the evidence is held.

**Investigate.**

- Was the change authorized, correct, duplicated, malicious or caused by sync?
- Check source-of-truth precedence and connector mappings.
- List every affected student, term, section and downstream system.

**Recover.**

- Correct through a formal workflow with documented authority.
- Notify the institutional owners; reconcile with the authoritative source and verify downstream systems.
- Add the invariant or contract test for the failure.

**Preserve first.**

- Ledger rows and their chain and seal status.
- Human-override log entries.
- Connector job ids and mapping version.

**Controls relied on.** [TC-SEC-12](CONTROL-FRAMEWORK.md), [TC-SEC-08](CONTROL-FRAMEWORK.md), [TC-INC-01](CONTROL-FRAMEWORK.md).

**Where this stands today.** The ledger chains detect tampering; no live write-back adapter is registered, so the realistic case is a sandbox or manual import.

## IR-04

### AI data leak, unsafe advice or policy bypass

**Trigger.** The assistant reveals protected information, acts or proposes an action it should not, cites an unauthorized source, or follows planted instructions.

**Default severity.** SEV2. **Commander.** trust. **In the room.** trust, engineering, privacy, founder. **Message template.** `ai_quality`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Engage kill.ai_generation for the tenant or globally; the switch fails closed.
- Preserve prompts, context-assembly logs, policy decisions, tool calls, sources and outputs.
- Stop automated follow-on actions and prevent replay.

**Investigate.**

- Classify affected data and users.
- Was the fault retrieval filtering, policy, tool authorization, model output, prompt injection, provider behaviour or interface ambiguity?
- Examine related prompts and feature cohorts.

**Recover.**

- Patch the policy, retrieval or tool boundary.
- Add the case to the adversarial suite and re-run the whole suite on the current model before re-enabling.
- Notify affected parties under the approved privacy and legal process.

**Preserve first.**

- The AI audit journal for the window (metadata only, 180 days).
- The model identifier and route in use.

**Controls relied on.** [TC-AI-01](CONTROL-FRAMEWORK.md), [TC-AI-02](CONTROL-FRAMEWORK.md), [TC-AI-04](CONTROL-FRAMEWORK.md), [TC-REL-05](CONTROL-FRAMEWORK.md).

**Where this stands today.** The only switch ever drilled against production (29 September); the release step needs a second reviewer who is unassigned.

## IR-05

### Integration failure or bad synchronization

**Trigger.** A connector health state of failed or mismatched, a reconciliation discrepancy, a schema drift, or an institution report.

**Default severity.** SEV3. **Commander.** engineering. **In the room.** engineering, success, champion. **Message template.** `integration_delay`.

**Contain.**

- Disable the connection (kill.connection.<id>) so dependent automation stops; native data stays available.
- Quarantine automated changes from the affected source; never overwrite silently.

**Investigate.**

- Last successful sync, source system, mapping version and counts.
- Whether any record was written back, and whether a retry could repeat an uncertain write.

**Recover.**

- Fix the mapping or credential; replay through the sandbox, then a limited cohort.
- Reconcile counts and samples against the source before re-enabling.

**Preserve first.**

- Connection id, job ids, error journal and reconciliation report.

**Controls relied on.** [TC-SEC-02](CONTROL-FRAMEWORK.md), [TC-REL-01](CONTROL-FRAMEWORK.md).

**Where this stands today.** The adapter registry is empty and the institutional probe is unconfigured, so this is rehearsable against fixtures only.

## IR-06

### Platform outage, failed deploy or migration

**Trigger.** The hourly probe fails, a deploy workflow fails, a migration deploy reports failure, or users report.

**Default severity.** SEV2. **Commander.** engineering. **In the room.** engineering, operations. **Message template.** `student_outage`.

**Contain.**

- Stop further deploys; roll the page back through the pages workflow (measured 76 to 180 seconds).
- For a function fault, redeploy the previous function version.
- Engage read-only mode to protect data while the cause is found.

**Investigate.**

- Deploy, migration and function logs for the first failing change.
- Whether data was written during the fault.

**Recover.**

- The schema cannot roll back; recover forward with a corrective migration reviewed like any other.
- Verify with the production smoke and the status history; post the resolution.

**Preserve first.**

- The deploy run, migration ledger rows and function logs.

**Controls relied on.** [TC-REL-01](CONTROL-FRAMEWORK.md), [TC-REL-04](CONTROL-FRAMEWORK.md), [TC-INC-02](CONTROL-FRAMEWORK.md).

**Where this stands today.** A migration deploy once failed silently for three days (18 to 21 September); read-only mode has never been engaged against production.

## IR-07

### Data loss and provider restore

**Trigger.** Rows or tables missing or corrupted, a dropped object, or a provider incident affecting the database.

**Default severity.** SEV1. **Commander.** operations. **In the room.** operations, engineering, data, privacy. **Message template.** `student_outage`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Engage read-only mode; stop jobs that write.
- Take a copy of the damaged state before any restore.

**Investigate.**

- Determine the loss window and which tables are affected.
- Choose logical restore of named tables or provider point-in-time recovery into a second project.

**Recover.**

- Restore into the second project, compare fingerprints, row counts and row-level security, then repoint or copy back.
- Replay deletions that fall inside the restore window (there is no deletion ledger by decision D-124).
- Record the measured recovery time and point.

**Preserve first.**

- Provider backup listing, restore logs and the comparison output.

**Controls relied on.** [TC-REL-04](CONTROL-FRAMEWORK.md), [TC-PRV-02](CONTROL-FRAMEWORK.md).

**Where this stands today.** Point-in-time recovery has never been restored; no recovery time or point objective exists; the second operator for a production restore is unassigned.

## IR-08

### Staff or support access misuse

**Trigger.** An audit anomaly, a student report that a supporter saw something, an unreviewed break-glass grant, or a staff departure.

**Default severity.** SEV2. **Commander.** security. **In the room.** security, privacy, founder. **Message template.** `privacy`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Revoke the staff member's grants and sessions; end open break-glass and support grants.
- Hold the audit rows for the person and the period.

**Investigate.**

- Everything the person read or changed, through support_access_event, console_audit_event and role-grant audit.
- Whether any student was told, as the student-visible log intends.

**Recover.**

- Correct any change through the governed workflow; tell affected students and institutions as counsel advises.
- Add the missing review or control the incident exposed.

**Preserve first.**

- Support access events, console audit chain, role-grant audit and break-glass review rows.

**Controls relied on.** [TC-SEC-08](CONTROL-FRAMEWORK.md), [TC-SEC-09](CONTROL-FRAMEWORK.md), [TC-SUP-01](CONTROL-FRAMEWORK.md), [TC-TSF-02](CONTROL-FRAMEWORK.md).

**Where this stands today.** Break-glass is a record with no access effect; ordinary reviewer reads are not logged; the security seat is vacant.

## IR-09

### Community safety: threat, self-harm, abuse material

**Trigger.** A P0 or P1 case, a crisis-language detection, a media match to known abuse, or a report of harm to a minor.

**Default severity.** SEV1. **Commander.** trust. **In the room.** trust, privacy, founder. **Message template.** `community_safety`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Preserve the content and its metadata; do not delete a known-abuse match (every deletion path exempts it).
- Withdraw distribution; restrict the account only through the two-person path for P0.
- Route to the professional named in the escalation policy; show the student the support resources. Semester is not an emergency service.

**Investigate.**

- The case timeline, the reporter count and signals, and the author's history, through the logged reveal path only.

**Recover.**

- Decide and notify with the reason code; the author may appeal to a different reviewer.
- Record the outcome and any report made.

**Preserve first.**

- The case, its events, the decision and, for media, both hashes.

**Controls relied on.** [TC-TSF-01](CONTROL-FRAMEWORK.md), [TC-TSF-02](CONTROL-FRAMEWORK.md), [TC-TSF-03](CONTROL-FRAMEWORK.md), [TC-TSF-04](CONTROL-FRAMEWORK.md), [TC-TSF-05](CONTROL-FRAMEWORK.md).

**Where this stands today.** Community is held off. Escalation delivery, the image scanner, abuse-material reporting and any 24-hour coverage do not exist, so this playbook cannot be run live and Community must not be enabled until it can.

## IR-10

### Payment or billing error

**Trigger.** A double charge, a forged or failed webhook, a chargeback, a wrong entitlement, or a refund request that cannot be explained.

**Default severity.** SEV2. **Commander.** finance. **In the room.** finance, engineering, success. **Message template.** `student_outage`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Hold new checkout (the individual paid acquisition switch is code-held off).
- Do not retry an uncertain write; reconcile against the processor first.

**Investigate.**

- Webhook signature and timing, payment events and invoices for the account, and processor records.

**Recover.**

- Refund or credit through the governed path; correct the entitlement; reconcile the ledger.

**Preserve first.**

- payment_events, invoices and processor event ids.

**Controls relied on.** [TC-SEC-12](CONTROL-FRAMEWORK.md), [TC-SEC-04](CONTROL-FRAMEWORK.md).

**Where this stands today.** Live billing was accepted on 3 October; refund, tax and consumer-payment questions are in the legal review queue.

## IR-11

### Accessibility barrier on a critical journey

**Trigger.** A user report, a failed nightly sweep, or a regression in a keyboard or screen-reader path on sign-in, Today, Courses, Work, Registration or Degree.

**Default severity.** SEV3. **Commander.** accessibility. **In the room.** accessibility, engineering, success. **Message template.** `accessibility`.

**Contain.**

- Offer the accessible alternative route immediately (a text path, an export, a person) and tell the user it exists.
- Disable the new interaction behind its flag if a prior accessible path exists.

**Investigate.**

- Reproduce with the assistive technology and browser the user named; capture steps, never screenshots without consent.

**Recover.**

- Fix, add the regression guard, and re-run the affected journey in the smoke and the manual protocol row.

**Preserve first.**

- The report, reproduction steps, the fix and the guard.

**Controls relied on.** [TC-A11-01](CONTROL-FRAMEWORK.md), [TC-A11-02](CONTROL-FRAMEWORK.md), [TC-A11-04](CONTROL-FRAMEWORK.md), [TC-A11-06](CONTROL-FRAMEWORK.md).

**Where this stands today.** A barrier is reported by email to one person; no response time is promised.

## IR-12

### Privacy request failure or over-deletion

**Trigger.** A request past its due date, an erasure that touched a held account, a deletion that removed something it should not, or a request with a disputed identity.

**Default severity.** SEV2. **Commander.** privacy. **In the room.** privacy, data, engineering. **Message template.** `privacy`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Stop the sweep or job involved; place or confirm the legal hold.
- Take no further action on a request whose requester has not been verified.

**Investigate.**

- The request row, the hold state at the time, the sweep run record and what the erasure walked.

**Recover.**

- Restore from backup only within the provider window and only for what a hold required; otherwise record the loss.
- Tell the requester and, where a duty exists, the institution (requires qualified human counsel review).

**Preserve first.**

- data_subject_request rows, legal_holds, retention run records and audit events.

**Controls relied on.** [TC-PRV-01](CONTROL-FRAMEWORK.md), [TC-PRV-02](CONTROL-FRAMEWORK.md), [TC-PRV-04](CONTROL-FRAMEWORK.md).

**Where this stands today.** No operator surface or overdue monitor handles a request; the thirty-day clock is a placeholder.

## IR-13

### Marketplace or partner fraud

**Trigger.** A listing report, a partner complaint, a chargeback pattern, or a student reporting a harmful offer.

**Default severity.** SEV2. **Commander.** trust. **In the room.** trust, finance, founder. **Message template.** `marketplace_sponsor`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Remove the listing and suspend the publisher role; hold payouts if any exist.

**Investigate.**

- The publisher's verification, every listing and every disclosure to students.

**Recover.**

- Notify affected students; add the screening rule.

**Preserve first.**

- Listing history, moderation decisions and any disclosure snapshot.

**Controls relied on.** [TC-TSF-08](CONTROL-FRAMEWORK.md).

**Where this stands today.** Only opportunity listings exist. Orders, payouts and seller verification do not, and the register keeps a marketplace deferred until they do.

## IR-14

### Key or secret compromise

**Trigger.** A secret in a log, a repository or a bundle; a provider notice; a departing person with access.

**Default severity.** SEV2. **Commander.** security. **In the room.** security, engineering. **Message template.** `security`. **Counsel needed** (requires qualified human counsel review).

**Contain.**

- Rotate the secret at the provider first, then in the function environment; revoke the old one.

**Investigate.**

- Where it was exposed, for how long, and what it could read or write.

**Recover.**

- Record the rotation; for the journal key, re-encrypt (not yet possible: no key identifier).

**Preserve first.**

- The exposure location and the provider's key-use log.

**Controls relied on.** [TC-SEC-05](CONTROL-FRAMEWORK.md), [TC-SEC-13](CONTROL-FRAMEWORK.md).

**Where this stands today.** The rotation log is empty and has never been exercised; the gateway journal key cannot be rotated without losing history.

## IR-15

### Provider failure

**Trigger.** The hosting, database, authentication, AI or payment provider reports an incident or the probe fails.

**Default severity.** SEV3. **Commander.** operations. **In the room.** operations, engineering. **Message template.** `student_outage`.

**Contain.**

- Switch to the documented degraded mode: saved workspace stays usable; official-system links replace connected data with a freshness label.

**Investigate.**

- The provider status, which components probed down, and what is queued locally.

**Recover.**

- Confirm sync drains with no duplicate; post the resolution.

**Preserve first.**

- Status history rows and the provider notice.

**Controls relied on.** [TC-REL-01](CONTROL-FRAMEWORK.md), [TC-INC-02](CONTROL-FRAMEWORK.md).

**Where this stands today.** The degraded-mode map exists; no failover provider exists for any component.

