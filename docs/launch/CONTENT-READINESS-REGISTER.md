# Content readiness register

One school's answer for each of the thirteen kinds of content a controlled launch needs. The items, and the rules for each, are `CONTENT_READINESS` in `app/src/lib/launch/content.ts`.

A row may say `READY` only when it has all of these:

- a **named person** as owner, not an office or an inbox;
- a **source**: an https link, or a filed record under `docs/evidence/`;
- a **review date** inside the item's review period;
- **Estimate** set to `no`, unless the item allows a labelled estimate.

`content.test.ts` checks every `READY` row against those rules. Every row starts as `NOT_STARTED`, because no school has filled this in yet. Copy this file per school when a pilot begins.

Statuses: `NOT_STARTED`, `IN_PROGRESS`, `READY`.

| Item | Status | Owner | Source | Reviewed | Estimate |
| --- | --- | --- | --- | --- | --- |
| institution_profile | NOT_STARTED | — | — | — | no |
| academic_calendar | NOT_STARTED | — | — | — | no |
| programs_degrees | NOT_STARTED | — | — | — | no |
| course_catalog | NOT_STARTED | — | — | — | no |
| campus_services | NOT_STARTED | — | — | — | no |
| learning_resources | NOT_STARTED | — | — | — | no |
| career_resources | NOT_STARTED | — | — | — | no |
| organizations_events | NOT_STARTED | — | — | — | no |
| emergency_safety | NOT_STARTED | — | — | — | no |
| privacy_support_contacts | NOT_STARTED | — | — | — | no |
| ai_policy | NOT_STARTED | — | — | — | no |
| accessibility_statement | NOT_STARTED | — | — | — | no |
| ownership_schedule | NOT_STARTED | — | — | — | no |
