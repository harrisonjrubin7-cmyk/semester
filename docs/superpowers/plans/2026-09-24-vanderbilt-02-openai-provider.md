# Vanderbilt OpenAI Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `openai-docs`. Recheck current official API behavior before installing the SDK.

**Goal:** Connect Semester Intelligence to an institution-approved OpenAI project without exposing keys, retaining response state, bypassing policy or fabricating citations.

**Architecture:** An OpenAI adapter implements the existing governed provider boundary. Tenant policy selects an allowed model and budgets; the application assembles approved evidence; the adapter sends minimum context using the Responses API with `store: false`; application-owned evidence renders citations.

### Task 1: Harden the provider boundary

**Files:** Modify `app/server/institution/intelligence.ts`, `intelligence.test.ts`; create `app/server/institution/providers/types.ts`.

- [ ] Write failing tests for explicit model selection, request deadline, cancellation, bounded output, token accounting, provider refusal and redacted audit metadata.
- [ ] Define `InstitutionModelProvider.generate(request, signal)` with text, usage and provider request ID outputs; no provider type may return citation authority.
- [ ] Ensure missing policy, source, budget, model or consent refuses before provider invocation.
- [ ] Run focused tests and commit `Harden institutional model provider boundary`.

### Task 2: Add the OpenAI Responses adapter

**Files:** Modify `app/package.json`, lockfile; create `app/server/institution/providers/openai.ts`, `openai.test.ts`.

- [ ] Verify the current official OpenAI Node SDK and Responses API, then pin an exact SDK version.
- [ ] Write failing tests with an injected fake client asserting `store: false`, no background mode, tenant-allowed model, bounded `max_output_tokens`, minimal approved context, timeout propagation and safe error mapping.
- [ ] Implement the adapter without global mutable client state. Never log prompt, output, course content or API key.
- [ ] Reject empty/invalid response content and return usage suitable for authoritative budget accounting.
- [ ] Run focused tests, dependency audit, build and commit `Add governed OpenAI Responses provider`.

### Task 3: Persist budgets and provider usage atomically

**Files:** Generate migration `supabase migration new intelligence_provider_usage`; create `supabase/intelligence-provider.check.sql`; modify `app/server/institution/policy-repository.ts` and tests.

- [ ] Write failing SQL tests for per-request ceiling, monthly reservation, concurrency, reversal after pre-call failure, final usage settlement, cross-tenant denial and immutable metadata-only audit.
- [ ] Add provider configuration metadata (never keys), usage reservations and atomic reserve/settle database functions.
- [ ] Keep raw prompts and responses out of persistence by schema design.
- [ ] Run focused and full SQL checks; commit `Enforce institutional AI budgets`.

### Task 4: Wire production runtime and degraded behavior

**Files:** Modify `app/server/institution/runtime.ts`, `app/server/institution/.env.example`, `app/server/institution/runtime.test.ts`; update `docs/market-readiness/AI_GOVERNANCE.md`.

- [ ] Write failing runtime tests for absent key, policy off, disallowed model, exhausted budget, timeout, provider outage and successful configured startup.
- [ ] Read `OPENAI_API_KEY` only server-side; use `SEMESTER_OPENAI_MODELS` as an operator ceiling intersected with tenant policy.
- [ ] Keep intelligence `policy-disabled` unless all required runtime and tenant configuration is present; non-AI workflows remain available.
- [ ] Add a build-artifact secret scan fixture proving server values are absent.
- [ ] Run focused tests, full app verification and commit `Activate policy-gated OpenAI runtime`.

**External gate:** Vanderbilt must approve models, data categories, faculty-source rules, retention, budget, incident owner and vendor terms. Default API abuse-monitoring retention or any approved ZDR/MAM arrangement must be documented accurately; repository code cannot claim vendor approval.
