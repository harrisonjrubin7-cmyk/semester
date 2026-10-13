# Authority model

Status: specified for the registration-readiness pilot. Machine-checked where
noted; the checks live in `scripts/validate-pilot-artifacts.mjs`.

Every record needs three answers: who owns it, who decides it, and which source
outranks it. Semester is not the official gradebook, registrar, or payment
system. It shows what the institution's systems say, labelled by source, and
records what Semester itself derives.

## Precedence

Highest authority first:

```yaml
authority_precedence:
  - institution_verified
  - connected
  - student_entered
  - estimated
  - ai_assisted
  - needs_review
```

## Rules

- **AUTH-001** A lower-authority source cannot overwrite a higher-authority record.
- **AUTH-002** A stale authoritative source is displayed as stale; it is not silently replaced.
- **AUTH-003** Student-entered information may supplement but cannot amend institutional data.
- **AUTH-004** AI-generated content is a draft and cannot become authoritative without a human decision.
- **AUTH-005** An unresolved authority conflict becomes `needs_review` and creates an audit event.
- **AUTH-006** Every source-backed claim rendered to a student shows a source label and freshness.

## Record authorities

```yaml
record_authorities:
  grade_entry:
    authoritative_owner: institution
    authoritative_system: SIS
    semester_role: draft_and_workflow_layer
    write_rule: >-
      Faculty may draft; registrar-approved release and SIS sync establish the
      official value.
  registration_request:
    authoritative_owner: institution
    authoritative_system: registrar_SIS
    semester_role: governed_request_and_receipt_layer
    write_rule: >-
      Semester may record a request; it must not state enrollment until
      authoritative confirmation arrives from the registrar's system.
  readiness_case:
    authoritative_owner: semester
    authoritative_inputs:
      - SIS_holds
      - time_ticket_system
      - prerequisite_record
      - institutional_policy
    write_rule: >-
      Semester derives a reviewable readiness state and preserves source
      evidence for every input.
```

## Consequences for the pilot

- A readiness result is never an enrollment status. The readiness schema has no enrollment field (control `CTL-NO-ENROLL-SCHEMA`).
- Staff may not replace a SIS value in Semester. Discrepancies become reconciliation items.
- Override requests are recorded and routed to a different actor; the requester cannot approve their own override.
