# Vanderbilt Production Readiness Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan. Complete the linked workstreams in order and stop at every external release gate. Do not describe a built or staging-verified integration as Vanderbilt-authorized.

**Goal:** Produce a deployable, observable Vanderbilt production candidate using OpenAI, Supabase Cloud and Vercel while preserving Semester's current application foundation and truthful integration states.

**Architecture:** Keep the React client and provider-neutral institutional gateway. Add Supabase-backed membership, provisioning, action journaling, rate limiting and retention; use thin Vercel Node entry points; install OpenAI behind the governed intelligence boundary; productionize the existing LTI 1.3 foundation; and track human approvals as explicit release gates.

**Tech Stack:** React 19, TypeScript 7, Vitest, Vite, Supabase Auth/Postgres 17/Storage/Edge Functions/Cron, Vercel Functions, OpenAI Responses API, Brightspace LTI 1.3.

**Spec:** `docs/superpowers/specs/2026-09-24-vanderbilt-production-readiness-design.md`

## Non-negotiable constraints

- Preserve all current routes, capabilities, visual language and local SQLite development behavior.
- Never place service-role, SCIM, OpenAI, LTI private-key or monitoring secrets in `VITE_*` variables.
- Resolve institution and roles from verified server records, never browser state or user-editable metadata.
- Keep Vanderbilt production capabilities disabled until their corresponding authorization evidence exists.
- Write each test first, observe it fail, implement the minimum behavior, rerun adjacent tests, then commit.
- Generate every new Supabase migration with `supabase migration new <descriptive_name>`; use the generated filename in the commit.
- Do not send outreach, buy services, create vendor commitments or paste production secrets into chat.
- Treat OpenAI response state as disabled (`store: false`); do not use background mode for the pilot.
- A failed external write is `uncertain` until authoritative reconciliation; never retry it blindly.

## Ordered workstreams

1. [Identity and SCIM](2026-09-24-vanderbilt-01-identity-scim.md) — tenant-bound SAML identity, current membership authorization and audited SCIM lifecycle.
2. [OpenAI provider](2026-09-24-vanderbilt-02-openai-provider.md) — approved, budgeted, source-grounded Responses API adapter.
3. [Brightspace](2026-09-24-vanderbilt-03-brightspace.md) — production registration validation and acceptance evidence around the existing LTI implementation.
4. [Retention](2026-09-24-vanderbilt-04-retention.md) — retry-safe physical Storage deletion after access withdrawal or expiry.
5. [Hosting and observability](2026-09-24-vanderbilt-05-hosting-observability.md) — Postgres runtime, Vercel deployment, health, alerts and smoke tests.
6. [Accessibility and legal](2026-09-24-vanderbilt-06-accessibility-legal.md) — reviewer packets, approval ledger and truthful release gating.

Workstreams 1 and 5 establish shared production runtime interfaces. Complete them before activating 2–4 in staging. Workstream 6 may be drafted in parallel but cannot be marked approved by repository work.

## Program-level verification

- [ ] Run `cd app && pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm run check:university && pnpm test`.
- [ ] Run `./supabase/check.sh` against repository-required PostgreSQL 17 and retain the report.
- [ ] Run `cd app && pnpm run sweep:contrast && pnpm run sweep:targets && pnpm run smoke:institutional`.
- [ ] Run secret scanning and assert that built browser assets contain none of the server secret names or test secret values.
- [ ] Deploy staging with synthetic SAML/LTI identities, a separate OpenAI project and disposable Storage objects.
- [ ] Execute `docs/vanderbilt/staging-acceptance-runbook.md`; attach timestamped evidence without student content.
- [ ] Confirm every item in `docs/vanderbilt/release-gates.json` is one of `built`, `staging-verified`, `authorized`, or `production-verified` and has evidence.
- [ ] Leave production tenant policy `off` until all 12 gates in the approved specification are satisfied.
- [ ] Commit final evidence with `git commit -m "Verify Vanderbilt staging candidate"`.

## Completion boundary

Repository completion means the software, staging automation, runbooks and evidence templates are built and verified. Vanderbilt SAML metadata, SCIM activation, Brightspace registration, legal/privacy/security approval and an independent accessibility opinion are external authorization events. If any is missing, report the exact gate and keep that capability disabled.
