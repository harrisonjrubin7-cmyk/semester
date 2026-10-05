import { MODULE_FLAG_NAMES, type ModuleFlag } from '../experience-flags';
import type { Screen } from '../types';
import { TIER_REVIEWERS, type Reviewer, type Tier } from './config-tiers';

/**
 * The policy simulator: before an institution changes a policy, what would
 * change, for whom, and what would be written down.
 *
 * The control plane can stage a policy change and apply it through the
 * gateway. What it could not do is answer the questions the brief puts
 * before the switch — *if we turn Course Studio off in this course, which
 * students see the change, which workflows are affected, which alternatives
 * remain, what support content should update, and what audit event will be
 * created; if we change a retention clock from 365 to 180 days, which data
 * classes are affected, which exports and deletions change, and which
 * contracts need review.*
 *
 * Two kinds of change, each simulated from data this file holds about the
 * modules (`experience-flags.ts`) and the retention clocks (`RETENTION.md`),
 * and each ending in the reviewers `config-tiers.ts` says a change at that
 * tier needs. Nothing here changes anything: a simulation is a description
 * of consequences, and the console prints it beside the button.
 *
 * ## The one refusal
 *
 * A retention clock may never be put on a student's own work. `RETENTION.md`
 * is load-bearing on this: "until you delete it" is the promise the privacy
 * page makes, so a simulated change to a `student-work` class returns
 * `refused` with the reason, and the console shows the refusal instead of a
 * plan. Shortening an audit clock below its legal floor is refused the same
 * way. The simulator is the first place a reviewer meets the rule, which is
 * where it should be met.
 */

export type DataClass = 'operational' | 'student-record' | 'audit' | 'commercial' | 'student-work';

export interface ModuleEffect {
  label: string;
  /** The screens that change when the module goes off. */
  screens: Screen[];
  /** The student or staff workflows that stop or change. */
  workflows: string[];
  /** What remains when it is off. */
  alternatives: string[];
  /** Support content that should be updated: repository paths, held to exist by the test. */
  support: string[];
  /** The configuration tier of the switch, which decides the reviewers. */
  tier: Tier;
  /**
   * Whether a course can switch it. Every module is switched by an
   * institution-wide build variable (`MODULE_FLAG_ENV`); only Course Studio
   * also has a per-course policy an instructor publishes, so only it can be
   * simulated for one course. Simulating a course scope for any other module
   * is refused rather than described, because the described consequence is
   * one the implemented controls cannot produce.
   */
  perCourse: boolean;
}

