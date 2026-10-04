# Security controls

## Identities and least privilege

| Identity | Can | Cannot | Held in |
| --- | --- | --- | --- |
| Workflow `GITHUB_TOKEN` | read contents (repository default is `read`; workflows cannot approve PRs) | write anything unless a job asks, where review sees it | GitHub |
| `infrastructure-plan` credentials | read state, read provider objects | change anything, run from a branch | environment, `main` only |
| `infrastructure-production` credentials | apply a reviewed plan | run without a reviewer; run from a branch | environment, reviewer required |
| `SUPABASE_ACCESS_TOKEN` | **everything on the Supabase account** (R-4) | — | Actions secret; rotate quarterly |
| Service-role key | everything in the database | — | injected into Edge Functions; never in a store (`SECRETS.md`) |
| Publishable key | what RLS allows | the rest | public by design |

Rules: `id-token: write` only on the job that attests or deploys (policy);
actions pinned to a commit and on the approved list (policy + `supplychain.ts`);
GitHub Actions allow-list and `sha_pinning_required` set by Terraform.

## Secrets

The register stays [`SECRETS.md`](../../SECRETS.md). Added by this work:
`INFRA_GITHUB_TOKEN`, `VERCEL_API_TOKEN`, `TF_STATE_ACCESS_KEY_ID` /
`TF_STATE_SECRET_ACCESS_KEY` (environment secrets) and `TF_STATE_BUCKET`,
`TF_STATE_REGION`, `TF_STATE_ENDPOINT` (environment variables). They are
registered in `SECRETS.md` (a test fails if a workflow reads one that is not). Terraform reads sensitive
values from `TF_VAR_*`; a `.tfvars` file in git holds identifiers only, and a
test fails on anything secret-shaped.

## Encryption

| Data | At rest | In transit |
| --- | --- | --- |
| Postgres | provider-managed disk encryption (Supabase) | TLS **enforced** by `supabase_settings.ssl_enforcement` |
| Terraform state | encrypted, versioned bucket (required: DISASTER-RECOVERY) — state holds the database password for a created project | TLS |
| Tenant keys | per-tenant envelope encryption is the target (`06 §5`); today one key (`SEMESTER_JOURNAL_KEY`) | — |

## Network

| Surface | Control | Status |
| --- | --- | --- |
| Direct Postgres | CIDR allow-list; empty list fails the plan in production; `0.0.0.0/0` rejected | Coded |
| Institution gateway | OWASP managed rulesets set to deny, bot protection, AI-bot deny, 300 req/min/IP edge limit | Coded |
| SPA (GitHub Pages) | no WAF and no response headers are possible; CSP is a `<meta>` tag | Gap R-2 |
| API / Auth | Supabase-managed; abuse limits are application-level (`rate limits` in the checks) | Existing |

## Tenant-safe deployment

Tenancy is enforced in the database (RLS, 106 second-account checks run by
`supabase/check.sh`) and in the gateway, not by infrastructure. Infrastructure's
duty is therefore: (1) never give a non-production environment production data
(staging is a separate project; the pipeline has no copy-down path); (2) never
let a deploy skip the check suite (`functions.yml`/`pages.yml` gate on CI);
(3) keep the isolation line at the project boundary — a silo tenant is a new
Terraform root, stamped from the same modules.
