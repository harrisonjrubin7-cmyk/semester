# Preserve canonical stages; add a reporting view
The repository CapabilityRecord has key/name/domain/workspace/phase/owner/risk/data_classification/roles/systems/routes/commands/events/maturity/evidence. The source has id/workspace/area/routes/actors/permissions/records/commands/events/screens/design.

Safe mappings: id → proposed alias, area → provisional display name, routes/commands/events → source references. Do not assume source id equals canonical capability key. A human-reviewed alias mapping links edu.registration to existing registration.readiness only after semantic verification.
Unsafe mappings: actors → actual role grants; records → deployed systems; design ref → approved designed stage; catalog function → working API; prototype route → app route. Require evidence.

Keep repository ten stages authoritative. Proposed six-fact report:
- designed: accepted design evidence for exact capability and version.
- implemented: relevant schema/policies/api/user_interface plus implementation reconciliation; not a filename count.
- tested: relevant unit/integration/E2E evidence on exact candidate; no substitute from design simulations.
- deployed: verified deployment for exact environment, SHA and configuration; staged is not production.
- institution_authorized: separate customer authority for scope/tenant/data mode; may be N/A only where formally justified.
- production_enabled: exact production scope activated with valid approvals and monitored operation, not merely deployed.
Unknown is not false and not approval. Additive reporting must never mutate release decisions. Mapping requirements are proposals pending canonical review.
