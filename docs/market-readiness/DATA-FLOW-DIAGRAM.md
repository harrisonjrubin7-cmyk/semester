# Pilot data-flow diagram

```text
Student/admin device
  ├─ manual/local workspace ───────────────┐
  ├─ authenticated request ──> Supabase ──┼─> tenant/resource policy ─> scoped records
  └─ optional approved source ─> gateway ─┘             │
                                                        ├─> minimal audit/security events
                                                        ├─> privacy-thresholded aggregates
                                                        └─> approved AI provider (feature-only, optional)

Support operator ─> time-limited capability ─> minimum diagnostic view ─> audited access
Rights/offboarding ─> verified request ─> export/revoke/delete/de-identify ─> completion record
```

Trust boundaries: browser/local storage; Supabase auth/database/storage/functions; institutional gateway; optional provider; support/trust room. Every customer must replace this logical diagram with a field-level map naming source, purpose, authority, classification, tenant/resource key, destination, retention, deletion, encryption, owner and subprocessor. Demo/sandbox data is synthetic and structurally separate from education records.
