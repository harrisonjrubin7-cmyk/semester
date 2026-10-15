/**
 * Launch content: what a school must have in place before students arrive,
 * and the package of guides that goes with it (launch-readiness Phase 6).
 *
 * Two registers, both held to their documents by `content.test.ts`:
 *
 * - `CONTENT_READINESS` — the thirteen kinds of institutional content a
 *   controlled launch needs (calendar, catalogue, services, emergency links…).
 *   Each says what kind of source it comes from, which stewardship role owns
 *   it, how often it is reviewed, who can see it, when it expires and how a
 *   student gets a mistake corrected. The per-school answers — the named
 *   person, the date last reviewed, the source link — live in
 *   `docs/launch/CONTENT-READINESS-REGISTER.md`, one row per item, and
 *   `readinessProblems` refuses to call a row ready without all of them.
 * - `LAUNCH_PACKAGE` — the seventeen guides, templates and pages in the
 *   launch package, each with a status and the file it lives in. `READY` means
 *   the file exists and passes the accessibility and claims checks in the test;
 *   anything unwritten says `NOT_STARTED` rather than pointing at a stub.
 *
 * Nothing here is shown to students. It is the operator's checklist, kept in
 * code so the checklist cannot quietly disagree with the app it describes.
 */
import type { StewardRole } from '../governance/data-contracts';
import type { Screen } from '../types';

/** The vocabulary of `source_records.source_type` (20260927170000_integration_control_plane.sql). */
export type SourceType = 'connected_institutional' | 'public_university' | 'manual_admin' | 'user_entered' | 'external_link';

export type Visibility = 'public' | 'school' | 'staff';

/**
 * How a student gets a mistake fixed.
 * - `in_app_feedback`: the Say something form (`components/SaySomething.tsx`),
 *   read by Semester, which forwards content errors to the owner below.
 * - `owning_office`: the office that publishes the fact corrects it at its
 *   source; Semester picks the change up on the next review or sync.
 * - `data_steward`: a connected domain's correction process, as its data
 *   contract states it (`lib/governance/data-contracts.ts`).
 */
export type CorrectionRoute = 'in_app_feedback' | 'owning_office' | 'data_steward';

export interface ContentItem {
  id: string;
  what: string;
  /** Where a school's copy of this comes from. The first is the expected one. */
  sources: readonly SourceType[];
  /** The stewardship role that answers for it. */
  owner: StewardRole;
  /** The longest a published copy may go unreviewed. */
  reviewEveryDays: number;
  visibility: Visibility;
  /** When a copy stops being true on its own, in words. */
  expires: string;
  correction: readonly CorrectionRoute[];
  /** Where it appears in the app. */
  appearsOn: readonly Screen[];
  /**
   * May it go out as an estimate, clearly labelled, when no verified source
   * exists? Only for planning aids; never for safety, policy or contacts.
   */
  estimateAllowed: boolean;
}

