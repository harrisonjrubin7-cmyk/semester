# P1: Event Sourcing & CQRS

## P1-02: emit_domain_event RPC (merged)

**Pattern**: Idempotent single-writer RPC with payload validation and PII protection.

- `emit_domain_event(aggregate_id, event_id, payload)` — idempotent via SHA256 hash + ON CONFLICT
- `payload_hash` validates struct (char(64) SHA256)
- `payload_denied_key()` recursively scans nested JSON for secrets (password, token, secret, api_key, etc.) — case-insensitive, forbids PII in payloads
- Service-role-only RLS (no client-facing access)
- Four columns: event_id (uuid), aggregate_id (uuid), payload_hash, payload (jsonb)

**P1-03 ready**: claim/complete/fail/replay RPCs depend on this event table; retention sweep will clean old events per policy.
