# Activation checklist

Nothing in `infra/` has run. Do these in order; each is its own change record.
A step is done when its check passes, not when the command ran.

1. **State store.** Provision the bucket to the requirements in
   DISASTER-RECOVERY; the exact commands and the scoped IAM policy are in
   [`infra/bootstrap/`](../../infra/bootstrap/README.md). Check: versioning on, public access blocked, a
   credential that can touch only that bucket.
2. **Bootstrap the platform root, once, locally.** The pipeline's own
   environments (`infrastructure-plan`, `infrastructure-production`) are
   created by this root, and the pipeline's secrets live in them, so the first
   apply cannot come from the pipeline. The maintainer runs
   `terraform apply` in `envs/platform` with a short-lived token, under a
   `standard` record that says so. (Applying over the existing `staging` and
   `production` environments adjusts them in place.) Every later change goes
   through `infra-apply.yml`.
3. **Secrets and variables** in those environments: `TF_STATE_BUCKET`,
   `TF_STATE_REGION`, `TF_STATE_ENDPOINT` (variables); the secrets listed in
   SECURITY-CONTROLS. Prefer a GitHub App installation token for
   `INFRA_GITHUB_TOKEN`. The rows are already in `SECRETS.md`; record each secret's owner and first-rotated date there.
4. **Confirm the platform root through the pipeline.** Dispatch `infra-apply.yml`
   for `platform` (record `Roots: platform`); it must plan empty. Review the ruleset: it must show no change
   if `main.json` already matches GitHub. Any difference is real drift found.
5. **Production root, import only.** Fill `db_allowed_cidrs` and
   `vercel_project_id` in `production/terraform.tfvars`; the plan must show
   *imports and updates, no create, no destroy* (policy enforces it). Note the
   WAF is a **create** on a project that may have a manual firewall — read the
   plan.
6. **Staging root.** Needs a Supabase organisation id and database password
   (`TF_VAR_*`). Then apply and compare plans against production.
7. **Run `drift.yml`** by hand; expect green and an artifact.
8. **Dispatch `supply-chain.yml`**; expect both `gh attestation verify` steps
   to pass. Check the Actions run page shows the attestation.
9. **Run the first DR drill** (DISASTER-RECOVERY) and fill in R-7.
10. Add a second reviewer, set `prevent_self_review = true` (R-1).
