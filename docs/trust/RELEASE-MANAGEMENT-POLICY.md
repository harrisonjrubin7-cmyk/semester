# Semester release management policy — controlled draft

- **Status:** `PARTIAL / RELEASE ACCEPTANCE INCOMPLETE`
- **Owner:** Release owner with Engineering, Product, Security, Privacy, Accessibility, Operations, Support, and customer approvers
- **Evidence date:** 2026-10-03

## Policy

A release is a pinned application, functions, database state, configuration, providers, data/integration assumptions, documentation, support model, and claim set—not merely a passing commit. Each release candidate must be reproducible, reviewed, tested to its risk, staged, observable, recoverable, and tied to an explicit decision for each audience and tenant.

## Release gates

1. Freeze candidate commit/artifact, lockfile/SBOM, migrations, configuration/feature states, environment and scope.
2. Reconcile required change records, dependency/license/secret results, tests, accessibility, security/privacy, data/AI/integration and legal/claim reviews.
3. Confirm no open P0/P1; record every lower finding, owner, compensating control, target, disclosure and expiry.
4. Verify migration compatibility, backup/restore posture, rollback/forward repair, monitoring/alerts, incident/support coverage and status communication.
5. Deploy through approved path; capture provider/artifact/deployment identifiers and authoritative target readback.
6. Run smoke, core journeys, negative authorization/tenant tests where applicable, and customer UAT/sign-off.
7. Record GO, GO WITH CONDITIONS, or NO-GO by authorized seats; monitor, communicate and close evidence.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| build/test/deploy | workflows, lockfile, build/test/database and smoke sources | selected deployments evidenced; no complete current release packet here | `PARTIAL` | Engineering | immutable artifact/provenance and candidate results |
| security/privacy/accessibility | control programs, scans, test plans and claim gates | target DAST, independent review and customer acceptance open | `PARTIAL` | Domain owners | release-specific signed dispositions |
| migration/configuration | migration checks, feature registry and deployment inputs | target baseline/readback and full drift proof incomplete | `PARTIAL` | Engineering/Operations | configuration manifest and authoritative comparison |
| recovery/operations | rollback, restore, monitoring, incident and support sources | provider restore, rota and integrated drills incomplete | `PARTIAL/BLOCKED` | Operations | witnessed rollback/restore/alert/support exercise |
| approval/customer UAT | go/no-go and acceptance sources | named seats, institution scope and signatures absent | `BLOCKED` | Executive/Product/Customer | two-account UAT and authorized release decision |

## Required release record

`[RELEASE ID]`, scope/audience/tenants, commit/artifact/checksums/SBOM, environment/configuration/providers/migrations, change set, tests/scans/findings/exceptions, backup/rollback/monitoring/support, data/privacy/accessibility/AI/legal/claims, UAT, approvers, deploy/readback, incidents, conditions/expiry, communication, metrics and final disposition.

## Claim ceiling and activation blockers

Permitted: “Semester has repeatable repository build/test/deploy controls and an evidence-gated release policy.” Prohibited: certified release, complete provenance, production-ready for institutions, zero defects/vulnerabilities, tested recovery, or customer acceptance. Blocks: named approval seats; immutable candidate packet; current scans/tests; configuration readback; target DAST and UAT; restore/rollback/incident/support exercises; legal/privacy/accessibility decisions; customer approval; exceptions; and signed GO.
