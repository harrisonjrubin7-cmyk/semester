# P1-02: emit_domain_event RPC — Completed and Merged

**Completed**: emit_domain_event RPC merged to main (commit 84c64743).

**What changed**: 
- Single SQL writer with idempotent design via SHA256 payload hashing
- PII/secrets detection via recursive payload_denied_key() scanning
- Enables event sourcing with CQRS pattern

**Why**: Foundation for domain event projection and CQRS queries; prevents accidental PII in events.

**Next**: P1-03 — implement claim/complete/fail/replay RPCs + retention sweep. User confirmed readiness to proceed.

**Status**: Ready to start P1-03 implementation immediately.
