# Combined risk review

<!-- Rendered from app/src/lib/ops/riskreview.ts by riskreview.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

One record per capability, answered by the seats that own each section, required before the capability is released to anyone beyond its builders. It joins what was kept apart: the privacy assessment, the risk register, the accessibility evidence, the service-level objective, the support route and the incident playbook, all keyed by the same `CAP-nnn` id the rest of the governance uses.

## The rule

- **Required.** No capability the activation register marks high risk, and no release profile beyond the invitation-only validation, proceeds without a review whose verdict is *go* or *conditional*. A capability with no review is *no-go*; the absence of a record is the thing this makes visible.
- **A pass is evidence, not an opinion.** It names files that exist. Anything that has to have been *operated* — a restore, an alert reaching a person, a screen-reader pass, a drill — needs a file under `docs/evidence/`, because the master register lets no row past `tested` without one. A test in the tree shows a build would notice; it does not show anyone did the thing.
- **A vacant seat cannot sign.** Each section has an owning seat. If the launch council names no holder, nothing it says counts. Today that makes the security, trust and data sections unpassable, which is true.
- **Evidence expires, strictly.** A pass is good before its `expiresOn` and not on it, the rule release evidence adopted on 3 October. A pass lasts at most 91 days.
- **Exceptions are narrow.** Only the founder seat can accept a risk, only on a question not marked blocking, for at most 90 days, with a reason. Any unresolved blocking question is *no-go*; unresolved non-blocking ones make the verdict *conditional*.
- **Legal conclusions are not made here.** A question that would end in one says *requires qualified human counsel review*, and a pass on it needs a closed row in the [legal review queue](../../LEGAL-REVIEW-QUEUE.md), filed as evidence.

The evaluator is `evaluate()` in `app/src/lib/ops/riskreview.ts`. It reads no clock, disk or network: the day and the file-existence check are passed in, so the same review always gives the same verdict. It is not yet a gate in `release-profiles.ts` or in CI — see TR-49 in the [remediation sequence](REMEDIATION-SEQUENCE.md) — so today it is consulted by its own test and by whoever runs a release.

## How a review is run

1. **Open** it: add a `Review` to `REVIEWS` for the capability, list what it touches, and name the risks and playbooks that apply. Opening costs nothing and already shows the known gaps, because every unanswered question is seeded from the [control register](CONTROL-FRAMEWORK.md).
2. **Answer** it, section by section, by the owning seat. A seat answers `pass` with evidence and dates, `fail` or `owed` with a note, or — for a non-blocking question only — asks the founder to accept.
3. **File** what has to be operated first: run the drill, the restore, the assistive-technology pass, and save the record under `docs/evidence/` with its date; cite it in the matching evidence record.
4. **Read the verdict** with `gateFor(capability, today, exists)`. *Go* releases; *conditional* releases with the listed conditions and their dates; *no-go* does not.
5. **Renew** before `expiresOn`, and on any change that touches what a section asked about — a new data class, a new provider, a changed model, a new role.

## The questions

37 questions in 10 sections. A question applies when the review touches the thing in the second column, or always.

### Security

Answered by the **security** seat (vacant: no pass counts until it has a holder).

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-SEC-1 | always | yes | repository | — | Is there a threat model for this capability's trust boundaries, with each high-severity row tied to a test or check? |
| RR-SEC-2 | always | yes | repository | TC-SEC-01 | Does every read and write enforce tenant and role in the database or server, with a negative test for each role? |
| RR-SEC-3 | Lets staff see or act on a student's data | yes | repository | TC-SEC-09 | Is every staff or support path purpose-scoped, time-bound and visible to the student, and does a break-glass grant widen access only inside that scope? |
| RR-SEC-4 | Reads or writes an official record | yes | repository | TC-SEC-08 | Is each consequential action confirmed, idempotent and receipted, with two people where it is high impact? |
| RR-SEC-5 | Depends on an external system | yes | repository | TC-SEC-03 | Does every integration fail closed, with least scopes and a signed or authenticated channel? |
| RR-SEC-6 | always | no | operated: `docs/evidence/` | TC-SEC-06 | Is new code covered by static analysis and an authenticated dynamic scan? |
| RR-SEC-7 | always | no | operated: `docs/evidence/` | TC-SEC-13 | Is every new secret inventoried, with a rotation owner and a logged rotation? |

### Privacy

