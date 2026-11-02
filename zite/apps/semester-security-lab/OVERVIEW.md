# Semester Security Lab

A restricted, internal-only lab for Semester's security and platform team. It brings together the evidence behind Semester's security claims: JWT claim validation and the scope model, token-bucket rate limiting, tenant-isolation tests, PostgreSQL RLS audit findings, the rate-limit policy registry, and release gates.

Every run states its mode (simulation, sandbox, staging, or production observation). Simulations help people learn and design, but they can never satisfy a release gate. Go/Redis tests, the PostgreSQL audit, and the end-to-end isolation tests need an outside runner. Until one is connected, those runs are recorded as blocked and no results are made up. All data is synthetic.
