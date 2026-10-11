-- Make five equivalent CHECK expressions stable across pg_dump and restore.
--
-- PostgreSQL expands `between` into a nested boolean expression in the live
-- parse tree. pg_dump prints that expansion as SQL, and parsing the dump then
-- flattens the same AND terms. The constraint still enforces the same rule,
-- but its definition fingerprint changes after a restore. Recreate the five
-- affected checks with their inclusive bounds written explicitly so the live
-- and restored parse trees have the same canonical shape.

begin;

alter table public.course_materials
  drop constraint course_materials_filename_check,
  add constraint course_materials_filename_check check (
    length(filename) >= 1
    and length(filename) <= 120
    and filename !~ '[\\/[:cntrl:]"<>|:*?]');

alter table public.course_source_corrections
  drop constraint course_source_corrections_derived_record_id_check,
  add constraint course_source_corrections_derived_record_id_check check (
    length(derived_record_id) >= 1
    and length(derived_record_id) <= 200
    and derived_record_id !~ '[[:cntrl:]]'),
  drop constraint course_source_corrections_field_name_check,
  add constraint course_source_corrections_field_name_check check (
    length(field_name) >= 1
    and length(field_name) <= 80
    and field_name ~ '^[A-Za-z][A-Za-z0-9_.:-]*$');

alter table public.course_source_derived_snapshots
  drop constraint course_source_derived_snapshots_extractor_version_check,
  add constraint course_source_derived_snapshots_extractor_version_check check (
    length(extractor_version) >= 1
    and length(extractor_version) <= 120
    and extractor_version !~ '[[:cntrl:]]');

alter table public.course_sources
  drop constraint course_sources_filename_check,
  add constraint course_sources_filename_check check (
    length(filename) >= 1
    and length(filename) <= 120
    and filename !~ '[\\/[:cntrl:]"<>|:*?]');

commit;