Answered by the **privacy** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-PRV-1 | Holds personal data | yes | repository | TC-PRV-07 | Is there a privacy impact assessment with all eleven answers, a reader list and cited evidence? |
| RR-PRV-2 | Holds personal data | yes | repository | TC-PRV-01 | Is every personal-data column in the export and erasure map, and does the deletion check cover the new tables? |
| RR-PRV-3 | Holds personal data | no | repository | TC-PRV-03 | Is each retention period stated, listed in the retention tripwire and approved? |
| RR-PRV-4 | Reachable by a minor or a guardian | yes | repository | TC-PRV-06 | Is the minor and guardian posture decided, tested in SQL and reviewed by counsel (requires qualified human counsel review)? |
| RR-PRV-5 | Shares data with another person or party | yes | repository | TC-PRV-05 | Does every share record purpose and basis, expire, and revoke immediately, with reads logged? |
| RR-PRV-6 | Holds personal data | yes | operated: `docs/evidence/` | TC-PRV-08 | Is every provider that touches the data on the subprocessor list, with signed terms and a deletion path? |

### Accessibility

Answered by the **accessibility** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-A11-1 | always | yes | operated: `docs/evidence/` | TC-A11-02 | Is the primary journey completed by keyboard alone, automated in a real browser and confirmed by a recorded manual run? |
| RR-A11-2 | always | yes | operated: `docs/evidence/` | TC-A11-06 | Are screen reader, zoom to 400 percent and forced colours results recorded for the primary journey? |
| RR-A11-3 | always | yes | repository | TC-A11-04 | Does text meet contrast in every ground and in the empty, error and hover states, as painted? |
| RR-A11-4 | always | no | repository | TC-A11-05 | Does every loading, empty, denied, offline and error state explain what happened, what to do and who can help, and keep the user's input? |
| RR-A11-5 | Holds content other users can see | no | repository | TC-A11-07 | Do audio and video have captions and transcripts, and images a text alternative? |

### Reliability

Answered by the **operations** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-REL-1 | always | yes | operated: `docs/evidence/` | TC-REL-02 | Is there a service-level objective for the primary journey, with eligible and good events defined and counted from real events? |
| RR-REL-2 | always | yes | operated: `docs/evidence/` | TC-REL-05 | Is there a switch that turns it off, drilled against production? |
| RR-REL-3 | always | yes | operated: `docs/evidence/` | TC-REL-06 | Does an alert reach an assigned person when its objective burns? |
| RR-REL-4 | always | yes | operated: `docs/evidence/` | TC-REL-04 | Is recovery documented and rehearsed, with a measured recovery time and point? |
| RR-REL-5 | always | no | operated: `docs/evidence/` | TC-REL-03 | Has the peak load for this capability (registration day, grade release, billing due date) been run? |
| RR-REL-6 | Depends on an external system | yes | repository | — | When the external system is down, does the capability keep its native function and label what is stale? |

### Support

Answered by the **success** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-SUP-1 | always | yes | repository | TC-SUP-02 | Is there a named support route with an owner, hours and a macro, and does a user know where to find it? |
| RR-SUP-2 | always | no | repository | — | Are the known limitations written where the user will read them? |

### Incident response

Answered by the **operations** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-INC-1 | always | yes | operated: `docs/evidence/` | TC-INC-04 | Is there a playbook for the incident this capability could cause, and has it been exercised? |
| RR-INC-2 | always | yes | operated: `docs/evidence/` | TC-INC-03 | Are the people who approve and send the message named and reachable outside business hours? |

### AI governance

Answered by the **trust** seat (vacant: no pass counts until it has a holder).

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-AI-1 | Uses an AI model | yes | repository | TC-AI-03 | Is the AI risk tier assigned and the use not on the prohibited list? |
| RR-AI-2 | Uses an AI model | yes | repository | — | Does a person confirm every consequential action, with sources and uncertainty shown? |
| RR-AI-3 | Uses an AI model | yes | operated: `docs/evidence/` | TC-AI-04 | Does the adversarial suite include this capability's data and tools, run on the current model? |

### Trust and safety

Answered by the **trust** seat (vacant: no pass counts until it has a holder).

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-TSF-1 | Holds content other users can see | yes | repository | TC-TSF-01 | Can a user report, can a case be triaged and decided with a reason, and can the author appeal? |
| RR-TSF-2 | Holds content other users can see | yes | repository | TC-TSF-02 | Is moderator access least-privilege, with reads as well as reveals logged? |
| RR-TSF-3 | Holds content other users can see | yes | operated: `docs/evidence/` | TC-TSF-05 | Are the abuse-material, self-harm and law-enforcement routes decided with counsel and exercised (requires qualified human counsel review)? |

