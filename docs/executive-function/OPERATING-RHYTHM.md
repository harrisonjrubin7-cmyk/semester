# Executive-function operating rhythm

The six October 1 source PDFs describe an optional, student-owned planning scaffold. The planner is available from **Home → My operating rhythm** in both tabs and feed navigation. It loads only when opened.

## Source-to-implementation map

| Supplied source | Implemented support |
| --- | --- |
| Turn CAST UDL Guideline 6 into a weekly executive | Daily morning / mid-day / close, self-advocacy drafts, Not yet / Partial / Ready audit, Markdown / Notion layout and printable export |
| semester-daily-executive-function-toolkit | Outcome, why, done, fixed commitments, Daily Three, first action and time box, context packet, if–then fallback, minimum progress, support route, daily close |
| Build a UDL-aligned executive function weekly oper | Weekly outcome, choice, non-negotiables, uncertainty, context packet, two optional obstacle plans, seven daily records, Wednesday check-in, Friday close and carry-forward |
| Build an executive function operating rhythm with | Account / term persistence, progress states, recorded milestones, last progress, short recovery, explicit official handoffs |
| Build an executive function toolkit and weekly ope | First-step launcher, editable triage groups, context organization, focus session, context-switch scenario comparison with editable buffers |
| anything else and other ways to increase cappablit copy | Student-entered commitments, scenario sensitivity, working preferences, private strategy reflections, project notes, assumption / question / decision / handoff fields, routes to existing learning and support tools |

## Existing capabilities reused

The existing `goal-plan`, `weekly-reset`, `plan-recovery`, `triage`, `dayplan`, `decision-compare`, `semester-packets`, `studyjournal`, `learningprefs`, `context-graph`, and `source-locker` modules remain the larger product's planning, learning, decision, commitment and consent foundations. Home retains its sourced deadline horizon and assignment states. The new workspace links to Study, Support, Work, Calendar, Search and Assistant preferences; it does not assert that opening those tools grants access to private planner content.

## Data and control

- Daily and weekly libraries are separate under `semester.operating-rhythm.v1:<account-or-device>:<term>:<daily-or-weekly>`.
- All fields are optional and student-entered. No inferred ability, motivation, attendance, grades, diagnosis, or academic risk is used.
- The bounded validator rejects corrupt records, duplicate dates, invalid progress states, invalid dates, excessive arrays and oversized text. The existing device-library hook preserves unreadable bytes and refuses edits rather than overwriting them.
- Records are local to the device and origin. They are not account sync or a cross-device service. At most 240 dates are retained in each rhythm; export older work before reaching that limit.
- Private notes are not automatically passed to AI, staff, institutional analytics, external calendars, or communications tools.
- Dedicated private JSON backup includes notes and reflections. Restore is validated, previewed and explicitly confirmed. These libraries are deliberately excluded from the general workspace backup and registered with that test's exemption reason.
- Markdown / Notion layout exports the chosen record. Printable HTML escapes student text and can be printed or saved as PDF in a browser.
- Calendar export requires preview and confirmation. The ICS file is a proposal in local time, escaped and folded according to RFC 5545. Import is a student action, not an external calendar API write.
- Carry-forward transfers only the selected outcome, next action and support route. It refuses to overwrite an existing target-date record.
- Focus uses the browser's modal dialog, which keeps keyboard focus inside the session. Its timer uses elapsed time rather than relying on the number of timer ticks. Pause, resume, stop and blocker exit are explicit actions.
- The simulator is arithmetic on student estimates. Buffers can be 0, 2, 5 or 10 minutes; the result is a planning scenario, not a measured cognitive cost or guaranteed time saving. It does not move official appointments.

## Verification and limits

Domain and component tests cover account / term isolation, local persistence, bad-data preservation, delete confirmation, carry-forward collision, editable buffer arithmetic, invalid calendar input, calendar escaping and folding, and automated accessibility checks. Existing planning / triage / packet tests are part of regression verification. Type checking, production build, vocabulary / label / style rules and startup performance budgets are checked before publication.

This implementation is not an accessibility certification or institutional pilot approval. AI course-policy enforcement, private cloud sync, institution integrations and live calendar writes remain governed by their existing separately configured services. Source PDFs describe product support; they do not establish certification or authorize institution-wide surveillance.
