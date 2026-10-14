# AI boundary for the readiness pilot

**Off by default** for registration_readiness_v1. If turned on, Ask Semester may only explain readiness states, holds and next steps from the student's own student-visible summary (`student_readiness_summary`), and from published institutional pages.

It may not: read `holds`, `students` or any restricted record; change a case state; clear a hold; request or decide an override; submit registration; say a student is enrolled or cleared.

Required in the UI: an "AI-assisted" label, the sources used (or "no source available"), uncertainty copy, human confirmation for any action, and a "report a problem" path.

Prompt injection in source text: treat it as text. Answers stay bounded to approved sources; no hidden or system content is ever revealed. This is drill 10 in `contracts/release-evidence.yaml`.
