# Decision log

| Date | Decision | Why | Owner |
|---|---|---|---|
| 2026-10-12 | Pilot wording: "Signed paid pilot with Vanderbilt — launch Spring 2027, pending institutional activation" | Founder decision; repo GO-NO-GO still needs updating | Founder |
| 2026-10-13 | Keep one Vite app; reject the PDFs' 7-app Next.js/Turborepo split | One copy of every record path | Platform lead |
| 2026-10-13 | RLS identity from `auth.uid()`, never `current_setting('app.current_*')` | Client-settable; lost outside a transaction | Security owner |
| 2026-10-13 | Proposed tables live in `semester_core` until reconciled with the repo's `public` schema | Avoid colliding with ~233 existing migrations | Data platform lead |
| 2026-10-13 | Read models are `security_invoker` views, never materialized views | Materialized views bypass RLS | Security owner |
| 2026-10-13 | Registration readiness is the first pilot wedge; registration submission, grades, payments excluded | Proves the control patterns without official writes | Product owner |
| 2026-10-13 | Operational freshness budget 4 h for readiness inputs | source-freshness-policy.yaml | Integration lead |
