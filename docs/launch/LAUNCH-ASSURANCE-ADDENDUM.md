# Launch assurance addendum

| Control | Value |
| --- | --- |
| Status | **CONTROLLED ADDENDUM — fills named gaps only; approves nothing** |
| Assessed against | `origin/main` at `7287ddc`, 2026-10-04 (America/Chicago) |
| Owner | Harrison Rubin, Founder/Business Operations primary; backup `UNASSIGNED` |
| Authority | none of its own. Decisions stay with [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md); evidence stays with [`EVIDENCE-REGISTER.md`](../EVIDENCE-REGISTER.md) |
| Conflict rule | where this file and a controlling document disagree, the more conservative reading wins |

Written for the Launch Readiness and Risk Management seat. Its brief has ten parts; `main` already carries most of them. This file does not restate them. It maps each part to where it lives, then supplies what was missing: a tabletop pack, post-launch monitoring, a launch-level lessons-learned process, a dependency and critical-path plan, delay and change notices, and the probability, trigger and contingency fields the launch risk register lacks.

Nothing here is evidence. A scenario written down is not a scenario run, and a monitoring plan is not monitoring.

## 1. Coverage map

| # | Brief item | Already on `main` | Gap this file closes |
| --- | --- | --- | --- |
| 1 | Master checklist | [`LAUNCH-READINESS-CHECKLIST.md`](../../LAUNCH-READINESS-CHECKLIST.md) (executive index), [`market-readiness/LAUNCH-READINESS-CHECKLIST.md`](../market-readiness/LAUNCH-READINESS-CHECKLIST.md) (canonical), [`MASTER-LAUNCH-READINESS-REGISTER.md`](../MASTER-LAUNCH-READINESS-REGISTER.md) | none |
| 2 | Go/no-go, severity blockers, authority | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), P0–P3 rule in [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md), [`BETA_EXIT_CRITERIA.md`](../../BETA_EXIT_CRITERIA.md), [`operating-model/RELEASE-CERTIFICATION.md`](../operating-model/RELEASE-CERTIFICATION.md), executable profiles in `app/src/lib/governance/release-profiles.ts` | accepted-risk record (§2) |
| 3 | Risk register | [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) (FR-001 to FR-016: owner, mitigation, blocks), [`operating-model/RISK-GOVERNANCE.md`](../operating-model/RISK-GOVERNANCE.md), rollout risks R-01 to R-09 | probability, impact, trigger, contingency for FR rows (§3) |
| 4 | Scorecard and evidence repository | [`EVIDENCE-REGISTER.md`](../EVIDENCE-REGISTER.md) with expiry, `docs/evidence/`, [`operating-model/RELEASE-CERTIFICATION.md`](../operating-model/RELEASE-CERTIFICATION.md), `release-readiness.ts` dimensions | none |
| 5 | Pilot exit and production cutover | [`operating-model/PILOT-TO-PRODUCTION.md`](../operating-model/PILOT-TO-PRODUCTION.md) (phases, migration acceptance, cutover checklist, conversion options), [`BETA_EXIT_CRITERIA.md`](../../BETA_EXIT_CRITERIA.md), [`institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md) | none |
| 6 | Tabletop exercises | one: [`2026-10-03 founder tabletop`](../evidence/operations/2026-10-03-founder-readiness-tabletop.md), cross-tenant AI disclosure, document walkthrough only | six scenarios and a run protocol (§4) |
| 7 | Customer communications | [`launch/ANNOUNCEMENT-TEMPLATES.md`](ANNOUNCEMENT-TEMPLATES.md) (invitation, reminder, faculty note, paused), [`operating-model/INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md) (13 audiences incl. launch delay and change notice, outage), [`market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md) | none for the notices; they are now audiences in `incident-comms.ts` (§5) |
| 8 | Dependencies and critical path | [`EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md) (18 items, no ordering), [`DEGRADED-MODE-MAP.md`](../DEGRADED-MODE-MAP.md) (runtime dependencies) | ordering, chains, binding constraint (§6) |
| 9 | Post-launch monitoring at 24 h, 7 d, 30 d, 90 d | [`MONITORING.md`](../../MONITORING.md) (weekly operator check), [`90-DAY-LAUNCH-PROGRAM.md`](../90-DAY-LAUNCH-PROGRAM.md) (the program, not the watch) | the four windows (§7) |
| 10 | Lessons learned | post-incident review in [`INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md); monthly themes in [`OPERATING-RHYTHM.md`](../operating-model/OPERATING-RHYTHM.md) | launch, pilot and waiver reviews (§8) |

## 2. No approval on optimism: the accepted-risk record

[`BETA_EXIT_CRITERIA.md`](../../BETA_EXIT_CRITERIA.md) allows a bounded pilot to accept a documented P2 or P3 when the founder signs, users are told, and the waiver expires. P0 and P1 are never waived; the rule is to shrink the motion until the risk no longer applies. This is the record that rule needs. A waiver missing any field is not a waiver.

| Field | Content |
| --- | --- |
| Risk | FR or R ID, and the sentence from the register |
| Motion and cohort | exact motion, cohort, tenant and data mode it covers; nothing wider |
| Why not remediated | the specific reason, not "time" |
| Compensating control | what limits harm meanwhile, and the evidence it works |
| Disclosure | who is told, in what words, and where the notice is retained |
| Accepting authority | the founder, plus the domain owner or customer authority the register names for that risk |
| Expiry | a date. Past it, the motion returns to NO-GO |
| Revocation trigger | the observable event that ends the waiver early (the §3 trigger) |

Rules: a waiver covers one candidate SHA; a new SHA re-opens it. An expired, self-attested or preview-only record keeps its label and counts for nothing toward GO. The seat approving a waiver cannot be the only seat that wrote it; while one person holds every seat, the record says `SELF-ACCEPTED` and the affected motion stays at its current ceiling.

## 3. Risk register addendum

The register keeps owner, remediation and what each risk blocks. This table adds the fields it lacks, keyed by the same IDs. **Probability** is the chance the risk causes harm if the blocked motion proceeded today without remediation. **Impact** is the harm if it did. Scale is Low, Medium, High, Critical, as in `rollout.ts`. These are the seat's assessments for the owner to confirm, not measurements.

| ID | Prob. | Impact | Trigger (observable, ends the waiver or stops the motion) | Contingency |
| --- | --- | --- | --- | --- |
| FR-001 entity, IP, signing | High | Critical | any paper, price or payment drafted for signature before the counsel-reviewed fact sheet exists | stop at non-activation discovery; no signature, no payment |
| FR-002 no named customer | High | High | tenant configuration or data mapping started without a signed scope | stay on synthetic demonstration; build nothing customer-specific on spec |
| FR-003 no DAST or independent review | High | Critical | an externally reachable target carries institutional data without a candidate-bound scan; any High finding open on the activation date | unpaid invitation validation with no institutional data; disable the affected route |
| FR-004 isolation unproven in target | Medium | Critical | any cross-tenant read in a test or report; a second tenant requested before the signed isolation test | one tenant only, manual data; no second tenant |
| FR-005 recovery never exercised | High | Critical | first request to restore, roll back, export, delete or offboard in production | no supported launch; keep the documented previous-build rollback and say it is untimed |
| FR-006 single operator | High | High | the one operator is unreachable during an open incident or a critical period | freeze the cohort (no new invitations), post the paused notice, no deploys |
| FR-007 accessibility unreviewed | Medium | High | a user reports a barrier on a critical flow with no equivalent path | publish known limitations; provide the equivalent route; hold broad and paid motions |
| FR-008 commercial unapproved | Medium | High | a checkout, invoice or price quote is issued | checkout stays disabled; refuse payment |
| FR-009 no frozen candidate | High | High | evidence bound to a SHA other than the candidate; a deploy after freeze | evidence for the other SHA is void for the decision; re-run, re-bind |
| FR-010 retention and rights incomplete | Medium | High | a deletion, export or legal-hold request arrives and nobody is named to answer | accept no new personal data classes; no timeline promised until an answerer is named |
| FR-011 monitoring and support not accepted | High | High | an alert or ticket goes unacknowledged past the window the owner stated before activation | pause the cohort; invoke the paused notice |
| FR-012 no UAT or baseline | Medium | Medium | outcome language appears in a customer message with no signed baseline | no activation; outcome claims withheld |
| FR-013 performance coverage thin | Medium | Medium | a budgeted route breaches its budget on a representative device, or load approaches a critical period | cap cohort size; lift only after the next measured run |
| FR-014 document drift | Medium | Medium | two controlled documents give different answers | the conservative one governs; open a correction the same day |
| FR-015 vendor assurance unproven | Medium | High | a provider changes terms, region or availability, or a feature relies on an unreviewed provider | disable the dependent feature (AI has a drilled kill switch); say so to users |
| FR-016 no repeatability | High | Medium | a broad-sale conversation moves ahead of a second deployment | decline scope; keep claims conditional |

## 4. Tabletop pack

The 2026-10-03 tabletop covered a suspected cross-tenant AI disclosure and closed "no tabletop at all". Six scenarios remain. Severities use the playbook's SEV1 to SEV4 ([`INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md)); a suspected cross-tenant exposure is SEV1 until disproven.

