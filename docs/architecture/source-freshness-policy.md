# Source freshness policy

Status: specified for the registration-readiness pilot.

Freshness is product behaviour, not only an integration-health metric. Every
source-backed screen states how old its data is, and an action that depends on
stale data does not produce a definitive answer.

## Freshness classes

```yaml
freshness_classes:
  real_time:
    maximum_age: 5 minutes
    examples: [access_revocations, active_holds_near_deadline]
  operational:
    maximum_age: 4 hours
    examples: [readiness_inputs, registration_status]
  daily:
    maximum_age: 30 hours
    examples: [degree_audit_projection, campus_service_data]
  reference:
    maximum_age: 30 days
    examples: [catalog_descriptions, institutional_contacts]
```

## Display rules

Copy is fixed text with placeholders; do not paraphrase it per screen.

```yaml
display_rules:
  current:
    copy: "Current as of {observed_at}."
  updating:
    copy: "Updating from {source_system}. Some details may change."
  stale:
    copy: "{source_system} has not updated since {observed_at}. Do not rely on this figure yet."
  failed:
    copy: "We could not refresh this source. Your existing record has not been changed."
  unknown:
    copy: "The source status is unknown. Check with the responsible office."
```

## Action rules

```yaml
action_rules:
  readiness_evaluation:
    current: allow
    updating: allow_with_notice
    stale: allow_with_review_result_only
    failed: block_definitive_result
    unknown: block_definitive_result
```

- `allow_with_review_result_only` returns a result labelled as needing review; it must not read as ready.
- `block_definitive_result` returns `SOURCE_STALE` (see `docs/contracts/api.openapi.yaml`) with a safe next action.
- Freshness is computed from `observed_at` on the normalized source record, never from the time a page was rendered.

## Related controls

- `CTL-SRC-STATUS-UI`: the source status component renders every state above.
- `CTL-SRC-TIMEOUT-TEST`: tests cover source timeouts and stale-source responses.
- `CTL-FRESH-POLICY`: the policy above is the single source of these thresholds.
