# Session Revocation Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one-account, one-remote-session revocation idempotent, auditable, event-backed, safely recoverable after an unknown response, and honestly represented in the existing Account security UI.

**Architecture:** Extend the existing `auth.sessions` self-service RPC rather than introducing a device identity model. A new additive command derives the account from `auth.uid()`, serializes one request key, records a minimized command receipt, audit row, and `identity.session_revoked` outbox event in the revocation transaction, and reuses the canonical claim/complete/fail receipt infrastructure for a dormant service-only projection consumer. The current React surface continues to use `SignedInDevices`, with bounded receipt parsing, safe timestamps, source observation time, and retry of the same request key after an unknown outcome.

**Tech Stack:** PostgreSQL/Supabase migrations and disposable SQL checks; TypeScript, React, Vitest, Semester design-system primitives.

**Spec:** `docs/handoff/execute/29-account-identity-mail.md`; capability `shared.identity.sessions`, permission `session.revoke`, routes and endpoint contract in `docs/handoff/registry/capabilities.json` and `docs/handoff/api/endpoints.json`.

## Global Constraints

- Work from `origin/main` on `codex/session-revocation-receipt`; do not alter, merge, or reuse PR #1529.
- Source-only migration: never apply it to a hosted database and never revoke a real session.
- Account authority comes only from `auth.uid()` and the JWT session id; accept no account, person, school, or tenant identifier.
- Protect the current session; make a cross-account target indistinguishable from a missing target.
- Keep raw session ids, account ids, user agents, IPs, locations, provider errors, credentials, and cursors out of UI copy, audit detail, event payloads, and the projection.
- Emit no event for a refused or already-ended target. A successful source change, audit row, command receipt, and outbox row commit or roll back together.
- The outbox worker remains dormant and service-only; add no scheduler, activation, provider call, configuration, grant expansion, or production deployment.
- Preserve the legacy bulk “Sign out other devices” path as an explicit remaining gap; do not claim the whole capability complete.
- Reuse `ConfirmDialog`, `ActionPreview`, `LoadingState`, `ErrorState`, `SemesterDesignSurface`, and the existing `SessionRow`; add no UI dependency or raw design value.

## Review Focus

- A network loss after the database commits must retry the identical request key and return the original receipt without a second audit or event.
- Two requests for another account’s session and a made-up session must have the same result and must not reveal which exists.
- An invalid session timestamp must render `Time unavailable` and must not prevent the remaining sessions from rendering.
- Provider/RPC error text containing identifiers or secrets must never reach the rendered page or event/audit payload.
- A malformed or replayed `identity.session_revoked` event must not produce a duplicate projection receipt or alter another account’s projection.

---

### Task 1: Idempotent command, audit, outbox, and first consumer

**Files:**
- Create: `supabase/session-revocation.check.sql`
- Create: `supabase/migrations/20261015120000_session_revocation_receipt.sql`
- Modify: `packages/institution/src/events.ts`
- Modify: `packages/institution/src/events.test.ts`
- Modify generated security/definer registers only when the repository generator requires them.

**Interfaces:**
- Consumes: `private.record_audit(...)`, `private.emit_domain_event(...)`, `private.complete_domain_event(...)`, `private.fail_domain_event(...)`, `private.domain_outbox_events`, `private.domain_event_receipts`, and `auth.sessions`.
- Produces: `public.revoke_my_session(want uuid, request_key uuid) -> table(outcome text, occurred_at timestamptz)`; service-only `public.run_account_security_projector(want_limit integer) -> jsonb`; event catalog entry `identity.session_revoked` version 1, internal/audit.

- [ ] **Step 1: Write the failing catalog and SQL checks**

Add a Vitest assertion for the literal `identity.session_revoked` catalog contract. Add a disposable SQL suite covering unauthenticated refusal, current-session protection, success, missing/cross-account indistinguishability, request-key replay and mismatch, minimized audit/outbox contents, one service-only projection receipt, malformed-event dead-lettering, and authenticated denial from every private table/function.

- [ ] **Step 2: Run the focused tests and prove RED**

