/**
 * The K–12 edition: a configured edition of the same operating system, not a
 * separate product (D-141).
 *
 * Positioning, the segments it would enter first, how each module is
 * configured for a school, the first pilot offer, the sales motion and the
 * channels — from the feature benchmark brief and the compliance playbook of
 * 29 September, kept under `docs/expansion/` as supplied. The public page
 * `/k-12/` prints it (`site/k12.tsx`), and says on its first line that no
 * district is served.
 *
 * ## The one rule
 *
 * The edition may be described, planned and priced; it may not take a
 * district's student data. `mayTakeDistrictData()` is `districtReady()` from
 * `requirements.ts`, and the page prints its answer rather than a claim.
 *
 * A module row cites the higher-education module it would configure. Its
 * status is that module's, never the K–12 configuration's: the gap says what
 * the configuration still needs, and for every row today that is all of it.
 */
import { districtReady } from './requirements';
import { PILOT_WEEKS } from '../gtm/pilot';
import { MINIMUM_AGE } from '../age';

export const POSITIONING =
  'Semester for high school gives students, families, counselors and districts one connected system for planning, support, college and career readiness, and school-community connection — configured from the same platform universities use, governed by the district.';

/** What it leads with, and what it will not lead with. */
export const LEADS_WITH: readonly string[] = [
  'Graduation and pathway planning',
  'College and career readiness',
  'Student support and trusted resource discovery',
  'Family-consented milestones',
  'Accessibility',
  'District governance and privacy',
];

export const DOES_NOT_REPLACE: readonly string[] = [
  'The student information system',
  'The gradebook',
  'Special education systems',
  'Discipline systems',
];

/** Where it would start, and what each is offered first. */
export const SEGMENTS: readonly { segment: string; offer: string }[] = [
  { segment: 'High schools', offer: 'Graduation planning, college and career readiness, internships, portfolio, scholarships' },
  { segment: 'Career and technical education', offer: 'Skills passport, work-based learning, portfolio, employer and mentor connection' },
  { segment: 'Early college and dual enrollment', offer: 'College-credit planning, transfer pathway, student support, academic readiness' },
  { segment: 'College and career centers', offer: 'Portfolio, application tracker, scholarships, mentors, career events' },
  { segment: 'District student-success teams', offer: 'Graduation readiness, student support workflows, resource discovery' },
];

/** Middle schools are not a segment: most of their students are under the minimum age. */
export const NOT_A_SEGMENT = `Middle and elementary schools: most of their students are under ${MINIMUM_AGE}, and nobody under ${MINIMUM_AGE} may hold a Semester account.`;

export interface ModuleConfig {
  module: string;
  k12: string;
  /** The higher-education module this configures. */
  base: { path: string; shows: string };
  needs: string;
}

export const MODULES: readonly ModuleConfig[] = [
  { module: 'My Path', k12: 'Graduation pathway, credits, graduation requirements, college and career plan', base: { path: 'app/src/lib/degree.ts', shows: 'degree requirements and progress' }, needs: 'State and district graduation requirements as data; none is loaded.' },
  { module: 'Registration planning', k12: 'Course requests, pathway selection, elective exploration, dual-enrollment planning', base: { path: 'app/src/lib/registration.ts', shows: 'term planning with backups' }, needs: 'A course-request window, which is not a registration window.' },
  { module: 'Study Studio', k12: 'Teacher-approved materials, practice, reading support, study plans, integrity controls', base: { path: 'app/src/lib/coursestudio.ts', shows: 'the instructor’s course policy' }, needs: 'A district AI policy above the course (K–12 requirements KA-02).' },
  { module: 'Career Hub', k12: 'Career exploration, CTE pathways, portfolio, internships, work-based learning', base: { path: 'app/src/lib/career-evidence.ts', shows: 'course work as evidence' }, needs: 'Employer visibility stays off for every minor; work-based learning needs a school-approved placement record.' },
  { module: 'Campus Hub', k12: 'School activities, clubs, counselors, family resources, events, transportation, meals, support', base: { path: 'app/src/lib/campusdirectory.ts', shows: 'the directory' }, needs: 'A school’s own resources, owned and reviewed by the school.' },
  { module: 'Community', k12: 'Verified class, club, cohort and project spaces with stricter safety controls', base: { path: 'app/src/community/connect.ts', shows: 'the community rules' }, needs: 'Off for every minor today (D-139); a school-supervised space would need its own design and counsel.' },
  { module: 'Supporter view', k12: 'Parent or guardian milestones the student chooses to share; no default access to private work', base: { path: 'app/src/lib/familyshare.ts', shows: 'items shared by choice, re-checked on read' }, needs: 'Verified guardian consent, where the law requires it (K–12 requirements KG-02).' },
  { module: 'Institution console', k12: 'District, school, grade, cohort, teacher, counselor and program configuration', base: { path: 'app/src/screens/Console.tsx', shows: 'the operations console' }, needs: 'A district and grade level above the school (K–12 requirements KD-01).' },
  { module: 'AI', k12: 'District policy controls, age-aware limits, approved source packs, human review', base: { path: 'app/src/ai/quality.ts', shows: 'source-aware answers' }, needs: 'Age-aware limits and a district policy (KA-02, KA-03).' },
  { module: 'Passport', k12: 'Portfolio, skills, credentials, reflections, graduation evidence, transition record', base: { path: 'app/src/lib/skills-graph.ts', shows: 'course to skill to evidence' }, needs: 'A transition record the student carries to college, with consent.' },
];

/** The first offer, when the district baseline allows it. */
export const PILOT = {
  name: 'Semester Graduation, College and Career Readiness Pilot',
  cohort: 'Grades 9–12, 50 to 250 students, all 13 or over',
  weeks: PILOT_WEEKS,
  includes: [
    'Student profile, interests, goals and support preferences',
    'Graduation and pathway planning',
    'Course-selection preparation',
    'College, career, scholarship and CTE exploration',
    'Portfolio and skills evidence',
    'A counselor meeting agenda',
    'Verified resources and events',
    'Family-consented milestone sharing',
    'The student Action Center',
    'District policy-controlled AI support',
    'Aggregate, privacy-safe pilot reporting',
  ],
  excludes: [
    'Any student under 13',
    'Messaging, matching or discovery between students',
    'Employer visibility',
    'Grades, discipline, special education or health records',
    'Any work the SIS or the gradebook does',
  ],
  measures: [
    'Student plan completion',
    'Counselor agenda creation',
    'Scholarship and opportunity discovery',
    'Portfolio artifacts saved',
    'College and career readiness milestones completed',
    'Student-reported clarity',
    'Counselor-reported usefulness',
    'Family engagement, where consented',
    'Support-resource discovery',
  ],
} as const;

/** How a district is reached, from the first free tool to a district agreement. */
export const MOTION: readonly string[] = [
  'Free student and counselor tools',
  'Adoption by a school counselor, CTE or college-and-career office',
  'A small school pilot',
  'A district pilot',
  'A multi-school rollout',
  'A district-wide platform agreement',
];

export const CHANNELS: readonly string[] = [
  'District college-and-career readiness offices',
  'CTE directors',
  'School counselors',
  'Early college and dual-enrollment programs',
  'State CTE associations',
  'Workforce-development boards',
  'Community colleges with dual-enrollment partnerships',
];

/** The page prints this, not a claim. */
export function mayTakeDistrictData(): boolean {
  return districtReady().ready;
}
