# Semester encryption and key-management standard — controlled draft

- **Status:** `PARTIAL / PROVIDER-DEPENDENT`
- **Owner:** Security owner with Engineering and Privacy
- **Evidence date:** 2026-10-03
- **Scope:** data in transit, at rest, application encryption, secrets, keys, certificates and signing material

## Standard

Use approved current transport encryption for network traffic and provider-supported encryption for stored data and backups. Application-level encryption is required where the threat/data model calls for separation beyond provider storage controls. Keys and secrets must be generated with approved randomness, held in an approved secret/KMS facility, least-privilege scoped, separated by environment/customer purpose, never committed, logged or copied into tickets, and rotated/revoked on schedule and incident.

No blanket “encrypted everywhere” claim is allowed. For each data path, identify plaintext boundaries, endpoints, termination, storage layer, key owner, provider control, backups, logs, exports, device storage and operational access.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| transport protection | HTTPS/provider architecture and security sources | target TLS settings/certificate evidence not consolidated | `PARTIAL` | Platform/Security | target protocol/header/config verification |
| provider storage/backups | provider descriptions and architecture | project-level settings and assurance scope not filed | `UNVERIFIED` | Security/Privacy | dated provider/project evidence |
| institutional action journal | application encryption implementation/tests | target key configuration/rotation exercise absent | `VERIFIED — REPOSITORY` | Engineering/Security | target encrypt/decrypt/rotate/revoke drill |
| application/provider secrets | [`SECRETS.md`](../../SECRETS.md), CI secret scanning | complete vault/key inventory and rotation log absent | `PARTIAL` | Security/Engineering | inventory, access review and rotation evidence |
| signing/webhook/token material | protocol-specific code/tests | key ownership/expiry/revocation operation incomplete | `PARTIAL` | Engineering | target failure and rollover tests |

## Key record

`[KEY/SECRET ID — NEVER VALUE]`, purpose/data, algorithm/size, environment/tenant, owner/backup, store/provider/region, access roles, creation/activation, rotation/expiry, backup/recovery, audit, dependent services, compromise action, destruction evidence and exception.

## Claim ceiling and activation blockers

Permitted: “Semester uses provider transport/storage protections and repository-tested encryption for defined paths.” Prohibited: encrypted everywhere, customer-managed keys, verified residency, complete rotation, hardware-backed storage, or independent cryptographic assurance without evidence. Blocks: cryptographic/data-path inventory, target TLS/storage settings, provider assurance, key/secret inventory, access review, rotation/revocation/recovery drill, logs/alerts, backup/export/device treatment, customer requirements, exceptions and named owners.
