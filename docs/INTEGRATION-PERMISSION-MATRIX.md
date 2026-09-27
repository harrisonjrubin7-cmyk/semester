# Integration permission matrix

Capabilities are held through `role_grants` over a scope and checked by `private.has_capability`. "School" means
the grant's `scope_kind = 'school'` and `scope_id` is the row's `tenant_id`.

## Capabilities added

| Capability | Held by (scope) | Allows |
| --- | --- | --- |
| `integration:view` | `integration_admin`, `university_admin` (school) | Read connections (not the credential column), scopes, mappings, runs, errors, webhook events, dead letters, snapshots; tenant-wide T0/T1 canonical references |
| `integration:configure` | `integration_admin` (school) | Insert/update connection configuration columns; propose, change (until approved) and withdraw scopes; manage mappings |
| `integration:approve` | `university_admin` (school) | `integration_approve_connection`, `integration_approve_scope` — never for a connection they own |
| `integration:sync` | `integration_admin` (school) | `integration_set_paused` |
| `integration:replay` | `integration_admin` (school) | `integration_request_replay` (request only; refused under a kill switch) |
| `killswitch:engage` | `university_admin` (school); `incident_responder` (platform) | Engage/release a school switch; the platform grant engages global switches |

Existing capabilities used: `tenant:configure` (tighten classification rules; tenant flag rows), `audit:read`
(read `tenant_policy_audit_event`).

## By role and table

✓ allowed · — refused · own = only rows about the caller

| Table / action | Student | Faculty / advisor / staff | Integration admin | University admin | Incident responder | Other school's admin |
| --- | --- | --- | --- | --- | --- | --- |
| `integration_connections` read | — | — | ✓ (no credential column) | ✓ (no credential column) | — | — |
| `integration_connections` insert/update config | — | — | ✓ | — | — | — |
| approve connection / scope | — | — | — | ✓ (not own) | — | — |
| pause / resume | — | — | ✓ | — | — | — |
| request replay | — | — | ✓ | — | — | — |
| `integration_scopes`, `_mappings` read | — | — | ✓ | ✓ | — | — |
| sync runs / errors / webhook events / dead letters read | — | — | ✓ | ✓ | — | — |
| sync runs / errors / events write | — | — | — (worker only) | — | — | — |
| `source_records` read | T0/T1 of own school | T0/T1 of own school | ✓ | ✓ | — | — |
| `source_freshness_events` read | own school | own school | ✓ | ✓ | — | — |
| `canonical_entity_references` — tenant-wide T0/T1 | ✓ own school | ✓ own school | ✓ | ✓ | — | — |
| `canonical_entity_references` — about a student | own | — | **—** | **—** | — | — |
| `feature_kill_switch` read | global + own school | global + own school | ✓ | ✓ | global | — |
| school kill switch engage | — | — | — | ✓ | — | — |
| global kill switch engage | — | — | — | — | ✓ | — |
| `data_classification_rules` read | global + own school | global + own school | ✓ | ✓ | global | — |
| tighten a class for the school | — | — | — | ✓ (`tenant:configure`) | — | — |
| loosen any class | — | — | — | — (refused by trigger/constraints) | — | — |
| `tenant_policy_audit_event` (integration rows) | — | — | — | ✓ (`audit:read`) | — | — |

Faculty, advisors and staff get course, program or assigned-student data through the feature that serves them
(e.g. a scoped course workspace), never through the integration tables.

Platform support has no default access to any of these tables. Access to a student's data goes through the
existing `support_access_grant` (student-created, time-boxed, audited).
