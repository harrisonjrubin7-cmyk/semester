# ADR-014: Readiness is not enrollment
- **Status:** Accepted · **Date:** 2026-10-13 · **Owners:** registrar product owner, platform owner, Vanderbilt registrar owner
- **Decision:** Readiness is a derived, source-aware planning state. Semester never represents a student as enrolled unless an authorized institutional source returns an enrollment outcome.
- **Why:** Readiness depends on inputs that can be stale, incomplete or pending review. Enrollment is an official institutional decision.
- **Consequences:** Receipts, UI copy, APIs, events, support macros, dashboards and training all keep the two apart. The readiness schema has no enrollment status; `readiness_receipts.statement` must contain "not enrollment" (check constraint).
- **Evidence:** EVD-RDY-SRC-001, institution copy approval, reconciliation drill, JNY-RDY-001.
