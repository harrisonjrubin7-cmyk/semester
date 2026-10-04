/**
 * The ten migration domains, each as a declaration the engine runs and the
 * workbook is generated from.
 *
 * One source of truth, three readers: `engine.ts` executes the invariants,
 * `scope.ts` refuses fields the platform floor does not allow, and
 * `workbook.ts` renders each domain into the document an institution signs.
 * A workbook written by hand beside this would drift from what is actually
 * checked, which is the failure the repository's other registers were each
 * built to prevent.
 *
 * What is *not* here, on purpose: accommodations, health and counseling,
 * conduct, government identifiers and card or bank data. The platform floor
 * (`integration/classification.ts`, T4 and above) sends them to no destination,
 * so a migration cannot be the way they get in. Each is listed under
 * `excluded` with what happens to it instead, because an omission nobody wrote
 * down looks, in a year, like a loss.
 *
 * Severity is chosen by what a wrong record does to a person, not by how hard
 * it is to detect. A grade, a balance, a guardian's consent and a role grant
 * are `critical`: one wrong row is a harm, so none is acceptable.
 */
import type { DataClass } from '../integration/classification.ts';
import type { DataDomain } from './types.ts';
import type { DomainSpec, EntitySpec, ExcludedSpec, FieldSpec } from './engine-types.ts';

const F = (name: string, cls: DataClass = 'T3', extra: Partial<FieldSpec> = {}): FieldSpec => ({ name, class: cls, ...extra });
const E = (name: string, label: string, key: readonly string[], fields: readonly FieldSpec[]): EntitySpec => ({ name, label, key, fields });

/* ── Entities another domain owns, referenced for link checks ──────────── */

const PERSON_REF = E('person', 'A person (identity domain)', ['person_id'], [F('person_id')]);
const TERM_REF = E('term', 'An academic term (academic records domain)', ['term_id'], [F('term_id', 'T0')]);
const STUDENT_REF = E('student_record', 'A student record (academic records domain)', ['student_id'], [F('student_id'), F('person_id')]);
const SECTION_REF = E('section', 'A course section (courses domain)', ['section_id'], [F('section_id', 'T0'), F('capacity', 'T0')]);

/* ── What stays behind in every domain that could touch it ─────────────── */

const SENSITIVE: readonly ExcludedSpec[] = [
  {
    name: 'accommodation_records',
    class: 'T4',
    handling: 'Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting.',
  },
  {
    name: 'health_and_counseling_records',
    class: 'T4',
    handling: 'Not migrated. Remains with the health and counseling service under its own rules.',
  },
  {
    name: 'conduct_records',
    class: 'T4',
    handling: 'Not migrated. Remains with the conduct office; a hold may be migrated only as a registration hold with no reason attached.',
  },
];

/* ── 1. Identity ───────────────────────────────────────────────────────── */

const identity: DomainSpec = {
  id: 'identity',
  label: 'Identity',
  stakes: 'high',
  owner: 'Registrar and central IT (identity management)',
  sources: ['Identity provider or directory (LDAP, Azure AD, Okta)', 'SIS person table', 'Provisioning system (SCIM source)'],
  references: [],
  entities: [
    E('person', 'A person with a relationship to the institution', ['person_id'], [
      F('person_id'), F('legal_name'), F('preferred_name'), F('email'), F('date_of_birth'),
      F('status', 'T3', { required: true }), F('affiliation', 'T3', { required: true }), F('directory_suppressed', 'T3', { note: 'FERPA directory-information opt-out' }),
    ]),
    E('external_identity', 'A sign-in identity bound to a person', ['idp', 'subject'], [F('idp'), F('subject'), F('person_id', 'T3', { required: true })]),
    E('person_alias', 'A former name or email, in the order it applied', ['alias_id'], [F('alias_id'), F('person_id', 'T3', { required: true }), F('seq'), F('alias_kind'), F('alias_value'), F('valid_from')]),
    E('role_grant', 'A role a person holds, and where', ['grant_id'], [F('grant_id'), F('person_id', 'T3', { required: true }), F('role_scope', 'T3', { required: true }), F('granted_on'), F('expires_on')]),
  ],
  excluded: [
    { name: 'government_identifiers', class: 'T4', handling: 'Never migrated (national ID, SSN, passport). Semester keys on person_id and the institutional email.' },
    { name: 'authentication_secrets', class: 'T6', handling: 'Never exported or imported (password hashes, MFA seeds). People sign in again through the institution identity provider.' },
    { name: 'immigration_status', class: 'T4', handling: 'Not migrated. Remains with the international office.' },
  ],
  invariants: [
    { id: 'identity.person.crosswalk', kind: 'crosswalk', entity: 'person', gravity: 'critical' },
    { id: 'identity.person.preserved', kind: 'preserved', entity: 'person', fields: ['legal_name', 'preferred_name', 'email', 'date_of_birth', 'status', 'affiliation'], gravity: 'critical' },
    { id: 'identity.person.suppression', kind: 'preserved', entity: 'person', fields: ['directory_suppressed'], gravity: 'critical' },
    { id: 'identity.person.email_unique', kind: 'unique', entity: 'person', fields: ['email'], gravity: 'critical' },
    { id: 'identity.external_identity.crosswalk', kind: 'crosswalk', entity: 'external_identity', gravity: 'major' },
    { id: 'identity.external_identity.unique', kind: 'unique', entity: 'external_identity', fields: ['idp', 'subject'], gravity: 'critical' },
    { id: 'identity.external_identity.reference', kind: 'reference', entity: 'external_identity', field: 'person_id', to: 'person', gravity: 'critical' },
    { id: 'identity.external_identity.binding', kind: 'preserved', entity: 'external_identity', fields: [], links: [{ field: 'person_id', to: 'person' }], gravity: 'critical' },
    { id: 'identity.alias.crosswalk', kind: 'crosswalk', entity: 'person_alias', gravity: 'major' },
    { id: 'identity.alias.history', kind: 'history', entity: 'person_alias', subjectEntity: 'person', subject: 'person_id', seq: 'seq', value: 'alias_value', gravity: 'major' },
    { id: 'identity.role_grant.crosswalk', kind: 'crosswalk', entity: 'role_grant', gravity: 'major' },
    { id: 'identity.role_grant.access', kind: 'permission', entity: 'role_grant', principal: 'person_id', principalEntity: 'person', resource: 'role_scope', gravity: 'critical' },
    { id: 'identity.role_grant.expiry', kind: 'preserved', entity: 'role_grant', fields: ['expires_on'], compare: 'date', gravity: 'major' },
  ],
  cleansing: [
    'Normalize email to lower case and trim whitespace; record the count changed.',
    'Identify duplicate people (same name and date of birth, different identifiers) and list them for the registrar. Nothing is merged without an approved merge decision.',
    'Flag people with no active affiliation but an active role grant.',
    'Flag identities that bind one sign-in subject to two people.',
  ],
  transforms: [
    'Assign a stable Semester person key; write the source-to-target crosswalk.',
    'Map affiliation and status vocabularies through an approved lookup table; an unmapped value stops the run.',
    'Provision through the tenant SCIM path; unknown groups grant nothing.',
  ],
  acceptance: [
    'No two people were combined unless the registrar approved that merge by name.',
    'Every person who could sign in before can sign in now, bound to the same person; nobody can sign in as someone else.',
    'Nobody holds a role they did not hold in the source system; any role lost is listed and accepted.',
    'Every directory-information opt-out carried across exactly.',
  ],
};