export const MODULE_EFFECTS: Record<ModuleFlag, ModuleEffect> = {
  today_action_center: { label: 'Action Center on Today', screens: ['home'], workflows: ['Ranked actions on Today', '“Ask for help” from an action'], alternatives: ['The Today briefing with due, on and next', 'Key dates on the registrar screen'], support: ['docs/TODAY-ACTION-CENTER.md', 'docs/launch/FAQ.md'], tier: 2, perCourse: false },
  registration_day_mode: { label: 'Registration day mode', screens: ['registrar'], workflows: ['The registration-day checklist and countdown', 'Backup picks beside the plan'], alternatives: ['The registrar screen’s dates and the plan’s conflict check', 'The public registration checklist tool'], support: ['docs/REGISTRATION-DAY-MODE.md', 'docs/launch/FAQ.md'], tier: 2, perCourse: false },
  graduation_simulator: { label: 'Graduation simulator', screens: ['pathway'], workflows: ['Terms-to-finish scenarios on the degree path'], alternatives: ['The degree path’s remaining requirements', 'The public graduation timeline tool'], support: ['docs/GRADUATION-AND-COST-SIMULATOR.md'], tier: 2, perCourse: false },
  cost_planner: { label: 'Cost planner', screens: ['costs'], workflows: ['Term cost scenarios'], alternatives: ['Costs as entered, without scenarios', 'The financial-aid office, by directory'], support: ['docs/GRADUATION-AND-COST-SIMULATOR.md', 'docs/FINANCIAL-READINESS-WORKSPACE.md'], tier: 2, perCourse: false },
  academic_life_balance: { label: 'Academic-life balance', screens: ['home', 'calendar'], workflows: ['Load and balance on the week'], alternatives: ['The calendar and the week as they are'], support: ['docs/ACADEMIC-LIFE-BALANCE.md'], tier: 2, perCourse: false },
  crunch_week_forecast: { label: 'Crunch-week forecast', screens: ['home', 'calendar'], workflows: ['The heavy-week warning'], alternatives: ['The calendar’s own view of the week'], support: ['docs/ACADEMIC-LIFE-BALANCE.md'], tier: 2, perCourse: false },
  course_detail_v2: { label: 'Course detail, second design', screens: ['courses'], workflows: ['The redesigned course screen'], alternatives: ['The course screen as it was'], support: ['docs/COURSE-DETAIL-V2.md'], tier: 2, perCourse: false },
  advisor_meeting_mode: { label: 'Advisor meeting mode', screens: ['meet'], workflows: ['The advising agenda and its sharing'], alternatives: ['The public advisor meeting planner', 'A note the student writes and brings'], support: ['docs/ADVISOR-MEETING-MODE.md', 'docs/launch/FAQ.md'], tier: 2, perCourse: false },
  study_readiness: { label: 'Study readiness', screens: ['study'], workflows: ['Readiness per unit before an exam'], alternatives: ['The study guide and practice as they are'], support: ['docs/STUDY-READINESS-AND-SOURCE-LOCKER.md'], tier: 2, perCourse: false },
  source_locker: { label: 'Source locker', screens: ['study'], workflows: ['Locking the sources a study session may use'], alternatives: ['Sources chosen per session, unlocked'], support: ['docs/STUDY-READINESS-AND-SOURCE-LOCKER.md'], tier: 3, perCourse: false },
  career_evidence: { label: 'Career evidence', screens: ['career'], workflows: ['Evidence of skills collected from coursework'], alternatives: ['Applications and deadlines without evidence'], support: ['docs/CAREER-EVIDENCE.md'], tier: 2, perCourse: false },
  office_action_feed: { label: 'Office action feed', screens: ['home', 'registrar'], workflows: ['Actions published by campus offices reaching students', 'The office desk for accounts that may publish'], alternatives: ['Offices reach students through their own portals and mail', 'Key dates entered by the student'], support: ['docs/OFFICE-ACTION-FEED.md', 'docs/launch/FAQ.md'], tier: 3, perCourse: false },
  demand_forecasting: { label: 'Course demand forecasting', screens: ['university'], workflows: ['Staff demand counts at n ≥ 10'], alternatives: ['The institution’s own enrollment reports'], support: ['docs/COURSE-DEMAND-FORECASTING.md'], tier: 3, perCourse: false },
  semester_wrapped: { label: 'Semester wrapped', screens: ['home'], workflows: ['The end-of-term summary'], alternatives: ['Grades and the calendar as they stand'], support: ['docs/SEMESTER-WRAPPED.md'], tier: 2, perCourse: false },
  offline_engine_tasks: { label: 'Actions through the sync engine', screens: ['home'], workflows: ['Your actions saved offline and sent when a connection returns, with the sync line saying what the account has not confirmed'], alternatives: ['Actions sync with the rest of the semester copy, as they did; the device copy opens either way'], support: ['docs/architecture/mobile-offline-reference.md', 'docs/OFFLINE-MODE.md'], tier: 3, perCourse: false },
  offline_mode: { label: 'Offline mode', screens: ['home', 'recovery'], workflows: ['Working without a connection, with the sync record'], alternatives: ['The device copy still opens; sync waits for a connection'], support: ['docs/OFFLINE-MODE.md', 'docs/launch/KNOWN-LIMITATIONS.md'], tier: 2, perCourse: false },
  trust_center: { label: 'Trust center', screens: ['privacy'], workflows: ['The in-app trust center'], alternatives: ['The public security, privacy and accessibility pages'], support: ['docs/TRUST-CENTER.md'], tier: 3, perCourse: false },
  course_studio: { label: 'Course Studio', screens: ['courses', 'ask', 'study'], workflows: ['An instructor publishing rules and guidance', 'The course’s AI policy shown before the assistant answers', 'Faculty-approved study packs'], alternatives: ['The AI policy the student records for the course', 'Rules the instructor publishes on the syllabus'], support: ['docs/FACULTY-COURSE-STUDIO-DESIGN.md', 'docs/FACULTY-ENABLEMENT.md', 'docs/launch/FAQ.md'], tier: 3, perCourse: true },
};

