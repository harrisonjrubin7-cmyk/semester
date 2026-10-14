# ADR-016: RLS identity comes from auth.uid()
- **Status:** Accepted · **Date:** 2026-10-13 · **Owner:** security owner
- **Decision:** Policies derive actor and tenant from the verified JWT (`auth.uid()` → active membership → grants). Never from `current_setting('app.current_*')`.
- **Why:** Session settings are client-settable on reachable connections, and `set_config(..., true)` outside a transaction is lost after one statement.
- **Evidence:** EVD-RDY-SEC-001.
