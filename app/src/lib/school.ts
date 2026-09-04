/**
 * What a school has, rather than which school it is.
 *
 * The app was built for one university and it shows in the places you would
 * expect: a meal plan screen that says Commodore Cash, a registrar link that
 * goes to YES, a buildings list that only contains Vanderbilt buildings. None
 * of that is wrong. It is the reason the app is good — an app that knows your
 * campus beats one that knows campuses in general.
 *
 * The mistake would be to make it work everywhere by making it good nowhere.
 *
 * ## Capabilities, not schools
 *
 * So no screen asks "is this Vanderbilt?". Screens ask "does this school have
 * a meal plan?", and Vanderbilt is the school that answers yes with swipes and
 * a card called Commodore Cash. That single rule is what stops school support
 * from being unbounded work: adding a university is filling in a form, and if
 * supporting one ever needs a code change then this abstraction is wrong and
 * should be fixed rather than worked around.
 *
 * A screen whose capability is absent disappears from navigation and search. It
 * does not render an error, and it does not render an empty state apologising
 * for somebody's university.
 *
 * ## Vanderbilt ships in the bundle, not only in a database
 *
 * `data/schools/vanderbilt.json` is compiled in. A Vanderbilt student who opens
 * the app offline, signed out, on a first launch gets the whole thing with no
 * network call — which is the local-first guarantee the rest of the app already
 * keeps. A row in the account exists so the profile can be corrected without a
 * redeploy, not because the app depends on one.
 *
 * ## The data pack, for depth a boolean cannot hold
 *
 * Flags answer "does this exist". They cannot hold an academic calendar, a
 * buildings list with coordinates, or the rule that move-out is counted from
 * your last exam rather than a fixed date. Those live in `data`, where every
 * branch is optional and every screen degrades to asking the student instead.
 *
 * That last one is the pattern for all of this: the smart Vanderbilt behaviour
 * is not deleted, it is promoted to a named rule — `hours_after_last_exam` —
 * and Vanderbilt becomes the school that uses it.
 */

import { readGradeSystem, type GradeSystem } from './cutoffs';

/** What the app may offer, given where somebody studies. */
export interface Capabilities {
  mealPlan: 'swipes' | 'dollars' | 'both' | 'none';
  /** What the campus card's money is called. "Commodore Cash". */
  cardName?: string;
  /** What a swipe is called. "meal swipes", "board meals". */
  swipeUnit?: string;
  /** Whether the app manages a move-out date at all. */
  housing: boolean;
  /** "YES", "Testudo", "Albert". */
  registrarName?: string;
  registrarUrl?: string;
  /** "Anchor Link", "Involved@UMD". */
  orgPortalName?: string;
  orgPortalUrl?: string;
  /** Display only — the feed below is the same code whatever this says. */
  lmsName?: string;
  lmsUrl?: string;
  /** Where this school tells students to find their personal calendar feed. */
  lmsIcsHelpUrl?: string;
  /** Whether there is a buildings list to put on a map. */
  campusMap: boolean;
  /** "Commodores". */
  athleticsName?: string;
  libraryUrl?: string;
  healthUrl?: string;
  advisingUrl?: string;
}

/** One term as the registrar publishes it. */
export interface TermCalendar {
  termName: string;
  startsOn: string;
  endsOn: string;
  deadlines: { label: string; on: string }[];
  breaks?: { label: string; from: string; to: string }[];
  finalsFrom?: string;
  finalsTo?: string;
}

/** Depth that a capability flag cannot carry. Every branch optional. */
export interface SchoolData {
  academicCalendar?: TermCalendar[];
  buildings?: { name: string; abbr?: string; lat: number; lng: number }[];
  mealPlanTiers?: { name: string; swipes: number; dollars: number; period: 'week' | 'term' }[];
  housing?: {
    /**
     * Vanderbilt counts move-out from your last exam. That is a better rule
     * than a fixed date and it is not a Vanderbilt fact — it is a rule, and
     * Vanderbilt is a school that uses it.
     */
    moveOutRule: 'fixed_date' | 'hours_after_last_exam';
    hoursAfterLastExam?: number;
    fixedDate?: string;
  };
  gradingNotes?: string;
  /**
   * The school's own grading scale, where it publishes one.
   *
   * Absent for most, including Vanderbilt: a university publishes what an A−
   * is worth towards a GPA and leaves the percentage that earns one to the
   * instructor. See `lib/cutoffs.ts` — a school with no scale here gets the
   * common table, stated as an assumption, rather than a number nobody wrote.
   */
  gradeSystem?: GradeSystem;
  athleticsFeedUrl?: string;
}