### Data and records

Answered by the **data** seat (vacant: no pass counts until it has a holder).

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-DAT-1 | Reads or writes an official record | yes | repository | — | Is the system of record named, with source precedence and a conflict policy a student can see? |
| RR-DAT-2 | Moves or displays money | yes | repository | TC-SEC-12 | Are amounts and records derived from a ledger, re-read at commit and reconciled against the source? |

### Claims and legal queue

Answered by the **privacy** seat.

| ID | Applies when | Blocking | Evidence | Control | Question |
| --- | --- | --- | --- | --- | --- |
| RR-LEG-1 | always | yes | operated: `docs/evidence/` | — | Is every public claim about this capability in the claims register at a status its evidence supports, and every counsel-queue item it depends on closed (requires qualified human counsel review)? |

## The record

A review in `REVIEWS`:

```ts
{
  capability: 'CAP-050',
  title: 'Registration',
  touches: ['personalData', 'officialRecords', 'integrations'],
  opened: '2026-10-04',
  answers: {
    'RR-SEC-2': { status: 'pass', reviewer: 'security', reviewedOn: '2026-11-02', expiresOn: '2027-01-15',
                  evidence: ['supabase/rls-coverage.check.sql', 'supabase/tenancy.check.sql'] },
    'RR-SEC-6': { status: 'accepted', acceptedBy: 'founder', reviewedOn: '2026-11-02', until: '2027-01-15',
                  reason: 'Code scanning lands with TR-15; the pilot window is eight weeks.' },
    'RR-REL-4': { status: 'owed', note: 'Provider restore drill TT-03 is scheduled for week 6.' },
  },
  risks: ['R-01', 'R-08'],
  playbooks: ['IR-03', 'IR-05', 'IR-06'],
}
```

## Reviews opened

Read at 2026-10-04. Each is opened with no answers: the seats that must give them are mostly vacant, and an answer written here on their behalf would be the thing this record exists to prevent. What each shows is what the control register already knows.

| Capability | Touches | Questions | Blocking unresolved | Known gaps | Owed | Not yet reviewed | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| CAP-041 Family | Holds personal data; Reachable by a minor or a guardian; Shares data with another person or party; Reads or writes an official record; Lets staff see or act on a student's data | 27 | 21 | 4 | 19 | 4 | **no-go** |
| CAP-046 Money | Holds personal data; Moves or displays money; Reads or writes an official record; Depends on an external system | 27 | 21 | 4 | 18 | 5 | **no-go** |
| CAP-047 Meal Plan | Holds personal data; Moves or displays money; Depends on an external system | 25 | 19 | 4 | 17 | 4 | **no-go** |
| CAP-048 Housing | Holds personal data; Reads or writes an official record; Depends on an external system | 26 | 20 | 4 | 17 | 5 | **no-go** |
| CAP-050 Registration | Holds personal data; Reads or writes an official record; Depends on an external system | 26 | 20 | 4 | 17 | 5 | **no-go** |

### CAP-041 Family

Risks: R-01, R-13. Playbooks: IR-01, IR-08, IR-12.

Blocking questions unresolved:

- **RR-SEC-1** (security, unanswered): Not yet reviewed.
- **RR-SEC-2** (security, owed): TC-SEC-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-3** (security, owed): TC-SEC-09 is partial: private.break_glass_active is defined and consumed by nothing, so a grant is an authorization record and review gate that widens no access; the security seat that must co-approve is vacant.
- **RR-SEC-4** (security, owed): TC-SEC-08 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-1** (privacy, owed): TC-PRV-07 is partial: Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.
- **RR-PRV-2** (privacy, owed): TC-PRV-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-4** (privacy, owed): TC-PRV-06 is partial: Community join and post are not gated by minor status in SQL, the guardian portal is not built, and parental consent has not started counsel review.
- **RR-PRV-5** (privacy, owed): TC-PRV-05 is partial: No purpose, legal basis or signature method is recorded, a revoked share can be deleted by the student, and reads log reader and time only.
- **RR-PRV-6** (privacy, owed): TC-PRV-08 is partial: The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.
- **RR-A11-1** (accessibility, owed): TC-A11-02 is enforced in the repository; the owning seat has not reviewed it.
- **RR-A11-2** (accessibility, known-gap): TC-A11-06 is absent: No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.
- **RR-A11-3** (accessibility, owed): TC-A11-04 is partial: Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; its last reported finding (a hovered journey card) is fixed and guarded (TR-02), and the first green nightly run is the proof still owed.
- **RR-REL-1** (operations, owed): TC-REL-02 is partial: Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.
- **RR-REL-2** (operations, owed): TC-REL-05 is partial: Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.
- **RR-REL-3** (operations, known-gap): TC-REL-06 is absent: The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.
- **RR-REL-4** (operations, owed): TC-REL-04 is partial: Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.
- **RR-SUP-1** (success, owed): TC-SUP-02 is partial: Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.
- **RR-INC-1** (operations, owed): TC-INC-04 is documented: One document walkthrough has been held; sixteen game days are planned and none held.
- **RR-INC-2** (operations, known-gap): TC-INC-03 is absent: One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.
- **RR-DAT-1** (data, unanswered): Not yet reviewed.
- **RR-LEG-1** (privacy, unanswered): Not yet reviewed.

