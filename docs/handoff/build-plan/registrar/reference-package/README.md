# Registrar reference package
New isolated PostgreSQL schema and proposed enrollment REST contract; not a production patch.
001 must run only after review on a fresh approved test database. It fails if registrar_ref already exists. No synthetic/live data, IAM grants, permissive RLS policies, API handlers or enrollment execution function included. Applying DDL does not enable the product.
002 is read-only reporting; zero rows for capacity discrepancies and zero invalid grade links are necessary, not sufficient. RLS negative tests must use real non-bypass roles. Schema owner/superuser checks do not prove isolation.
No psql/PostgreSQL server or OpenAPI conformance runner used here. Generated files have been parsed as JSON only. No deployment or live validation performed.
Reference schema omits reserved/shared capacity, multiple academic careers, full policy engine, audited corrections and degree models. Integrate against inspected existing migrations, do not create a parallel production schema.
Cutover: source snapshot/checkpoint; additive schema; import dependency order; reconcile; shadow; catch up; drain/fence old writer; final checkpoint; approve authority; enable new writer; verify; monitor. Without reliable CDC/fencing, use an approved write pause. Never promise zero write interruption without tested handover.
Recovery: pre-handover return to legacy; post-handover preserve new writes and replay under approved mapping or forward repair. Do not DROP/TRUNCATE or restore away legitimate writes. No destructive down migration supplied.