### Run protocol

1. **Roles.** Commander, facilitator, scribe, communications approver. The facilitator is never the commander. With one person, the run is labeled `SELF-RUN`, and it is evidence of a walkthrough only.
2. **Rules of play.** Use the real contact route and the real templates. Injects arrive on the facilitator's clock, not the commander's. No new information after an inject unless asked for through a real channel. Mark every place the real tool, rota or person did not exist.
3. **Record.** Save to `docs/evidence/operations/<date>-tabletop-<id>.md`: scenario, participants, timeline, decisions with who made them, each pass criterion met or not, gaps with owner and gate, and the evidence ceiling.
4. **Ceiling.** A tabletop never closes EXT-011. Target drills do, with dated records and named witnesses. State the ceiling in every record.
5. **Currency.** Tabletop evidence uses the 91-day window already in the evidence register. Re-run after a material change to identity, data, AI or payment, and at each monitoring review in §7.
6. **Before first activation.** Every scenario below has been run at least once, gaps have owners, and any `SELF-RUN` has been repeated with a second person.

### Scenarios

**TT-1 Migration rollback (SEV2; SEV1 if an official record is wrong)**
Inject 1: a cohort data import reconciles with a count mismatch after cutover day. Inject 2: a schema migration applied the same day breaks sign-in for part of the cohort. Inject 3: the institution asks whether its roster is correct.
Decisions: stop and roll back, or forward-fix; who tells the institution; which system is the source of truth right now.
Pass: nothing official is written while counts disagree; the source of truth is named within the first update; rollback follows [`ROLLBACK.md`](../../ROLLBACK.md) and the migration acceptance criteria in [`PILOT-TO-PRODUCTION.md`](../operating-model/PILOT-TO-PRODUCTION.md); the reconciliation report is produced before restore is declared; the notice says what was and was not changed.
Feeds: EXT-011, EXT-018, FR-005.