/* ── 2. Academic records ───────────────────────────────────────────────── */

const academicRecords: DomainSpec = {
  id: 'academic_records',
  label: 'Academic records',
  stakes: 'high',
  owner: 'Registrar',
  sources: ['Student information system (Banner, Colleague, PeopleSoft, Workday Student)', 'Transcript archive', 'Degree-audit system'],
  references: [PERSON_REF],
  entities: [
    E('term', 'An academic term', ['term_id'], [F('term_id', 'T0'), F('name', 'T0'), F('starts_on', 'T0'), F('ends_on', 'T0'), F('status', 'T0')]),
    E('student_record', 'A student academic record', ['student_id'], [
      F('student_id'), F('person_id', 'T3', { required: true }), F('gpa', 'T3', { note: 'a stated figure; recomputed from results on both sides' }),
      F('credits_earned'), F('standing'), F('class_level'),
    ]),
    E('course_result', 'One attempt at one course by one student', ['result_id'], [
      F('result_id'), F('student_id', 'T3', { required: true }), F('term_id', 'T0', { required: true }), F('course_code', 'T0'), F('attempt'),
      F('credits'), F('grade'), F('grade_points'), F('status'), F('counts_in_gpa'), F('earned'),
    ]),
    E('grade_event', 'A recorded change to a grade, in sequence', ['event_id'], [F('event_id'), F('result_id', 'T3', { required: true }), F('seq'), F('grade'), F('changed_on'), F('change_code')]),
    E('record_access', 'Who may read or act on a student record', ['access_id'], [F('access_id'), F('student_id', 'T3', { required: true }), F('person_id', 'T3', { required: true }), F('level')]),
    E('student_program', 'A declared program of study', ['student_id', 'program_code'], [F('student_id', 'T3', { required: true }), F('program_code', 'T0'), F('catalog_year', 'T0'), F('status'), F('declared_on')]),
  ],
  excluded: [
    ...SENSITIVE,
    { name: 'free_text_advisor_notes', class: 'T3', handling: 'Not migrated by default: notes are not a structured record and cannot be validated. The incumbent archive remains the record.' },
  ],
  invariants: [
    { id: 'academic_records.term.crosswalk', kind: 'crosswalk', entity: 'term', gravity: 'major' },
    { id: 'academic_records.term.preserved', kind: 'preserved', entity: 'term', fields: ['name', 'status'], gravity: 'major' },
    { id: 'academic_records.term.dates', kind: 'preserved', entity: 'term', fields: ['starts_on', 'ends_on'], compare: 'date', gravity: 'major' },
    { id: 'academic_records.term.window', kind: 'temporal', entity: 'term', start: 'starts_on', end: 'ends_on', gravity: 'major' },
    { id: 'academic_records.student.crosswalk', kind: 'crosswalk', entity: 'student_record', gravity: 'critical' },
    { id: 'academic_records.student.preserved', kind: 'preserved', entity: 'student_record', fields: ['standing', 'class_level'], links: [{ field: 'person_id', to: 'person' }], gravity: 'critical' },
    { id: 'academic_records.student.gpa', kind: 'derived', entity: 'student_record', child: 'course_result', childSubject: 'student_id', value: 'grade_points', weight: 'credits', agg: 'weighted_mean', filter: { field: 'counts_in_gpa', in: ['true'] }, stated: 'gpa', tolerance: 0.005, gravity: 'critical' },
    { id: 'academic_records.student.credits', kind: 'derived', entity: 'student_record', child: 'course_result', childSubject: 'student_id', value: 'credits', agg: 'sum', filter: { field: 'earned', in: ['true'] }, stated: 'credits_earned', tolerance: 0, gravity: 'critical' },
    { id: 'academic_records.result.crosswalk', kind: 'crosswalk', entity: 'course_result', gravity: 'critical' },
    { id: 'academic_records.result.preserved', kind: 'preserved', entity: 'course_result', fields: ['course_code', 'attempt', 'credits', 'grade', 'grade_points', 'status', 'counts_in_gpa', 'earned'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'term_id', to: 'term' }], gravity: 'critical' },
    { id: 'academic_records.result.student', kind: 'reference', entity: 'course_result', field: 'student_id', to: 'student_record', gravity: 'critical' },
    { id: 'academic_records.result.term', kind: 'reference', entity: 'course_result', field: 'term_id', to: 'term', gravity: 'critical' },
    { id: 'academic_records.grade_event.crosswalk', kind: 'crosswalk', entity: 'grade_event', gravity: 'critical' },
    { id: 'academic_records.grade_event.history', kind: 'history', entity: 'grade_event', subjectEntity: 'course_result', subject: 'result_id', seq: 'seq', value: 'grade', current: 'grade', gravity: 'critical' },
    { id: 'academic_records.access.crosswalk', kind: 'crosswalk', entity: 'record_access', gravity: 'critical' },
    { id: 'academic_records.access.grant', kind: 'permission', entity: 'record_access', principal: 'person_id', principalEntity: 'person', resource: 'student_id', resourceEntity: 'student_record', gravity: 'critical' },
    { id: 'academic_records.program.crosswalk', kind: 'crosswalk', entity: 'student_program', gravity: 'major' },
    { id: 'academic_records.program.preserved', kind: 'preserved', entity: 'student_program', fields: ['catalog_year', 'status'], links: [{ field: 'student_id', to: 'student_record' }], gravity: 'major' },
  ],
  cleansing: [
    'Record the source system\'s own stated GPA and credits next to the recomputed figures; list every student where they already disagree. These are inherited findings, never silently corrected.',
    'Resolve letter grades to the institution\'s grade table; an unmapped grade stops the run.',
    'Flag results whose term falls outside the student\'s enrollment dates.',
    'Preserve withdrawn, incomplete and repeated attempts as attempts; do not collapse retakes.',
  ],
  transforms: [
    'Carry grade, grade points, credits and the counts-in-GPA and earned flags exactly; derive nothing.',
    'Load every grade-change event with its sequence; the current grade must equal the last event.',
    'Assign target keys; write the crosswalk for students, results, events and programs.',
  ],
  acceptance: [
    'Every student\'s GPA and earned credits, recomputed from their results, match the source to the tolerance, and no student\'s result belongs to a different student.',
    'Every grade change is present, in order, with the same values; the current grade is the last change.',
    'A sample of transcripts, drawn by the registrar and not by Semester, matches the incumbent transcript line for line.',
    'Grades and GPA moved only under a recorded scope approval; nothing else from the record moved.',
  ],
};

/* ── 3. Courses and catalog ────────────────────────────────────────────── */