export interface School {
  id: string;
  name: string;
  shortName?: string;
  capabilities: Capabilities;
  data: SchoolData;
  /**
   * A profile nobody else's edit can degrade.
   *
   * Vanderbilt's is seeded true. The point is not status; it is that the
   * school this app was built around should not be editable by a stranger who
   * signed up and mistyped something.
   */
  verified: boolean;
}

/**
 * The school of somebody who has not said where they study.
 *
 * Everything off. This is not a degraded state to apologise for — it is
 * roughly eighty per cent of the app, which is the whole reason capability
 * gating is worth doing rather than shipping four separate builds.
 */
export const NO_SCHOOL: School = {
  id: '',
  name: '',
  capabilities: { mealPlan: 'none', housing: false, campusMap: false },
  data: {},
  verified: false,
};

/**
 * Which screens need something the school may not have.
 *
 * Everything not named here is universal and always available. That list is
 * the actual product: Today, Courses, Grades, Study, cards, practice papers,
 * the exam runway, essays, notes, the weekly report. None of it asks where you
 * are enrolled.
 */
export const REQUIRES: Record<string, (c: Capabilities) => boolean> = {
  meals: (c) => c.mealPlan !== 'none',
  housing: (c) => c.housing,
  // The portal, not the dates. `registrar` — Term deadlines — is deliberately
  // absent: add/drop and withdrawal dates exist at every university, and a
  // school with no calendar in its pack gets a list to fill in rather than no
  // screen. Driving this caught it hiding for anyone outside Vanderbilt, which
  // would have been the refactor making the app worse to make it general.
  yes: (c) => Boolean(c.registrarUrl),
  activities: (c) => Boolean(c.orgPortalUrl),
  maps: (c) => c.campusMap,
};

/** Whether a screen can be offered at all. Unlisted screens always can. */
export function allowed(screen: string, c: Capabilities): boolean {
  const need = REQUIRES[screen];
  return need ? need(c) : true;
}

/** Every screen that must be hidden for this school. */
export function hiddenFor(c: Capabilities): string[] {
  return Object.keys(REQUIRES).filter((s) => !allowed(s, c));
}

// ── The words a screen puts on the page ─────────────────────────────────

/**
 * What to call the campus card's money.
 *
 * Falls back to something true rather than to a blank: a school with dollars
 * on a card and no name for them still has dollars on a card.
 */
export function cardName(c: Capabilities): string {
  return c.cardName?.trim() || 'card balance';
}

/** What to call one meal. */
export function swipeUnit(c: Capabilities): string {
  return c.swipeUnit?.trim() || 'meals';
}

/** What to call the registrar, for a link's label. */
export function registrarName(c: Capabilities): string {
  return c.registrarName?.trim() || 'your registrar';
}

export function orgPortalName(c: Capabilities): string {
  return c.orgPortalName?.trim() || 'your student organisations portal';
}

export function lmsName(c: Capabilities): string {
  return c.lmsName?.trim() || 'your course site';
}

/** Whether the meal screen should show swipes, money, or both. */
export function showsSwipes(c: Capabilities): boolean {
  return c.mealPlan === 'swipes' || c.mealPlan === 'both';
}

export function showsCash(c: Capabilities): boolean {
  return c.mealPlan === 'dollars' || c.mealPlan === 'both';
}

// ── The data pack, read safely ──────────────────────────────────────────

/**
 * When the room has to be empty.
 *
 * Returns null where the school has not said, which is the honest answer and
 * the one the screen should show — an invented move-out date is worse than no
 * move-out date, because somebody would plan a flight around it.
 */
export function moveOut(data: SchoolData, lastExamEndsAt: number | null): number | null {
  const rule = data.housing;
  if (!rule) return null;
  if (rule.moveOutRule === 'fixed_date') {
    const at = rule.fixedDate ? Date.parse(`${rule.fixedDate}T12:00:00`) : NaN;
    return Number.isNaN(at) ? null : at;
  }
  if (lastExamEndsAt === null) return null;
  const hours = typeof rule.hoursAfterLastExam === 'number' ? rule.hoursAfterLastExam : 24;
  return lastExamEndsAt + hours * 3_600_000;
}

