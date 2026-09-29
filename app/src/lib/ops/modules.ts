/**
 * The systems Semester Core is to take over, one module at a time.
 *
 * The owner decided on 29 September 2026 (D-141) that Semester is to become the
 * system of record for a school, module by module, where until then it worked
 * beside those systems. This is the one list of what that means, and both the
 * public pages read it: the site's replacement map and the company site's
 * copy of it.
 *
 * What this file does not hold is a status. A module's word is its claim's
 * (`CORE_CLAIMS` in `claims.ts`, one per module, built from this list), so the
 * site cannot say a module is available in Core while the register calls it
 * planned. Every module is planned today: no Core mode, no assignment,
 * submission, grade, attendance or ledger table exists, and no school has
 * switched anything off. `modules.test.ts` holds the words to the register and
 * the company site's copy to this list.
 */

export interface CoreModule {
  /** A slug; the claim is `core-<id>`. */
  id: string;
  name: string;
  /** The products a school runs this in today, named so a buyer knows what is meant. */
  replaces: readonly string[];
  /** What Semester does for this today, beside those systems. */
  connect: string;
  /** What Core would do once the module is switched to it. Not built. */
  core: string;
  /** Master-register rows that would move the claim. */
  rows: readonly string[];
  /** Why nothing here is built, in one line that is checkable. */
  gap: string;
}

