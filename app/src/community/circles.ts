/**
 * Peer circles and structured study groups: bounded groups with a purpose,
 * a cap, a start and an end.
 *
 * A circle is the blueprint's answer to the anonymous feed — "a bounded
 * group is safer and more useful than an endless anonymous feed" — and the
 * bounds are the whole design. `openCircle` refuses a circle without a
 * purpose, a facilitator who has finished training, a cap, an end date, a
 * code of conduct, a reporting route and a closure plan. `join` refuses a
 * full circle and one that has ended. Nothing here reads anything about a
 * person to decide who belongs: membership is a choice the student makes,
 * and `FORBIDDEN_INPUTS` names what may never be an input to suggesting one.
 *
 * The `communities` table (kind `study_group`) is where a circle will live;
 * it has no cap, dates or facilitator columns today, and this is the rule
 * those columns will be held to. `circles.test.ts` holds it now.
 */
import { NOT_AN_EMERGENCY_SERVICE } from './governance';

export const CIRCLE_TYPES = [
  { id: 'first_year', name: 'First-year transition circle', purpose: 'Finding your feet in the first term' },
  { id: 'transfer', name: 'Transfer-student circle', purpose: 'Navigating a new institution with credits already earned' },
  { id: 'study_accountability', name: 'Study accountability circle', purpose: 'Keeping study plans with people who keep theirs' },
  { id: 'pre_health', name: 'Pre-health planning circle', purpose: 'Planning prerequisites, experience and applications' },
  { id: 'internship_search', name: 'Internship-search circle', purpose: 'Searching and applying together' },
  { id: 'grad_school', name: 'Graduate-school preparation circle', purpose: 'Tests, statements, recommendations and timing' },
  { id: 'commuter', name: 'Commuter-student circle', purpose: 'Belonging without living on campus' },
  { id: 'international', name: 'International student orientation circle', purpose: 'Campus resources and peer connection; never legal or immigration advice' },
  { id: 'accessible_study', name: 'Accessible study circle', purpose: 'Study practices and resource navigation; no diagnosis disclosure asked' },
  { id: 'course_study', name: 'Course study circle', purpose: 'One course, one term' },
  { id: 'founder', name: 'Founder and creator circle', purpose: 'Building something alongside a degree' },
  { id: 'volunteer', name: 'Volunteer and service circle', purpose: 'Service together' },
] as const;

export type CircleType = (typeof CIRCLE_TYPES)[number]['id'];

/** Types whose membership is never listed to other members' classmates or the campus. */
export const SENSITIVE_TYPES: readonly CircleType[] = ['accessible_study', 'international', 'transfer', 'first_year'];

export const MIN_CAP = 3;
export const MAX_CAP = 16;
/** A circle runs a term at most; a standing group is a community, not a circle. */
export const MAX_DAYS = 120;

export type Format = 'in_person' | 'online' | 'hybrid';

export interface Facilitator {
  id: string;
  name: string;
  /** ISO date the peer-leader training was completed; `null` when it was not. */
  trainedOn: string | null;
}

export interface Circle {
  id: string;
  type: CircleType;
  purpose: string;
  cap: number;
  startsOn: string;
  endsOn: string;
  facilitator: Facilitator;
  conductVersion: string;
  /** Optional. A circle without one meets when it meets. */
  cadence?: string;
  format: Format;
  accessibility: string;
  timeZone: string;
  /** Where a member goes with a problem. Always shown; never the emergency route's substitute. */
  reportingRoute: string;
  closurePlan: string;
  /** Event safety boundaries: where the circle may and may not meet. */
  meetingBoundaries: string;
}

