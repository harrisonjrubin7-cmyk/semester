# Environment and Configuration Management

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — REPOSITORY GUARDS PRESENT; TARGET INVENTORY/READBACK PARTIAL** |
| Owner | Harrison Rubin — company-side environment, configuration and release owner; backup operator and customer configuration authority unassigned |
| Evidence date | 2026-10-03 at repository revision `fb6adc7a` |

## Environment classes

| Class | Data and purpose | Activation boundary |
| --- | --- | --- |
| local development | synthetic/local data and rapid feedback | never evidence of deployment or customer acceptance |
| CI/test | disposable fixtures, Postgres/Supabase rehearsal and automated checks | isolated credentials; artifacts tied to exact revision |
| demo | synthetic, visibly labeled, non-production demonstrations | no live customer data, production impersonation or consequential provider write |
| preview/staging | candidate verification against approved non-production services | separate access/configuration; cannot silently point to production data |
| public production | individual application and approved public services | immutable revision/config readback, monitoring, rollback and support required |
| named institutional target | one customer, tenant, cohort, roles and integrations | full customer-controlled approval, isolation/UAT, operations and signed GO required |

## Configuration rules

- Keep one inventory of environment, owner, purpose, URL/project/tenant identifiers, data class, access group, region, provider, revision and review date. Do not store secrets in the inventory.
- Anything prefixed `VITE_` is public build output. It may contain public URLs, client identifiers and publishable keys only.
- Store server secrets in the relevant deployment secret manager; name an owner and rotation/revocation path.
- Validate paired and dependent values at build/startup and fail closed on incomplete security-sensitive configuration.
- Default sensitive features to off. Record flag scope, stage, owner, reason, expiry, kill switch and target readback.
- Separate demo/preview data and labels from production; a public production build may not enable the institutional demo switch.
- Promote the same immutable candidate where practical. Record source revision, artifact identity, configuration fingerprint, approvals and deployed readback.
- Make changes through reviewed version control or an approved logged control plane. Emergency changes require retrospective review.

## Release evidence record

Record candidate SHA and artifact; environment/tenant; public configuration names and redacted fingerprint; secret/config owners; database migration state; flag/capability values; build/test/scan results; backups and rollback target; monitoring/alert/support readiness; deploy actor/time; post-deploy smoke and revision/config readback; decision/signatures; and rollback/offboarding result if used.

## Evidence state

**Code/config evidence.** Pages and CI workflows validate many public configuration dependencies, prevent obvious secret-shaped client values, pin production demo behavior and preserve build/release artifacts. Application environment and feature registries expose intended states.

**Operational evidence.** No complete current inventory covers every target, secret owner/rotation, effective variable, provider project, privileged access, deployed configuration fingerprint or named-customer approval. Public smoke does not establish institutional configuration.

**Missing test/proof.** Export and reconcile effective public configuration, assign secret/backup owners, verify rotation/revocation, record immutable deployed revision/config fingerprints, test fail-closed startup and kill switches, and obtain signed target configuration acceptance.

## Claim ceiling

Semester may describe its repository configuration guards and exact environment values that are safely read back and documented. It may identify the public deployment revision only when verified against the live asset.

## Prohibited claims

Do not claim complete environment parity, secret hygiene, immutable promotion, customer isolation, disaster recovery or production readiness from workflow definitions or redacted configuration alone.
