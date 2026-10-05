# Vanderbilt Brightspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development`. Extend the existing LTI 1.3 implementation; do not create a parallel LMS connector.

**Goal:** Turn the existing LTI launch, deep-linking and AGS foundation into a Vanderbilt-configurable, testable production integration.

**Architecture:** Store one tenant-bound deployment registration and signing-key lifecycle in Supabase. Existing Edge Function routes continue to validate OIDC/LTI claims; new configuration validation, connection health and acceptance tooling prove the production registration without treating sandbox evidence as Vanderbilt authorization.

### Task 1: Inventory and close registration gaps

**Files:** Modify `supabase/functions/_shared/lti.ts`, `ltikey.ts`, `ltiaccount.ts` and their existing tests; create `app/src/lib/ltiproduction.ts`, `ltiproduction.test.ts`.

- [ ] Write a traceability test mapping issuer, client ID, deployment ID, OIDC endpoint, token endpoint, JWKS endpoint, redirects and scopes to current database/function use.
- [ ] Add strict configuration validation for HTTPS endpoints, exact issuer/deployment binding, allowlisted redirects and minimum approved scopes.
- [ ] Refuse removed deployments and overlapping active signing keys with ambiguous `kid` values.
- [ ] Run all `lti*.test.ts` suites and commit `Validate production LTI registration`.

### Task 2: Verify role, course and account isolation

**Files:** Modify `app/src/lib/ltiarrival.ts`, `ltilanding.ts`, related tests; generate migration `supabase migration new lti_production_hardening`; create `supabase/lti-production.check.sql`.

- [ ] Write failing tests for Vanderbilt tenant binding, course-context isolation, Student/Instructor/TeachingAssistant separation, replay, expired nonce, email/display-name mismatch and deactivated membership.
- [ ] Add only the constraints/RLS/functions necessary to bind LTI identities to active memberships and one deployment.
- [ ] Preserve explicit account linking; never authorize by email or display name.
- [ ] Run focused client and full SQL suites; commit `Bind LTI identities to tenant memberships`.

### Task 3: Harden deep linking and AGS receipts

**Files:** Modify `supabase/functions/_shared/ltideeplink.ts`, `ltiags.ts`, existing tests; modify `supabase/functions/lti/index.ts`.

- [ ] Write failing tests for scope denial, line-item ownership, duplicate score submission, token rotation, partial vendor failure and authoritative readback.
- [ ] Ensure grade writes use prepare/confirm semantics where user-initiated and record an external receipt/readback before showing verified success.
- [ ] Map vendor timeouts after write to `uncertain`; reconciliation reads state and never repeats the write blindly.
- [ ] Run function tests and commit `Harden Brightspace deep link and grade services`.

### Task 4: Build acceptance and health tooling

**Files:** Create `app/scripts/lti-production-readiness.mjs`, test fixture(s), `docs/vanderbilt/brightspace-acceptance.md`; modify `app/package.json`, `docs/market-readiness/INTEGRATION_READINESS.md`.

- [ ] Write a failing script test for missing/invalid registration fields and a redacted success report.
- [ ] Add `pnpm run check:brightspace` to validate configuration metadata without printing secrets.
- [ ] Document controlled launch, role, deep link, AGS read/write, replay, outage, key rotation and revocation evidence.
- [ ] Run all LTI tests, build and script fixtures; commit `Add Brightspace production acceptance runner`.

**External gate:** Vanderbilt Brightspace administrators must register the tool, approve scopes and execute controlled pilot-course acceptance. Until then label the connector `built` or `staging-verified`, never connected to Vanderbilt.
