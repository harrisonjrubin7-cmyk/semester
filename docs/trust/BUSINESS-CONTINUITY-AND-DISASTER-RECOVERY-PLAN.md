# Semester business continuity and disaster recovery plan — controlled draft

- **Status:** `PARTIAL / TARGET RECOVERY NOT PROVEN`
- **Owner:** Executive continuity owner with Operations, Security, Product, Support, Privacy, and customer owners
- **Evidence date:** 2026-10-03

## Plan

Continuity prioritizes safety, protected access, data integrity, essential academic journeys, transparent status, and recoverable operation. RTO and RPO are not promised until measured on the intended provider, data volume, staffing model, and customer scope, then approved contractually where applicable.

| Scenario | Safe continuity mode | Recovery requirement |
| --- | --- | --- |
| application/deploy failure | serve last safe compatible version or approved status/help path | rollback plus smoke/core-journey verification |
| unsafe writes/integration uncertainty | pause connection/writes; read-only and preserve pending intent where supported | reconcile authoritative source, replay safely, prove no duplicate/lost official action |
| identity/provider failure | refuse protected data/actions; provide public help/status only | provider recovery, current access verification, revoked-session test |
| database/data loss or corruption | isolate writes and preserve evidence; do not overwrite production for rehearsal | approved isolated restore/reconcile and complete validation |
| vendor/region/network outage | degrade only within approved boundaries; no fabricated freshness or official status | provider/fallback decision and authoritative readback |
| key-person/facility loss | backup owners use current contacts, access, runbooks, and decision authority | access/communication rehearsal and transfer record |

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| service/dependency priorities | architecture, critical workflows, runbooks and status surfaces | customer-specific impact/priorities not accepted | **DESIGNED / PARTIAL** | Product/Customer | business-impact analysis and signed service order |
| deploy rollback | workflows and [`ROLLBACK.md`](../../ROLLBACK.md) | historic timings exist for page mechanism; staffing and current target rehearsal remain open | `PARTIAL` | Engineering/Operations | witnessed target rollback and compatibility checks |
| backup/restore | restore scripts/checks and dated logical rehearsal | disposable one-account PostgreSQL rehearsal; not live-provider backup proof | `PARTIAL` | Operations/Security | isolated restore of real provider backup by backup operator |
| continuity modes | read-only/feature/provider controls and local-first patterns | integrated critical-period exercises incomplete | `PARTIAL` | Product/Operations | provider, identity, write-safety, and total-outage drills |
| communications/people | status and incident communication sources | rota, backup access, customer tree, and channel resilience incomplete | `BLOCKED` | Executive/Support | key-person and communications tabletop |

## Recovery acceptance

Verify restored/recovered version and configuration, authentication, access and tenant isolation, schema and policy controls, record counts and sampled content, audit continuity, deletions/holds/retention tail, storage/files, secrets and scheduled jobs, integrations and source freshness, core student/staff journeys, monitoring/alerts, outstanding reconciliation, customer sign-off, and cleanup. Record measured RTO/RPO only for the tested scope.

## Claim ceiling and activation blockers

Permitted: “Semester has documented continuity modes, rollback controls, restore tooling, and a dated logical dump-and-restore rehearsal.” Prohibited: proven disaster recovery, live-backup restore tested, any contractual RTO/RPO, multi-region resilience, no data loss, or institution-accepted continuity. Blocks: business-impact analysis; critical-service/dependency/customer priorities; provider backup/PITR evidence; timed isolated target restore; second trained operator; full validation; rollback and outage drills; communications tree; deletion/hold reconciliation; cost/retention approval; and signed acceptance.
