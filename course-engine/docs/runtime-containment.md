# Course Engine runtime containment

This guard is a containment boundary, not production activation. Local synthetic
development keeps the existing defaults. Any Vercel process is treated as managed even
when `VERCEL` or `VERCEL_ENV` is present with a blank value; a missing or malformed
`RUNTIME_ENVIRONMENT` never turns a Vercel deployment into development.

A managed runtime is ready only when all of these are true:

- non-loopback PostgreSQL is configured instead of SQLite or the Compose example;
  connection-target and identity query overrides are forbidden, and the only accepted
  query option is `sslmode=require`, `verify-ca`, or `verify-full`;
- the JWT secret is non-default, is not the documented placeholder, and is at least 32
  characters;
- private S3-compatible storage uses HTTPS, non-default credentials and bucket, and a
  pinned 12-digit expected bucket owner with `AES256` or `aws:kms` encryption;
- the broker uses non-loopback `rediss://`;
- external LLM work is disabled; and
- `RUNTIME_POLICY=private-course-data-no-provider-egress-v1` is set explicitly.

The policy value records a narrow no-provider-egress posture. It does not approve a
provider, scanner, database, storage service, or production launch. Those remain subject
to the production activation checklist.

When any condition fails, `/health` remains a liveness-only `200`, `/ready` returns a
generic `503`, and every `/api/v1/*` operation returns the same generic `503`. The API
does not import its routes, database, queue, authentication, storage, or provider-facing
code in that state. Swagger, ReDoc, OpenAPI, and CORS middleware are not exposed while
contained. A worker or other process that imports the database boundary refuses startup
before creating the configured engine. Malformed typed environment values are converted
to the same contained settings state rather than exposing validation details. Responses
do not reveal which setting failed.

## Observed project metadata

Read-only Vercel metadata on 2026-10-10 returned `envs: []` and
`hiddenProductionEnvCount: 0` for project `prj_FUAYdUfqv1hNCVbFOXTy3cKCYCSs`.
This is an explicit empty result, not a list with redacted values. A separate connector
query returned `connectors: []`; connector absence is supporting topology evidence, not
proof by itself that environment configuration is empty.

## Deployment and rollback

Do not deploy this change without explicit approval. On the currently observed empty
Vercel configuration, deployment would preserve liveness while converting all Course
Engine data, authentication, upload, job, export, and provider-facing API operations to
stable `503` responses.

The preferred rollback is to remove or protect the public alias and then redeploy the
previous approved SHA. Redeploying the previous SHA while leaving the alias public would
restore the unsafe development fallbacks and is not a safe rollback. Do not bypass the
guard by inventing placeholder production values. Re-enable operations only after the
activation checklist has verified the named resources, policies, migrations, and owners.
