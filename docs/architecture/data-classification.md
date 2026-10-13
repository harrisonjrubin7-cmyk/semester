# Data classification

Status: specified. This catalogue must exist before any institutional data is
ingested. Every table, field, log line and export names a class.

## Classes

```yaml
classes:
  public:
    examples: [public_course_catalog, published_events]
    encryption: standard
    access: public_or_tenant_public
  internal:
    examples: [feature_flags, operations_metrics]
    encryption: standard
    access: authenticated_and_granted
  confidential:
    examples: [student_tasks, advising_notes, support_cases]
    encryption: standard
    access: least_privilege_RLS
    audit: read_and_write_for_sensitive_views
  restricted:
    examples: [grades, financial_data, accommodation_references, access_tokens]
    encryption: enhanced
    access: explicit_capability_and_policy_allow
    audit: all_reads_and_writes
    export: approval_required
    AI: prohibited_unless_explicitly_approved_and_deidentified
```

## Handling rules

- A new field defaults to `confidential` until a reviewer assigns a class.
- Holds, time tickets and registrar decisions about a student are `confidential`; accommodation references are `restricted`.
- Raw provider payloads are stored only under the approved retention period and at the class of their most sensitive field.
- Logs and analytics events carry identifiers, never `restricted` values.
- Export of `restricted` data requires approval and is audited (`export.approved`, `export.requested`).

Enforcement: RLS policies per table (`CTL-RLS`), the policy gate (`CTL-POLICY-GATE`), and the role-scope test suite (`CTL-ROLE-SCOPE-TEST`).
