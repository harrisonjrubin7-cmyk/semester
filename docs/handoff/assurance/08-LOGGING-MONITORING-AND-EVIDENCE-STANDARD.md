# Logging, monitoring and evidence

**Write paths:** the security audit goes through `record_audit()` (013). FERPA disclosure records are separate (011, user DDL), and access audits never stand in for them.

## Rules
- **Logged data:**
  - Log decisions and the field categories released. Never log full payloads, raw JWTs, tokens, recommendation content or medical evidence.
  - Metadata keys are allow-listed.
- **Who and when:**
  - Keep the initiating actor when a background job does the work.
  - Distinguish authorization, URL issuance, delivery and confirmed retrieval.
- **Integrity:**
  - Write mutation audits and outbox events in the same transaction as the change.
  - Audit records can only be added, have their own access policy, and are exported to a separately protected store.
- **Failure:** if sensitive-access logging is down, the read fails closed.

**Signals to alert on:** spikes in denied access; rejected launches by reason code; failed or unknown AGS deliveries; webhook signature failures; export jobs; privileged-access grants; definer-function errors; unknown registration outcomes; reconciliation mismatches.

**Evidence register:** an immutable link for each test log, CI run, audit file, incident report and restore drill (`evidence-register.csv`).