export type OpenVerdict = { ok: true; circle: Circle } | { ok: false; problems: string[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function openCircle(input: Circle): OpenVerdict {
  const problems: string[] = [];
  if (!CIRCLE_TYPES.some((t) => t.id === input.type)) problems.push('not a circle type');
  if (input.purpose.trim().length < 12) problems.push('a purpose, written for the people who might join');
  if (!Number.isInteger(input.cap) || input.cap < MIN_CAP || input.cap > MAX_CAP) problems.push(`a membership cap between ${MIN_CAP} and ${MAX_CAP}`);
  if (!ISO.test(input.startsOn) || !ISO.test(input.endsOn)) problems.push('a start and an end date');
  else {
    const length = days(input.startsOn, input.endsOn);
    if (length < 7) problems.push('at least a week between start and end');
    if (length > MAX_DAYS) problems.push(`no more than ${MAX_DAYS} days: a circle has a term, not a lifetime`);
  }
  if (!input.facilitator.trainedOn) problems.push('a facilitator who has completed peer-leader training');
  if (!input.conductVersion.trim()) problems.push('the code of conduct, by version');
  if (!input.reportingRoute.trim()) problems.push('a reporting route');
  if (!input.closurePlan.trim()) problems.push('a closure plan: what happens at the end date');
  if (!input.accessibility.trim()) problems.push('accessibility details, even "none arranged yet"');
  if (!input.timeZone.trim()) problems.push('a time zone');
  if (!input.meetingBoundaries.trim()) problems.push('where the circle may meet');
  return problems.length ? { ok: false, problems } : { ok: true, circle: input };
}

export interface Membership {
  circleId: string;
  memberId: string;
  joinedOn: string;
}

export type JoinVerdict = { ok: true; membership: Membership } | { ok: false; reason: string };

/** Joining is a choice; the only refusals are the bounds. */
export function join(circle: Circle, members: readonly Membership[], memberId: string, today: string): JoinVerdict {
  if (members.some((m) => m.memberId === memberId)) return { ok: false, reason: 'already a member' };
  if (today > circle.endsOn) return { ok: false, reason: 'this circle has closed' };
  if (members.length >= circle.cap) return { ok: false, reason: `this circle is full at ${circle.cap}` };
  return { ok: true, membership: { circleId: circle.id, memberId, joinedOn: today } };
}

/** Whether another member may see who else is in the circle. Sensitive types: no. */
export function rosterVisible(circle: Circle): boolean {
  return !SENSITIVE_TYPES.includes(circle.type);
}

/** What a circle's page always says, whatever the facilitator writes. */
export const ALWAYS_SHOWN = [NOT_AN_EMERGENCY_SERVICE, 'Leaving is one tap, and nobody is told why.'] as const;

/**
 * What may never be an input to suggesting a circle or a study group to a
 * student. A suggestion is explained from what the student chose (interests,
 * course, availability, format) and from nothing else.
 */
export const FORBIDDEN_INPUTS = [
  'grade', 'gpa', 'standing', 'accommodation', 'disability', 'diagnosis', 'health', 'religion', 'ethnicity', 'race',
  'nationality', 'immigration', 'orientation', 'gender', 'income', 'aid', 'risk', 'attendance', 'submission', 'location',
] as const;

export function assertSuggestionInputs(input: Record<string, unknown>): void {
  const keys = Object.keys(input).map((k) => k.toLowerCase());
  const hit = FORBIDDEN_INPUTS.filter((f) => keys.some((k) => k.includes(f)));
  if (hit.length) throw new Error(`a suggestion may not read: ${hit.join(', ')}`);
}

// ── Structured study groups ─────────────────────────────────────────────────

/**
 * A study group is a circle of type `course_study` with a study plan. The
 * plan is the group's own; the four things under `NEVER_SHARED` are the
 * institution's or the student's, and no group setting can pull them in.
 */
export interface StudyPlan {
  courseOrTopic: string;
  term: string;
  meetingPattern: string;
  format: Format;
  goals: readonly string[];
  materialsPolicy: string;
  /** Rotates; see `nextFacilitator`. */
  facilitatorRotation: readonly string[];
  calendarLinks: readonly string[];
  /** Members who opted in to shared meeting notes. Nobody else's notes are kept. */
  notesOptIn: readonly string[];
}

export const NEVER_SHARED = ['grades', 'accommodations', 'attendance', 'assignment submissions', 'private course data'] as const;

/** Attendance is never recorded for a study group: the constant a screen reads instead of a setting. */
export const ATTENDANCE_OPTIONAL = true as const;

export const INTEGRITY_REMINDER =
  'Study together; submit your own work. Your course\'s academic-integrity policy applies to everything shared here.';

/** Who facilitates the meeting after `current`. Round-robin; an empty rotation has no facilitator. */
export function nextFacilitator(plan: StudyPlan, current: string | null): string | null {
  const r = plan.facilitatorRotation;
  if (!r.length) return null;
  const i = current ? r.indexOf(current) : -1;
  return r[(i + 1) % r.length];
}

/** Whether a member's notes may be shown to the group: only the member's own opt-in says so. */
export function notesShared(plan: StudyPlan, memberId: string): boolean {
  return plan.notesOptIn.includes(memberId);
}