const courses: DomainSpec = {
  id: 'courses',
  label: 'Courses and catalog',
  stakes: 'standard',
  owner: 'Registrar (catalog and scheduling)',
  sources: ['SIS catalog and schedule of classes', 'Curriculum management system'],
  references: [TERM_REF, PERSON_REF],
  entities: [
    E('course', 'A catalog course', ['course_code'], [F('course_code', 'T0'), F('title', 'T0'), F('credits', 'T0'), F('department', 'T0'), F('status', 'T0')]),
    E('section', 'A scheduled section of a course in a term', ['section_id'], [
      F('section_id', 'T0'), F('term_id', 'T0', { required: true }), F('course_code', 'T0', { required: true }), F('section_no', 'T0'), F('capacity', 'T0'),
      F('instructor_person_id', 'T1'), F('modality', 'T0'),
    ]),
    E('catalog_version', 'A past version of a catalog entry, in order', ['version_id'], [F('version_id', 'T0'), F('course_code', 'T0', { required: true }), F('seq', 'T0'), F('title', 'T0')]),
    E('section_editor', 'Who may edit a section, set capacity or override a prerequisite', ['grant_id'], [F('grant_id', 'T1'), F('person_id', 'T1', { required: true }), F('section_id', 'T0', { required: true })]),
    E('section_meeting', 'A recurring meeting of a section', ['meeting_id'], [F('meeting_id', 'T0'), F('section_id', 'T0', { required: true }), F('day', 'T0'), F('starts_at', 'T0'), F('ends_at', 'T0'), F('room', 'T0')]),
  ],
  excluded: [],
  invariants: [
    { id: 'courses.course.crosswalk', kind: 'crosswalk', entity: 'course', gravity: 'major' },
    { id: 'courses.course.unique', kind: 'unique', entity: 'course', fields: ['course_code'], gravity: 'major' },
    { id: 'courses.course.preserved', kind: 'preserved', entity: 'course', fields: ['title', 'department', 'status'], gravity: 'major' },
    { id: 'courses.course.credits', kind: 'preserved', entity: 'course', fields: ['credits'], compare: 'number', gravity: 'major' },
    { id: 'courses.section.crosswalk', kind: 'crosswalk', entity: 'section', gravity: 'major' },
    { id: 'courses.section.unique', kind: 'unique', entity: 'section', fields: ['term_id', 'course_code', 'section_no'], gravity: 'major' },
    { id: 'courses.section.course', kind: 'reference', entity: 'section', field: 'course_code', to: 'course', gravity: 'major' },
    { id: 'courses.section.preserved', kind: 'preserved', entity: 'section', fields: ['section_no', 'modality'], links: [{ field: 'term_id', to: 'term' }, { field: 'course_code', to: 'course' }, { field: 'instructor_person_id', to: 'person' }], gravity: 'major' },
    { id: 'courses.section.capacity', kind: 'preserved', entity: 'section', fields: ['capacity'], compare: 'number', gravity: 'major' },
    { id: 'courses.version.crosswalk', kind: 'crosswalk', entity: 'catalog_version', gravity: 'major' },
    { id: 'courses.version.history', kind: 'history', entity: 'catalog_version', subjectEntity: 'course', subject: 'course_code', seq: 'seq', value: 'title', gravity: 'major' },
    { id: 'courses.editor.crosswalk', kind: 'crosswalk', entity: 'section_editor', gravity: 'major' },
    { id: 'courses.editor.grant', kind: 'permission', entity: 'section_editor', principal: 'person_id', principalEntity: 'person', resource: 'section_id', resourceEntity: 'section', gravity: 'major' },
    { id: 'courses.meeting.crosswalk', kind: 'crosswalk', entity: 'section_meeting', gravity: 'major' },
    { id: 'courses.meeting.section', kind: 'reference', entity: 'section_meeting', field: 'section_id', to: 'section', gravity: 'major' },
    { id: 'courses.meeting.preserved', kind: 'preserved', entity: 'section_meeting', fields: ['day', 'starts_at', 'ends_at', 'room'], links: [{ field: 'section_id', to: 'section' }], gravity: 'major' },
    { id: 'courses.meeting.times', kind: 'temporal', entity: 'section_meeting', start: 'starts_at', end: 'ends_at', gravity: 'minor' },
  ],
  cleansing: [
    'Normalize subject and number casing; list courses whose code differs only by case or spacing.',
    'List sections with no meeting pattern (arranged, online) so absence is a recorded fact, not a gap.',
    'Flag cross-listed sections; decide one primary per cross-list before load.',
  ],
  transforms: [
    'Meeting days to the canonical 0–6 form and times to local 24-hour wall time; keep the source string in the lineage record.',
    'Credits to a number; keep the source text.',
  ],
  acceptance: [
    'Every section a student could register for in the source is present with the same course, term, capacity, meeting pattern and instructor.',
    'No course or section appears that the registrar did not publish.',
    'Every meeting pattern renders the same day and wall-clock time in the calendar as in the schedule of classes.',
  ],
};

/* ── 4. Learning content ───────────────────────────────────────────────── */

