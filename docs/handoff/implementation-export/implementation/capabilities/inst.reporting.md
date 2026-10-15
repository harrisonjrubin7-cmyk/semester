# inst.reporting — Reporting

Source-declared design contract, not current implementation proof.

routes: /institution/reports
actors: institution_admin
permissions: report.run, report.export
records: analytics.datasets, analytics.reports
commands: run_report
events: report.generated
screen_types: list, reporting

## Acceptance
- authorized complete job loop
- tenant/object negative access
- expiry/revocation enforcement
- source authority and freshness
- approval target/payload/version binding
- idempotent durable command
- outbox replay/reconciliation
- seven data-region states
- manual accessibility review
- exact-target deployment and applicable authority acceptance

Reconcile existing code and authority before adding or applying schemas. Production activation disabled.
