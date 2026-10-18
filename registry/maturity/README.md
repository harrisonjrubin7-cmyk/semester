# Semester maturity registries

Machine-readable form of the maturity program (source: `continue_12`). Every
file here is **specified, not enforced**: no CI check reads these yet, and no
capability is marked activated because of them.

Paths in the table are relative to `registry/`. This index is separate from the component-passport index in `registry/README.md`.

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

- Six of twelve pillars have no owner in the source. Assign them before relying on the pillar.
- Twelve of twelve pillars have no certification record. Six carry a `certification_target` ID that is not yet backed by a record.
- `SIS-READINESS-001` has no certification level reached; it is at most `sandbox`.
- The contract-lab and read-model TypeScript shapes from the source are not included, since they belong in the app after a contract review.
- Nothing has been deployed. Launch and deploy need an approved target, which this change does not establish.
