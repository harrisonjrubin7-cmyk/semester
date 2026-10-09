-- Keep the check-constraint definitions stable across pg_dump and pg_restore.
--
-- PostgreSQL expands `between` after it has already grouped a surrounding
-- AND/OR expression. pg_dump prints that stored grouping with parentheses;
-- restoring the printed expression flattens it, so pg_get_constraintdef()
-- changes even though the rule does not. The backup drill correctly refuses
-- that ambiguity. Spell the same inclusive bounds as explicit comparisons,
-- matching the earlier repair in 20260929040000_round_trip_stable_checks.sql.
--
-- Idempotent: each constraint is replaced by the same named definition.

alter table public.gradebook_schemes
  drop constraint if exists gradebook_schemes_categories_check,
  add constraint gradebook_schemes_categories_check check (
    jsonb_typeof(categories) = 'array'
    and jsonb_array_length(categories) >= 1
    and jsonb_array_length(categories) <= 30),
  drop constraint if exists gradebook_schemes_letters_check,
  add constraint gradebook_schemes_letters_check check (
    jsonb_typeof(letters) = 'array'
    and jsonb_array_length(letters) >= 1
    and jsonb_array_length(letters) <= 30);

alter table public.gradebook_items
  drop constraint if exists gradebook_items_line_item_check,
  add constraint gradebook_items_line_item_check check (
    line_item is null
    or (length(btrim(line_item)) >= 1 and length(btrim(line_item)) <= 500));

alter table public.productivity_task
  drop constraint if exists productivity_task_when_text_check,
  add constraint productivity_task_when_text_check check (
    when_text is null
    or (length(when_text) >= 1 and length(when_text) <= 40)),
  drop constraint if exists productivity_task_planned_from_check,
  add constraint productivity_task_planned_from_check check (
    planned_from is null
    or (length(planned_from) >= 1 and length(planned_from) <= 200));

alter table public.course_sources
  drop constraint if exists course_sources_filename_check,
  add constraint course_sources_filename_check check (
    length(filename) >= 1
    and length(filename) <= 120
    and filename !~ '[\\/[:cntrl:]"<>|:*?]'),
  drop constraint if exists course_sources_scanner_version_check,
  add constraint course_sources_scanner_version_check check (
    scanner_version is null
    or (length(scanner_version) >= 1 and length(scanner_version) <= 120));

alter table public.course_materials
  drop constraint if exists course_materials_filename_check,
  add constraint course_materials_filename_check check (
    length(filename) >= 1
    and length(filename) <= 120
    and filename !~ '[\\/[:cntrl:]"<>|:*?]');

alter table public.course_source_corrections
  drop constraint if exists course_source_corrections_derived_record_id_check,
  add constraint course_source_corrections_derived_record_id_check check (
    length(derived_record_id) >= 1
    and length(derived_record_id) <= 200
    and derived_record_id !~ '[[:cntrl:]]'),
  drop constraint if exists course_source_corrections_field_name_check,
  add constraint course_source_corrections_field_name_check check (
    length(field_name) >= 1
    and length(field_name) <= 80
    and field_name ~ '^[A-Za-z][A-Za-z0-9_.:-]*$');

alter table private.course_material_retention_policy
  drop constraint if exists course_material_retention_policy_days_after_withdrawal_check,
  add constraint course_material_retention_policy_days_after_withdrawal_check check (
    (state = 'active' and days_after_withdrawal >= 0 and days_after_withdrawal <= 3650)
    or (state = 'withdrawn' and days_after_withdrawal is null));

alter table public.course_source_derived_snapshots
  drop constraint if exists course_source_derived_snapshots_extractor_version_check,
  add constraint course_source_derived_snapshots_extractor_version_check check (
    length(extractor_version) >= 1
    and length(extractor_version) <= 120
    and extractor_version !~ '[[:cntrl:]]');
