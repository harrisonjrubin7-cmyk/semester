# Release and incident operator runbook

This procedure separates repository readiness, approval, deployment, production verification, incident communication and institutional activation. The Operations Console summarizes evidence; it does not perform a deployment or rollback and does not turn a green row into a GO decision.

## Before a release request

1. Confirm the intended branch and exact 40-character commit.
2. Record current source evidence for restore readiness, legal approval, paid infrastructure, domain/TLS and production migrations. A pass without a source, an expired record or a migration record without the exact commit remains blocked.
3. Attach the CI result, golden-path result, rollback rehearsal and change ticket as opaque references. Do not paste secrets, logs with personal data or credentials into the console.
4. Request the `release` duty. The request is not approval and must not trigger deployment.

## Approved release

1. Confirm the approval still targets `platform`, names action `release` and is current.
2. Execute the deployment in the owned deployment system. Record its source, deployment identifier, rollback reference and exact commit as deployment evidence.
3. Treat the release as **Deployed — unverified** until post-deploy checks name the same exact commit.
4. Run the production smoke, readback, tenant-isolation and rollback-readiness checks. Record post-deploy verification only for the deployed commit.
5. A **Verified evidence** row means the recorded evidence is current and internally consistent. It is not institutional approval, tenant activation or proof that every customer workflow is healthy.

## Incident response

1. Open the incident in the service-owned incident writer with severity, owner, affected tenant if known, affected workflows and cautious customer-impact language.
2. Follow [`operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md). Publish the required audience notice and a next-update time even when the investigation is incomplete.
3. Keep personal data, notice bodies, recipients, raw provider errors and security-investigation detail out of the console summary.
4. Prefer the narrowest reversible mitigation. If rollback is appropriate, request approval against the incident reference and release commit. The request does not execute rollback.
5. Execute through the owned external rollback path, then verify the affected workflows and issue the next notice. Do not mark recovery from process completion alone.

## Recovery and close

1. Record recovery only after the customer-facing workflows are verified.
2. Publish the resolution notice and preserve the timeline, evidence references and exact release commit.
3. Schedule the post-incident review and track corrective actions with owners and dates.
4. Keep the incident distinct from GA, contractual acceptance and institutional activation; each requires its own evidence and authority.
