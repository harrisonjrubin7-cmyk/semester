# Phase 1, step 7 — where a tenant or owner id enters a request (trace)

**Date:** 2026-10-04 · **Repository:** `origin/main` @ `f8b1649` plus this branch · **Scope line (build rule):** S1 gate evidence — closes the `N` marks on register rows I-05 and U-01 and narrows risk PR-04 · **Status:** READ-ONLY TRACE. No code changed. It is a statement about what was read, not a security assurance.

## Question

Phase 0 left one item untraced under P1 risk PR-04: `app/server/productivity/http.ts` reads `owner_id` from the query string (lines 218, 228, 304). Does a caller-supplied id reach a query without the caller being entitled to it? And, more broadly, does a client-supplied tenant or owner id enter anywhere else?

## Answer for the productivity API: no entitlement is bypassed, and it is not mounted

| # | Fact | Evidence | Mark |
| --- | --- | --- | --- |
| 1 | **Tenant is never read from the request.** The rate-limit key and every repository scope use `principal.tenant.id`, from `config.authenticate(request)` | `app/server/productivity/http.ts:165-176`; `service.ts:167,490,524,546` | V |
| 2 | **Writes ignore any named owner.** For a `user` principal `ownerFor()` returns the verified actor and throws if a different owner is requested; the HTTP layer never passes `options.ownerId` | `service.ts:201-207`; `http.ts` calls `execute(principal, commands, meta)` with no options | V |
| 3 | **Test of (2):** `owner_id` in the URL and in the body is ignored; every audit row belongs to the real actor | `http.test.ts:141-147` ("never lets a person name another owner in the URL, the query or the body") | V |
| 4 | **Reads take `owner_id` from the query, but only as a filter behind the policy decision.** `authorizeRead()` allows the actor's own data; for anyone else it asks `decide()` with grants from `principal.consentGrantsFor(ownerId)` | `service.ts:521-522, 543-544, 458-482` | V |
| 5 | **`decide()` denies a non-owner read without a live share grant** that names *this* grantee, *this* owner and the scope; it also requires the `productivity:use` capability and a stated purpose, and refuses non-person actors | `packages/institution/src/policy.ts:362-371` (`actor_not_person`, `capability_missing`, `owner_missing`, `purpose_missing`, `grant_missing`, `grant_not_live`) | V |
| 6 | **A denied cross-owner read is audited** (`productivity.shared_read`, outcome `denied`), and an allowed one is recorded *before* data is returned | `service.ts:471, 478, 485-505` | V |
| 7 | **Tests of (4)–(6):** 403 with `grant_missing` and a denied audit row for the actor; 403 over HTTP without a grant | `service.test.ts:440, 454`; `http.test.ts:238` | V |
| 8 | **The SQL filters on tenant and owner together** in every read and in the commit function, and all are `service_role`-only | `supabase/migrations/20261004180000_productivity_reads.sql:95-99, 113-117, 145, 173, 193-196, 291-294`; grants at `:220-231` | V |
| 9 | **A forged cursor cannot reach another person's rows**; another person's record answers not-found | `http.test.ts:182, 226` | V (titles); not re-run |
| 10 | **A job principal with no owner is a 500 that leaks nothing**, not a data path | `http.test.ts:149-161` | V |
| 11 | **The productivity API is not mounted in production.** `createProductivityApi` is referenced only by `http.ts` (definition), `ops.ts` (a comment) and tests; `app/api/` holds only `institution/[...path].ts`; nothing in `app/vercel.json` routes to it | `grep -rn createProductivityApi` over `app/`, `packages/`, `supabase/`; `ls app/api` | V |
| 12 | **No production code supplies `authenticate` or `consentGrantsFor`.** The only `consentGrantsFor` hits are the type and its one use in `service.ts` | same search | V |

**Reading.** The caller-supplied `owner_id` is not a forged-argument path: it is checked against the policy decision point, which is itself fed by a server-side grant resolver, and the SQL cannot return a row for a tenant/owner pair other than the one it is given. With no mounted route and no resolver wired, shared reads are **denied by default**, and nothing is exposed today.

## What is still open (and where it goes)

| # | Residual | Why it matters | Goes to |
| --- | --- | --- | --- |
| R1 | **Step 9 must wire `authenticate` and `consentGrantsFor` correctly.** The principal must come from verified membership (as `app/server/institution/gateway.ts` does), and grants must be resolved server-side, never taken from the request | The safety in rows 1, 4–5 holds *because* those two inputs are trusted. Wiring them from client input would reopen the path | Phase 1 step 9; add a mount-level test that fails if `consentGrantsFor` is derived from request data |
| R2 | **The service-only definers still trust `p_tenant` / `p_owner`** (`public.productivity_*`, `gateway_*`, `reserve_ai_budget`, `add_spend`, `scim_gateway_*`). Row 8 shows the productivity reads filter on both, but a forged argument is only as safe as its caller | Safe only if every server caller derives ids from a verified principal | Phase 1 step 5 (forged-argument tests) |
| R3 | **`gateway.ts` and the Edge Functions were checked at grep level only.** `gateway.ts` refuses a mismatched `X-Tenant-Id` (`context.ts:56-72`, `gateway.ts:330-335`). A grep of `supabase/functions/*/index.ts` for tenant/school/owner/user ids read from the request found none (the one hit is a column list in a `select`). The audit reports `lti` takes its tenant from a registered platform row | A grep is not a proof; a function could read an id under another name | Step 8 (PDP coverage sweep) should include a per-function table |
| R4 | **Non-user principals reach `execute` and get a plain `Error`** (500, tested). Harmless, but it is an unhandled path rather than a designed refusal | cosmetic | note only |

## Consequence for the registers

| Row | Before | After |
| --- | --- | --- |
| I-05 (`COMPLETE_CAPABILITY_REGISTER.md`) | gap: "`productivity/http.ts:218,228,304` `q.ownerId` untraced (N)" | gap: productivity traced (this page); gateway and Edge Functions grep-level |
| U-01 | Unknown/investigate | Built but not release-ready (traced; not mounted) |
| PR-04 (`RISK_REGISTER.md`) | "`q.ownerId` untraced" | productivity half **narrowed**: not exploitable and not mounted; the risk remains for the other service-role definers and for step 9 wiring. Severity stays **P1** until R1–R3 close |

## Limits of this trace

- I read code and ran no test for this trace. Test titles are cited, not re-run for this page; the full suite passed on this branch before this page was added.
- It covers the productivity API in full and the gateway and Edge Functions only to the depth in R3.
- It is not an independent security review, and it does not satisfy FR-004 (target-tenant isolation proof), which needs a signed test on a target.
