# Infrastructure

How Semester's infrastructure is defined, changed, secured, observed and
recovered. The code is in [`infra/`](../../infra/README.md) (start there for the
status table and risk register); these pages are the reasoning and the runbooks.

| Page | Answers |
| --- | --- |
| [CHANGE-CONTROL](CHANGE-CONTROL.md) | Who may change production, by what path, with what record; what drift is and how it closes |
| [SECURITY-CONTROLS](SECURITY-CONTROLS.md) | Identities and least privilege, secrets, encryption, network, WAF/CDN, tenant isolation |
| [ENVIRONMENTS-AND-RELEASE](ENVIRONMENTS-AND-RELEASE.md) | Preview, staging, production, canary, rollback — mapped onto the platforms actually in use |
| [DISASTER-RECOVERY](DISASTER-RECOVERY.md) | Backups, RPO/RTO targets, the drill, the Terraform state store |
| [VULNERABILITY-MANAGEMENT](VULNERABILITY-MANAGEMENT.md) | SBOM, provenance, scanning, response times |
| [OPERATIONS](OPERATIONS.md) | Monitoring of the platform, cost controls, access reviews, recovery testing cadence |
| [COMPLIANCE-EVIDENCE](COMPLIANCE-EVIDENCE.md) | Which artefact proves which control; how a bundle is produced |
| [ACTIVATION](ACTIVATION.md) | The ordered checklist that turns the code into a running pipeline |

## Today, as measured on 4 October 2026

| Fact | Source |
| --- | --- |
| One production Supabase project, `us-west-2`, Postgres 17, healthy | Supabase management API (read-only) |
| Eight Supabase preview branches live, one per open pull request | same |
| Security advisors on production: 3 WARN (GraphQL exposure of anon/authenticated tables; an executable `SECURITY DEFINER` function) and 1 INFO (RLS enabled, no policy) | `get_advisors`; tracked in `docs/DEFINER-RLS-REGISTER.md` |
| SPA on GitHub Pages; institution gateway on one Vercel function | `STAGING.md`, `app/vercel.json` |
| No Terraform, state store, or second environment existed before this change | repository history |
| Backups / PITR: **unknown** — "not verified" | `RESTORE.md` |

## What this design refuses to do

- Claim a control is live because its code exists. Every page says *Enforced*,
  *Coded* or *Proposed*.
- Add a platform the product does not use (no Kubernetes, no multi-cloud) to
  look complete. The target in
  [`docs/target-architecture/05`](../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md)
  and [`06`](../target-architecture/06-DELIVERY-AND-OPERATIONS.md) goes further;
  this is the part that can be true now, built so that growth replaces modules
  rather than rewriting the pipeline.
- Touch production. Nothing here has been applied.
