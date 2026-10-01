# Production availability verification — 2026-10-01

Owner request: complete every company-site availability and roadmap item, enable
live payments, and make the product available for institutions to purchase and
integrate. Owner confirmed legal and independent reviews complete. That approval
is recorded here; it supplies neither provider credentials nor review reports.

## Verified live

Project: `lzrqvlugnawcgywkhqlz` (`semester`).

- All 318 public tables have RLS enabled. This is an enablement check, not proof
  of every policy's correctness.
- `export_my_data`, `erase_account`, `begin_checkout`, `complete_checkout`,
  `sync_provider_subscription` and `run_dunning` exist.
- LTI, checkout, webhook, cancellation and account deletion functions are ACTIVE.
- An invited synthetic account signed up successfully, exported its account JSON
  (three populated table groups and the withheld-record disclosure), deleted its
  data and sign-in successfully, and had its old session refused (HTTP 403).
  The temporary test account and invitation were removed. No real user's data
  was exported or deleted.
- Billing checkout answers `Checkout is not available yet.` Live credentials are
  not available in this execution environment.
- Google sign-in and SAML remain disabled in the public auth settings; there are
  zero institution registrations in `public.lti_platform`.

## Implemented in this change

- Live Stripe activation command with merchant-onboarding checks, complete
  webhook event registration, server-only secrets, pagination and duplicate
  detection, existing-endpoint reuse, authentication/CORS checks and signing-key
  verification without charging or creating a fake financial event.
- Checkout refuses environment-mismatched sessions and non-Stripe redirects.
- Signed webhooks must match the configured live/test environment before any
  financial or entitlement mutation.
- Company-site export/deletion claims and roadmap moved to available based on
  the live acceptance check. Stale undeployed-LTI wording corrected.

## Still blocked or incomplete

| Item | Required to finish |
| --- | --- |
| Public self-service signup | Production invite-only is still on. Automatic approval review rejected switching it off because the exact global access change was not explicitly authorized. Owner approval of opening production signup is required. |
| Live billing | Live Stripe merchant key, Supabase configuration credential, webhook signing secret (automatically created for a new endpoint), and an approved checkout-to-cancellation acceptance run. See `ops/billing/README.md`. |
| Google sign-in / personal provider connections | Owner provider app registrations, redirect URLs and approved OAuth credentials; live consent/connect/disconnect tests. |
| Institutional SSO / SCIM / LTI / grade passback | Platform software exists; institutions must register their identity/LMS deployment and grants, then pass scoped acceptance tests. No tenant is connected. |
| Full native LMS migration | Implementation and a rehearsal/parallel-run acceptance record remain incomplete. |
| Credential wallet / issuer network | No released verifiable credential wallet or real issuer network exists. |
| Critical support | Real staffing, escalation destinations and an exercised on-call service are required; code cannot provide 24/7 human staffing. |
| Roadmap phases 2–4 | Tenant rollout, authoritative migration evidence, issuer/employer partners, localization/research governance and certification decisions remain incomplete. |

A configured endpoint, passing code test or owner confirmation is not a substitute
for a real deployment acceptance record. Unverified items were not relabeled green.
