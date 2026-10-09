-- Keep registration-readiness check constraints stable across pg_dump and
-- pg_restore. PostgreSQL expands BETWEEN in a stored check expression, and a
-- dump/restore can regroup the expanded comparisons. Use the equivalent
-- explicit inclusive bounds so pg_get_constraintdef() is deterministic.

alter table private.registration_readiness_evaluations
  drop constraint if exists registration_readiness_evaluations_id_check,
  add constraint registration_readiness_evaluations_id_check check (
    length(id) >= 1 and length(id) <= 200),
  drop constraint if exists registration_readiness_evaluations_subject_id_check,
  add constraint registration_readiness_evaluations_subject_id_check check (
    length(subject_id) >= 1 and length(subject_id) <= 200),
  drop constraint if exists registration_readiness_evaluations_term_id_check,
  add constraint registration_readiness_evaluations_term_id_check check (
    length(term_id) >= 1 and length(term_id) <= 200),
  drop constraint if exists registration_readiness_evaluations_requested_by_check,
  add constraint registration_readiness_evaluations_requested_by_check check (
    length(requested_by) >= 1 and length(requested_by) <= 200);

alter table private.registration_readiness_tasks
  drop constraint if exists registration_readiness_tasks_task_id_check,
  add constraint registration_readiness_tasks_task_id_check check (
    length(task_id) >= 1 and length(task_id) <= 300);

alter table private.registration_readiness_receipts
  drop constraint if exists registration_readiness_receipts_idempotency_key_check,
  add constraint registration_readiness_receipts_idempotency_key_check check (
    length(idempotency_key) >= 1 and length(idempotency_key) <= 300),
  drop constraint if exists registration_readiness_receipts_fingerprint_check,
  add constraint registration_readiness_receipts_fingerprint_check check (
    length(fingerprint) >= 1 and length(fingerprint) <= 500);
