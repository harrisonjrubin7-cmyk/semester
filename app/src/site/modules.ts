/**
 * The takeover map: every system Semester means to replace, one module at a
 * time, and how far each has got.
 *
 * ## Why it is data
 *
 * The site used to say "it does not replace your SIS". The owner reversed that
 * on 29 Sep 2026 (D-137): Semester runs beside a school's systems today
 * (Connect) and takes each one over when the school switches that module to
 * Core. The temptation now runs the other way, and it is the one
 * `claims.ts` was written against: a page that says "replaces Canvas" the week
 * the design exists. So the map is a table a test can hold. A module's status
 * word is the claims register's vocabulary, and `modules.test.ts` refuses
 *
 *  - a module above `planned` whose tables are not in `supabase/migrations`
 *    or whose `<id>.check.sql` suite does not exist (DO-NOT-BUILD rule 13);
 *  - a module still `planned` whose tables have landed, so the page cannot
 *    understate a shipped module either.
 *
 * Nothing here is built. Every module reads `planned`.
 */

import type { CoreModuleId } from '@semester/contract';
import type { ClaimStatus } from '../lib/ops/claims';

export interface CoreModule {
  /** The module id the per-tenant mode switch uses (`CORE_MODULES` in the contract). */
  id: CoreModuleId;
  name: string;
  /** The kinds of system it would replace, named as products a buyer runs today. */
  replaces: string;
  /** What Semester does for this area today, in Connect mode. */
  today: string;
  /** What changes when a school switches the module to Core. */
  core: string;
  status: ClaimStatus;
  /** Tables the module needs; the test reads the migrations for them. */
  tables: readonly string[];
}

export const MODULES: readonly CoreModule[] = [
  { id: 'lms_assignments', name: 'Assignments and submissions', replaces: 'Canvas, Blackboard, Brightspace, Moodle',
    today: 'Your own work and deadlines, read from the syllabus.',
    core: 'Faculty publish assignments; students submit with a receipt and no double submissions.',
    status: 'planned', tables: ['assignments', 'submissions'] },
  { id: 'lms_gradebook', name: 'Gradebook and rubrics', replaces: 'The gradebook in Canvas, Blackboard or Brightspace',
    today: 'What you record yourself, with what-if grades.',
    core: 'Weighted categories, rubrics, posting rules and a grade history nobody can edit.',
    status: 'planned', tables: ['grade_items', 'grade_history'] },
  { id: 'lms_assessments', name: 'Tests and question banks', replaces: 'Canvas and Blackboard quizzes and tests',
    today: 'Self-practice exams you build from your own material.',
    core: 'Question banks, timed attempts held on the server, accommodations and QTI import.',
    status: 'planned', tables: ['question_banks', 'assessment_attempts'] },
  { id: 'attendance', name: 'Attendance', replaces: 'PowerSchool, Infinite Campus, Skyward attendance; paper sign-in',
    today: 'Nothing.',
    core: 'Instructor check-in by code, marks with a history, and reports to guardians in the K-12 edition.',
    status: 'planned', tables: ['attendance_sessions', 'attendance_marks'] },
  { id: 'registration', name: 'Registration', replaces: 'Banner, Colleague, PeopleSoft Campus Solutions, Workday Student',
    today: 'Prepares a cart, checks conflicts and hands off; it registers no one.',
    core: 'Seat-locked enrolment, waitlist promotion, add, drop and swap, proved not to over-fill a class.',
    status: 'planned', tables: ['registration_transactions', 'waitlist_claims'] },
  { id: 'degree_audit', name: 'Degree audit', replaces: 'Degree Works, uAchieve, Stellic',
    today: 'A planning estimate, labelled as one.',
    core: 'The official audit, run on the server against the catalog year, with approved exceptions.',
    status: 'planned', tables: ['programs', 'requirement_rules'] },
  { id: 'records', name: 'Records and transcripts', replaces: 'The records module of your SIS; transcript ordering services',
    today: 'Nothing official.',
    core: 'Final grades, signed transcripts, enrolment verification and a log of every release of a record.',
    status: 'planned', tables: ['term_records', 'ferpa_disclosures'] },
  { id: 'admissions', name: 'Admissions', replaces: 'Slate, Element451, Ellucian CRM Recruit',
    today: 'Nothing.',
    core: 'An applicant portal, document checklist and decision workflow; a person decides every admission.',
    status: 'planned', tables: ['applications', 'application_decisions'] },
  { id: 'student_accounts', name: 'Student accounts', replaces: 'TouchNet, Nelnet Campus Commerce, Banner Student Accounts',
    today: 'Deadlines and the cost of a plan. Semester’s own billing is separate.',
    core: 'A tuition ledger, payment plans and refunds; card numbers stay with the processor.',
    status: 'planned', tables: ['tuition_ledger_entries', 'payment_plans'] },
  { id: 'financial_aid', name: 'Financial-aid records', replaces: 'PowerFAIDS, Banner Financial Aid, Ellucian Colleague Financial Aid',
    today: 'The checklist and the next action.',
    core: 'Offer and disbursement records and satisfactory-progress tracking; every determination stays with a person.',
    status: 'planned', tables: ['aid_offers', 'aid_disbursements'] },
  { id: 'scheduling', name: 'Timetabling and rooms', replaces: 'Ad Astra, CollegeNET Series25',
    today: 'Demand forecasts in the design documents only.',
    core: 'A timetable solver, room and space booking, and exam scheduling.',
    status: 'planned', tables: ['rooms', 'timetable_runs'] },
  { id: 'events', name: 'Events', replaces: 'Localist, CampusGroups, Anthology Engage',
    today: 'Community sessions.',
    core: 'Events with RSVPs, hosted by communities, offices or courses.',
    status: 'planned', tables: ['events', 'event_rsvps'] },
  { id: 'k12', name: 'K-12 and parents', replaces: 'PowerSchool, Infinite Campus, Skyward, ParentSquare',
    today: 'Family access for college students who choose to share; nothing for a minor.',
    core: 'A guardian role with the parent’s rights over a minor’s record, standards-based grading and report cards.',
    status: 'planned', tables: ['guardian_links', 'report_cards'] },
  { id: 'advancement', name: 'Alumni relations and fundraising', replaces: 'Raiser’s Edge NXT, Salesforce Nonprofit, Slate Advancement',
    today: 'Alumni mentor offers.',
    core: 'Alumni profiles, campaigns, gifts with receipts, a donor portal and a gift-officer console; current students’ data is never used for outreach.',
    status: 'planned', tables: ['alumni_profiles', 'gifts'] },
];
