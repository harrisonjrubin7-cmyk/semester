-- Cover both composite foreign keys introduced by the registration-readiness
-- store. The leading tenant column keeps tenant-scoped lookups selective, and
-- the complete key lets PostgreSQL validate/delete one evaluation without
-- scanning every task or receipt in the tenant.

create index if not exists registration_readiness_tasks_evaluation_fk
  on private.registration_readiness_tasks (tenant_id, evaluation_id);

create index if not exists registration_readiness_receipts_evaluation_fk
  on private.registration_readiness_receipts (tenant_id, evaluation_id);
