# Support routes

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: drafted, and mostly unstaffed.** The support queue is built (an identity-free ticket table, context limited to named keys that start unticked, five tickets per account per day, opt-in email notices) and sits behind a flag that is off. No named owner, no hours, no probe of first-response time and no retention period for closed tickets exist. The support address is a personal mailbox, so today every route below ends at the founder. This page says where each kind of request should go, who owns it, what to collect, and when it becomes an incident, so that a second person has something to follow.

**Rule over every route.** Support convenience never overrides privacy, authorization or evidence integrity. An agent does not browse student records, does not use any global "act as" function (none exists), does not alter grades, records, roles, bills or consent, and never asks anyone to send a password, a multi-factor code, a full payment number or a sensitive document through an unapproved channel. Access to a student's learning signals comes only through a grant the student made, which expires, states a reason, and is visible to the student ([TC-SUP-01](CONTROL-FRAMEWORK.md)).

## Routes

| Request | First response | Owner seat | Becomes an incident when | Collect | Never |
| --- | --- | --- | --- | --- | --- |
| Cannot sign in or recover | Check the status page and incident list; guide recovery; do not reset on someone's word | success | Many users at once (SEV2, SEV1 if sign-in is down), or signs of takeover ([IR-02](INCIDENT-PLAYBOOKS.md#ir-02)) | Account id, tenant, time, device and browser | Ask for a password or code |
| Draft not saved, submission missing, receipt missing | Check the receipt and storage state; check the deadline policy; reassure only on a receipt | success, then engineering | A receipt mismatch or loss (SEV2; a deadline in the next day raises the urgency) | Correlation id, timestamp, course and assignment ids | Promise the instructor will accept it |
| Grade question | Explain which source is official; point to the instructor or registrar; do not alter anything | success, then the institution's registrar | An unexpected change ([IR-03](INCIDENT-PLAYBOOKS.md#ir-03), SEV1) | Grade record, audit trail, policy basis | Change a grade |
| Registration problem | Explain that Semester validates and the official system decides; check connector health and last sync | success, then data | A write that is not confirmed ([IR-05](INCIDENT-PLAYBOOKS.md#ir-05)) | Connection id, job id, mapping version | Retry an uncertain write |
| Billing or payment | Verify status, receipt, plan and the processor result | finance | A double charge, a forged event or a wrong entitlement ([IR-10](INCIDENT-PLAYBOOKS.md#ir-10)) | Invoice and payment ids, redacted processor evidence | Ask for card numbers |
| Privacy request: export, correct, restrict, erase | Direct to the in-app route; if emailed, reply with how to use it; do not promise an outcome | privacy | A request past its due date or touching a held account ([IR-12](INCIDENT-PLAYBOOKS.md#ir-12)) | Request type, tenant; verification by the data-rights procedure | Fulfil from an email |
| Family or guardian access | Explain that sharing is the student's choice or the institution's verified link; do not describe what is or is not shared with a third party | privacy | A suspected false guardian claim or oversharing ([IR-08](INCIDENT-PLAYBOOKS.md#ir-08), SEV2) | Link id; the requester's route | Confirm a student's data to a caller |
| Safety report or concern about a person | Acknowledge that it was received; give crisis resources; preserve; do not promise confidentiality beyond policy | trust | Any P0 or P1 ([IR-09](INCIDENT-PLAYBOOKS.md#ir-09), SEV1) | Case id, report metadata, risk assessment | Promise a response time or that someone is watching |
| Accessibility barrier | Capture the task, assistive technology, browser, device and impact; offer an alternative route now | accessibility | A blocker on a primary journey near a deadline ([IR-11](INCIDENT-PLAYBOOKS.md#ir-11)) | Steps; screenshots only with consent | Say the product is accessible |
| AI answer wrong, unsafe, or showed something it should not | Take the report; preserve the prompt and answer by reference; engage the switch if there is a leak | trust | A leak or policy bypass ([IR-04](INCIDENT-PLAYBOOKS.md#ir-04)) | Time, feature, the answer, what was expected | Argue the answer was right |
| Integration or sync issue | Check connector health, last sync and freshness label; explain what is native and still works | data, then the institution's IT | A mismatch or a failed write ([IR-05](INCIDENT-PLAYBOOKS.md#ir-05)) | Connection id, source system | Edit the connector configuration |
| Suspected security issue | Do not ask for secrets; preserve; create a security case | security | Always at least SEV2 ([IR-01](INCIDENT-PLAYBOOKS.md#ir-01) if cross-tenant) | Reporter contact, evidence, affected service | Discuss details outside the case |
| Request from law enforcement or a government body | Do not respond; forward to counsel the same day | privacy | Always counsel (requires qualified human counsel review) | The request as received | Release any data |

## Internal targets

The queue's design carries a first-response target of 24 hours for accessibility and privacy tickets and 72 hours for the rest (`docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`). They are internal, unprobed, and **not offered to anyone**: nothing here authorizes a response commitment to a customer, and the founder is the only responder. RM-37 names an owner and hours and adds a probe before the flag is switched on for a pilot.

## What the agent sees

The ticket queue is identity-free by default. The context an agent can attach is limited to six named keys, each unticked until the person ticks it. Email notices are opt-in per ticket and an opt-out cancels unclaimed outbox rows. The support-access log shows the student who looked and when. Nothing in the queue is a route to a student's notes or documents.

## Quality and escalation

- A ticket has a type, a severity (SEV1 to SEV4), an owner seat and a status. Reopened tickets and repeat contacts from the same person are measured; a spike in either is a signal to look for a defect, not for a bigger team.
- Escalation goes to the owner seat in the table, then the incident commander. A ticket that names harm to a person skips the queue and goes to [IR-09](INCIDENT-PLAYBOOKS.md#ir-09).
- Closed tickets have no retention period today (RM-37).
- Macros for each route are written once the owner and hours exist; a macro never states a cause not yet established.