### CAP-046 Money

Risks: R-01, R-08. Playbooks: IR-03, IR-05, IR-10.

Blocking questions unresolved:

- **RR-SEC-1** (security, unanswered): Not yet reviewed.
- **RR-SEC-2** (security, owed): TC-SEC-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-4** (security, owed): TC-SEC-08 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-5** (security, owed): TC-SEC-03 is partial: The gateway is not deployed and the hourly production probe for it is unconfigured, so nothing shows it operating.
- **RR-PRV-1** (privacy, owed): TC-PRV-07 is partial: Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.
- **RR-PRV-2** (privacy, owed): TC-PRV-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-6** (privacy, owed): TC-PRV-08 is partial: The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.
- **RR-A11-1** (accessibility, owed): TC-A11-02 is enforced in the repository; the owning seat has not reviewed it.
- **RR-A11-2** (accessibility, known-gap): TC-A11-06 is absent: No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.
- **RR-A11-3** (accessibility, owed): TC-A11-04 is partial: Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; its last reported finding (a hovered journey card) is fixed and guarded (TR-02), and the first green nightly run is the proof still owed.
- **RR-REL-1** (operations, owed): TC-REL-02 is partial: Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.
- **RR-REL-2** (operations, owed): TC-REL-05 is partial: Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.
- **RR-REL-3** (operations, known-gap): TC-REL-06 is absent: The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.
- **RR-REL-4** (operations, owed): TC-REL-04 is partial: Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.
- **RR-REL-6** (operations, unanswered): Not yet reviewed.
- **RR-SUP-1** (success, owed): TC-SUP-02 is partial: Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.
- **RR-INC-1** (operations, owed): TC-INC-04 is documented: One document walkthrough has been held; sixteen game days are planned and none held.
- **RR-INC-2** (operations, known-gap): TC-INC-03 is absent: One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.
- **RR-DAT-1** (data, unanswered): Not yet reviewed.
- **RR-DAT-2** (data, owed): TC-SEC-12 is enforced in the repository; the owning seat has not reviewed it.
- **RR-LEG-1** (privacy, unanswered): Not yet reviewed.

### CAP-047 Meal Plan

Risks: R-08. Playbooks: IR-05, IR-10.

Blocking questions unresolved:

- **RR-SEC-1** (security, unanswered): Not yet reviewed.
- **RR-SEC-2** (security, owed): TC-SEC-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-5** (security, owed): TC-SEC-03 is partial: The gateway is not deployed and the hourly production probe for it is unconfigured, so nothing shows it operating.
- **RR-PRV-1** (privacy, owed): TC-PRV-07 is partial: Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.
- **RR-PRV-2** (privacy, owed): TC-PRV-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-6** (privacy, owed): TC-PRV-08 is partial: The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.
- **RR-A11-1** (accessibility, owed): TC-A11-02 is enforced in the repository; the owning seat has not reviewed it.
- **RR-A11-2** (accessibility, known-gap): TC-A11-06 is absent: No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.
- **RR-A11-3** (accessibility, owed): TC-A11-04 is partial: Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; its last reported finding (a hovered journey card) is fixed and guarded (TR-02), and the first green nightly run is the proof still owed.
- **RR-REL-1** (operations, owed): TC-REL-02 is partial: Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.
- **RR-REL-2** (operations, owed): TC-REL-05 is partial: Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.
- **RR-REL-3** (operations, known-gap): TC-REL-06 is absent: The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.
- **RR-REL-4** (operations, owed): TC-REL-04 is partial: Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.
- **RR-REL-6** (operations, unanswered): Not yet reviewed.
- **RR-SUP-1** (success, owed): TC-SUP-02 is partial: Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.
- **RR-INC-1** (operations, owed): TC-INC-04 is documented: One document walkthrough has been held; sixteen game days are planned and none held.
- **RR-INC-2** (operations, known-gap): TC-INC-03 is absent: One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.
- **RR-DAT-2** (data, owed): TC-SEC-12 is enforced in the repository; the owning seat has not reviewed it.
- **RR-LEG-1** (privacy, unanswered): Not yet reviewed.