**TT-2 Support surge (SEV3; SEV2 if it hides a real defect)**
Inject 1: ticket volume in the first week is several times plan after a confusing flow. Inject 2: the support address is a personal mailbox that is also receiving unrelated mail. Inject 3: a message contains a student's private details and a request to "just fix my account".
Decisions: what to pause (invitations, a feature), what to answer by macro, when to ask for the second person.
Pass: a posted acknowledgement target exists and is met; triage separates a defect from a how-to; support sees only what its purpose needs, and the access is logged; inflow is shed by pausing invitations before the queue goes silent; the status or paused notice goes out; the defect is routed to engineering with a correlation reference rather than the student's content.
Feeds: EXT-009, FR-006, FR-011.

**TT-3 Integration failure (SEV3; SEV2 if grades or enrollment are shown wrong)**
Run on synthetic data: no production adapter exists today ([`RELEASE-GATES.md`](../RELEASE-GATES.md) G8).
Inject 1: a connector returns a stale feed with no error. Inject 2: it then returns duplicates. Inject 3: an ambiguous official write has no confirmation.
Pass: the source shows stale with its last-verified time; sync is halted; nothing is silently overwritten; the action reads **Pending verification** and is not retried; the one-and-only-one-effect check is made against the authoritative system; the "Integration data delay" audience is used with source system and last good sync filled in.
Feeds: EXT-018, FR-015.

**TT-4 Data breach (SEV1)**
Distinct from the cross-tenant AI case already run on 2026-10-03. Inject 1: a credential or secret is found in a public place. Inject 2: logs show it was used. Inject 3: a customer contact asks directly whether student records were read.
Decisions: what to revoke first; when counsel is engaged; what the first notice may and may not say.
Pass: credentials are revoked and rotated per [`SECRETS.md`](../../SECRETS.md); evidence is preserved before cleanup; counsel is engaged before any statement about legal obligations or deadlines; the security notice sets data exposure to **Suspected** or **Unknown**, never a guess at **Not indicated**; the institution's named contact is told; no notification clock is promised.
Feeds: EXT-001 (counsel), EXT-011, FR-003, FR-010.

