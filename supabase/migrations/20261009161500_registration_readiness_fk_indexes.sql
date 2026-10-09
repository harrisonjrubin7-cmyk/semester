-- Cover the two registration-readiness foreign keys added in 20261009160000.
--
-- The existing task index is partial (`where state = 'open'`), so it cannot
-- support every parent update/delete. The receipt uniqueness rule starts with
-- evaluation_id rather than tenant_id. These exact leading columns cover the
-- full child-row scans required by the composite foreign keys.

create index if not exists registration_readiness_tasks_by_evaluation
  on private.registration_readiness_tasks (tenant_id, evaluation_id);

create index if not exists registration_readiness_receipts_by_evaluation
  on private.registration_readiness_receipts (tenant_id, evaluation_id);