export type Scope = 'course' | 'tenant';

export interface ModuleChange {
  kind: 'module-off';
  module: ModuleFlag;
  scope: Scope;
  /** The course, when the scope is one. */
  course?: string;
}

/** A retention clock, as `RETENTION.md` states it. `days` is null for “until deleted”. */
export interface Clock {
  id: string;
  label: string;
  dataClass: DataClass;
  days: number | null;
  /** The migration or function that enforces it, held to exist by the test. */
  enforcedBy: string;
  /** The legal or contractual floor in days, when one exists. */
  floor: number | null;
  exports: string[];
  deletions: string[];
  contracts: string[];
}

export const CLOCKS: readonly Clock[] = [
  { id: 'student-work', label: 'Notes, actions, courses, plans and everything a student typed', dataClass: 'student-work', days: null, enforcedBy: 'RETENTION.md', floor: null, exports: ['Export data (every plan)', 'Download my account data'], deletions: ['Delete account', 'Erase this device'], contracts: ['The privacy page’s “until you delete it”'] },
  { id: 'access_log', label: 'Who read a student’s rows (access_log)', dataClass: 'audit', days: 90, enforcedBy: 'supabase/migrations/20260921143653_access_log.sql', floor: null, exports: ['Download my account data (the log of reads)'], deletions: ['Drops with the account'], contracts: ['Data-processing agreement: access logging'] },
  { id: 'activity', label: 'Activity record (activity)', dataClass: 'operational', days: 400, enforcedBy: 'supabase/migrations/20260921151000_activity.sql', floor: null, exports: ['Download my account data'], deletions: ['Drops with the account'], contracts: [] },
  { id: 'gateway_audit', label: 'Gateway audit metadata', dataClass: 'audit', days: 180, enforcedBy: 'supabase/migrations/20260924184500_gateway_action_journal.sql', floor: null, exports: ['Controlled export for a reviewer (owed)'], deletions: ['Hourly sweep'], contracts: ['Data-processing agreement: AI processing records'] },
  { id: 'tombstones', label: 'Tombstones of deleted notes, actions, appointments, sittings and courses', dataClass: 'operational', days: 90, enforcedBy: 'supabase/migrations/20260901000700_records.sql', floor: null, exports: [], deletions: ['Weekly sweep; a tombstone shorter than the sync window breaks a device’s catch-up'], contracts: [] },
  { id: 'audit_events', label: 'Role-grant, moderation and provisioning audit events', dataClass: 'audit', days: 1095, enforcedBy: 'supabase/migrations/20260929030000_retention_sweeps.sql', floor: 1095, exports: ['Controlled export for a reviewer (owed)'], deletions: ['Daily sweep through the narrowly authorised path'], contracts: ['Security addendum: audit retention', 'HECVAT answers on audit logging'] },
  { id: 'invites', label: 'Invitations never taken up', dataClass: 'commercial', days: 90, enforcedBy: 'supabase/migrations/20260929030000_retention_sweeps.sql', floor: null, exports: [], deletions: ['Daily sweep'], contracts: [] },
  { id: 'abandoned_signups', label: 'Sign-ups never finished', dataClass: 'commercial', days: 30, enforcedBy: 'supabase/migrations/20260929030000_retention_sweeps.sql', floor: null, exports: [], deletions: ['Daily sweep'], contracts: [] },
];

export interface RetentionChange {
  kind: 'retention';
  clock: string;
  toDays: number;
}

export type Change = ModuleChange | RetentionChange;

