# Semester maturity registries

Machine-readable form of the maturity program (source: `continue_12`). Every
file here is **specified, not enforced**: no CI check reads these yet, and no
capability is marked activated because of them.

| File | Covers |
| --- | --- |
| `maturity/capability-maturity.yaml` | Six facts that define "built"; what each status may and may not claim |
| `platform/pillar-owners.yaml` | Twelve shared pillars; owner and certification where the source names them |
| `connectors/connector-certification.yaml` | Sandbox → validated → pilot-approved → reusable gates |
| `connectors/SIS-READINESS-001.yaml` | Connector passport for the readiness source (passport only, not certified) |
| `portfolio/capability-intake.yaml` | Intake questions, rejection conditions, portfolio lanes |
| `portfolio/domain-entry-criteria.yaml` | Prerequisites, 1–5 scoring factors, decision outcomes |
| `developer/api-application.yaml` | Example partner application with prohibited scopes |

Companion docs (outside this folder): `docs/strategy/platform-tiers.yaml`,
`docs/strategy/next-50-actions.md`, `docs/engineering/contract-lab.yaml`,
`docs/data/read-model-standard.yaml`, `docs/operations/operations-os-roadmap.yaml`,
`docs/finance/native-finance-sequence.yaml`, `docs/platform/developer-platform-roadmap.yaml`,
`docs/company/company-os-standard.yaml`, `docs/company/board-packet-standard.yaml`.

The ship and launch procedure is `operations/SHIP_PROGRAM_RUNBOOK.md`, which
already exists on `main` and is not duplicated here.

## Open gaps

- Six of twelve pillars have no owner or certification in the source. Assign them before relying on the pillar.
- `SIS-READINESS-001` has no certification level reached; it is at most `sandbox`.
- The contract-lab and read-model TypeScript shapes from the source are not included, since they belong in the app after a contract review.
- Nothing has been deployed. Launch and deploy need an approved target, which this change does not establish.