/** How the move-out rule reads, so a screen can say why it is that date. */
export function moveOutWhy(data: SchoolData): string {
  const rule = data.housing;
  if (!rule) return '';
  if (rule.moveOutRule === 'fixed_date') {
    return rule.fixedDate ? 'A fixed date your school sets.' : '';
  }
  const hours = typeof rule.hoursAfterLastExam === 'number' ? rule.hoursAfterLastExam : 24;
  return `${hours} hours after your last exam, which is how your school counts it.`;
}

/** The term calendar covering a date, or null. */
export function termFor(data: SchoolData, onIso: string): TermCalendar | null {
  for (const t of data.academicCalendar ?? []) {
    if (onIso >= t.startsOn && onIso <= t.endsOn) return t;
  }
  return null;
}

/**
 * Anything unrecognised made safe to render from.
 *
 * A profile edited by somebody else, or written by a newer build, reaches this
 * one. It should come out plain rather than broken.
 */
export function readCapabilities(raw: unknown): Capabilities {
  const base: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };
  if (!raw || typeof raw !== 'object') return base;
  const c = raw as Record<string, unknown>;
  const str = (k: string): string | undefined =>
    typeof c[k] === 'string' && (c[k] as string).trim() ? (c[k] as string) : undefined;
  // Only http(s). A capability row is user-supplied data, and `javascript:` in
  // a field the app turns into a link is the obvious way to abuse that.
  const url = (k: string): string | undefined => {
    const v = str(k);
    if (!v) return undefined;
    return /^https:\/\/|^http:\/\//i.test(v.trim()) ? v.trim() : undefined;
  };
  const plans = ['swipes', 'dollars', 'both', 'none'];
  return {
    mealPlan: plans.includes(c.mealPlan as string) ? (c.mealPlan as Capabilities['mealPlan']) : 'none',
    cardName: str('cardName'),
    swipeUnit: str('swipeUnit'),
    housing: c.housing === true,
    registrarName: str('registrarName'),
    registrarUrl: url('registrarUrl'),
    orgPortalName: str('orgPortalName'),
    orgPortalUrl: url('orgPortalUrl'),
    lmsName: str('lmsName'),
    lmsUrl: url('lmsUrl'),
    lmsIcsHelpUrl: url('lmsIcsHelpUrl'),
    campusMap: c.campusMap === true,
    athleticsName: str('athleticsName'),
    libraryUrl: url('libraryUrl'),
    healthUrl: url('healthUrl'),
    advisingUrl: url('advisingUrl'),
  };
}

/**
 * The data pack, read safely.
 *
 * Most branches are inert — a buildings list with a bad row draws one fewer
 * pin. The grading scale is not inert: it decides what the app tells somebody
 * they need on the final, so it goes through its own reader and a malformed
 * one falls through to the stated assumption rather than reaching a screen.
 */
function readData(raw: unknown): SchoolData {
  if (!raw || typeof raw !== 'object') return {};
  const d = { ...(raw as SchoolData) };
  const scale = readGradeSystem((raw as Record<string, unknown>).gradeSystem);
  if (scale) d.gradeSystem = scale;
  else delete d.gradeSystem;
  return d;
}

export function readSchool(raw: unknown): School {
  if (!raw || typeof raw !== 'object') return { ...NO_SCHOOL };
  const s = raw as Record<string, unknown>;
  return {
    id: typeof s.id === 'string' ? s.id : '',
    name: typeof s.name === 'string' ? s.name : '',
    shortName: typeof s.shortName === 'string' ? s.shortName : undefined,
    capabilities: readCapabilities(s.capabilities),
    data: readData(s.data),
    verified: s.verified === true,
  };
}

/** How a school reads in one line, for a settings row. */
export function schoolLine(s: School): string {
  if (!s.id) return 'No school set — the universal part of the app is all here.';
  const has = hiddenFor(s.capabilities);
  if (has.length === 0) return `${s.name}. Everything the app offers is switched on.`;
  return `${s.name}. ${has.length} ${has.length === 1 ? 'screen is' : 'screens are'} hidden because your school has no equivalent.`;
}
