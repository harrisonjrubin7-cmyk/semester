# Service blueprints

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — DRAWN FROM THE WRITTEN PROCESSES, NOT OBSERVED IN OPERATION** |
| Owner seat | `operations` |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Claim ceiling | Semester may say it has designed its service flows. It may not say any of them has run with a customer. |

A service blueprint lays out one service from the person's point of view and from the back of the house, so failure points and owners are visible *before* they hurt someone. Each blueprint here follows one person through one service.

## How to read a blueprint

| Column | Meaning |
| --- | --- |
| **Step** | A stage in the service |
| **User does** | What the student, administrator, provider or partner does |
| **Front stage** | What they can see and touch: screens, messages, people |
| **Back stage and evidence** | What Semester does out of sight, the systems it uses, and the record it leaves |
| **Failure and recovery** | What goes wrong at this step, and the recovery that keeps the promise |
| **Target** | The SL0 service level that governs it, from the [catalog](04-support-operating-model.md#service-level-catalog) |

**The line of visibility** runs between *front stage* and *back stage*. Anything a person experiences as a failure must have a recovery on the front-stage side that does not depend on them understanding the back stage. Every step obeys the product rules: no dead-end state, an explanation of what happened, what they can do now, and who can help.

## Blueprint 1: Implementation, from qualification to launch

**Persona:** an institution's champion and administrator. **Method:** [02](02-implementation-methodology.md). **Readiness:** [10](10-tenant-launch-risk-and-readiness.md).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Qualify** | Describes a job to be done; meets the sponsor | A candid fit conversation; a written no-fit list; a clear "this is what Semester cannot do yet" | Qualification record; ideal-customer-profile test; deal-desk review; claims restricted to the register; counsel items queued | The buyer wants replacement or an unsupported commitment: say no in writing and offer the nearest honest scope | [H-01](handoffs.md#h-01-revenue-to-implementation) |
| **2 Kick off** | Names sponsor, champion, IT, privacy, security, accessibility; agrees baselines | One kickoff, one charter with *stop* listed as a decision; one named contact at Semester | Charter and RACI; tenant record; risk register opened (TR-01 to TR-20); freeze calendar loaded | A role is vacant on their side: pause; do not proceed on assumption | SL-IMP-03 |
| **3 Design and review** | Reviews the data-flow map and package; approves scope | A package that answers their security and privacy questions without asking twice | Security and privacy package; subprocessor list; counsel review; `security_kickoff` evidence | Review stalls: parallel path, named owner, date; never skip the review | [H-02](handoffs.md#h-02-implementation-to-securityprivacy-review) |
| **4 Configure** | Supplies identity and role details; tests their own login | A sandbox that works with fake data; a configuration they can read back | Tenant provisioned in sandbox data mode; roles, flags, policies; configuration export; rollback path recorded | Wrong role mapping at test login: revert to the last read-back configuration; re-test | SL-CHG-01 |
| **5 Integrate** | Provides credentials under least privilege; confirms source precedence | A health view of each connection and a clear "what happens if this is off" | Mapping version; reconciliation report; degraded-mode test; `sso_login_verified`, `source_reconciliation_passed` | Source data poor: exception queue; do not silently overwrite either side | [H-04](handoffs.md#h-04-engineering-to-implementation-integration-accepted) |
| **6 Validate** | Runs UAT by role; tests with assistive technology | Test scripts and a defect list they can see; accessible alternatives documented | Isolation, rights, restore, rollback and incident rehearsals; defects by severity; `uat_signoff`, `rls_isolation_passed`, `accessibility_review_passed` | A P1 defect: fix or mitigate in 5 business days; the gate waits | SL-IMP-02 |
| **7 Train** | Attends; practises; names the support desk | Role-based sessions, recordings, quick starts, accessible materials | Training records; support readiness checklist; macros loaded | A role is untrained: no launch for that role | [H-06](handoffs.md#h-06-implementation-to-support-hypercare-entry) |
| **8 Decide** | Approves launch on their side | A plain-language decision pack: what is live, what is not, what is promised, how to stop | Fresh `decide()` result; scorecard; hard gates; acceptances with disclosure and expiry; signed decisions | NO-GO: a dated remediation plan, communicated candidly; the cohort hears nothing yet | [H-05](handoffs.md#h-05-implementation-to-the-launch-council) |
| **9 Launch** | Their cohort is invited | Approved invitation; help one step away; status page ready | War-room open; three health sweeps; stop controls armed | An early SEV: contain, read-only, communicate per [05](05-incident-and-continuity.md) | [SL-INC-01](04-support-operating-model.md#incidents-security-privacy-accessibility) |
| **10 Hypercare** | Reports issues; joins weekly call | Daily-then-alternate-day check-ins; one point of contact | Hypercare log; incident and problem handling; exit test | Exit test fails: extend; no handoff until it passes | SL-IMP-04; [H-07](handoffs.md#h-07-hypercare-to-steady-state) |

## Blueprint 2: A support case

**Persona:** a student at 11:55 PM who cannot submit an assignment. **Model:** [04](04-support-operating-model.md).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Problem** | Tries to submit; sees an error | An error that says what happened, that their work is safe on the device, and where help is | Local-first save holds the draft; error carries a correlation ID | Server unreachable: the draft stays; the screen says so; no false success | — |
| **2 Ask** | Opens help from the same place on every screen | Context already attached: course, assignment, deadline, screen; a short form; consent for diagnostics shown | Case created with tenant, route, device, correlation ID; category suggested | Help unreachable: the status page and a fallback route are shown | — |
| **3 Acknowledge** | Receives confirmation | Immediate receipt; the hours statement; what happens next | Auto-acknowledgement; priority derived (deadline-critical, core journey blocked: P1); queue | Out of hours: the receipt says so honestly and how to reach the school's official route | SL-SUP-02 |
| **4 Triage** | Waits; may add a detail | A named responder; no repeat questions | Identity checked through the authenticated session; category LRN; check submission receipt, storage state, deadline policy, connector health | Receipt mismatch or storage fault: L3 now; incident record considered | SL-SUP-05 |
| **5 Resolve or route** | Follows the fix, or is told what the school decides | A verified workaround or a clear statement of what Semester cannot decide (extensions are the instructor's) | Workaround applied within policy; no record altered; support-access grant only if needed, scoped, expiring | Unsafe workaround: do not offer it; escalate | SL-SUP-06 |
| **6 Escalate if needed** | Is kept informed | One voice; an honest next-update time | [Escalation package](handoffs.md#h-09-support-to-engineering); engineering acknowledgement; link to an incident if many are affected | Escalation not accepted in time: next level; logged | [H-09](handoffs.md#h-09-support-to-engineering) |
| **7 Close** | Confirms, or does not reply | A clear resolution and how to reopen | Resolution; scope; communication; access revoked; links to known issue or root cause | No reply: auto-resolve after 7 days with the way to reopen | SL-SUP-07 |
| **8 Learn** | — | A later fix, an article, or a note in the release | Tag, problem record if repeated; QA sample; article or macro; product feedback | A repeat of a cause: problem record at the third contact | SL-DOC-01 |

## Blueprint 3: An incident

**Persona:** a registrar's office during a sign-in outage on the first day of term. **Model:** [05](05-incident-and-continuity.md).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Detect** | May report before any alert | A visible way to report; the status page | Probe, alert or report; first-known time recorded | Detection by a user only: note the gap for the reliability backlog | — |
| **2 Declare** | Waits | Nothing yet, or an auto-note that the team is aware | Commander named; severity and flags set; roles assigned or compensating controls noted | Declaration late: log the miss | SL-INC-01 |
| **3 Contain** | — | A degraded but safe state; honest messaging | Deploys frozen; smallest unsafe path disabled; evidence preserved; no control weakened | Containment risks harm: choose the lesser; record the decision | — |
| **4 First notice** | Reads the notice | What happened, who is affected, what to do now, what Semester is doing, the next update time, where to get help; sent to the school's incident contact **before** students hear from elsewhere | Audience-correct template; approvers per audience; notice recorded | No named contact: the status page and support route carry it; fix the gap | SL-INC-02 |
| **5 Recover** | Is told when to retry | Updates on the promised cadence, even if nothing changed | Restore to a known-good state or fallback; official writes not retried when ambiguous | A recovery step fails: the next safe option; the cadence continues | — |
| **6 Verify** | — | A statement that it is fixed and what was checked | Security, privacy, integrity, accessibility, source and reconciliation verified for the affected path | Verification fails: the incident stays open | — |
| **7 Resolve** | Reads the resolution | Plain statement of impact and what changed | Resolution notice; access revoked; closing record | — | — |
| **8 Review** | May receive a summary | A short blameless summary where appropriate | Review inside 5 business days; actions with owners; regression test | Review late: escalate | SL-INC-03 |
| **9 Improve** | — | Visible only as fewer repeats | Actions tracked; problem record if recurring | Actions slip: the weekly review reads them | SL-INC-04 |

## Blueprint 4: A data-rights request

**Persona:** a student asking to export and later delete their data. **Runbook:** [`DATA-RIGHTS-REQUEST-RUNBOOK`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Ask** | Uses the data-control screen or help | A clear, findable control; a statement of what can and cannot be deleted and why | Request opens with type, tenant, date | Control absent in a route: help path accepts it | — |
| **2 Verify** | Proves identity | A proportionate check; no unnecessary documents | Identity verification result recorded | Weak verification: refuse to proceed; explain | — |
| **3 Acknowledge** | Receives a receipt | The request ID, the status page for the request, what happens next | Acknowledgement; legal clock noted by counsel | Late acknowledgement: escalate | SL-PRV-01 |
| **4 Triage** | Waits | Honest status | Retention and legal-hold check; the institution's role as record owner; the tenant's policy | A hold applies: tell the person, without promising otherwise | [H-11](handoffs.md#h-11-support-to-privacy-data-rights-request) |
| **5 Fulfil** | Receives the export or the confirmation | Export in an accessible format, or a deletion confirmation with exceptions explained | Export produced and validated before any deletion; deletion executed; downstream copies handled; backups per schedule | Export fails validation: do not delete; fix and re-run | SL-PRV-01 |
| **6 Confirm** | Acknowledges | A final statement of what was done and what was kept and why | Completion evidence retained under policy; audit event | Partial completion: say so plainly | — |
| **7 Learn** | — | — | Review of timing and exceptions at the monthly privacy review | A request missed a legal clock: counsel review; incident of process | — |

## Blueprint 5: A marketplace order and dispute (gated, phase 1)

**Dormant.** No marketplace exists. This blueprint is the operations design that must be exercised before phase 1 can open. **Model:** [08](08-marketplace-partner-trust-fulfillment.md).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Discover** | Browses a listing | Price and fees, what is not guaranteed, who the provider is, any relationship to the school or Semester, how to report | Provider approved at its risk tier; listing reviewed | A false claim reported: listing review in 2 business days; claim removed | SL-MKT-01 |
| **2 Order** | Expresses intent; pays on the provider's hosted checkout | A clear statement that the provider takes payment and fulfils | Order intent and entitlement recorded; no card data and no funds held by Semester | Provider silent: the intent cancels at the window's end and the student is told | [H-16](handoffs.md#h-16-marketplace-order-to-provider-dispute-and-finance) |
| **3 Fulfil** | Receives the service | Confirmation path; how to say it did not arrive | Provider confirms; Semester tracks non-fulfilment | Not delivered in the window: dispute opens | — |
| **4 Problem** | Opens a dispute | A short form; the type chosen; evidence guidance; a safety question first | Dispute record; a safety or conduct report becomes a T&S case and the dispute waits | A safety issue inside a dispute: T&S owns it; the dispute pauses | SL-MKT-02 |
| **5 Evidence** | Adds evidence; the provider answers | Same timeline for both sides | Minimal, redacted evidence; both sides heard inside 3 business days | One side silent: decide on the evidence with a note | SL-MKT-02 |
| **6 Decide** | Receives the outcome | The outcome, the reason code, how the refund happens, how to appeal | Decision by `finance` (non-safety) or `trust` (safety); executed by the provider and its payment provider; completion verified | Outcome not executed: escalate with the provider; provider consequence | SL-MKT-02 |
| **7 Appeal** | Appeals once | A different reviewer | Decision inside 5 business days | Overturn rate high: review guidelines | SL-TS-02 |
| **8 Learn** | — | — | Provider scorecard; thresholds; guideline updates | Dispute rate over 5%: suspend pending review | — |

## Blueprint 6: Partner onboarding

**Persona:** an integration partner that will connect to Semester. **Model:** [08](08-marketplace-partner-trust-fulfillment.md#partner-operations).

| Step | User does | Front stage | Back stage and evidence | Failure and recovery | Target |
| --- | --- | --- | --- | --- | --- |
| **1 Introduce** | Describes the use case and the customers affected | A plain statement that a conversation is not a partnership | Evaluation record opened; the criteria applied; no listing or logo | The partner wants a claim early: decline; the claims rule | — |
| **2 Evaluate** | Supplies diligence materials | A clear list of what is needed and why | Legal, security, privacy, accessibility, sanctions, insurance, capacity reviewed | Material missing: pause with a list; no exceptions for speed | — |
| **3 Pilot** | Agrees a limited pilot | A written scope, owner, success measures, guardrails, expiry and offboarding | Agreement reviewed by counsel; access scoped; certificate of training on claims and conduct | A scope request beyond the pilot: a change order | — |
| **4 Operate** | Builds and supports | A named technical contact; the escalation path | Sandbox contract tests; monthly check-in; incident intake; scorecard | A partner incident: [05](05-incident-and-continuity.md) vendor path; customers told per the subprocessor policy | SL-PAR-01 |
| **5 Review** | Receives the scorecard | Honest feedback | Quarterly review; decision to expand, hold or exit | Red on compliance or claims discipline: restrict now | — |
| **6 Offboard** | Hands back access | A closure statement | Access, assets and claims revoked; affected customers notified; data returned or deleted | Partner unresponsive: revoke unilaterally; counsel on contract steps | — |

## Maintaining the blueprints

A blueprint is updated by pull request when a service changes, after any incident or review that shows a failure the blueprint did not name, and at the quarterly internal audit. New failure points are added where they occurred.

## Related

[Handoffs](handoffs.md) · [Templates](templates.md) · [04 Service-level catalog](04-support-operating-model.md#service-level-catalog)
