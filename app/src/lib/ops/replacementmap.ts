/**
 * The replacement map: every system Semester Core is being built to take over,
 * what Semester does beside that system today (Connect), and how far the Core
 * build has come.
 *
 * ## Why the status is computed, not typed
 *
 * A plan to replace a registrar is the easiest thing in this repository to
 * overstate. So the Core word beside each module is never written by hand: it
 * is read off the master-register rows the module's build rests on, using the
 * same floors the claims register uses (`FLOOR`, `RANK` in `claims.ts`). A
 * module with no row yet is `planned`: decided by the owner and not built.
 * The weakest row decides, because a module is only as far along as its
 * least-finished part. The word can reach `built-tested` from rows alone;
 * `available` needs a claim in the claims register that is itself available,
 * so the map cannot say a module runs for anybody before the register does.
 *
 * ## What this is not
 *
 * It is not a statement that Semester replaces any system today. In Connect
 * mode, which is every tenant today, the institution's system stays
 * authoritative (`platform.ts` BOUNDARIES, `/platform/system-boundaries/`).
 * The overclaim guard in `site.test.tsx` still refuses a page that says
 * Semester replaces a named system in the present tense.
 *
 * Printed by `/platform/replacement-map/` (`site/more.tsx`) and by the company
 * site's home page (`company-site/index.html`, `data-core-module` rows), both
 * held to this file by `replacementmap.test.ts`.
 */

import { REGISTER, type Status as RegisterStatus } from '../masterregister';
import { CLAIMS, RANK, STATUS_LABEL, type ClaimStatus } from './claims';

export interface CoreModule {
  id: string;
  area: string;
  /** The kind of system this module is built to take over, with examples a buyer would recognise. */
  takesOver: string;
  /** What Semester does beside that system today, with the institution's system authoritative. */
  connect: string;
  /** Master-register rows the Core build rests on. Empty: planned, no row yet. */
  rows: readonly string[];
  /** An available claim in the claims register, once the Core module runs for somebody. */
  availableClaim?: string;
}

export const CORE_MODULES: readonly CoreModule[] = [
  {
    id: 'lms-content',
    area: 'Course content and delivery',
    takesOver: 'Learning management systems such as Canvas, Blackboard, Brightspace and Moodle: modules, pages, files and release rules',
    connect: 'Reads a course’s syllabus and dates; Course Studio publishes course rules and guidance',
    rows: ['LMS-001', 'LMS-002', 'LMS-003'],
  },
  {
    id: 'lms-assignments',
    area: 'Assignments and submissions',
    takesOver: 'The assignment and submission tools of the learning management system',
    connect: 'Breaks assignments into steps and keeps drafts safe on the device; submission stays in the course’s own system',
    rows: ['LMS-004', 'LMS-005'],
  },
  {
    id: 'lms-gradebook',
    area: 'Gradebook, rubrics and grading',
    takesOver: 'The learning management system’s gradebook, rubrics and grading views',
    connect: 'What-if grade planning from the grades a student records',
    rows: ['LMS-006', 'LMS-011', 'LMS-012', 'LMS-013', 'LMS-014'],
  },
  {
    id: 'lms-assessments',
    area: 'Assessments and accommodations',
    takesOver: 'Quiz and exam engines, with accommodations applied per student',
    connect: 'Self-practice papers and study drills from a student’s own material',
    rows: ['LMS-008', 'LMS-009', 'LMS-010'],
  },
  {
    id: 'attendance',
    area: 'Attendance',
    takesOver: 'Attendance and check-in tools',
    connect: 'Nothing yet',
    rows: [],
  },
  {
    id: 'registration',
    area: 'Registration',
    takesOver: 'Registration in the student information system, such as Banner, Colleague, Workday Student and PeopleSoft Campus Solutions',
    connect: 'Builds a primary plan with ranked backups, checks conflicts and readiness, and hands off to the registrar',
    rows: [],
  },
  {
    id: 'degree-audit',
    area: 'Degree audit',
    takesOver: 'Degree-audit systems such as DegreeWorks and uAchieve',
    connect: 'Plans and estimates progress as a Path Snapshot, labelled as an estimate',
    rows: [],
  },
  {
    id: 'records',
    area: 'Academic records and transcripts',
    takesOver: 'Records, grade changes and transcripts in the student information system',
    connect: 'Keeps a student’s own term close-out; the registrar keeps the official record',
    rows: [],
  },
  {
    id: 'admissions',
    area: 'Admissions',
    takesOver: 'Admissions portals and applicant CRMs such as Slate',
    connect: 'Nothing yet; admitted-student and transfer onboarding is being built for pilots',
    rows: [],
  },
  {
    id: 'student-accounts',
    area: 'Student accounts',
    takesOver: 'Bursar and tuition-billing systems',
    connect: 'Shows the balance action and the route to the school’s own office',
    rows: [],
  },
  {
    id: 'financial-aid',
    area: 'Financial-aid records',
    takesOver: 'Financial-aid record systems; eligibility stays a decision people make',
    connect: 'Shows the action and the checklist; the aid office and its system decide',
    rows: [],
  },
  {
    id: 'scheduling',
    area: 'Scheduling and rooms',
    takesOver: 'Timetabling, room-booking and exam-scheduling tools',
    connect: 'Course-demand snapshots a department can read',
    rows: [],
  },
  {
    id: 'portal',
    area: 'Student portal and communications',
    takesOver: 'Student portals and mass-notification tools',
    connect: 'Today, the Action Center and one search, with source labels on every fact',
    rows: ['STU-001', 'STU-002'],
  },
  {
    id: 'advising',
    area: 'Advising',
    takesOver: 'Advising and appointment platforms such as EAB Navigate and Starfish',
    connect: 'Advisor agendas a student builds, shares and revokes',
    rows: [],
  },
  {
    id: 'career',
    area: 'Career services',
    takesOver: 'Career-services platforms such as Handshake',
    connect: 'The student’s own portfolio, evidence and application tracker',
    rows: ['UOS-004', 'UOS-005'],
  },
  {
    id: 'campus-life',
    area: 'Campus life and events',
    takesOver: 'Campus-engagement platforms for clubs and events',
    connect: 'Scoped, moderated communities',
    rows: ['UOS-003'],
  },
  {
    id: 'k12',
    area: 'K-12 student information and parent portal',
    takesOver: 'K-12 systems such as PowerSchool, Infinite Campus and Skyward, and parent-communication tools such as ParentSquare',
    connect: 'Nothing yet; a K-12 edition is planned on the same system',
    rows: [],
  },
  {
    id: 'advancement',
    area: 'Alumni relations and fundraising',
    takesOver: 'Advancement and fundraising CRMs such as Raiser’s Edge and Blackbaud CRM',
    connect: 'Alumni mentoring offers only; no giving yet',
    rows: [],
  },
];