export const CONTENT_READINESS: readonly ContentItem[] = [
  { id: 'institution_profile', what: 'Verified institution profile: name, domains, terms, campuses', sources: ['manual_admin'], owner: 'data_owner', reviewEveryDays: 365, visibility: 'school', expires: 'When the school changes a domain or term system', correction: ['owning_office'], appearsOn: ['university'], estimateAllowed: false },
  { id: 'academic_calendar', what: 'Academic calendar: term dates, add/drop, withdrawal, exams, holidays', sources: ['public_university', 'connected_institutional'], owner: 'data_steward', reviewEveryDays: 90, visibility: 'school', expires: 'At the end of the term it describes', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['calendar', 'home'], estimateAllowed: false },
  { id: 'programs_degrees', what: 'Program and degree requirements, or a clear manual/estimated label', sources: ['public_university', 'connected_institutional', 'manual_admin'], owner: 'data_steward', reviewEveryDays: 180, visibility: 'school', expires: 'When the catalogue year it was taken from ends', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['degree'], estimateAllowed: true },
  { id: 'course_catalog', what: 'Course catalogue, each course linked to its official source', sources: ['public_university', 'connected_institutional'], owner: 'data_steward', reviewEveryDays: 120, visibility: 'public', expires: 'When the registrar publishes the next term', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['courses', 'degree'], estimateAllowed: false },
  { id: 'campus_services', what: 'Campus service directory: which office, what it does, how to reach it', sources: ['public_university', 'manual_admin'], owner: 'content_owner', reviewEveryDays: 90, visibility: 'school', expires: 'When an office changes hours, location or contact', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['support'], estimateAllowed: false },
  { id: 'learning_resources', what: 'Tutoring, writing center and library resources', sources: ['public_university', 'manual_admin'], owner: 'content_owner', reviewEveryDays: 90, visibility: 'school', expires: 'At the end of each term, when hours change', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['support', 'study'], estimateAllowed: false },
  { id: 'career_resources', what: 'Career office resources', sources: ['public_university', 'manual_admin'], owner: 'content_owner', reviewEveryDays: 180, visibility: 'school', expires: 'When the career office changes a service', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['career'], estimateAllowed: false },
  { id: 'organizations_events', what: 'Organizations and events, only where the school approved them', sources: ['connected_institutional', 'manual_admin'], owner: 'content_owner', reviewEveryDays: 30, visibility: 'school', expires: 'Each event at its end; each organization at its next registration cycle', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['hub', 'directory'], estimateAllowed: false },
  { id: 'emergency_safety', what: 'Emergency and safety resource links', sources: ['public_university'], owner: 'security_owner', reviewEveryDays: 30, visibility: 'public', expires: 'Never on its own — reviewed monthly because a wrong number is dangerous', correction: ['owning_office'], appearsOn: ['support'], estimateAllowed: false },
  { id: 'privacy_support_contacts', what: 'Privacy and support contacts', sources: ['manual_admin'], owner: 'privacy_owner', reviewEveryDays: 180, visibility: 'public', expires: 'When the named contact changes', correction: ['owning_office'], appearsOn: ['privacy', 'help'], estimateAllowed: false },
  { id: 'ai_policy', what: 'The school’s AI-use policy, linked, never paraphrased', sources: ['public_university'], owner: 'privacy_owner', reviewEveryDays: 180, visibility: 'public', expires: 'When the school revises its policy', correction: ['owning_office'], appearsOn: ['ask', 'privacy'], estimateAllowed: false },
  { id: 'accessibility_statement', what: 'Accessibility statement and how to request an accommodation', sources: ['public_university', 'manual_admin'], owner: 'content_owner', reviewEveryDays: 365, visibility: 'public', expires: 'When the statement or the accommodation route changes', correction: ['owning_office', 'in_app_feedback'], appearsOn: ['help', 'support'], estimateAllowed: false },
  { id: 'ownership_schedule', what: 'Source owners, freshness schedule and correction route for everything above', sources: ['manual_admin'], owner: 'data_owner', reviewEveryDays: 90, visibility: 'staff', expires: 'When any owner above changes', correction: ['owning_office'], appearsOn: ['university'], estimateAllowed: false },
];

/**
 * A named person, by the same rule `governance_steward_assignments.person_name`
 * enforces in SQL (20260927235000_governance_registries.sql). A department
 * inbox is not an owner; `content.test.ts` holds this list to the migration's.
 */
export const NOT_A_PERSON = /^(tbd|tba|todo|n\/?a|none|unknown|vacant|team|office|department|inbox)$/i;

export function namedPerson(name: string): boolean {
  const t = name.trim();
  return t.length >= 2 && t.length <= 200 && !t.includes('@') && !NOT_A_PERSON.test(t);
}

export type ReadinessStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';

/** One school's row for one item, as the register records it. */
export interface ReadinessRecord {
  item: string;
  status: ReadinessStatus;
  owner: string;
  source: string;
  /** ISO date the published copy was last checked against its source. */
  reviewed: string;
  estimate: boolean;
}

const DAY = 86_400_000;

/**
 * What stops a record being called ready. A row that does not claim READY is
 * not held to anything — an honest NOT_STARTED is the point of the register.
 */
export function readinessProblems(r: ReadinessRecord, today: string, exists: (path: string) => boolean = () => false): string[] {
  const item = CONTENT_READINESS.find((c) => c.id === r.item);
  if (!item) return [`${r.item}: not a content item`];
  if (r.status !== 'READY') return [];
  const out: string[] = [];
  if (!namedPerson(r.owner)) out.push(`${r.item}: owner must be a named person, not "${r.owner}"`);
  if (/^docs\/evidence\/\S+$/.test(r.source)) {
    if (!exists(r.source)) out.push(`${r.item}: ${r.source} is not filed`);
  } else if (!/^https:\/\/\S+$/.test(r.source)) {
    out.push(`${r.item}: source must be an https link or a filed record under docs/evidence/`);
  }
  const reviewed = Date.parse(r.reviewed);
  if (Number.isNaN(reviewed)) out.push(`${r.item}: no review date`);
  else if (reviewed > Date.parse(today)) out.push(`${r.item}: reviewed ${r.reviewed}, which is after today`)
  else if (Date.parse(today) - reviewed > item.reviewEveryDays * DAY) out.push(`${r.item}: review overdue (every ${item.reviewEveryDays} days)`);
  if (r.estimate && !item.estimateAllowed) out.push(`${r.item}: may not go out as an estimate`);
  return out;
}

