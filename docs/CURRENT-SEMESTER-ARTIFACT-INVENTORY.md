# Current Semester artifact inventory

What existed on `main` at `c029822` (27 September 2026) before the integration control plane, and which of it
the new work touches. Read-only survey; paths from the repository root.

## Application

- **Framework**: React + Vite, TypeScript, in `app/`. No URL router: the reducer holds `state.screen`, mirrored to
  the hash (`app/src/lib/route.ts`). Screens are lazy components in `app/src/screens.tsx` (~80).
- **Navigation**: `app/src/lib/nav.ts` (groups, destinations, `offered(capabilities, role)`),
  `app/src/lib/tabbar.ts` (`DEFAULT_TABS = home, courses, study, calendar, me`), `components/nav/*`.
  Institutional preview IA in `app/src/lib/institutional-ia.ts`. **Untouched.**
- **Staff surfaces**: no `/admin`. `app/src/screens/University.tsx` holds Services, Drafts, Records, Connections,
  and Control (`components/institutional/ControlPlane.tsx`, behind `VITE_UNIVERSITY_CONTROL_PLANE`).
  **Touched: one tab added, behind `VITE_INTEGRATION_DASHBOARD`.**
- **Design system**: tokens in `app/src/styles/app.css` (`--sp-*`, `--type-*`, `--app-*`, `--r-*`), primitives in
  `app/src/components/ui.tsx` (`TabList`, `Segmented`, `ActionButton`, `Notice`, `EmptyState`), style and label
  audits in `app/scripts/styles.mjs`, `labels.mjs`. **Touched: CSS appended, tokens only.**
- **Data**: local-first reducer (`app/src/state/*`), IndexedDB persistence, Supabase sync in `app/src/lib/cloud.ts`.
  No React Query. Gateway calls are `fetch` in `app/src/lib/university.ts`.
- **Accessibility**: `TabList` roving focus, `sr-only`, label lint, `smoke:a11y` journeys.
- **Feature gating**: build-time `app/src/lib/experience-flags.ts` (`FeatureState` per `VITE_*`), per-school
  `Capabilities` pack (`app/src/lib/school.ts`), AI categories (`aiflags.ts`), preview access
  (`institutional-access.ts`). **Touched: one key added, default off.**

## Supabase

- 59 migrations before this one. Tenant key `tenant_id text → schools(id)` on newer tables.
- **Permissions**: `app_roles`, `app_capabilities`, `role_capabilities`, `role_grants`
  (`scope_kind`, `scope_id`), `private.has_capability(capability, scope_kind, scope_id)`,
  `private.has_capability_anywhere`, `private.scope_in_tenant`, `private.school_of`. **Extended: two roles, six
  capabilities, eight matrix rows.**
- **Tenant policy**: `tenant_feature_policy`, `ai_policy`, `approved_source`, `consent_record`,
  `tenant_policy_audit_event` (`20260923210000_intelligence_policy.sql`). **Extended: audit entity list.**
- **Identity**: `institution_identity_provider`, `institution_membership`, `scim_*`.
- **LTI**: `lti_platform`, `lti_nonce`, `lti_identity`, `lti_link_ticket`, `lti_line_item`.
- **Gateway journal**: `private.gateway_*` and public wrappers.
- **Audit**: `role_grant_audit_event`, `moderation_audit_event`, `support_access_event`, `access_log`.
- **Edge functions**: `calendar`, `canvas`, `claude`, `fetchcal`, `lti`, `push`.
- **Tests**: `supabase/*.check.sql` via `supabase/check.sh` (Postgres 17 from `config.toml`);
  `supabase/rehearse.sh` against `schema.snapshot.sql`. **Added: `integration-control-plane.check.sql`;
  updated counts in `capabilities.check.sql`, allowlist in `grants.check.sql`.**

## Operations

- **CI** `.github/workflows/ci.yml`: audit, tsc, lint, `check:university`, tests (+ zones, shuffle), build, cold
  and a11y smokes, pipeline validation, Postgres 17 + `check.sh` + `rehearse.sh`, gitleaks.
- **Deploy**: `pages.yml` (GitHub Pages), `functions.yml` (edge functions after CI on main), Vercel for
  `app/api/institution`. Hourly `production-smoke.yml`. **Untouched.**
- **Secrets**: `SECRETS.md`; client `VITE_*` are public by construction. New env var:
  `VITE_INTEGRATION_DASHBOARD` (public, a feature state, not a secret).

## Compatibility by new module

| Module | Existing artifacts touched | Extension point | Compatibility | Risk | Tests | Flag |
| --- | --- | --- | --- | --- | --- | --- |
| Control-plane schema | `app_roles`, `app_capabilities`, `role_capabilities`, `tenant_policy_audit_event` check | inserts; widened check | inserts `on conflict do nothing`; wider check accepts every old value | low | `integration-control-plane`, `capabilities`, `grants`, `indexes`, `rehearse` | n/a |
| Flag registry | none (reads `tenant_feature_policy` shape) | new module | nothing reads it yet | none | `flags.test.ts` | all off |
| Gateway library | none | new module | not wired to a worker | none | `pipeline.test.ts`, `classification.test.ts` | connector flags |
| Dashboard | `University.tsx`, `experience-flags.ts`, `app.css` | new tab, new key, appended CSS | tab absent unless the build sets the flag | low | `IntegrationDashboard.test.tsx`, `experience-preservation.test.ts` | `VITE_INTEGRATION_DASHBOARD`, `module.integration_dashboard` |