const learningContent: DomainSpec = {
  id: 'learning_content',
  label: 'Learning content',
  stakes: 'standard',
  owner: 'Provost\'s office / teaching and learning center, with each department',
  sources: ['LMS course exports (Common Cartridge, Canvas, Brightspace, Blackboard, Moodle)', 'Course repositories', 'Media platform'],
  references: [SECTION_REF, PERSON_REF],
  entities: [
    E('course_site', 'A course site in the learning platform', ['site_id'], [F('site_id', 'T1'), F('section_id', 'T0', { required: true }), F('title', 'T1'), F('published', 'T1'), F('points_total', 'T1', { note: 'a stated figure; recomputed from the assignments on both sides' })]),
    E('module', 'A unit of the course outline', ['module_id'], [F('module_id', 'T1'), F('site_id', 'T1', { required: true }), F('position', 'T1'), F('title', 'T1'), F('published', 'T1')]),
    E('content_item', 'A page, file, link or media item in a module', ['item_id'], [F('item_id', 'T1'), F('module_id', 'T1', { required: true }), F('position', 'T1'), F('kind', 'T1'), F('title', 'T1'), F('checksum', 'T1', { note: 'hash of the file bytes, taken at extraction' }), F('published', 'T1')]),
    E('content_revision', 'A past revision of a content item, in order', ['revision_id'], [F('revision_id', 'T1'), F('item_id', 'T1', { required: true }), F('seq', 'T1'), F('checksum', 'T1')]),
    E('site_role', 'The role a person holds in a course site', ['role_id'], [F('role_id', 'T1'), F('person_id', 'T1', { required: true }), F('site_id', 'T1', { required: true }), F('role', 'T1')]),
    E('assignment', 'An assignment and its dates', ['assignment_id'], [F('assignment_id', 'T1'), F('site_id', 'T1', { required: true }), F('title', 'T1'), F('opens_at', 'T1'), F('due_at', 'T1'), F('points', 'T1'), F('published', 'T1')]),
  ],
  excluded: [
    { name: 'student_submissions', class: 'T3', handling: 'Not part of default scope. The platform never ingests submissions by default. Moving them is a separate, named scope approval by the registrar and the Semester privacy lead, validated with history checks; until then the incumbent archive remains the record.' },
    { name: 'gradebook_entries', class: 'T3', handling: 'Same as submissions: named approval required, never implicit in a content migration.' },
    { name: 'instructor_notes', class: 'T3', handling: 'Not migrated.' },
  ],
  invariants: [
    { id: 'learning_content.site.crosswalk', kind: 'crosswalk', entity: 'course_site', gravity: 'major' },
    { id: 'learning_content.site.preserved', kind: 'preserved', entity: 'course_site', fields: ['title', 'published'], links: [{ field: 'section_id', to: 'section' }], gravity: 'major' },
    { id: 'learning_content.module.crosswalk', kind: 'crosswalk', entity: 'module', gravity: 'major' },
    { id: 'learning_content.module.site', kind: 'reference', entity: 'module', field: 'site_id', to: 'course_site', gravity: 'major' },
    { id: 'learning_content.module.preserved', kind: 'preserved', entity: 'module', fields: ['title', 'published'], links: [{ field: 'site_id', to: 'course_site' }], gravity: 'major' },
    { id: 'learning_content.module.order', kind: 'order', entity: 'module', group: 'site_id', groupEntity: 'course_site', position: 'position', gravity: 'major' },
    { id: 'learning_content.item.crosswalk', kind: 'crosswalk', entity: 'content_item', gravity: 'major' },
    { id: 'learning_content.item.module', kind: 'reference', entity: 'content_item', field: 'module_id', to: 'module', gravity: 'major' },
    { id: 'learning_content.item.preserved', kind: 'preserved', entity: 'content_item', fields: ['kind', 'title', 'checksum', 'published'], links: [{ field: 'module_id', to: 'module' }], gravity: 'major' },
    { id: 'learning_content.item.order', kind: 'order', entity: 'content_item', group: 'module_id', groupEntity: 'module', position: 'position', gravity: 'major' },
    { id: 'learning_content.revision.crosswalk', kind: 'crosswalk', entity: 'content_revision', gravity: 'major' },
    { id: 'learning_content.revision.history', kind: 'history', entity: 'content_revision', subjectEntity: 'content_item', subject: 'item_id', seq: 'seq', value: 'checksum', gravity: 'major' },
    { id: 'learning_content.role.crosswalk', kind: 'crosswalk', entity: 'site_role', gravity: 'major' },
    { id: 'learning_content.role.access', kind: 'permission', entity: 'site_role', principal: 'person_id', principalEntity: 'person', resource: 'site_id', resourceEntity: 'course_site', gravity: 'major' },
    { id: 'learning_content.site.points', kind: 'derived', entity: 'course_site', child: 'assignment', childSubject: 'site_id', value: 'points', agg: 'sum', stated: 'points_total', tolerance: 0, gravity: 'major' },
    { id: 'learning_content.assignment.crosswalk', kind: 'crosswalk', entity: 'assignment', gravity: 'major' },
    { id: 'learning_content.assignment.preserved', kind: 'preserved', entity: 'assignment', fields: ['title', 'points', 'published'], links: [{ field: 'site_id', to: 'course_site' }], gravity: 'major' },
    { id: 'learning_content.assignment.dates', kind: 'preserved', entity: 'assignment', fields: ['opens_at', 'due_at'], compare: 'date', gravity: 'major' },
    { id: 'learning_content.assignment.window', kind: 'temporal', entity: 'assignment', start: 'opens_at', end: 'due_at', gravity: 'minor' },
  ],
  cleansing: [
    'Hash every file at extraction, from the source bytes, and record the hash beside the item.',
    'List broken internal links, missing files and unpublished items so each is a decision.',
    'Detect content with third-party licensing or embedded external tools that cannot move; list them for the instructor.',
    'Resolve time zones: due dates carry the source zone explicitly.',
  ],
  transforms: [
    'Rebuild the outline from parent and position; keep sibling order.',
    'Convert file types only where the target cannot render the source type, and record each conversion with before and after hashes.',
    'Rewrite internal links through the crosswalk; an unresolvable link is an exception, never dropped.',
  ],
  acceptance: [
    'Every course site opens with the same outline, in the same order, with the same files by hash.',
    'Every assignment has the same title, points and dates, with time zones preserved.',
    'Items that cannot move are listed to the instructor before cutover, not discovered by students after.',
  ],
};

/* ── 5. Enrollments and registration ───────────────────────────────────── */

const enrollments: DomainSpec = {
  id: 'enrollments',
  label: 'Enrollments and registration',
  stakes: 'high',
  owner: 'Registrar (registration and records)',
  sources: ['SIS registration tables', 'Waitlist system', 'Hold management'],
  references: [STUDENT_REF, SECTION_REF, TERM_REF, PERSON_REF],
  entities: [
    E('enrollment', 'A student\'s enrollment in a section', ['enrollment_id'], [
      F('enrollment_id'), F('student_id', 'T3', { required: true }), F('section_id', 'T0', { required: true }), F('term_id', 'T0', { required: true }),
      F('status'), F('grade_mode'), F('credits'), F('added_on'), F('dropped_on'),
    ]),
    E('enrollment_event', 'A change to an enrollment, in the order it happened', ['event_id'], [F('event_id'), F('enrollment_id', 'T3', { required: true }), F('seq'), F('status')]),
    E('schedule_access', 'Who may see or change a student schedule', ['access_id'], [F('access_id'), F('person_id', 'T3', { required: true }), F('student_id', 'T3', { required: true })]),
    E('waitlist_entry', 'A place on a section waitlist', ['waitlist_id'], [F('waitlist_id'), F('section_id', 'T0', { required: true }), F('student_id', 'T3', { required: true }), F('position'), F('added_on')]),
    E('registration_hold', 'A hold that blocks registration', ['hold_id'], [
      F('hold_id'), F('student_id', 'T3', { required: true }), F('hold_code'), F('placed_on'), F('released_on'), F('active'),
    ]),
  ],
  excluded: [
    { name: 'hold_reasons', class: 'T4', handling: 'Not migrated. The platform never stores why a hold exists (conduct, medical or financial reasons); only the code and its dates move, and the owning office keeps the reason.' },
    ...SENSITIVE.filter((s) => s.name === 'accommodation_records'),
  ],
  invariants: [
    { id: 'enrollments.enrollment.crosswalk', kind: 'crosswalk', entity: 'enrollment', gravity: 'critical' },
    { id: 'enrollments.enrollment.preserved', kind: 'preserved', entity: 'enrollment', fields: ['status', 'grade_mode', 'credits'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'section_id', to: 'section' }, { field: 'term_id', to: 'term' }], gravity: 'critical' },
    { id: 'enrollments.enrollment.dates', kind: 'preserved', entity: 'enrollment', fields: ['added_on', 'dropped_on'], compare: 'date', gravity: 'major' },
    { id: 'enrollments.enrollment.window', kind: 'temporal', entity: 'enrollment', start: 'added_on', end: 'dropped_on', gravity: 'major' },
    { id: 'enrollments.enrollment.student', kind: 'reference', entity: 'enrollment', field: 'student_id', to: 'student_record', gravity: 'critical' },
    { id: 'enrollments.enrollment.section', kind: 'reference', entity: 'enrollment', field: 'section_id', to: 'section', gravity: 'critical' },
    { id: 'enrollments.section.seats', kind: 'bounded', entity: 'enrollment', group: 'section_id', groupEntity: 'section', capacity: 'capacity', filter: { field: 'status', in: ['enrolled'] }, equalToSource: true, gravity: 'critical' },
    { id: 'enrollments.student.load', kind: 'derived', entity: 'student_record', child: 'enrollment', childSubject: 'student_id', value: 'credits', agg: 'sum', filter: { field: 'status', in: ['enrolled'] }, tolerance: 0, gravity: 'critical' },
    { id: 'enrollments.event.crosswalk', kind: 'crosswalk', entity: 'enrollment_event', gravity: 'critical' },
    { id: 'enrollments.event.history', kind: 'history', entity: 'enrollment_event', subjectEntity: 'enrollment', subject: 'enrollment_id', seq: 'seq', value: 'status', gravity: 'critical' },
    { id: 'enrollments.access.crosswalk', kind: 'crosswalk', entity: 'schedule_access', gravity: 'critical' },
    { id: 'enrollments.access.grant', kind: 'permission', entity: 'schedule_access', principal: 'person_id', principalEntity: 'person', resource: 'student_id', resourceEntity: 'student_record', gravity: 'critical' },
    { id: 'enrollments.waitlist.crosswalk', kind: 'crosswalk', entity: 'waitlist_entry', gravity: 'critical' },
    { id: 'enrollments.waitlist.order', kind: 'order', entity: 'waitlist_entry', group: 'section_id', groupEntity: 'section', position: 'position', gravity: 'critical' },
    { id: 'enrollments.waitlist.preserved', kind: 'preserved', entity: 'waitlist_entry', fields: ['added_on'], compare: 'date', links: [{ field: 'student_id', to: 'student_record' }, { field: 'section_id', to: 'section' }], gravity: 'major' },
    { id: 'enrollments.hold.crosswalk', kind: 'crosswalk', entity: 'registration_hold', gravity: 'critical' },
    { id: 'enrollments.hold.preserved', kind: 'preserved', entity: 'registration_hold', fields: ['hold_code', 'active'], links: [{ field: 'student_id', to: 'student_record' }], gravity: 'critical' },
    { id: 'enrollments.hold.dates', kind: 'preserved', entity: 'registration_hold', fields: ['placed_on', 'released_on'], compare: 'date', gravity: 'major' },
  ],
  cleansing: [
    'List enrollments in sections no longer in the catalog and enrollments for students with no record.',
    'List sections already over capacity in the source; they are inherited, not introduced.',
    'Freeze registration in the source for the rehearsal extract window, or take the extract from a consistent snapshot; record which.',
  ],
  transforms: [
    'Carry status and grade mode as recorded; map vocabularies through an approved lookup; an unmapped status stops the run.',
    'Waitlist position carried as an ordered sequence, not recomputed.',
    'Holds carry code and dates only.',
  ],
  acceptance: [
    'Every student sees exactly the schedule the incumbent shows; credit load per student per term is identical.',
    'No section holds more seats than its capacity unless it already did; waitlists keep their order.',
    'Every active hold still blocks the same students; no hold appears that did not exist.',
    'A registration day rehearsal on migrated data produces the same outcomes as the incumbent for the same inputs.',
  ],
};

