# Semester vendor security review program — controlled draft

- **Status:** `DESIGNED / REVIEWS NOT ESTABLISHED`
- **Owner:** Security/Vendor Risk owner with Privacy, Legal, Procurement, and system owner
- **Evidence date:** 2026-10-03

## Review lifecycle

1. Inventory the exact vendor/legal entity, product, account, purpose, data, privileges, connectivity, regions, subprocessors, business criticality, alternatives, and exit dependency.
2. Tier risk from data sensitivity, access, tenant impact, operational criticality, AI use, transfer, concentration, and recoverability.
3. Obtain current primary evidence under approved confidentiality: assurance reports/certificates and scope, pen-test summary, security architecture, incidents, DPA/terms, continuity/recovery, deletion, and subprocessor records.
4. Evaluate exceptions, complementary user controls, contract gaps, customer flow-down, remediation, compensating controls, owner, expiry, and residual-risk acceptance.
5. Approve, condition, restrict, reject, replace, or time-bound the vendor; verify target configuration before enablement.
6. Monitor ownership, breach, terms, region, subprocessor, product, vulnerability, certification, financial/continuity, and scope changes; review and exit on trigger.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| vendor/party coverage | subprocessor and vendor-risk register tests | no complete assessment set | Vendor Risk | one dated package per High/Medium vendor |
| security assurance | public statements marked to confirm | reports not obtained/reviewed | Security | report-scope/exceptions/CUEC review |
| terms and privacy | provider terms and draft checklists | executed contracts/DPAs absent or incomplete | Legal/Privacy | signed terms and flow-down matrix |
| configuration | code/provider paths | target account settings/regions/access unverified | System owner | configuration acceptance test |
| continuity and exit | recovery/export designs | vendor failure/exit exercise absent | Operations | tabletop and deletion/export proof |

## Claim ceiling and activation blockers

Permitted: “Semester has a risk-tiered review method and controlled vendor inventory.” Prohibited: assessed/approved vendor, verified SOC/ISO scope, secure vendor, signed DPA, tested continuity, or completed deletion without evidence. Blocks: named reviewers/backups, current primary evidence, contract/privacy review, target configuration, remediation/risk acceptance, customer requirements, continuity/exit, monitoring, expiry, and activation record.
