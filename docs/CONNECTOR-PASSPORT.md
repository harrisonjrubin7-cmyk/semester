# Connector passport

**Status: specified, not implemented.** A connector passport is the record that makes an integration a managed product rather than a one-off. Each active connector needs one before it moves past pilot. The rules for connections, credentials, and health are in [`INTEGRATION-CONTROL-PLANE.md`](./INTEGRATION-CONTROL-PLANE.md). This document adds the lifecycle and the passport fields.

## Lifecycle

A connector moves through these states. Only the transitions shown are allowed.

```
proposed → evaluated → designed → sandbox_verified → pilot_certified → production_active
                                                                          ↕
                                                        degraded ⇄ paused
                                                                          ↓
                                                                       retired
```

- `pilot_certified` requires every item in the checklist below.
- `degraded` and `paused` are reachable from `production_active`. Both keep the connector's data and credentials in place so it can resume.
- `retired` is final. Credentials are revoked and mapping data is handled under the retention rules in [`DATA-PORTABILITY-AND-OFFBOARDING.md`](./DATA-PORTABILITY-AND-OFFBOARDING.md).

### Required for `pilot_certified`

- Named provider and owner.
- Approved data minimization: the fields pulled are listed and justified.
- Source-authority record: which system is authoritative for each field.
- Versioned mapping.
- Authentication and secret management, using the vault rules in `INTEGRATION-CONTROL-PLANE.md`.
- Freshness behavior: what the product shows when source data is stale.
- Duplicate and replay handling.
- Invalid-payload quarantine.
- Reconciliation process.
- Disablement path: a documented way to turn the connector off without losing data.
- Monitoring and alerts.
- Incident contacts.

### Change triggers

A change to any of these reopens the connector for review before it goes live again:

- Provider schema change.
- Authentication change.
- New data element.
- New authority use.
- Mapping change.
- Revised freshness window.
- Security finding.
- Repeated operational failure.

## Passport fields

One passport per connector, stored as a versioned YAML file. Example, filled for the student information system adapter (state values are illustrative until the pilot is certified):

```yaml
# registry/integrations/SIS-001.yaml
connector:
  id: SIS-001
  name: Student information system adapter
  owner:
    semester: integration_owner
    institution: technical_owner

  authority:
    source_system: institution_SIS
    institution_owner: registrar
    semester_role: synchronized_projection   # Semester never becomes the source of record

  data_classes:
    - restricted_institutional
    - operational_metadata

  capabilities_supported:
    - registration_readiness
    - degree_planning
    - advising_context

  states:
    implementation: pilot_certified
    health: pending_live_observation

  reliability:
    delivery: pull_or_event_driven_as_approved
    deduplication_key: provider_event_id_or_source_version
    invalid_payload_behavior: quarantine
    stale_behavior: block_definitive_derived_outcomes
    recovery: replay_from_safe_checkpoint

  controls:
    - source_authority_register
    - mapping_contract
    - connector_tests
    - replay_test
    - reconciliation_runbook
    - disablement_drill
```

`stale_behavior: block_definitive_derived_outcomes` means that when source data is stale, Semester shows the last known value with its age and does not produce a definitive result such as "ready to register".

## Open items

- No `registry/integrations/` directory exists. Passports are not yet generated or validated by a test.
- The SIS-001 values above are the target, not a verified current state. Confirm each against the live connector before recording it.
- Replay and disablement drills have not been run for any connector.