### CAP-048 Housing

Risks: R-01, R-08. Playbooks: IR-03, IR-05.

Blocking questions unresolved:

- **RR-SEC-1** (security, unanswered): Not yet reviewed.
- **RR-SEC-2** (security, owed): TC-SEC-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-4** (security, owed): TC-SEC-08 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-5** (security, owed): TC-SEC-03 is partial: The gateway is not deployed and the hourly production probe for it is unconfigured, so nothing shows it operating.
- **RR-PRV-1** (privacy, owed): TC-PRV-07 is partial: Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.
- **RR-PRV-2** (privacy, owed): TC-PRV-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-6** (privacy, owed): TC-PRV-08 is partial: The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.
- **RR-A11-1** (accessibility, owed): TC-A11-02 is enforced in the repository; the owning seat has not reviewed it.
- **RR-A11-2** (accessibility, known-gap): TC-A11-06 is absent: No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.
- **RR-A11-3** (accessibility, owed): TC-A11-04 is partial: Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; its last reported finding (a hovered journey card) is fixed and guarded (TR-02), and the first green nightly run is the proof still owed.
- **RR-REL-1** (operations, owed): TC-REL-02 is partial: Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.
- **RR-REL-2** (operations, owed): TC-REL-05 is partial: Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.
- **RR-REL-3** (operations, known-gap): TC-REL-06 is absent: The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.
- **RR-REL-4** (operations, owed): TC-REL-04 is partial: Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.
- **RR-REL-6** (operations, unanswered): Not yet reviewed.
- **RR-SUP-1** (success, owed): TC-SUP-02 is partial: Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.
- **RR-INC-1** (operations, owed): TC-INC-04 is documented: One document walkthrough has been held; sixteen game days are planned and none held.
- **RR-INC-2** (operations, known-gap): TC-INC-03 is absent: One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.
- **RR-DAT-1** (data, unanswered): Not yet reviewed.
- **RR-LEG-1** (privacy, unanswered): Not yet reviewed.

### CAP-050 Registration

Risks: R-01, R-08. Playbooks: IR-03, IR-05, IR-06.

Blocking questions unresolved:

- **RR-SEC-1** (security, unanswered): Not yet reviewed.
- **RR-SEC-2** (security, owed): TC-SEC-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-4** (security, owed): TC-SEC-08 is enforced in the repository; the owning seat has not reviewed it.
- **RR-SEC-5** (security, owed): TC-SEC-03 is partial: The gateway is not deployed and the hourly production probe for it is unconfigured, so nothing shows it operating.
- **RR-PRV-1** (privacy, owed): TC-PRV-07 is partial: Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.
- **RR-PRV-2** (privacy, owed): TC-PRV-01 is enforced in the repository; the owning seat has not reviewed it.
- **RR-PRV-6** (privacy, owed): TC-PRV-08 is partial: The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.
- **RR-A11-1** (accessibility, owed): TC-A11-02 is enforced in the repository; the owning seat has not reviewed it.
- **RR-A11-2** (accessibility, known-gap): TC-A11-06 is absent: No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.
- **RR-A11-3** (accessibility, owed): TC-A11-04 is partial: Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; its last reported finding (a hovered journey card) is fixed and guarded (TR-02), and the first green nightly run is the proof still owed.
- **RR-REL-1** (operations, owed): TC-REL-02 is partial: Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.
- **RR-REL-2** (operations, owed): TC-REL-05 is partial: Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.
- **RR-REL-3** (operations, known-gap): TC-REL-06 is absent: The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.
- **RR-REL-4** (operations, owed): TC-REL-04 is partial: Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.
- **RR-REL-6** (operations, unanswered): Not yet reviewed.
- **RR-SUP-1** (success, owed): TC-SUP-02 is partial: Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.
- **RR-INC-1** (operations, owed): TC-INC-04 is documented: One document walkthrough has been held; sixteen game days are planned and none held.
- **RR-INC-2** (operations, known-gap): TC-INC-03 is absent: One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.
- **RR-DAT-1** (data, unanswered): Not yet reviewed.
- **RR-LEG-1** (privacy, unanswered): Not yet reviewed.