type RowStatus = (id: string) => RegisterStatus | undefined;
const fromRegister: RowStatus = (id) => REGISTER.find((r) => r.id === id)?.status;

/** How far a module's Core build has come, read off its rows. Never above what they support. */
export function coreStatus(m: CoreModule, rowStatus: RowStatus = fromRegister, claims = CLAIMS): ClaimStatus {
  if (m.availableClaim) {
    const c = claims.find((x) => x.id === m.availableClaim);
    if (c?.status === 'available') return 'available';
  }
  if (m.rows.length === 0) return 'planned';
  const weakest = Math.min(...m.rows.map((r) => RANK[rowStatus(r) ?? 'not-started']));
  if (weakest >= RANK.tested) return 'built-tested';
  if (weakest >= RANK.building) return 'in-preparation';
  return 'planned';
}

/** The steps every module takes from Connect to Core, and back if it must. */
export const CUTOVER_STEPS: readonly [string, string][] = [
  ['Connect', 'Semester reads from the school’s system, which stays authoritative.'],
  ['Parallel run', 'Semester keeps its own records beside the school’s for a full term, and every difference is reported.'],
  ['Cutover', 'At a term boundary the school makes Semester that module’s system of record, with two approvers.'],
  ['Rollback', 'Switching back freezes Semester’s copy read-only; nothing is deleted.'],
];

/** True in Connect and in Core. */
export const IN_BOTH_MODES: readonly string[] = [
  'No student data is sold, and there is no advertising.',
  'AI explains, drafts and prepares; people make every official academic, admissions, financial-aid and disciplinary decision.',
  'No grade, retention, graduation or job outcome is promised.',
  'Every fact says where it came from.',
];

/** The company site's class for each word (`company-site/index.html` `.cs-*`). */
const SITE_CLASS: Record<ClaimStatus, string> = {
  available: 'cs-av',
  'limited-beta': 'cs-ip',
  'institution-configured': 'cs-ic',
  'built-tested': 'cs-bt',
  'in-preparation': 'cs-ip',
  planned: 'cs-pl',
};

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The company site's home-page block, between its `core-map` markers.
 * `replacementmap.test.ts` holds the file to this; `npm run registers` writes it.
 */
export function companySiteBlock(status: (m: CoreModule) => ClaimStatus = coreStatus): string {
  const rows = CORE_MODULES.map((m) => {
    const s = status(m);
    return `        <li data-core-module="${m.id}"><b>${esc(m.area)}</b> <span class="cs ${SITE_CLASS[s]}">${esc(STATUS_LABEL[s])}</span><br><span class="fine">Built to take over from: ${esc(m.takesOver)}. Today: ${esc(m.connect)}.</span></li>`;
  }).join('\n');
  const both = IN_BOTH_MODES.map((l) => `        <li>${esc(l)}</li>`).join('\n');
  return [
    '      <p class="eyebrow">Semester Core</p>',
    '      <h2 style="font-size:clamp(28px,3.4vw,40px);margin-top:12px">One system, one module at a time.</h2>',
    '      <p class="muted" style="margin-top:14px">Semester runs beside your systems today, in Connect mode, and is being built to become each one’s system of record. No school runs a module in Semester Core yet; until one does, its own system stays authoritative. The word beside each module is read from the register that holds this site to its word.</p>',
    '      <ul class="check" style="margin-top:20px">',
    rows,
    '      </ul>',
    '      <p class="eyebrow" style="margin-top:24px">True in both modes</p>',
    '      <ul class="check xlist" style="margin-top:12px">',
    both,
    '      </ul>',
  ].join('\n');
}