/* ── 6. Finance ────────────────────────────────────────────────────────── */

const finance: DomainSpec = {
  id: 'finance',
  label: 'Finance',
  stakes: 'high',
  owner: 'Bursar / student accounts',
  sources: ['Student accounts receivable (ERP)', 'Payment plan system', 'Payment processor reports'],
  references: [STUDENT_REF, TERM_REF, PERSON_REF],
  entities: [
    E('account', 'A student account', ['account_id'], [F('account_id'), F('student_id', 'T3', { required: true }), F('currency'), F('status'), F('stated_balance_cents', 'T3', { note: 'whole minor units; never a float' })]),
    E('ledger_entry', 'One signed charge, payment, adjustment or reversal', ['entry_id'], [
      F('entry_id'), F('account_id', 'T3', { required: true }), F('term_id', 'T0'), F('charge_code'), F('amount_cents', 'T3', { required: true }), F('posted_on'), F('posted_seq', 'T3', { note: 'the order entries were posted in, per account' }), F('reversal_of'),
    ]),
    E('account_access', 'Who may see or pay an account', ['access_id'], [F('access_id'), F('person_id', 'T3', { required: true }), F('account_id', 'T3', { required: true })]),
    E('payment_plan', 'An installment arrangement', ['plan_id'], [F('plan_id'), F('account_id', 'T3', { required: true }), F('status'), F('installment_count'), F('next_due_on')]),
  ],
  excluded: [
    { name: 'financial_aid_awards', class: 'T3', handling: 'Not migrated. Aid is never ingested; Semester shows an action item and a link to the financial aid office.' },
    { name: 'payment_card_data', class: 'T6', handling: 'Never copied. Cards stay tokenised at the processor; nothing about them is in a migration file.' },
    { name: 'bank_account_numbers', class: 'T6', handling: 'Never copied. Bank details stay with the bank and the processor; nothing about them is in a migration file.' },
    { name: 'collections_and_legal_notes', class: 'T4', handling: 'Not migrated; remain with student accounts and counsel.' },
  ],
  invariants: [
    { id: 'finance.account.crosswalk', kind: 'crosswalk', entity: 'account', gravity: 'critical' },
    { id: 'finance.account.preserved', kind: 'preserved', entity: 'account', fields: ['currency', 'status'], links: [{ field: 'student_id', to: 'student_record' }], gravity: 'critical' },
    { id: 'finance.account.balance', kind: 'derived', entity: 'account', child: 'ledger_entry', childSubject: 'account_id', value: 'amount_cents', agg: 'sum', stated: 'stated_balance_cents', tolerance: 0, integer: true, gravity: 'critical' },
    { id: 'finance.ledger.crosswalk', kind: 'crosswalk', entity: 'ledger_entry', gravity: 'critical' },
    { id: 'finance.ledger.amount', kind: 'preserved', entity: 'ledger_entry', fields: ['amount_cents'], compare: 'number', links: [{ field: 'account_id', to: 'account' }, { field: 'reversal_of', to: 'ledger_entry' }], gravity: 'critical' },
    { id: 'finance.ledger.preserved', kind: 'preserved', entity: 'ledger_entry', fields: ['charge_code', 'posted_on'], links: [{ field: 'term_id', to: 'term' }], gravity: 'critical' },
    { id: 'finance.ledger.account', kind: 'reference', entity: 'ledger_entry', field: 'account_id', to: 'account', gravity: 'critical' },
    { id: 'finance.ledger.reversal', kind: 'reference', entity: 'ledger_entry', field: 'reversal_of', to: 'ledger_entry', gravity: 'critical' },
    { id: 'finance.ledger.history', kind: 'history', entity: 'ledger_entry', subjectEntity: 'account', subject: 'account_id', seq: 'posted_seq', value: 'amount_cents', gravity: 'critical' },
    { id: 'finance.access.crosswalk', kind: 'crosswalk', entity: 'account_access', gravity: 'critical' },
    { id: 'finance.access.grant', kind: 'permission', entity: 'account_access', principal: 'person_id', principalEntity: 'person', resource: 'account_id', resourceEntity: 'account', gravity: 'critical' },
    { id: 'finance.plan.crosswalk', kind: 'crosswalk', entity: 'payment_plan', gravity: 'major' },
    { id: 'finance.plan.preserved', kind: 'preserved', entity: 'payment_plan', fields: ['status', 'installment_count'], links: [{ field: 'account_id', to: 'account' }], gravity: 'major' },
    { id: 'finance.plan.due', kind: 'preserved', entity: 'payment_plan', fields: ['next_due_on'], compare: 'date', gravity: 'major' },
  ],
  cleansing: [
    'Convert every amount to whole minor units in the extract; reject any value with a fractional minor unit.',
    'Recompute every account balance from its ledger on the source side and list each account whose stated balance already disagrees.',
    'List unapplied payments, orphan reversals and entries dated outside any term.',
    'Freeze posting in the source for the cutover extract; capture the posting cut-off time.',
  ],
  transforms: [
    'Load the ledger append-only with original posting dates; never re-derive an amount.',
    'Carry reversal links through the crosswalk.',
    'Balance is recomputed in the target from entries and compared to the source; it is never loaded as a number alone.',
  ],
  acceptance: [
    'For every account, the balance recomputed from the migrated ledger equals the source to the cent; the total across all accounts equals the general ledger control total.',
    'No amount is a float anywhere in the pipeline.',
    'A full billing cycle in parallel produces identical statements, due dates and late-fee outcomes.',
    'Nothing about aid awards, cards or bank accounts is in any file.',
  ],
};

