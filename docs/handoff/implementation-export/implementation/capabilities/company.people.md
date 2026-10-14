# company.people — People operations

Source-declared design contract, not current implementation proof.

routes: /company/people, /company/hiring
actors: people_admin, recruiter, manager
permissions: employee.edit, candidate.edit
records: people.employees, people.candidates, people.positions, people.training_records
commands: make_offer, onboard_employee, api.offboard_employee
events: employee.onboarded, employee.offboarded
screen_types: list, detail, edit, history

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
