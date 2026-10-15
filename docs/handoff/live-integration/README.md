# Semester live integration

Real authentication, Supabase data, SIS/LMS integrations, payments, messaging and institutional writes, as code you deploy into **harrisonjrubin7-cmyk/semester** with your own credentials.

Everything ships **off**. Each capability is switched on per institution, with a named approver and an approval reference (the database refuses `enabled = true` without them), and every function re-checks on every request.

## What's here

| Path | What it does |
|---|---|
| `supabase/migrations/20261011120000_live_integration.sql` | 8 `live_*` tables (grants, capability switches, connections, SIS staging, command receipts, outbox, payments, messages), RLS enabled + forced, client read policies only, `live_record_command()` (service role only) |
| `supabase/migrations/20261012090000_live_workflows.sql` | Workflow engine: 16 workflow types, 12 states, allowed transitions enforced by trigger (illegal jumps fail for everyone), step log, integration health. Tenant access derived from grants, never a client-set setting |
| `supabase/functions/_shared/gate.ts.txt` | Auth → grant → capability → connection checks; CORS allow-list; errors that never leak payloads |
| `supabase/functions/live-sis-sync/` | OneRoster 1.2 client-credentials read of sessions, classes, users and enrollments into **staging** (not official records) |
| `supabase/functions/live-lti/` | LTI 1.3 `/login` (OIDC third-party initiated) and `/launch` (JWKS-verified id_token, nonce single-use, deployment allow-list) |
| `supabase/functions/live-payments/` | Stripe Checkout `/checkout` + signature-verified `/webhook`; forward-only status, idempotent |
| `supabase/functions/live-messaging/` | In-app + Postmark email between members of the same institution; rate-limited |
| `supabase/functions/live-institution-command/` | Registration add/drop, final grades and hold release as **idempotent receipts + outbox**. Never writes to the SIS in-request. |
| `ui_kits/platform/live.js` (in the design project) | Live mode for the platform shell: real Supabase sign-in, grants read under RLS |

## Install

```bash
# from the repo root, on a branch
cp -R <handoff>/live-integration/supabase/. supabase/
find supabase/functions -name '*.ts.txt' -exec sh -c 'mv "$1" "${1%.txt}"' _ {} \;   # .txt kept the design bundler from compiling them

# Production project: `semester` (DEC-ENV-001). Staging: Semester-Platform. Development: Semester2.
# 1. staging first
supabase link --project-ref <STAGING_REF>
supabase db push                                  # review the diff against your 233 existing migrations first
supabase secrets set SEMESTER_ALLOWED_ORIGINS=https://<staging-app-origin> SEMESTER_APP_ORIGIN=https://<staging-app-origin>
supabase functions deploy live-sis-sync live-lti live-payments live-messaging live-institution-command
```

Secrets per capability (set only the ones you're enabling):

| Capability | Secrets | Connection row (`live_integration_connections.config`) |
|---|---|---|
| `sis.read` | value named by `secret_ref` (OneRoster client secret) | `base_url`, `token_url`, `client_id`, `scope` |
| `lms.lti` | — (public JWKS) | `issuer`, `client_id`, `auth_endpoint`, `jwks_url`, `deployment_ids`, `app_url` |
| `payments.checkout` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — |
| `messaging.send` (email) | `POSTMARK_SERVER_TOKEN`, `SEMESTER_MAIL_FROM` | — |

## Turn one capability on (staging)

```sql
insert into live_workspace_grants(user_id, institution_id, workspace) values ('<your auth.users id>', '<institution uuid>', 'institution');
insert into live_integration_connections(institution_id, kind, config, secret_ref, status)
  values ('<institution uuid>', 'oneroster', '{"base_url":"…","token_url":"…","client_id":"…"}', 'ONEROSTER_SECRET_SANDBOX', 'sandbox');
update live_tenant_capabilities set enabled = true, approval_ref = 'STAGING-TEST-001', enabled_by = '<your id>', enabled_at = now()
  where institution_id = '<institution uuid>' and capability = 'sis.read';   -- insert the row first if missing
```

Then, in the design project's platform shell, click **Live: off**, paste the staging URL + publishable key, sign in. Your workspace switcher now comes from `live_workspace_grants`, not demo personas.

## Connected-journey release tests

`e2e/connected-journeys.spec.ts.txt` (rename to `.spec.ts`) runs against staging with two test users and two institutions:
- one account reads only its own grants;
- clients can’t grant themselves workspaces or switch capabilities on;
- capability off → 423;
- student command → same receipt on retry, one outbox event, conflicting key reuse → 409;
- kill switch → 423;
- a grant at institution A does nothing at B;
- students can’t submit final grades, faculty can;
- faculty → student message is readable by the student under RLS, a non-member recipient → 403;
- unauthenticated → 401.

Add it to CI as a required check before any capability is enabled in production.

## Campus commands
`supabase/functions/live-campus-command/` — `housing.select_bed`, `housing.select_group`, `dining.redeem`. Needs `handoff/build-plan/campus-services/*.sql` applied (adds `cs_select_bed_once`, service-role grants, and the `campus.housing` / `campus.dining` capability names). Staging tests: `e2e/campus-acceptance.spec.ts.txt` (AT001, AT002, AT003, AT008, AT012, AT030; needs a second test student).

## Kill switch

```sql
update live_tenant_capabilities set kill_switch = true where capability = '<cap>';   -- every function refuses within one request
```

## What this does not do

- **Production credentials:** I don't have them, and you shouldn't paste them into a design tool. You run `supabase link` / `secrets set` against production yourself, after staging passes.
- **Institutional authority:** turning on `sis.read`, `lms.lti` or any `writes.*` for a real school needs that school's approval (agreement, data terms, IT sign-off). The `approval_ref` column is where that reference goes. A staging test reference is not approval.
- **Official records:** the outbox worker that delivers commands to a SIS and reconciles them isn't included. Until it exists, write receipts stay `accepted`, which means "queued", not "done".
- **Not run here:** none of this was executed in the design project. Test in staging, add cases to your existing release profiles (`npm run release:check`), and attach the run links as evidence in the completion register.