/* ── 7. Family and guardians ───────────────────────────────────────────── */

const family: DomainSpec = {
  id: 'family',
  label: 'Family and guardians',
  stakes: 'high',
  owner: 'Registrar (FERPA officer) with the dean of students',
  sources: ['SIS proxy-access and release records', 'FERPA consent forms', 'Parent portal'],
  references: [PERSON_REF, STUDENT_REF],
  entities: [
    E('guardian_relationship', 'A recorded relationship between a student and a guardian', ['relationship_id'], [
      F('relationship_id'), F('student_id', 'T3', { required: true }), F('guardian_person_id', 'T3', { required: true }), F('relationship'), F('status'),
    ]),
    E('consent_record', 'A consent a student gave, or withdrew', ['consent_id'], [
      F('consent_id'), F('student_id', 'T3', { required: true }), F('guardian_person_id', 'T3', { required: true }), F('scope'), F('scope_level', 'T3', { note: 'the breadth of what was consented to' }), F('granted_on'), F('revoked_on'), F('basis'), F('active'),
    ]),
    E('consent_event', 'A grant or withdrawal of consent, in the order it happened', ['event_id'], [F('event_id'), F('consent_id', 'T3', { required: true }), F('seq'), F('state')]),
    E('proxy_access', 'Access a guardian currently holds to a student\'s information', ['proxy_id'], [F('proxy_id'), F('student_id', 'T3', { required: true }), F('guardian_person_id', 'T3', { required: true }), F('scope')]),
  ],
  excluded: [
    { name: 'court_orders_and_custody_documents', class: 'T4', handling: 'Not migrated as data. Held by the registrar as documents under counsel\'s direction; any restriction they impose is entered as an explicit block by a person.' },
    ...SENSITIVE.filter((s) => s.name !== 'conduct_records'),
  ],
  invariants: [
    { id: 'family.relationship.crosswalk', kind: 'crosswalk', entity: 'guardian_relationship', gravity: 'critical' },
    { id: 'family.relationship.preserved', kind: 'preserved', entity: 'guardian_relationship', fields: ['relationship', 'status'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'guardian_person_id', to: 'person' }], gravity: 'critical' },
    { id: 'family.consent.crosswalk', kind: 'crosswalk', entity: 'consent_record', gravity: 'critical' },
    { id: 'family.consent.preserved', kind: 'preserved', entity: 'consent_record', fields: ['scope', 'basis', 'active'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'guardian_person_id', to: 'person' }], gravity: 'critical' },
    { id: 'family.consent.dates', kind: 'preserved', entity: 'consent_record', fields: ['granted_on', 'revoked_on'], compare: 'date', gravity: 'critical' },
    { id: 'family.consent.window', kind: 'temporal', entity: 'consent_record', start: 'granted_on', end: 'revoked_on', gravity: 'major' },
    { id: 'family.consent.student', kind: 'reference', entity: 'consent_record', field: 'student_id', to: 'student_record', gravity: 'critical' },
    { id: 'family.event.crosswalk', kind: 'crosswalk', entity: 'consent_event', gravity: 'critical' },
    { id: 'family.event.history', kind: 'history', entity: 'consent_event', subjectEntity: 'consent_record', subject: 'consent_id', seq: 'seq', value: 'state', gravity: 'critical' },
    { id: 'family.student.consented', kind: 'derived', entity: 'student_record', child: 'consent_record', childSubject: 'student_id', value: 'scope_level', agg: 'sum', filter: { field: 'active', in: ['true'] }, tolerance: 0, gravity: 'critical' },
    { id: 'family.proxy.crosswalk', kind: 'crosswalk', entity: 'proxy_access', gravity: 'critical' },
    { id: 'family.proxy.access', kind: 'permission', entity: 'proxy_access', principal: 'guardian_person_id', principalEntity: 'person', resource: 'student_id', resourceEntity: 'student_record', requires: { entity: 'consent_record', principal: 'guardian_person_id', resource: 'student_id', active: 'active' }, gravity: 'critical' },
  ],
  cleansing: [
    'List every proxy grant with no matching active consent in the source; these are inherited findings and are never migrated as access until the registrar rules.',
    'List consents past any expiry the institution\'s policy sets, and students whose age or status changes who may consent.',
    'List guardians linked to students who no longer have an active record.',
  ],
  transforms: [
    'Carry consent dates, scope and active flag exactly; a revoked consent must load revoked.',
    'Access is derived from consent, never the other way round: no access row is created without a consent row.',
  ],
  acceptance: [
    'No guardian can see any student\'s information that they could not see before, and none can see it without an active consent record.',
    'Every revocation carried across as a revocation, with its date.',
    'Where the institution\'s policy changes who may consent, the change is a signed decision with counsel review, not a migration side effect.',
  ],
};

/* ── 8. Campus services ────────────────────────────────────────────────── */

