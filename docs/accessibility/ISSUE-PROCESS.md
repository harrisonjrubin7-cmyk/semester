# Accessibility issues, incidents and remediation

Companion to [PROGRAM.md](PROGRAM.md). **Proposal, 2026-10-04.** None of this has been exercised: there is no
accessibility owner yet, no public contact, and no reported issue has gone through it. The times below are
proposed targets for the owner to accept or change, and are the numbers HECVAT A11Y-4 asks to be published. They
are not promises until someone is named who can keep them.

The severity and fix-time scale is the one already in
[../operating-model/ACCESSIBILITY-GOVERNANCE.md](../operating-model/ACCESSIBILITY-GOVERNANCE.md) (Critical 5
business days, Serious 30 days, Moderate 90 days, Minor next major release). This page defines what each severity
means, adds the workaround and communication duties, and adds a faster lane for incidents.

## 1. Who can report, and how

Reporting must itself be accessible, and must not need an account, a disclosure or a justification.

| Channel | Requirement |
| --- | --- |
| In-app: Help → **Report an accessibility problem** | A short form, plain language, fully keyboard and screen-reader operable, reachable in two steps from any screen (3.2.6 place). Pre-fills screen, build, device and the user's own settings **only with the user's permission**; works without them |
| Email to the published accessibility address | A role mailbox (not a person), monitored by two people. **The address is a placeholder until one exists** |
| Phone or text relay | Offered, for people who cannot use a form; a person writes it up and sends the user the ticket |
| Through the institution | The institution's accessibility coordinator can file on a student's behalf; the ticket carries the institution and no more of the student's identity than needed |
| Staff and community | Support, success and moderation staff file what they hear; "I heard it second-hand" is a valid report |
| Security and privacy | Anything involving a vulnerability or a data exposure goes to the security route (`app/public/.well-known/security.txt`, `SECURITY.md`), and this process is told |

A report is never closed because the user "should use" a different device, browser or assistive technology. The
reporter is told within one business day that it was received.

## 2. The ticket

One ledger, one row per distinct barrier. The same shape as the review packet so evidence and tickets are one list.

| Field | Content |
| --- | --- |
| ID | `A11Y-<n>`; permanent |
| Source | User report, institution, panel session, internal pass, audit, automated finding |
| WCAG 2.2 criterion | Level A or AA SC number(s), or "usability, no SC" for a barrier no criterion covers; those count the same |
| Surface and role | Screen or flow; the role affected |
| Environment | AT, browser, OS, **versions**; device; the user's Semester settings |
| What happened / Expected | What the AT said or the screen did, and what it should have |
| Steps | Reproducible, short |
| Impact | Who is blocked and from what; **is it time-bound or high-stakes** (registration, payment, exam, safety, grade) |
| Severity | §3 |
| Workaround | A real one, tested by someone, or "none" |
| Owner, due | A named person and a date from the SLA |
| Class | Shared component or guard that should have caught it, or "none: new class" |
| Status | New, Triaged, In progress, Fixed (unverified), Verified, Closed, Won't fix with reason |
| Retest | Environment, tester, date, result |
| Communication log | Each message to the reporter and the institution |

Personal data in a ticket is minimised. A student's name is not needed to fix a barrier.

## 3. Severity, fix times and duties

Triage within **one business day** of receipt. When in doubt between two severities, take the higher and say so.

| Severity | Definition | Examples | Fix target | Workaround | Told |
| --- | --- | --- | --- | --- | --- |
| **Critical** | A user with a disability **cannot complete** a core task, or a time-bound or high-stakes task, with any reasonable AT route, or the barrier is a safety risk | Registration cannot be completed with a keyboard; the payment form traps focus; an emergency or campus alert is inaccessible; sign-in cannot be done without a CAPTCHA with no alternative; content that is flashing | **5 business days** to fix or ship a workaround that is verified; incident process (§4) | Within **2 business days**, verified by a tester | Reporter within 1 business day; institution within 1 business day if its students are affected |
| **Serious** | Core task completable only with significant extra effort or by a route most users would not find; or a failure of a Level A criterion on a main journey | Calendar event actions unreachable without a pointer, but a list view exists; chart with no table; form error not announced | **30 days** | Stated in the ticket within 5 business days | Reporter at triage and at fix |
| **Moderate** | Task completable, with a clear workaround, or a Level AA failure off the main journeys | A missing landmark label; a focus ring weak on one ground; a decorative image announced | **90 days** | Optional | Reporter at fix |
| **Minor** | Cosmetic or an enhancement beyond AA | A word that could be plainer; an extra shortcut | Next major release | None | Reporter at close |

A task is **core** if it appears in the student golden path or in a role's critical journeys (ACCEPTANCE-CRITERIA).
A task is **time-bound** if it has a deadline outside the user's control (registration window, payment due date,
exam session, application deadline). Time-bound escalates a severity one level.

**Never "won't fix"** a Critical or Serious without the owner and counsel recording why and what the user can do
instead. The reporter is told in plain words, with the alternative.

## 4. Accessibility incidents

