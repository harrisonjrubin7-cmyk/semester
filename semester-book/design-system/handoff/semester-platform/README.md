# semester-platform

Database and API code for community, marketplace, ops and audit, built on the core Semester app (Next.js + Supabase).
Files end in .txt so they don't run in the design project. Strip the suffix when you copy them into the repo.

Install:
  cp supabase/migrations/*.sql.txt <repo>/supabase/migrations/ (rename to .sql)
  cp -r app lib tests <repo>/ (rename .ts.txt to .ts)
  npx supabase db reset && npm test

Status: written to the architecture guide. Not yet run, typechecked or tested; do that before you rely on it.

## Security hardening (Oct 2026)

migrations/050_security_hardening.sql.txt closes 11 findings from the review of 010–040 (2 critical/high: ops.staff self-insert as 'ceo', and moving a profile to another institution). tests/security.test.ts.txt proves each one. Apply 050 before any real data. Review: docs/secure/Platform Security Review.html in the design project.

migrations/060_command_functions.sql.txt: all community/market writes go through audited api.* functions (validation, rate limits, integrity filter, campus checks); storage policies for listing photos. Proven by tests/commands.test.ts.txt.

AI gateway: app/api/ai/route.ts.txt (auth → policy → gate → content scan → provider → audit), lib/ai/redact.ts.txt (blocks IDs, SSN, GPA, grades, transcripts, DOB, cards typed into prompts), migrations/070_ai_gateway.sql.txt (tenant policy, course rules, usage log with no prompt content), tests/ai-redteam.test.ts.txt (launch gate).

080_sources_storage_delegations: approved-source AI context, private buckets with path rules, audited delegations. middleware.security.ts.txt: CSP/HSTS/headers. .github/ci-security-job.yml.txt: secret scan, audit, guards, security tests.