export const CORE_MODULES: readonly CoreModule[] = [
  {
    id: 'course-content',
    name: 'Course content and delivery',
    replaces: ['Canvas', 'Blackboard Learn', 'Brightspace', 'Moodle'],
    connect: 'A student’s own view of their courses and deadlines, and Course Studio for a course’s rules and AI policy. No learning system is connected for any school.',
    core: 'Faculty publish modules, pages and files; students read them in Semester.',
    rows: ['LMS-003'],
    gap: 'Courses are per-student records today, not an institution’s.',
  },
  {
    id: 'assignments',
    name: 'Assignments and submissions',
    replaces: ['Canvas assignments', 'Blackboard assignments', 'Brightspace assignments', 'Moodle assignments'],
    connect: 'A student plans the work and breaks it down. Nothing is submitted through Semester.',
    core: 'Faculty create assignments; students submit, get a receipt, and cannot double-submit.',
    rows: ['LMS-004'],
    gap: 'No assignment or submission table exists.',
  },
  {
    id: 'gradebook',
    name: 'Gradebook and grading',
    replaces: ['Canvas gradebook', 'Blackboard grade center', 'Brightspace grades', 'Moodle gradebook'],
    connect: 'A student records their own grades and runs what-if scenarios. Semester holds no official grade.',
    core: 'Weighted categories, rubrics and a grade history that cannot be edited; the AI never decides a grade.',
    rows: ['LMS-011', 'LMS-012', 'LMS-013'],
    gap: 'No grade table exists; grading is designed, not built.',
  },
  {
    id: 'assessments',
    name: 'Tests, question banks and attendance',
    replaces: ['Canvas quizzes', 'Blackboard tests', 'Brightspace quizzes', 'Moodle quizzes'],
    connect: 'A student practises for an exam on their own material. Semester gives no graded test.',
    core: 'Question banks, timed attempts held on the server, accommodations and attendance, without biometric proctoring.',
    rows: ['LMS-008'],
    gap: 'Practice is device-only; no server-side attempt exists.',
  },
  {
    id: 'registration',
    name: 'Registration and enrolment',
    replaces: ['Ellucian Banner', 'Ellucian Colleague', 'PeopleSoft Campus Solutions', 'Workday Student'],
    connect: 'A student plans a schedule, checks conflicts and is handed to the registrar. Semester registers no one.',
    core: 'Seats held in one transaction, waitlists, add, drop and swap, with a load test that no class can be over-filled.',
    rows: ['STU-005', 'INT-009'],
    gap: 'No enrolment write exists; seats and windows are read-only planning data.',
  },
  {
    id: 'degree-audit',
    name: 'Degree audit',
    replaces: ['Ellucian Degree Works', 'uAchieve'],
    connect: 'A student’s own Path Snapshot: a plan and an estimate, never the official audit.',
    core: 'An official audit run on the server against the catalog year, with exceptions an advisor must approve.',
    rows: ['STU-004'],
    gap: 'Degree logic runs on the student’s device and is an estimate.',
  },
  {
    id: 'records',
    name: 'Academic records and transcripts',
    replaces: ['Ellucian Banner records', 'Parchment', 'National Student Clearinghouse transcript ordering'],
    connect: 'A student’s own copy of what they choose to keep. It is not a record of the school.',
    core: 'Term records, official transcripts a stranger can verify, and a log of every release of a record.',
    rows: ['INT-009'],
    gap: 'No official record or transcript exists.',
  },
  {
    id: 'admissions',
    name: 'Admissions',
    replaces: ['Slate', 'Ellucian CRM Recruit', 'Common App processing'],
    connect: 'Nothing. Semester serves enrolled students.',
    core: 'An applicant portal and a decision workflow in which a person decides; the AI never does.',
    rows: ['INT-009'],
    gap: 'Applicants do not exist as a role.',
  },
  {
    id: 'student-accounts',
    name: 'Student accounts (tuition and fees)',
    replaces: ['Ellucian Banner Student Accounts', 'Nelnet', 'TouchNet'],
    connect: 'A student estimates what a term will cost. Semester takes no tuition payment.',
    core: 'A tuition ledger and payment plans, with card numbers never stored by Semester.',
    rows: ['INT-009'],
    gap: 'The only billing that exists is Semester’s own Plus subscription, not a school’s ledger.',
  },
  {
    id: 'financial-aid',
    name: 'Financial-aid records',
    replaces: ['Ellucian Financial Aid', 'PowerFAIDS'],
    connect: 'A checklist and deadlines with a hand-off to the aid office. Semester holds no award.',
    core: 'Aid offers and disbursement records, with satisfactory-progress tracking; the AI never decides aid.',
    rows: ['INT-009'],
    gap: 'No aid record exists.',
  },
  {
    id: 'scheduling',
    name: 'Timetabling and room booking',
    replaces: ['Ad Astra', 'EMS', '25Live'],
    connect: 'A student sees their own schedule. Semester builds no institution timetable.',
    core: 'Rooms with capacity and features, a booking flow, and a timetabling solver over sections, rooms and instructors.',
    rows: ['UOS-002'],
    gap: 'No room or space table exists.',
  },
  {
    id: 'events',
    name: 'Events and campus engagement',
    replaces: ['Anthology Engage', 'CampusGroups', 'Presence'],
    connect: 'Communities and clubs a student joins. Semester has no event with RSVPs.',
    core: 'Events hosted by a community, an office or a course, with RSVPs feeding the calendar.',
    rows: ['UOS-003'],
    gap: 'No event entity exists.',
  },
  {
    id: 'k12',
    name: 'K-12 records and parent portal',
    replaces: ['PowerSchool', 'Infinite Campus', 'Skyward'],
    connect: 'Nothing. Semester is built for college students today.',
    core: 'A K-12 edition with a guardian role, in which a parent holds a minor’s record rights until 18.',
    rows: ['INT-006'],
    gap: 'No K-12 code exists; the family screen is a college student’s consent to share.',
  },
  {
    id: 'advancement',
    name: 'Alumni relations and fundraising',
    replaces: ['Blackbaud Raiser’s Edge', 'Ellucian Advance', 'Salesforce Nonprofit Cloud'],
    connect: 'Alumni can offer to mentor a student. Nothing else.',
    core: 'Alumni profiles a graduate opts into, campaigns, gifts and tax receipts, and no use of a current student’s data for fundraising.',
    rows: ['INT-009'],
    gap: 'No gift, donor or campaign table exists.',
  },
];

/** The claim id for a module. */
export const coreClaimId = (id: string): string => `core-${id}`;