const campusServices: DomainSpec = {
  id: 'campus_services',
  label: 'Campus services',
  stakes: 'standard',
  owner: 'Dean of students / auxiliary services',
  sources: ['Housing management system', 'Dining and card office', 'Student organization platform'],
  references: [STUDENT_REF, TERM_REF],
  entities: [
    E('room', 'A housing room', ['room_id'], [F('room_id', 'T1'), F('building', 'T1'), F('number', 'T1'), F('capacity', 'T1')]),
    E('housing_assignment', 'A student assigned to a room for a term', ['assignment_id'], [
      F('assignment_id'), F('student_id', 'T3', { required: true }), F('room_id', 'T1', { required: true }), F('term_id', 'T0'), F('status'), F('check_in_on'),
    ]),
    E('housing_event', 'A change to a housing assignment, in the order it happened', ['event_id'], [F('event_id'), F('assignment_id', 'T3', { required: true }), F('seq'), F('status')]),
    E('dining_plan', 'A meal plan for a student and term', ['plan_id'], [F('plan_id'), F('student_id', 'T3', { required: true }), F('plan_code', 'T1'), F('term_id', 'T0'), F('status')]),
    E('org_membership', 'A student\'s role in an organization', ['membership_id'], [F('membership_id', 'T1'), F('student_id', 'T3', { required: true }), F('org_id', 'T1'), F('role', 'T1'), F('status', 'T1')]),
  ],
  excluded: [
    ...SENSITIVE,
    { name: 'housing_accommodations', class: 'T4', handling: 'Not migrated. Disability-related housing needs remain with the accessibility office; a room is carried without the reason it was assigned.' },
    { name: 'roommate_conflict_and_incident_notes', class: 'T4', handling: 'Not migrated. Incident and conflict notes stay with residence life under its own rules.' },
  ],
  invariants: [
    { id: 'campus_services.room.crosswalk', kind: 'crosswalk', entity: 'room', gravity: 'major' },
    { id: 'campus_services.room.preserved', kind: 'preserved', entity: 'room', fields: ['building', 'number'], gravity: 'major' },
    { id: 'campus_services.room.capacity', kind: 'preserved', entity: 'room', fields: ['capacity'], compare: 'number', gravity: 'major' },
    { id: 'campus_services.housing.crosswalk', kind: 'crosswalk', entity: 'housing_assignment', gravity: 'major' },
    { id: 'campus_services.housing.preserved', kind: 'preserved', entity: 'housing_assignment', fields: ['status'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'room_id', to: 'room' }, { field: 'term_id', to: 'term' }], gravity: 'major' },
    { id: 'campus_services.housing.room', kind: 'reference', entity: 'housing_assignment', field: 'room_id', to: 'room', gravity: 'major' },
    { id: 'campus_services.housing.occupancy', kind: 'bounded', entity: 'housing_assignment', group: 'room_id', groupEntity: 'room', capacity: 'capacity', filter: { field: 'status', in: ['assigned'] }, equalToSource: true, gravity: 'major' },
    { id: 'campus_services.housing_event.crosswalk', kind: 'crosswalk', entity: 'housing_event', gravity: 'major' },
    { id: 'campus_services.housing_event.history', kind: 'history', entity: 'housing_event', subjectEntity: 'housing_assignment', subject: 'assignment_id', seq: 'seq', value: 'status', gravity: 'major' },
    { id: 'campus_services.dining.crosswalk', kind: 'crosswalk', entity: 'dining_plan', gravity: 'major' },
    { id: 'campus_services.dining.preserved', kind: 'preserved', entity: 'dining_plan', fields: ['plan_code', 'status'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'term_id', to: 'term' }], gravity: 'major' },
    { id: 'campus_services.org.crosswalk', kind: 'crosswalk', entity: 'org_membership', gravity: 'minor' },
    { id: 'campus_services.org.preserved', kind: 'preserved', entity: 'org_membership', fields: ['org_id', 'role', 'status'], links: [{ field: 'student_id', to: 'student_record' }], gravity: 'minor' },
    { id: 'campus_services.org.access', kind: 'permission', entity: 'org_membership', principal: 'student_id', principalEntity: 'student_record', resource: 'org_id', gravity: 'major' },
  ],
  cleansing: [
    'List students assigned to rooms that no longer exist and rooms over capacity in the source.',
    'List meal plans with no matching term or student.',
    'Separate organizations that are active from archived; archived ones are carried as archived.',
  ],
  transforms: [
    'Rooms and assignments carry building, number and status; reasons for assignment are not carried.',
    'Memberships carry role and status only.',
  ],
  acceptance: [
    'Every resident sees their own room and nobody else\'s; no room exceeds its capacity unless it already did.',
    'Every meal plan matches the card office for the term.',
    'No accommodation, health, counseling or conduct information is present in any form.',
  ],
};

/* ── 9. Career and lifelong ────────────────────────────────────────────── */

const career: DomainSpec = {
  id: 'career',
  label: 'Career and lifelong',
  stakes: 'standard',
  owner: 'Career center and alumni relations',
  sources: ['Career platform (Handshake, Symplicity)', 'Alumni CRM', 'Credential and co-curricular records'],
  references: [PERSON_REF, STUDENT_REF],
  entities: [
    E('opportunity', 'A job, internship or research opportunity', ['opportunity_id'], [F('opportunity_id', 'T1'), F('employer', 'T1'), F('title', 'T1'), F('deadline_on', 'T1'), F('status', 'T1')]),
    E('application', 'A student\'s application to an opportunity', ['application_id'], [F('application_id'), F('student_id', 'T3', { required: true }), F('opportunity_id', 'T1', { required: true }), F('status'), F('submitted_on')]),
    E('verified_achievement', 'A verified achievement or credential', ['achievement_id'], [
      F('achievement_id'), F('student_id', 'T3', { required: true }), F('kind'), F('issuer'), F('issued_on'), F('evidence_checksum'), F('status'),
    ]),
    E('application_event', 'A change to an application, in the order it happened', ['event_id'], [F('event_id'), F('application_id', 'T3', { required: true }), F('seq'), F('status')]),
    E('profile_share', 'Who may see a student\'s career profile', ['share_id'], [F('share_id'), F('viewer_person_id', 'T3', { required: true }), F('student_id', 'T3', { required: true })]),
    E('alumni_profile', 'A graduate\'s profile and its visibility', ['profile_id'], [F('profile_id'), F('person_id', 'T3', { required: true }), F('graduation_term_id', 'T0'), F('visibility', 'T3', { note: 'a privacy setting' }), F('mentor_opt_in')]),
  ],
  excluded: [
    { name: 'confidential_recommendation_letters', class: 'T4', handling: 'Not migrated. Access and waiver rules differ by letter and need counsel review; they stay with the author or office.' },
    { name: 'employer_private_feedback', class: 'T3', handling: 'Not migrated.' },
    ...SENSITIVE.filter((s) => s.name === 'accommodation_records'),
  ],
  invariants: [
    { id: 'career.opportunity.crosswalk', kind: 'crosswalk', entity: 'opportunity', gravity: 'minor' },
    { id: 'career.opportunity.preserved', kind: 'preserved', entity: 'opportunity', fields: ['employer', 'title', 'status'], gravity: 'minor' },
    { id: 'career.opportunity.deadline', kind: 'preserved', entity: 'opportunity', fields: ['deadline_on'], compare: 'date', gravity: 'major' },
    { id: 'career.application.crosswalk', kind: 'crosswalk', entity: 'application', gravity: 'major' },
    { id: 'career.application.unique', kind: 'unique', entity: 'application', fields: ['student_id', 'opportunity_id'], gravity: 'major' },
    { id: 'career.application.opportunity', kind: 'reference', entity: 'application', field: 'opportunity_id', to: 'opportunity', gravity: 'major' },
    { id: 'career.application.preserved', kind: 'preserved', entity: 'application', fields: ['status'], links: [{ field: 'student_id', to: 'student_record' }, { field: 'opportunity_id', to: 'opportunity' }], gravity: 'major' },
    { id: 'career.application.submitted', kind: 'preserved', entity: 'application', fields: ['submitted_on'], compare: 'date', gravity: 'major' },
    { id: 'career.event.crosswalk', kind: 'crosswalk', entity: 'application_event', gravity: 'major' },
    { id: 'career.event.history', kind: 'history', entity: 'application_event', subjectEntity: 'application', subject: 'application_id', seq: 'seq', value: 'status', gravity: 'major' },
    { id: 'career.share.crosswalk', kind: 'crosswalk', entity: 'profile_share', gravity: 'critical' },
    { id: 'career.share.access', kind: 'permission', entity: 'profile_share', principal: 'viewer_person_id', principalEntity: 'person', resource: 'student_id', resourceEntity: 'student_record', gravity: 'critical' },
    { id: 'career.achievement.crosswalk', kind: 'crosswalk', entity: 'verified_achievement', gravity: 'major' },
    { id: 'career.achievement.preserved', kind: 'preserved', entity: 'verified_achievement', fields: ['kind', 'issuer', 'evidence_checksum', 'status'], links: [{ field: 'student_id', to: 'student_record' }], gravity: 'major' },
    { id: 'career.achievement.issued', kind: 'preserved', entity: 'verified_achievement', fields: ['issued_on'], compare: 'date', gravity: 'major' },
    { id: 'career.alumni.crosswalk', kind: 'crosswalk', entity: 'alumni_profile', gravity: 'critical' },
    { id: 'career.alumni.privacy', kind: 'preserved', entity: 'alumni_profile', fields: ['visibility', 'mentor_opt_in'], links: [{ field: 'person_id', to: 'person' }], gravity: 'critical' },
  ],
  cleansing: [
    'List achievements whose evidence file is missing or whose issuer is unrecognized; a "verified" label is carried only where the evidence hash matches.',
    'Resolve duplicate applications; list, do not delete.',
    'List alumni profiles with no recorded visibility choice; they load as private, never as public.',
  ],
  transforms: [
    'Visibility carried exactly; a missing value loads as the most private setting and is listed.',
    'Achievements carry their evidence hash; verification status is never upgraded by the migration.',
  ],
  acceptance: [
    'Every application and its status is where the student left it.',
    'Every verified achievement is verified by the same issuer on the same evidence, or is not shown as verified.',
    'No alumnus becomes more visible than they chose to be.',
  ],
};

