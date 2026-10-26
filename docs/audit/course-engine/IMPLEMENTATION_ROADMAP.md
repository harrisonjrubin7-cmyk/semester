# Implementation roadmap

Semester is one educational-journey operating system, not a collection of vertical applications. The Course Engine is the first deeply tested student loop inside that system; it is not the boundary of the company or product thesis.

The architecture and roadmap retain all eight product planes from the start:

1. student operating system;
2. productivity suite;
3. campus super-app;
4. institutional system;
5. governed AI assistant;
6. trusted marketplace;
7. family and guardian platform; and
8. career, alumni, credential, and lifelong-journey platform.

Scope discipline is expressed through evidence-backed maturity, never by deleting a plane from the model. Every capability must be labeled **Live**, **Connected**, **Pilot**, **Early access**, **Institution-controlled**, or **Planned but not exposed**. “Live” requires implementation, tests, support ownership, permissions, observability, and an operational owner; a design, schema, prototype, integration card, or passing repository test is not enough.

## Shared platform contract

Every Course Engine increment and every adjacent product plane must reuse the same governed platform primitives:

- identity/account and person/relationship graph;
- organization, campus, tenant, role, consent, permission, and entitlement authority;
- academic and life timeline plus shared source/provenance graph;
- capability registry and maturity evidence;
- event and analytics taxonomy;
- AI policy, authorization, action approval, and audit layer;
- design system and cross-platform web/mobile shell;
- internal operations console; and
- trust, retention, incident, support, and data-rights workflows.

No family, marketplace, AI, partner, or institutional surface may create a parallel identity or permissions model. AI actions stay inside the caller's authorization. Marketplace access is never an unrestricted education-record channel. Family access requires explicit student consent plus applicable institutional policy.

The default student navigation remains **Home**, **My Journey**, **Campus**, **Opportunities**, **Support**, **Family**, and **Settings**. Capabilities that are not exposed at the current maturity stay in the registry and architecture without cluttering that default experience. Institutional users and internal operators receive role-appropriate surfaces over the same governed records and controls.

For every capability, the implementation record must answer:

1. Which core entities does it use?
2. Which role, tenant, permission, and consent rules govern it?
3. Is it student-, family-, institution-, partner-, or operator-facing?
4. What is its current maturity, based on evidence?
5. Which metrics demonstrate value?
6. What is the fail-closed behavior when an integration, permission, or source of truth is unavailable?
7. What does the mobile experience include?
8. Which audit, support, and incident workflows own it?

## Phase 0 — Foundation

State: code-present and tested in the repository; production deployment and operational ownership are not established by this roadmap.

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

1. Field guide, Slides, and Cases now render citation-resolved concepts, lecture outlines, and schema-valid applied scenarios. Every cited study view filters embedded display data through the API's live citation links, so revoked evidence fails closed. Cram and Listen remain to be completed.
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

## Phase 4 — Cross-plane maturity expansion

Advance Campus, housing, dining, career, finance, family, community, marketplace, staff, alumni, lifelong, partner, and institutional-control capabilities from **Planned but not exposed** toward **Connected**, **Pilot**, **Early access**, **Institution-controlled**, or **Live** only when their own evidence gates are satisfied.

These planes are already part of the shared architecture, entity graph, permissions model, brand, operating model, and roadmap. Validation controls when a capability is exposed and what may be claimed about it; validation does not remove the capability category from Semester's thesis.