**TT-5 AI safety incident (SEV2; SEV1 if a crisis or high-stakes answer was wrong)**
Distinct from the cross-tenant case already run. Inject 1: the assistant tells a student a deadline has passed that has not. Inject 2: a student's message signals crisis and the response does not hand off. Inject 3: the provider has silently changed model behavior.
Pass: the narrowest reliable switch is engaged (`kill.ai_generation` is the drilled one) and deterministic features are shown unaffected; the crisis route in [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md) is followed; the "AI quality incident" notice names the outputs to distrust and says whether the feature is paused; restore waits for a rerun of the model-quality set and the prompt-injection set against the model in use, with two-person release.
Feeds: G7, FR-015, EXT-017.

**TT-6 Critical-deadline outage (SEV1 or SEV2 by reach)**
Inject 1: sign-in and sync fail in the last hours before an add/drop or assignment deadline. Inject 2: a deploy went out that morning. Inject 3: students ask for extensions and the institution asks who was affected.
Pass: the freeze rule from the critical-periods list in [`DEGRADED-MODE-MAP.md`](../DEGRADED-MODE-MAP.md) is applied (no deploys, no migrations); the device-first fact is used truthfully (what still works locally is stated); the student notice carries the deadline contact and never promises an extension; the institution gets the list of affected windows; rollback is decided on stated criteria, not hope.
Feeds: FR-005, FR-006, FR-011; also creates the freeze calendar the map says is an owner decision.

## 5. Customer communications

