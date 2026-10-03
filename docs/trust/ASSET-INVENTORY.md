# Semester asset inventory — controlled draft

- **Status:** `PARTIAL / RECONCILIATION REQUIRED`
- **Owner:** Security/Operations asset owner with system, data, vendor, and business owners
- **Evidence date:** 2026-10-03

## Inventory scope

Inventory every production, staging, development, corporate, customer-specific, and recovery asset that can process data, grant access, deliver code, make commitments, or restore operation: repositories and artifacts; applications/domains; databases/storage/backups; cloud/provider projects; identities, roles, service accounts, keys and certificates; endpoints/devices; integrations/APIs/webhooks; data sets and logs; AI models/tools/knowledge sources; vendors/contracts; workflows/runners; documentation/runbooks; and critical people/communication channels.

Repository and feature inventories are discovery inputs, not proof of live assets, ownership, provider configuration, region, backup, or approved use.

## Control and evidence map

| Asset class | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| source/artifacts/releases | Git, workflows, lockfiles, feature and screen inventories | provider artifact/deployment reconciliation incomplete | `PARTIAL` | Engineering | live deployment and artifact inventory |
| cloud/data/storage/backups | architecture, migrations, environment and restore sources | projects, tiers, regions, storage and backup settings incomplete | `PARTIAL` | Operations/Data | provider exports and owner acceptance |
| identities/secrets/keys | IAM standards, `SECRETS.md`, service and provider configuration | account/access/rotation inventory incomplete | `PARTIAL` | Security/IAM | provider-console and machine-identity review |
| integrations/vendors/AI | connection, provider, subprocessor and AI sources | contracts, scopes, regions, activation and model state incomplete | `PARTIAL` | System/Vendor/AI owners | authoritative provider/contract reconciliation |
| devices/corporate/business | company controls and operating sources | endpoint, software, domain, insurance and key-person records incomplete | `NOT COMPLETE` | Executive/Operations | complete corporate asset register and access review |

## Required asset record

`[ASSET ID]`, class/name, description/purpose, environment, owner/backup/custodian, technical location/provider/account/project, customer/tenant, data classification/subjects, criticality, dependencies, internet exposure, identities/access, secrets/keys, version/configuration, region/residency, encryption, logging/monitoring, backup/recovery, retention/disposal, vendor/contract, lifecycle/status, last verified, evidence, risks/exceptions and offboarding.

## Claim ceiling and activation blockers

Permitted: “Semester has multiple repository-derived asset inventories and a canonical reconciliation standard.” Prohibited: complete asset inventory, verified ownership/control, known attack surface, complete software/hardware inventory, or institution-specific asset coverage. Blocks: live provider/account exports; repositories/artifacts/domains; data/storage/backups; identities/keys/certificates; integrations/vendors/AI; endpoints/corporate assets; customer-specific assets; owners/backups; lifecycle/disposal; reconciliation cadence; and signed completeness review.
