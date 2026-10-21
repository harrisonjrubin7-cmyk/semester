# Implementation roadmap

The roadmap builds the student course/study loop first. Campus, marketplace, finance, staff, and institutional control-plane expansion should not outrun validated use of this loop.

## Phase 0 — Foundation (current branch)

State: tested, not deployed.

- Citation-first course schema and ownership-scoped API.
- Upload/extraction/review/calendar/study/export/progress vertical slice.
- Premium responsive shell, semantic tokens, source/status vocabulary, operational states, and automated UI/accessibility tests.
- Factual audit and explicit production blockers.

Exit: merge review, complete browser journey tests, run DAST in a credentialed environment, and decide how the standalone slice integrates with the existing app.

## Phase 1 — Student core

1. Extend the protected source viewer from location-labeled chunks to exact bounding-box highlighting and correction actions. Owner-scoped source inspection, focus management, and protected original download are implemented.
2. Review resolution and calendar editing are implemented with confirm/reject/correction decisions, optional notes, owner isolation, consequence preview, unspecified-time preservation, and one-step session undo. Durable cross-session undo remains a later enhancement.
3. Worker polling/cancellation and failure recovery are implemented with an owner-scoped job feed, active-work polling, progress visibility, explicit cancellation, idempotent retry dispatch, and bounded redelivery of abandoned queued work.
4. Cards, Read, Quiz, and Doc now use real stored asset shapes: cited card recall records progress, guide sections render as readable source-linked material, confirmed documents export through authenticated downloads, and self-graded cited quizzes persist an owned study session.
5. Production-mode Chrome coverage is implemented for browser accessibility, responsive widths, reviewed visual baselines, keyboard/focus behavior, console errors, and the source/review/calendar/cards/quiz/export journey. The browser API is deterministic and fixture-backed; a seeded live-backend journey remains required for the phase exit.

Exit: a seeded user can complete `upload → review → calendar → study → source inspection → export` without CLI intervention.

## Phase 2 — Learning intelligence

1. Field guide and Slides now render citation-resolved concepts, lecture outlines, examples, and source labels with browser coverage. Cases, Cram, and Listen remain to be completed.
2. Add spaced repetition and weak-concept evidence without streaks or gamification.
3. Add Ask Semester with course-source retrieval, uncertainty, and AI-policy disclosure.
4. Add real provider adapters only behind explicit policy and consent gates.

Exit: every generated claim has a stored citation or is blocked from publication.

## Phase 3 — Pilot hardening

1. Shared tenant/course membership, role gates, SAML/SSO, and institution authority records.
2. Managed secrets/KMS, malware scanning, signed source delivery, rate limits, and audit events.
3. Retention/deletion verification, data export, backup/restore drills, and staffed support runbooks.
4. Independent security, privacy, accessibility, legal, and institutional approval.

Exit: named-tenant approval and observed UAT evidence. Repository tests or a deployment alone do not satisfy this gate.

## Phase 4 — Expansion after validation

Expand Campus, housing, dining, career, finance, family, community, marketplace, staff, and institutional control-plane workflows only after student-loop adoption, reliability, support load, and outcomes justify them.