Launch and reminder notices: [`ANNOUNCEMENT-TEMPLATES.md`](ANNOUNCEMENT-TEMPLATES.md). Outages, security, privacy, accessibility, AI, integration, maintenance and rollback: [`INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md), which enforces its seven-part frame through `compose()` and records sends in `governance_incident_notices`.

The launch delay and the change notice are audiences in `incident-comms.ts` (`launch_delay`, `change_notice`), so `compose()` refuses them with a section missing, a placeholder left in, or a required field blank or off its list, and `governance_incident_notices` holds the same rules again (approvers, cadence, required details). The templates below are the shape `compose()` produces; the required fields are the last two headings in each.

Rules for both: no date unless a current, evidence-gated decision backs it; a delay is stated as a gate not yet evidenced, never as a promise to be ready by a later date; no outcome or readiness claim beyond [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); the customer's name appears only with their written permission.

**Launch delay.** Approver: Founder; the customer's sponsor sees it first. Cadence: no later than a week, the steering meeting's.

```text
Subject: Semester — Launch is on hold

What happened
The start of the [COHORT] pilot is on hold. A required check has not yet been completed: [PLAIN-LANGUAGE GATE].

Who is affected
[COHORT] at [INSTITUTION]. Nobody's account or data has changed.

What data or workflow is affected
None. [Existing arrangement] continues unchanged.

What you should do now
Keep using [CURRENT SYSTEM]. Nothing is needed from you except [ACTION, OR "nothing"].

What Semester is doing
Completing [CHECK] with [WHO]. We will start only when it is recorded as complete and you have approved it.

Next update
By [TIME/DATE OF NEXT GATE REVIEW], even if nothing has changed.

Where to get help
[SUPPORT ROUTE].

Check not yet complete
[PLAIN-LANGUAGE GATE]

Has any account or data changed
No
```

**Change notice** (terms, data use, AI behavior, a provider). Approvers: Product owner, Privacy owner and Legal, every time; a change that needs neither belongs to feature rollback or scheduled maintenance. Cadence: no later than 30 days, the longest notice period the registry allows.

```text
Subject: Semester — A change to [WHAT]

What happened
On [DATE] we will change [WHAT].

Who is affected
[WHO].

What data or workflow is affected
[WHAT CHANGES FOR THEM]. Your existing work is [AFFECTED / NOT AFFECTED].

What you should do now
[ACTION, OR "nothing"]. You can [OPT OUT / ASK A QUESTION] by [ROUTE].

What Semester is doing
[WHY, ONE SENTENCE]. We will roll back if [CRITERION].

Next update
[DATE OF EFFECT], and a confirmation that it took effect.

Where to get help
[SUPPORT ROUTE].

Takes effect
[DATE]

Is your work affected
No
```

## 6. Dependencies and critical path

The queue lists 18 external items with no order. This section orders them. **No durations or dates are asserted**; none exist in the repository. Each owner supplies an estimate in working days when claiming a node, and the weekly review records it.

### Dependency chains

| Chain | Sequence | Gates |
| --- | --- | --- |
| A. Company and commercial | EXT-001 → EXT-002 and EXT-003 → EXT-004 and EXT-005 | paid pilot, payment, contracted launch |
| B. People and operations | named backup and rota → EXT-009 → EXT-010 → EXT-011 | any supported launch |
| C. Technical assurance | frozen candidate with hosted CI and PostgreSQL 17 (priority 1) → authorized target → EXT-007 → EXT-006 | paid and target activation |
| D. Customer | named customer → EXT-012 → EXT-013 and EXT-014 → EXT-015 → EXT-016 | institutional activation, claims |
| E. Providers and integrations | EXT-017 → EXT-018 | affected features, integration claims |
| F. Accessibility | EXT-008, independent of the rest | broad individual, paid pilot |

### Reading the paths

- **The binding constraint is people, not code.** Chain B is the narrowest. The restore, rollback, rights and offboarding drills in EXT-011 need a second operator, and the register records that none is named. Every other chain can progress with money or time; this one needs a person.
- **One owner holds nearly every node.** Harrison Rubin is named primary on most rows, so the path is resource-constrained: parallel chains on paper are serial in practice. Estimate each node's effort, not only its elapsed time, and do not plan two chains as concurrent unless different people own them.
- **Chain D starts at a node nobody can start.** There is no named customer ([`FR-002`](../../LAUNCH-RISK-REGISTER.md)). Until there is, chain D has no schedule at all, and any date for institutional activation is invention.
- **The earliest activation is the bounded design partner.** Its blockers are priorities 1 to 8 in [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), so B, C and D (and counsel's part of A) sit on its path. Paid pilot adds A and F in full.
- **Runtime dependencies are separate.** GitHub Pages, Supabase, Stripe, the AI provider, the gateway journal and the single operator are in [`DEGRADED-MODE-MAP.md`](../DEGRADED-MODE-MAP.md). A runtime single point of failure that is unmitigated is a node on chain B or C, not a footnote.

### Tracking rules

Tracked in the weekly review ([`OPERATING-RHYTHM.md`](../operating-model/OPERATING-RHYTHM.md)), one row per node:

| Field | Meaning |
| --- | --- |
| ID, owner, acceptor | who produces the evidence, who accepts it |
| Predecessors | node IDs that must be accepted first |
| Estimate | owner's working days, with the date it was given |
| State | OPEN, IN PROGRESS, BLOCKED (with the blocker's ID), EVIDENCED, EXPIRED |
| Last moved | date of the last change in state |
| Evidence expiry | from the evidence register |

A node unmoved for 14 days is raised at the next review with a reason. A BLOCKED node names what unblocks it and who owns that. An EXPIRED node returns every motion it supports to NO-GO, as [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) already says. A node is never marked EVIDENCED on an owner's say-so; the acceptor named in the queue accepts it.

## 7. Post-launch monitoring

Applies from the first activation of any named cohort, individual or institutional. Thresholds are the ones in [`SLOS-AND-ERROR-BUDGETS.md`](../operating-model/SLOS-AND-ERROR-BUDGETS.md); **this file adds no numbers**. Recovery time and recovery point are unset ([`INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md)) and nothing here states one. Anything the SLO document does not cover, such as an acknowledgement target or an adoption floor, is set by the owner and signed in the baseline (EXT-015) **before** activation. A threshold chosen after seeing the data is not a threshold.

Each window ends with one recorded decision: **continue**, **hold** (no new users), **roll back**, or **expand**. Expand is possible only at 30 and 90 days.

