# World-class daily student experience

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Every session answers: Where am I? What matters now? What should I do next? What is official? What can I safely ignore? Who can help?
- Opens fast on mobile; works when data is partly unavailable; shows source and freshness on every fact.
- Progressive disclosure: layer 1 what matters now, layer 2 explanation and choices, layer 3 detail and settings.
- Every action links to a course, path, policy, support or goal. Honest guidance, never fake certainty.
- Interaction language written once: alerts, official data, AI uncertainty, approvals, policy restrictions, recovery after errors.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `ui_kits/student/`, `ui_kits/mobile/`, `templates/platform-shell/`, `ui_kits/every-screen/` |
| Implementation state | Designed: 64 student destinations, six-state screens, mobile tab bar. Not shipped to real students. |
| Product owner | Product |
| Technical owner | Engineering (app) |
| Risk owner | Founder |
| Success metrics | Answers the six questions in under 5 s (usability test); First meaningful action in first session ≥ 70%; Weekly next actions completed; Students choosing Semester over portal + LMS for daily check |
| Launch gate | Pilot cohort usability test passes on mobile and desktop |
| Next action | Run a 5-student moderated test of Today on the pilot build |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
