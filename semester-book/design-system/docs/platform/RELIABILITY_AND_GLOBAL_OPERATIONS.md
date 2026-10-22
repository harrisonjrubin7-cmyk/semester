# Global reliability and operations

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Service catalog, critical journey map, SLIs and SLOs, error-budget policy (feature work slows when the budget is spent), release policy, incident command, status communications.
- Disaster recovery, backup/restore drills, load and capacity testing, dependency map, observability, tenant health, integration health, operations inbox, on-call matrix, RCA and corrective actions, release cohorts and kill switches.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `docs/operate/`, `ui_kits/ops/`, `ui_kits/architecture/ (lag simulator)` |
| Implementation state | Drafted: SLOs, error-budget policy, 10 alerts, 8 runbooks. No monitoring live. |
| Product owner | Engineering |
| Technical owner | Founder (on-call) |
| Risk owner | Founder |
| Success metrics | SLO attainment; Error budget remaining; Restore drill time; Incidents with postmortem in 5 days |
| Launch gate | Restore drill timed; alerts firing in staging |
| Next action | Wire error tracking, uptime checks and the SIS-lag alert in staging |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