| Window | Staffing and cadence | What is watched | Decision at the end |
| --- | --- | --- | --- |
| **First 24 hours** | the operator reachable throughout, backup informed, check at fixed intervals the owner states; no other release in the window | sign-in and Today availability; error rates by route; tenant-isolation and audit alarms (any cross-tenant signal is SEV1 at once); support inbox depth and acknowledgement; queued writes and Pending-verification counts; AI refusals and kill-switch state; first-action completion; every ticket read for a defect, not just answered | continue, hold or roll back. Roll back on any breach of the stop criteria in the signed baseline |
| **First 7 days** | daily check, short written note each day; one review at day 7 | the same set, trended; connector freshness and reconciliation (if any connector is on); support themes and repeat contacts; accessibility reports; AI quality samples against the evaluation sets; retention and deletion requests received and answered; open waivers and their expiry | continue, hold or roll back; list every waiver and its expiry; confirm tabletop gaps found since launch have owners |
| **30 days** | weekly check; formal review at day 30; lessons-learned (§8) | SLO attainment against the 30-day measurement the beta exit gates ask for; error-budget burn; support contact rate and time to resolve; activation and time to first value against the signed baseline; incident count and recurrence; drill status (restore, rollback, rights, offboarding) against the target environment; vendor changes | continue, hold or expand. Expansion needs every gate for the wider scope evidenced, as for any motion |
| **90 days** | monthly check; formal review at day 90; lessons-learned (§8) | all of the above, plus retention and outcome movement against the baseline, with denominators and guardrails; renewal and conversion indicators; evidence expiring in the next 90 days; claims in use against the claims register; whether the operating model survived real load (second operator, rota, escalations) | continue, convert, or close out under [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md). An outcome claim needs the claim-specific permission in EXT-016 |

Standing rules for every window:

- **Stop criteria are fixed in advance.** The escalation conditions in [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) apply throughout: suspected secret exposure, cross-tenant access, material data loss, a critical accessibility barrier with no equivalent path, unavailable monitoring or support, a false public or contractual claim, failed restore or offboarding, an unreviewed material change.
- **Unmonitored is red.** If an alert route stops working, the window is treated as failed until it is restored and tested, not assumed quiet.
- **Privacy bounds the watch.** Monitoring uses aggregates and correlation references; it never copies private student content into an incident, a note or a dashboard.
- **A quiet window proves nothing about the probe.** Confirm at least once per window that an alert would have fired, using a deliberate test signal.

## 8. Lessons-learned process

The playbook already requires a post-incident review for SEV1 and SEV2 within five business days of stabilization. This extends that to launches, pilots and waivers.

**When.** After every SEV1 or SEV2 (existing rule). Also: at the 30-day and 90-day reviews; at pilot closeout; when a waiver expires or is revoked; when a gate that was passed is re-opened; after any near miss, defined as a control that stopped a problem by luck, not by design; after any tabletop.

**How.**

1. **Blameless, evidence-first.** Reconstruct from timeline, alerts, tickets, redacted traces, changes and notices. Ask what the system allowed, not who erred.
2. **Separate four things:** what happened; what we believed beforehand; what the evidence now shows; what we do about it.
3. **Reviewer is not the author.** With one person, the record says `SELF-REVIEWED` and its findings carry that label.
4. **Every finding becomes a change in one of four places:** a test or guard, a runbook, a gate or checklist row, or a public claim. A finding with none of these is a note, not a lesson.
5. **Every action has one owner, a due date, a severity, the evidence that proves it done, and a regression test or rehearsal when applicable.** It closes only on verification, not on the owner's say-so.
6. **Feed forward.** Update the risk register (new risk, or changed probability, impact, trigger), add or amend a tabletop scenario (§4), re-open the affected checklist row, and, when a decision changes, record it as a decision file named for its pull request ([`docs/decisions/README.md`](../decisions/README.md)).

**Record.** `docs/evidence/operations/<date>-review-<subject>.md` with: subject and window, timeline, what was believed versus found, findings with the change each produced, actions with owner and due date, risks and claims affected, evidence ceiling.

**Measures** (reviewed monthly alongside incident themes): repeat findings across reviews; actions overdue; median time from finding to verified closure; waivers renewed more than once; tabletop gaps still open at the next activation. A repeat finding means the earlier action did not hold, and reopens it.

## 9. What this file does not do

- It does not run any exercise, collect any evidence, or move any gate. Every tabletop above is unrun.
- It does not change a decision. Individual validation stays conditional, discovery stays non-activation, paid and broad motions stay NO-GO until [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) says otherwise.
- It does not give legal conclusions. Counsel reviews anything that changes terms, data use, notification duties or contract positions.
- It does not set recovery objectives, durations, thresholds or dates.
- It does not run the new audiences against a real database: see the pull request for which checks ran.