Run the event test and `supabase/check.sh session-revocation`. Expected: the catalog assertion lacks `identity.session_revoked`, and the SQL check lacks `public.revoke_my_session`.

- [ ] **Step 3: Implement the smallest additive migration and catalog entry**

Use one account-hash/request-key command receipt boundary plus a transaction advisory lock to bind retries before deleting. Hash account and target references with the repository audit hash; keep the event tenant null and payload limited to the account pseudonym, outcome, and changed-field names. Add one narrow claim/apply/run consumer that uses canonical outbox receipts and has no scheduler or client grant.

- [ ] **Step 4: Run the focused event and SQL tests and prove GREEN**

Expected: the new catalog test and every session-revocation SQL notice pass, with the transaction rolled back by the harness.

### Task 2: Safe client receipt and six-state Account UI

**Files:**
- Modify: `app/src/lib/devices.ts`
- Modify: `app/src/lib/devices.test.ts`
- Modify: `app/src/components/SignedInDevices.tsx`
- Modify: `app/src/components/SignedInDevices.test.tsx`

**Interfaces:**
- Consumes: `public.revoke_my_session`, the existing `my_sessions()` list, and existing Account/confirmation/design-system components.
- Produces: `SessionRevocationReceipt`, `sessionRevocationReceipt(raw)`, `formatSessionTime(value)`, and `endSession(id, requestKey)` returning a stable bounded receipt.

- [ ] **Step 1: Write failing pure client tests**

Pin literal receipt outcomes and timestamps, reject malformed RPC results as unavailable, and require invalid/empty timestamps to format as `Time unavailable`.

- [ ] **Step 2: Run the device-library test and prove RED**

Expected: the new receipt parser and safe timestamp helper are missing.

- [ ] **Step 3: Implement the minimal client contract**

Call `revoke_my_session` with `want` and `request_key`, return only the bounded outcome/timestamp, and replace provider messages with stable internal error codes that the UI never renders.

- [ ] **Step 4: Run the device-library test and prove GREEN**

- [ ] **Step 5: Write failing component tests**

Cover checked source/freshness, invalid dates, pending disable/announcement, confirmed and already-ended outcomes, definite refusal, unknown outcome with same-key retry, raw-error non-exposure, modal Escape/focus return, and existing loading/error/empty/ready behavior.

- [ ] **Step 6: Run the component test and prove RED**

- [ ] **Step 7: Implement the six-state UI using existing primitives**

Keep one operation record per row so an unknown result retains its request key. Render only safe fixed recovery copy and never infer success from a failed request. Use the existing responsive `SessionRow` and confirmation focus trap.

- [ ] **Step 8: Run both focused UI test files and prove GREEN**

### Task 3: Crosswalk, regression gates, review, and draft PR

**Files:**
- Modify the existing ecosystem implementation crosswalk/report selected by repository tests.
- Modify generated registers only through their existing generator.

**Interfaces:**
- Consumes: the tested SQL and UI evidence from Tasks 1–2.
- Produces: an honest partial capability record and reviewable branch/PR evidence.

- [ ] **Step 1: Update scope evidence without claiming deployment or full capability completion**

Record the single-session path as implemented/tested while leaving bulk revoke, canonical device/push-token records, deployment, and activation open.

- [ ] **Step 2: Run focused and repository gates**

Run the new SQL suite, relevant Vitest files with one worker, TypeScript, lint, `check:university`, build, design-system check/report, full ordered tests, and shuffle. Report every failure by name.

- [ ] **Step 3: Perform synthetic visual and keyboard review**

Compare the existing Account security surface at desktop and 320/420px against the Copy 5 Account Center reference; verify loading, ready, pending, error, and unknown states without real accounts or sessions.

- [ ] **Step 4: Commit, independently review the exact range, and repair all Critical/Important findings**

- [ ] **Step 5: Refresh/rebase on current main, rerun proportional gates, push, and open a draft PR**

Report the branch, exact SHA, PR URL, local/hosted checks, source-only migration limitation, dormant worker, remaining capability gaps, and any external CI blocker.
