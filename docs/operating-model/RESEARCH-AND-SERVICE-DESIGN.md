# Continuous user research and service design

Feedback tools collect what people choose to say. A research program goes and finds out what they couldn't do. And
service design covers the part of a journey that happens outside the app. If the human service behind a handoff can't
fulfil it quickly, the app only moves the frustration to a new place.

## Research cadence

| Cadence | Activity | Owner | Output |
| --- | --- | --- | --- |
| Weekly | Support and feedback triage | Customer success | Tagged themes into the product review |
| Monthly | Student task-completion interviews (5–8) | Product research | Task success rate, top three friction points |
| Monthly | Accessibility review with assistive-tech panel | Accessibility lead | Defects with severity and SLA |
| Monthly | Faculty/advisor workflow review | Product research | Workflow map changes |
| Each term | Usability benchmark (fixed task set) | Product research | Comparable score term over term |
| Each term | Student trust/privacy survey | Privacy owner | Trust index; "what surprised you" themes |
| Each term | Course/department activation review | Customer success | Activation by department |
| Each term | Integration-quality review | Integration owner | Per-contract freshness and correction metrics |
| Annually | Customer advisory board | CEO | Roadmap input, reference health |
| Annually | Independent accessibility audit | Accessibility lead | Audit report, remediation plan |
| Annually | Security/privacy review | Security owner | Findings and HECVAT refresh |
| Annually | Product strategy refresh | Founders | Strategy memo |

## Recruit deliberately

A panel made of whoever answers first is a panel of the most engaged students, and they are the ones who need Semester
least. Keep a recruitment matrix and fill every cell each year:

- **Students:** first-year, transfer, adult, graduate, international, online, commuter, disabled, first-generation,
  working.
- **Staff and faculty:** faculty, TAs, advisors, librarians, registrars, accessibility staff, IT, student affairs.
- **Institutions:** small, large, public, private, community college, system.

Compensate participants, record consent for each session, and keep recordings under the T2 retention rule.

## Service design

For every support feature that hands a student to a human service, the service blueprint must answer eight questions
before the feature ships. The `workflow.service_routing` setting's limit
(see [CONFIGURATION-TIERS.md](CONFIGURATION-TIERS.md)) refuses a route without them.

| Question | Why |
| --- | --- |
| Service capacity | A button that books into a full queue is worse than no button |
| Wait time | Shown to the student before they commit |
| Owner | A named office and person |
| Escalation | What happens when the wait is exceeded |
| Closure condition | When the handoff counts as done |
| Student communication | What the student hears, and when |
| Accessibility accommodation route | How a student who needs an accommodation gets it |
| Data retention | How long the context shared in the handoff is kept |

### Example: tutoring handoff

```text
Student asks for tutoring
→ Semester shows approved options (from integration.campus_services), with wait time
→ student chooses and approves the context to share (T2 consent)
→ booking system receives the request (workflow extension, minimum context)
→ tutor sees the approved context only
→ session occurs
→ student gets a follow-up plan
→ outcome recorded at aggregate level only
```

| Blueprint field | Tutoring |
| --- | --- |
| Capacity | Tutoring center publishes slots per week; Semester hides the option when none are free |
| Wait time | Next available slot shown before booking |
| Owner | Tutoring center director |
| Escalation | No slot within 5 days → offer drop-in hours and the course's office hours |
| Closure | Session attended, or the student cancels |
| Communication | Confirmation, reminder 24 h ahead, follow-up plan after |
| Accommodation | "I need an accommodation" routes to the accessibility office, with no reason required |
| Retention | Shared context deleted 30 days after the session |
