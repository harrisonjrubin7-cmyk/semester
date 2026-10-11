# Semester ecosystem build plan

**As of** 11 October 2026 · **Scope** [`SEMESTER_ECOSYSTEM_INVENTORY.md`](SEMESTER_ECOSYSTEM_INVENTORY.md) · **Status, row by row** [`SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md`](SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md) · **Continuation record** §6

The delivery target is the whole inventory. The phases below set the order the work is done in. They do not decide what gets left out. Nothing is dropped: an item that is not built yet keeps its row in the matrix, marked `specified` or `proposed`.

## 1. Architecture: keep what exists

This is the smallest architecture that supports the confirmed scope, and it is the one already in the repository. No new framework, service, or permission model is proposed.

| Concern | Decision | Why |
| --- | --- | --- |
| Client | One SPA in `app/`, served as web and PWA | It already holds the student, staff and console surfaces. A second client would duplicate the design system and navigation. |
| Server rules | Postgres in Supabase: RLS on every table, `SECURITY DEFINER` RPCs, `private.has_capability` | All authorization lives in one place. A server-side check belongs here, not in the browser. |
| Server code that is not SQL | Edge functions for third parties and webhooks; the gateway for institution APIs | Already split this way. `check:university` keeps the gateway honest. |
| Cross-module propagation | `private.domain_outbox_events` and the projector | Already exists. OD-1 decides how it is extended. |
| Design system | `lib/look.ts`, then `styles/tokens.css`, then the contract tests | This order of authority is set in `CLAUDE.md`. |
| New decisions | `docs/decisions/D-<PR>.md` | Repository rule. |

**Consequential changes this plan does *not* make without a recorded decision:** a unified membership model (RG-02), turning on `enforce_membership` (RG-07), an org-unit hierarchy (OD-3), and tenant-bound staff (OD-7). Each one changes who can see what across tenants. Each needs its own decision record and a non-production database to prove it on.

## 2. Shared foundations first

| ID | Foundation | State | Next action |
| --- | --- | --- | --- |
| F-1 | Identity, SSO, onboarding | Built (`Account`, `Credentials`, `SchoolClaim`, `Onboarding`) | Institutional IT identity review (Student journey #3), stream 02 |
| F-2 | Tenancy and membership | Built, as three membership sources that are not unified | Decision record on unifying them (RG-02), then the migration on a named non-production database |
| F-3 | Capability check, consent, audit | Built; consent is not part of `has_capability` | Close OP-01 and F-1/F-5 (OD-9), each only with approval |
| F-4 | Navigation and design system | Built (`lib/nav.ts`, `navareas.ts`, tokens, contract tests) | Each slice reuses the existing shared components |
| F-5 | Configuration and feature policy | Built; `tenant_feature_policy` has 0 rows live | Record the default of every flag behind an `exists` row (REPO_AUDIT note 1) |
| F-6 | Outbox and projections | Outbox and `ops-projector` exist | Re-audit the projector against OD-1 |
| F-7 | Coverage tracking | **Done this session.** The matrix renderer and its CI test | Each slice updates `STATUS_OVERRIDES` or re-audits |

## 3. Vertical slices, in dependency order

Every slice ships together:

- the screen and its navigation,
- the domain rule and the RPC or migration,
- authorization, including negative tests,
- the loading, empty, error, restricted and success states,
- tests, and a revert proof for each new guard,
- the docs and a CHANGELOG entry,
- the matching matrix rows moved.

**Phase A: the Registration Readiness pilot cut** (layers 3, 5, 8, 9; the mainframe backlog decides the order within it):

1. **Agenda view (§94).** Done in #1448. Class meetings were added after review.
2. **Unmatched named courses.** Done 11 October 2026: after a catalog import, the codes a student named stay listed, matched or unmatched (`matchNamed`, `RegistrationPortal.namedplan.test.tsx`). Seats are never invented.
3. **Advising, the student-consented part** (Advising #5 and #6; P0). Check-ins done 11 October 2026 in #1448 (D-1448): an advisor writes a note and up to five next steps on a live share, and the student adds each step to their own actions. A standalone success plan (the rest of #6) is still open. No staff caseload store until decision Q1.
4. **Hold-release notice** (Student finance #12; P0). Through `push` and `support-reply-notify`.
5. **Faculty P0 steps** (Faculty course lifecycle #1, #9, #10, #13, #19): rubric, assessment builder (wiring `lib/itembank.ts`), review of student work, and office hours. Each is gated on `course_studio`.

**Phase B: institution and operations, which the pilot needs to run:**

- Institution implementation (#4, #13, #14).
- Incident response (#2–#5): declare, triage and command. The severity scale already exists in `lib/incident-recovery.ts`.
- Support request gaps.
- The partial K and N screens that have a migration but no operator screen (REPO_AUDIT note 4).

**Phase C: after the pilot:**

- Campus services (housing maintenance, accommodation decision).
- Community and moderation (6 missing steps).
- Career, employer and alumni (9 missing).
- Family consent (1 missing).
- Developer platform and marketplace (13 missing).
- Analytics and outcomes (7 missing).
- Domain migration (legacy retirement).

**Phase D: the 278 `proposed` modules.** For each module, either map it to an existing screen (by recording the merge) or build it. Then audit the design project's 84 added screens (Q6).

## 4. Launch blockers and approvals

| Blocker | Who clears it | What waits on it |
| --- | --- | --- |
| Remote migrations and production deploy | Founder approval, every time | Any row moving to `deployed` |
| A named non-production database | Founder | F-2, F-3, any migration proof |
| OD-1 to OD-9 | Founder | See [`../operations/OPERATIONS_ROADMAP.md`](../operations/OPERATIONS_ROADMAP.md) |
| DPA, insurance, HECVAT, attorney review | Founder | Pilot launch |
| Institution contacts (IT, registrar, sponsor) | Founder | SSO go-live, registrar slices |

## 5. Release, monitoring, backup and rollback

The procedures already exist and are not rewritten here:

- **Release and rollback:** [`../mainframe/TEST_AND_RELEASE_GATES.md`](../mainframe/TEST_AND_RELEASE_GATES.md), `docs/launch/`, and the `production-smoke` workflow.
- **Monitoring, SLOs, on-call and runbooks:** [`../operations/`](../operations/), with the SLOs waiting on OD-2.
- **Backups and restore drills:** the operations handbook.

A slice changes these documents only when it changes what they describe.

Staging means the Vercel preview of the branch, which is built on every push. A row moves to `deployed` only when its behaviour has been checked on a deployed URL and that check has been recorded.

## 6. Continuation record

Update this section at the end of every session.

- **11 October 2026.**
  - Built the inventory, the matrix, its renderer, and a CI test that fails when the matrix is stale or a cited file is gone (proved by moving `screens/Mine.tsx` away: the test went red, then green again when the file was restored).
  - Added the agenda view, with class meetings.
  - Gates for these changes: listed in the pull request.
  - Named courses stay visible after a catalog import (Phase A item 2).
  - Advisor check-ins on a share (Phase A item 3, D-1448). The migration is in the tree and has not been applied to any hosted database.
  - **Next executable task:** Phase A item 4, the hold-release notice.
