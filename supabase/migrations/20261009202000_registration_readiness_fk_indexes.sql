-- Cover the composite foreign keys added by the registration-readiness store.
--
-- The open-task index is partial, so it cannot help PostgreSQL prove that
-- every task row is safe when an evaluation is deleted. The receipt's unique
-- index begins with evaluation_id rather than tenant_id, so it cannot service
-- the tenant-scoped foreign-key lookup either. These full indexes keep both
-- parent-side checks from degrading into child-table scans.

create index if not exists registration_readiness_tasks_evaluation_fk
  on private.registration_readiness_tasks (tenant_id, evaluation_id);

create index if not exists registration_readiness_receipts_evaluation_fk
  on private.registration_readiness_receipts (tenant_id, evaluation_id);