/* ── 10. Documents ─────────────────────────────────────────────────────── */

const documents: DomainSpec = {
  id: 'documents',
  label: 'Documents',
  stakes: 'high',
  owner: 'Registrar and records management',
  sources: ['Document imaging system', 'Transcript archive', 'Shared drives and portals'],
  references: [PERSON_REF],
  entities: [
    E('document', 'A document and its metadata', ['document_id'], [
      F('document_id'), F('owner_person_id', 'T3', { required: true }), F('kind'), F('title'), F('mime_type'), F('byte_size'), F('checksum', 'T3', { note: 'hash of the bytes, taken from the source file at extraction' }),
      F('created_on'), F('retention_class'), F('legal_hold'), F('access_level'),
    ]),
    E('document_version', 'One version of a document', ['version_id'], [F('version_id'), F('document_id', 'T3', { required: true }), F('version_no'), F('checksum'), F('created_on')]),
    E('document_access', 'A person\'s access to a document', ['access_id'], [F('access_id'), F('document_id', 'T3', { required: true }), F('person_id', 'T3', { required: true }), F('level')]),
  ],
  excluded: [
    { name: 'documents_of_sensitive_kinds', class: 'T4', handling: 'Documents of kind medical form, accommodation letter, conduct notice or counseling note are not migrated, whatever system they sit in. They are listed by kind and count in the source inventory so their absence is a decision.' },
    { name: 'unreadable_or_corrupt_source_files', class: 'T3', handling: 'Never repaired in flight. Listed as exceptions; the institution decides to re-scan, accept the loss in writing, or exclude.' },
  ],
  invariants: [
    { id: 'documents.document.crosswalk', kind: 'crosswalk', entity: 'document', gravity: 'critical' },
    { id: 'documents.document.content', kind: 'preserved', entity: 'document', fields: ['checksum', 'byte_size', 'mime_type'], gravity: 'critical' },
    { id: 'documents.document.owner', kind: 'preserved', entity: 'document', fields: [], links: [{ field: 'owner_person_id', to: 'person' }], gravity: 'critical' },
    { id: 'documents.document.hold', kind: 'preserved', entity: 'document', fields: ['legal_hold', 'retention_class'], gravity: 'critical' },
    { id: 'documents.document.metadata', kind: 'preserved', entity: 'document', fields: ['kind', 'title', 'access_level'], gravity: 'major' },
    { id: 'documents.document.created', kind: 'preserved', entity: 'document', fields: ['created_on'], compare: 'date', gravity: 'major' },
    { id: 'documents.document.person', kind: 'reference', entity: 'document', field: 'owner_person_id', to: 'person', gravity: 'critical' },
    { id: 'documents.version.crosswalk', kind: 'crosswalk', entity: 'document_version', gravity: 'major' },
    { id: 'documents.version.preserved', kind: 'preserved', entity: 'document_version', fields: ['checksum', 'version_no'], links: [{ field: 'document_id', to: 'document' }], gravity: 'major' },
    { id: 'documents.version.order', kind: 'order', entity: 'document_version', group: 'document_id', groupEntity: 'document', position: 'version_no', gravity: 'major' },
    { id: 'documents.version.history', kind: 'history', entity: 'document_version', subjectEntity: 'document', subject: 'document_id', seq: 'version_no', value: 'checksum', gravity: 'major' },
    { id: 'documents.access.crosswalk', kind: 'crosswalk', entity: 'document_access', gravity: 'critical' },
    { id: 'documents.access.grant', kind: 'permission', entity: 'document_access', principal: 'person_id', principalEntity: 'person', resource: 'document_id', resourceEntity: 'document', gravity: 'critical' },
  ],
  cleansing: [
    'Hash every source file at extraction, from the bytes on disk, with a tool independent of the transform.',
    'List files that cannot be opened, zero-byte files and files whose recorded size differs from the bytes.',
    'List documents with no owner, and documents owned by a person who is not in scope.',
    'List documents under legal hold before anything moves; a held document is migrated only with the hold intact, and never deleted from the source by this program.',
  ],
  transforms: [
    'Copy bytes unchanged; convert nothing. A format conversion is a separate, approved, evidenced step with before and after hashes.',
    'Carry retention class and hold exactly; a missing retention class loads as unclassified and is listed.',
  ],
  acceptance: [
    'Every migrated document is byte-identical to its source by hash, belongs to the same person, and carries the same hold and retention class.',
    'Nobody can open a document they could not open before; nobody who could has lost the ability without a signed exception.',
    'A sample drawn by the records manager opens and reads correctly in the target.',
  ],
};

export const DOMAIN_SPECS: readonly DomainSpec[] = [identity, academicRecords, courses, learningContent, enrollments, finance, family, campusServices, career, documents];

export const DOMAIN_IDS: readonly DataDomain[] = DOMAIN_SPECS.map((d) => d.id);

/**
 * Load order. A domain is loaded after every domain whose entities it
 * references, because a link cannot be checked against a parent that has not
 * moved yet.
 */
export const DEPENDS_ON: Readonly<Record<DataDomain, readonly DataDomain[]>> = {
  identity: [],
  academic_records: ['identity'],
  courses: ['academic_records', 'identity'],
  learning_content: ['courses'],
  enrollments: ['academic_records', 'courses', 'identity'],
  finance: ['academic_records'],
  family: ['academic_records', 'identity'],
  campus_services: ['academic_records'],
  career: ['academic_records', 'identity'],
  documents: ['identity'],
};

export function specOf(id: string): DomainSpec | undefined {
  return DOMAIN_SPECS.find((d) => d.id === id);
}