An accessibility incident is a barrier that blocks a person from a time-bound or high-stakes task **now**, a
regression that reintroduces a closed Critical, or a release that broke a criterion on a main journey. It runs
through the existing incident plan (`docs/trust/INCIDENT-RESPONSE-PLAN.md`) with these differences:

| Step | Target | Action |
| --- | --- | --- |
| Declare | On confirmation of a Critical on a time-bound task | An incident commander (not the author of the change) opens an incident with the `accessibility` tag |
| Contain | Within **4 business hours** | Roll back (`ROLLBACK.md`), switch off the capability behind its flag, or ship a verified workaround; the registration, payment or exam flow is reopened for the affected users first |
| Protect | Same time | Contact the institution's accessibility office so it can grant its own extensions (registration windows, extra time, deadline relief) while the barrier stands; offer the affected user a human route to complete the task by phone, chat or in person |
| Communicate | Within 1 business day | The reporter, the affected institution, and, if the barrier is public-facing and longer than a day, a status-page note in plain language that says what is blocked, what to do instead and when to expect a fix |
| Fix the class | Within the Critical SLA | The shared component or guard, not only the screen |
| Review | Within 5 business days | A blameless review: how it reached the user past G1 to G3; the guard added; the criterion in the ledger; the metric recurrence updated |

A kill switch exists for AI (`app/src/lib/aikillswitch.test.ts`); each capability's flag has an owner and a
rollback (`app/src/lib/flags.test.ts`). The first containment action is usually a flag.

## 5. Remediation workflow

```text
Report or finding → Intake (≤1 business day) → Triage and severity → Workaround if needed
   → Fix the class (shared component, lint or test) → Fix the instance → Verify in the finding environment
   → Retest in one other environment → Close with evidence → Tell the reporter → Update recurrence metric
```

- **Prefer a guard to a reminder.** Every fixed Critical or Serious has a regression test, a lint rule or a G0/G1
  checklist line, or a stated reason none is possible.
- **Retest by the person who found it** where they are willing; otherwise by the panel; never only by the author.
- **Batch by class.** Twenty missing labels are one lint rule.
- **Backlog hygiene.** Ledger reviewed weekly by the accessibility lead; any Serious past 20 days or Critical past
  3 business days is raised at the launch readiness council.
- **Tenant content** that is inaccessible is a content finding, owned by the content owner of that tenant, with
  Semester's tooling flagging it (R-FAC-1, R-STF-4); Semester does not edit a school's content without the school.

## 6. Alternate-format and accommodation requests

A student can request an alternate format of any content, or an accommodation inside the product, and the request
needs **no reason**.

| Stage | Duty |
| --- | --- |
| Request | From Help or from the item itself ("Request an accessible version"). Offers: HTML, tagged PDF, large print, audio, braille-ready file, captions, transcript, audio description, sign-language interpretation for scheduled events, extra time |
| Route | To the **institution's accessibility office**, which decides accommodations. Semester provides the workflow and the clock, and does not decide eligibility |
| Clock | The institution sets its own SLA, shown to the student; the default shown is 5 business days for a document and 2 business days for time-bound content, flagged to the office as time-bound |
| Fulfil | Staff attach the format to the same item so the next student gets it |
| Close | The student confirms it works; if not, the request reopens. Unmet requests escalate to the institution's coordinator |
| Learn | A recurring request for the same item is a content finding and goes to the owner |

Where Semester generates the content itself (study material, summaries, exports), the accessible form is
Semester's to supply on the spot, not a request: an accessible version is the default.

## 7. The ledger and its metrics

The ledger is a CSV, working copy [`first-pass/accessibility-issue-ledger.csv`](first-pass/accessibility-issue-ledger.csv), with the §2 columns, plus opened, triaged, fixed and
verified dates. It is the same file the Vanderbilt packet plan seeds (headers only; no pre-filled passing rows).

Metrics reported monthly (PROGRAM §9): open by severity and age; time to fix by severity; **recurrence** (a new
ticket in a closed class); escape rate (user-reported findings the pipeline should have caught); acknowledgement
within one business day.

## 8. Public commitments (to publish only when owned)

When someone holds the seat and a mailbox is monitored, publish: the contact, the channels in §1, the table in §3
(severity names, plain definitions, fix times), the alternate-format route, and the escalation route for an
unresolved complaint: the institution's accessibility coordinator, and then the relevant regulator or the
institution's procedure. The wording of any enforcement-related text is counsel's.

Do not publish a time Semester cannot keep. A longer honest time beats a shorter one that is missed.

## 9. Roles in the process

| Role | Duty |
| --- | --- |
| Reporter | Anyone; may be anonymous; never required to disclose a disability |
| Support | Intake; acknowledges in a business day; opens the ticket; never closes it |
| Accessibility lead | Triage, severity, workaround, the ledger, the report to the council |
| Engineering champion | Fix the class, add the guard |
| Content champion | Content findings and the alternate-format library |
| Incident commander | Runs §4; not the author of the change |
| Institution accessibility office | Accommodations; receives incident notice; holds the student relationship |
| Counsel | Any "won't fix", any statement of fault, any regulator contact |
