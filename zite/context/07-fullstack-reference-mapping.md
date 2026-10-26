# Full-stack reference → Zite mapping

The "Semester full-stack architecture" brief (PostgreSQL schema + RLS, Vite portal, API gateway YAML, tuition workflow YAML) is a **reference design**, not executed infrastructure. Semester stays in Zite.

| Reference item | In Zite today | Status |
|---|---|---|
| registrar.terms | Academic Terms table | Built |
| registrar.sections (capacity, version, state) | Sections + Capacity, Section State, Record Version | Built |
| registrar.registration_requests (idempotency key) | Registration Requests (Request Key) | Built; uniqueness checked in workflow, not DB constraint |
| registrar.enrollments | Enrollments (status mixes request/waitlist — to split later) | Partial |
| registrar.released_grades (revision, supersedes) | Official Grade Records + Grade Change Requests | Tables built, workflow pending |
| student_holds | Student Holds | Built, enforced on submit |
| Course/program versions | Not built | Pending |
| PostgreSQL RLS / FORCE RLS / semester_api role | Not available — Zite enforces via app access + server-side checks in each workflow (requireAccess, tenantScope) | Not RLS; do not label as RLS |
| SELECT … FOR UPDATE seat claim | Not available — registrarDecide uses version + count check (optimistic, not atomic) | Gap: needs transactional service for real capacity guarantees |
| API gateway routes | Zite endpoints in apps/semester/src/api (registration, registrarDecide) | Mapped |
| TanStack Query keys with user/tenant | Portal uses its own reload state | Pending review |
| Tuition payment + webhook workflows | Not built; Stripe connected, test mode only | Pending |
