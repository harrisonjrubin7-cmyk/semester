# Vanderbilt production activation

This is an activation gate, not evidence that Vanderbilt production exists.
Every unchecked external item remains a release blocker.

## Before deployment

- [ ] Vanderbilt names an executive owner, technical owner, privacy contact, security contact, accessibility reviewer and incident commander.
- [ ] The Vercel and Supabase production projects have organization ownership, billing, two administrators and recovery access.
- [ ] Vanderbilt approves the exact origin, SSO/SCIM configuration, Brightspace registration, AI provider/models, source rules, data categories, retention and budget.
- [ ] Formal accessibility, security, privacy and legal reviews record findings and launch disposition.
- [ ] Backup restoration, tenant disable and application rollback are exercised in staging with timestamps and evidence links.

## Production configuration

Configure these as server-only Vercel values in Preview and Production separately:

- `SEMESTER_APP_ORIGIN`
- `SEMESTER_AUTH_URL`, `SEMESTER_AUTH_PUBLIC_KEY`, `SEMESTER_AUTH_SERVICE_KEY`
- `SEMESTER_JOURNAL_KEY`
- `SEMESTER_INSTITUTION_NAME`
- `SEMESTER_SSO_DOMAIN`, `SEMESTER_SSO_LABEL`
- `SEMESTER_MINIMUM_ADAPTERS`
- `SEMESTER_INTEGRATIONS_READY=1` only after required adapters pass authoritative synthetic checks
- `SEMESTER_MONITORING_READY=1` only after alert delivery is exercised
- `SEMESTER_REQUIRE_AI=1` only when AI is launch-required and fully approved
- `OPENAI_API_KEY`, `SEMESTER_AI_PROVIDERS`, request and monthly cost policy values only after approval

Only the browser gateway address is public: `VITE_UNIVERSITY_GATEWAY_URL=/api/institution`.
No service-role, journal, SCIM, LTI private key, provider or monitoring secret may use a `VITE_` prefix.

## Database and scheduler

1. Rehearse every pending migration against PostgreSQL 17 and a production-shaped staging copy.
2. Capture the current migration ledger and a restorable backup.
3. Apply the migrations through the approved production deployment identity.
4. Apply `supabase/scheduler.sql` and verify `institution-gateway-retention` is active.
5. Run `select public.gateway_purge_journal();` once through the approved operator path; do not mark readiness green until the scheduled job subsequently succeeds.
6. Verify browser roles cannot execute gateway journal, rate-limit, retention or AI-confirmation RPCs.

## Staging acceptance

Run from `app/`:

```sh
SEMESTER_PRODUCTION_APP_URL=https://staging.example.edu \
SEMESTER_PRODUCTION_GATEWAY_URL=https://staging.example.edu/api/institution \
npm run smoke:production
```

Then test every authorized role, tenant isolation, SSO logout/deprovisioning, Brightspace launch/readback, AI source citations and confirmation, retention freshness, accessibility keyboard/screen-reader flows, backup restore and rollback. Synthetic or sandbox evidence must be labelled as such.

## Promotion and rollback

Production promotion is a protected human decision after all evidence is attached. Stop or roll back for authentication leakage, cross-tenant access, untraceable consequential actions, readiness failure, inaccessible critical flows, missing alert delivery or failed authoritative readback.

Rollback the application to the previous verified Vercel deployment first. The database changes are additive so the prior application remains readable; do not drop new tables or columns during an incident. Disable the affected tenant/integration/provider through its server-controlled policy, preserve uncertain action rows for reconciliation, and verify `/health/ready`, authentication refusal and representative role journeys before reopening.

## Current external blockers

As of 24 September 2026, repository tests do not prove a linked Vercel project, applied production migration, active retention schedule, approved OpenAI account, Vanderbilt IdP/SCIM or Brightspace credentials, delivered alerts, restore exercise, or formal accessibility/legal/security approval.
