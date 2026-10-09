-- Cover the two composite foreign keys introduced by the durable registration
-- readiness store. Both child tables are queried and cascaded by tenant and
-- evaluation, so the foreign-key column order is also the useful lookup order.

create index if not exists registration_readiness_tasks_evaluation_fk
  on private.registration_readiness_tasks (tenant_id, evaluation_id);

create index if not exists registration_readiness_receipts_evaluation_fk
  on private.registration_readiness_receipts (tenant_id, evaluation_id);
