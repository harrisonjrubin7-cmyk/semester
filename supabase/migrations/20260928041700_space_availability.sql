-- Room availability as a canonical entity.
--
-- `space_availability` is a study space's free and busy slots: the space, a
-- start, an end and free/busy — tenant-wide, T0, and never who holds a busy
-- slot. It needs to be a mapping target, and `integration_mappings` checks its
-- canonical_entity_type against a closed list, so the list gains it.
-- `canonical_entity_references` checks only length and needs nothing.
--
-- Booking on a student's behalf is not built. `writeback.space_booking`
-- (lib/flags.ts) is high-risk and off, and nothing in the database accepts a
-- booking; "Book" opens the school's own page.

alter table public.integration_mappings
  drop constraint if exists integration_mappings_canonical_entity_type_check;
alter table public.integration_mappings
  add constraint integration_mappings_canonical_entity_type_check check (canonical_entity_type in (
    'institution', 'campus', 'college', 'school', 'program', 'term', 'course',
    'course_section', 'academic_requirement', 'student_program', 'enrollment',
    'registration_window', 'registration_hold', 'course_catalog_entry',
    'course_policy', 'assignment', 'appointment', 'referral', 'opportunity',
    'job', 'internship', 'research_opportunity', 'organization', 'event',
    'service', 'resource', 'study_space', 'library_source', 'calendar_event',
    'notification', 'person_reference', 'lms_context', 'space_availability'));

-- Rolling back: re-add the constraint without 'space_availability', after
-- deleting any mapping that targets it.