export interface Simulation {
  /** One sentence naming the change. */
  change: string;
  /** Who sees it. */
  who: string;
  workflows: string[];
  alternatives: string[];
  /** Support content to update: repository paths. */
  support: string[];
  dataClasses: DataClass[];
  exports: string[];
  deletions: string[];
  contracts: string[];
  /** The audit event the change would create, and what it records. */
  audit: { event: string; records: string[] };
  reviewers: Reviewer[];
  /** Why the change cannot be made, when it cannot. */
  refused: string | null;
}

export function clockById(id: string): Clock {
  const c = CLOCKS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown clock ${id}`);
  return c;
}

const AUDIT_RECORDS = ['Who made it and under which capability', 'The tenant, and the course when the scope is one', 'The value before and after', 'The reviewers who signed', 'When it took effect'];

export function simulateModule(change: ModuleChange): Simulation {
  const e = MODULE_EFFECTS[change.module];
  if (change.scope === 'course' && !e.perCourse) {
    return {
      change: `Turn ${e.label} off in one course.`,
      who: '',
      workflows: [],
      alternatives: [],
      support: [],
      dataClasses: [],
      exports: [],
      deletions: [],
      contracts: [],
      audit: { event: `policy.module.${change.module}.off`, records: [] },
      reviewers: [],
      refused: `${e.label} is switched for the whole institution by its build setting; there is no per-course switch, so a course-only change cannot be simulated. Simulate it for the whole institution.`,
    };
  }
  const where = change.scope === 'course' ? `in ${change.course?.trim() || 'this course'}` : 'for the whole institution';
  return {
    change: `Turn ${e.label} off ${where}.`,
    who:
      change.scope === 'course'
        ? `Every student enrolled in ${change.course?.trim() || 'this course'}, and the staff who publish to it. Nobody else notices.`
        : 'Every student and staff member at the institution, on the screens named below.',
    workflows: e.workflows,
    alternatives: e.alternatives,
    support: e.support,
    dataClasses: [],
    exports: [],
    deletions: [],
    contracts: e.tier === 3 ? ['The order form, if the module is named in it'] : [],
    audit: { event: `policy.module.${change.module}.off`, records: AUDIT_RECORDS },
    reviewers: [...TIER_REVIEWERS[e.tier]],
    refused: null,
  };
}

export function simulateRetention(change: RetentionChange): Simulation {
  const c = clockById(change.clock);
  const from = c.days === null ? 'until deleted' : `${c.days} days`;
  const base: Simulation = {
    change: `Change the ${c.label} clock from ${from} to ${change.toDays} days.`,
    who: c.dataClass === 'audit' ? 'Reviewers and the security seat; students do not see this data.' : 'Every account at the institution whose rows the clock covers.',
    workflows: [],
    alternatives: [],
    support: ['RETENTION.md', 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md'],
    dataClasses: [c.dataClass],
    exports: c.exports,
    deletions: c.deletions,
    contracts: c.contracts,
    audit: { event: `policy.retention.${c.id}`, records: AUDIT_RECORDS },
    reviewers: [...TIER_REVIEWERS[3]],
    refused: null,
  };
  if (c.dataClass === 'student-work') {
    return { ...base, refused: 'A retention clock may not be put on a student’s own work. The privacy page promises it is kept until they delete it, and that promise is not a setting.' };
  }
  if (!Number.isInteger(change.toDays) || change.toDays < 1) {
    return { ...base, refused: 'A clock is a whole number of days, at least one.' };
  }
  if (c.floor !== null && change.toDays < c.floor) {
    return { ...base, refused: `${c.label} has a floor of ${c.floor} days; shortening it would break the audit-retention commitment.` };
  }
  if (c.days !== null && change.toDays === c.days) {
    return { ...base, refused: 'That is the clock already.' };
  }
  return base;
}

/** One entry point for the console. */
export function simulate(change: Change): Simulation {
  return change.kind === 'module-off' ? simulateModule(change) : simulateRetention(change);
}

/** Every module, for a select. */
export const MODULES: readonly ModuleFlag[] = MODULE_FLAG_NAMES;