export type Audience = 'student' | 'faculty' | 'advisor' | 'admin' | 'staff' | 'public';

export interface PackageItem {
  id: string;
  title: string;
  audience: readonly Audience[];
  status: ReadinessStatus;
  /** The file it lives in. Required when READY or IN_PROGRESS. */
  path?: string;
  /** Why it is not written, or what it waits on. */
  note?: string;
}

export const LAUNCH_PACKAGE: readonly PackageItem[] = [
  { id: 'student_quick_start', title: 'Student quick-start guide', audience: ['student'], status: 'READY', path: 'docs/launch/STUDENT-QUICK-START.md' },
  { id: 'what_is_semester', title: '60-second “What is Semester?”', audience: ['student', 'public'], status: 'IN_PROGRESS', path: 'docs/launch/WHAT-IS-SEMESTER.md', note: 'The script is written; a video needs captions and a transcript before it counts' },
  { id: 'first_day_checklists', title: 'Role-specific first-day checklists', audience: ['student', 'faculty', 'advisor', 'admin'], status: 'READY', path: 'docs/launch/FIRST-DAY-CHECKLISTS.md' },
  { id: 'faculty_quick_start', title: 'Course and faculty quick-start guide', audience: ['faculty'], status: 'READY', path: 'docs/launch/FACULTY-QUICK-START.md' },
  { id: 'advisor_quick_start', title: 'Advisor quick-start guide', audience: ['advisor'], status: 'READY', path: 'docs/launch/ADVISOR-QUICK-START.md' },
  { id: 'admin_onboarding', title: 'Admin onboarding guide', audience: ['admin'], status: 'READY', path: 'docs/launch/ADMIN-OPERATIONS-GUIDE.md' },
  { id: 'accessibility_guide', title: 'Accessibility guide', audience: ['student', 'staff'], status: 'NOT_STARTED', note: 'Needs the accessibility conformance evidence first, so it describes what was tested rather than what was intended' },
  { id: 'privacy_ai_guide', title: 'Privacy and AI-use guide', audience: ['student'], status: 'IN_PROGRESS', path: 'app/src/lib/privacy.ts', note: 'The Privacy screen states each claim and a test holds it; a guide for the school’s own AI policy waits on that policy' },
  { id: 'source_freshness_guide', title: 'Source and freshness guide', audience: ['student', 'staff'], status: 'NOT_STARTED' },
  { id: 'support_center', title: 'Support center', audience: ['student'], status: 'IN_PROGRESS', path: 'app/src/screens/Help.tsx', note: 'How this works is generated from the app; tickets to Semester support are #839, behind a flag' },
  { id: 'announcement_templates', title: 'Campus announcement templates', audience: ['admin'], status: 'READY', path: 'docs/launch/ANNOUNCEMENT-TEMPLATES.md' },
  { id: 'orientation_slide', title: 'Orientation slide', audience: ['student'], status: 'NOT_STARTED' },
  { id: 'ambassador_kit', title: 'Student ambassador kit', audience: ['student'], status: 'NOT_STARTED', note: 'Waits on the pilot recruiting ambassadors; an ambassador speaks for themselves and is never paid per sign-up' },
  { id: 'faq', title: 'FAQ library', audience: ['student', 'staff'], status: 'READY', path: 'docs/launch/FAQ.md' },
  { id: 'integration_status', title: 'Integration status page', audience: ['staff'], status: 'NOT_STARTED', note: 'The Integration Dashboard exists for staff behind its flag; a page for students is not written' },
  { id: 'known_limitations', title: 'Known limitations page', audience: ['student', 'staff'], status: 'READY', path: 'docs/launch/KNOWN-LIMITATIONS.md' },
  { id: 'office_hours_calendar', title: 'Office-hours and live onboarding calendar', audience: ['student', 'staff'], status: 'NOT_STARTED', note: 'Needs named people and times from the pilot' },
];

export function packageProblems(p: PackageItem, exists: (path: string) => boolean): string[] {
  const out: string[] = [];
  if (p.status !== 'NOT_STARTED' && !p.path) out.push(`${p.id}: ${p.status} with no file`);
  if (p.path && !exists(p.path)) out.push(`${p.id}: ${p.path} does not exist`);
  if (p.status === 'NOT_STARTED' && p.path) out.push(`${p.id}: NOT_STARTED but points at ${p.path}`);
  return out;
}
