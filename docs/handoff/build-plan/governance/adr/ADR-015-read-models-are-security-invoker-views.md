# ADR-015: Read models are security_invoker views
- **Status:** Accepted · **Date:** 2026-10-13 · **Owner:** security owner
- **Decision:** UI projections are plain views with `security_invoker = true`. No materialized views over RLS-protected tables.
- **Why:** Materialized views don't apply RLS; one would expose every student at every institution.
- **Evidence:** AT-RDY-010.
