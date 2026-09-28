import type { Explanation } from './actions';
import type { Commitment } from './activities';
import { accepts, progress, type Requirement, type Taken } from './degree';
import { obj } from './device-library';
import type { Opportunity } from './career';
import { clock24, conflicts, type CatalogCourse } from './registration';
import { deriveSkillClaims } from './skills-graph';
import type { SourceLabel } from './source';

/**
 * Course Detail V2 (Phase F, `course_detail_v2`): what a student needs to
 * decide about one course, worked out from what Semester already holds.
 *
 * - **The catalog** the student imported: title, credits, meetings, seats,
 *   prerequisites, description, and — when the file carries them — the
 *   official page and the modality. Labelled Imported, with its age.
 * - **Their own records**: the requirements and courses on My Path, their
 *   commitments, the registration cart and credit target, and the
 *   opportunities they saved in Career. Labelled Student entered.
 * - **What Semester works out** from those — requirement fit, schedule fit,
 *   skills read from the description — labelled Estimated.
 *
 * It never decides eligibility, never promises a seat, never claims a
 * workload, and never shows professor ratings. Prerequisites are read from
 * the catalog's own words and compared with what the student recorded; the
 * department decides.
 */

// Any case: catalogs write "Econ 1010" and "math-1100" as often as "ECON 1010".
const CODE = /\b([A-Za-z]{2,5})[\s-]?(\d{3,4}[A-Za-z]?)\b/g;
// Words that sit before a number in prerequisite prose without being a
// department: "ECON 1010 or 1020", "any 3000-level course". Written in
// capitals they are read as a department, since that is how codes look.
const NOT_A_DEPARTMENT = new Set([
  'or', 'and', 'nor', 'of', 'in', 'on', 'at', 'by', 'to', 'for', 'from', 'with', 'the', 'plus', 'any', 'one', 'two',
  'both', 'also', 'then', 'than', 'over', 'under', 'above', 'below', 'level', 'grade', 'min', 'max', 'take', 'taken',
  'has', 'have', 'into', 'least', 'after', 'before', 'each', 'all', 'some', 'only', 'units', 'hours', 'year', 'fall',
  'spring', 'summer', 'winter', 'term',
]);

/** "econ-1010", "ECON1010" and "ECON 1010" are the same course. */
export function tidyCode(code: string): string {
  const m = /^([A-Za-z]{2,5})[\s-]?(\d{3,4}[A-Za-z]?)$/.exec(code.trim());
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : code.trim().toUpperCase().replace(/\s+/g, ' ');
}

function codesIn(text: string): string[] {
  const codes = [...text.matchAll(CODE)]
    .filter((m) => m[1] === m[1].toUpperCase() || !NOT_A_DEPARTMENT.has(m[1].toLowerCase()))
    .map((m) => `${m[1].toUpperCase()} ${m[2].toUpperCase()}`);
  return [...new Set(codes)];
}

/**
 * The course codes a prerequisite line names, split into what must come
 * before and what may be taken alongside. The line is the catalog's prose,
 * so everything after "corequisite", "co-requisite", "concurrent" or "taken
 * with" is read as a corequisite.
 */
export function readRequisites(text: string): { prerequisites: string[]; corequisites: string[] } {
  const at = text.search(/co-?requisite|concurrent|taken with/i);
  const before = at < 0 ? text : text.slice(0, at);
  const after = at < 0 ? '' : text.slice(at);
  const corequisites = codesIn(after);
  return { prerequisites: codesIn(before).filter((c) => !corequisites.includes(c)), corequisites };
}

export type RequisiteState = 'recorded' | 'in_progress' | 'in_cart' | 'not_recorded';

export interface Requisite {
  code: string;
  kind: 'prerequisite' | 'corequisite';
  state: RequisiteState;
  /** In words, and never "eligible". */
  says: string;
}

export interface Requisites {
  /** The catalog's own words, shown verbatim beside the reading. */
  text: string;
  items: Requisite[];
  /** Words in the line that are not course codes — "consent of instructor", "junior standing". */
  unread: boolean;
}

export function requisites(course: CatalogCourse, taken: Taken[], cart: CatalogCourse[]): Requisites {
  const text = course.prerequisites.trim();
  const { prerequisites, corequisites } = readRequisites(text);
  const done = new Map(taken.map((t) => [tidyCode(t.code), t]));
  const inCart = new Set(cart.filter((c) => c.id !== course.id).map((c) => tidyCode(c.code)));
  const read = (code: string, kind: Requisite['kind']): Requisite => {
    const t = done.get(code);
    if (t && !t.current) return { code, kind, state: 'recorded', says: `You recorded ${code}${t.term ? ` (${t.term})` : ''}.` };
    if (t) return { code, kind, state: 'in_progress', says: `You recorded ${code} as in progress.` };
    if (kind === 'corequisite' && inCart.has(code)) return { code, kind, state: 'in_cart', says: `${code} is in your registration cart.` };
    return { code, kind, state: 'not_recorded', says: `${code} is not in the courses you have recorded. Check with the department.` };
  };
  const stripped = text.replace(CODE, '').replace(/\b(and|or|with|a|an|the|of|grade|minimum|min|prerequisites?|co-?requisites?|concurrent(ly)?|enrollment|taken|in|c|c-|b|or better|none( stated)?)\b/gi, '').replace(/[\s.,;:()/-]+/g, '');
  return {
    text,
    items: [...prerequisites.map((c) => read(c, 'prerequisite')), ...corequisites.map((c) => read(c, 'corequisite'))],
    unread: stripped.length > 0,
  };
}

export interface Fit {
  requirement: Requirement;
  /** Still needed before this course, in the requirement's own unit. */
  left: number;
  unit: string;
  /** An empty accept list means anything counts — an elective block. */
  elective: boolean;
}

/** Requirements on My Path this course could count toward, where something is still needed. */
export function requirementFit(course: CatalogCourse, reqs: Requirement[], taken: Taken[]): Fit[] {
  const probe: Taken = { id: course.id, code: course.code, title: course.title, term: course.term, hours: course.credits, grade: '', current: false };
  return reqs
    .filter((r) => accepts(r, probe))
    .map((r) => {
      // After what is in progress: a requirement this term already finishes
      // is not one this course fills.
      const left = progress(r, taken).left;
      return { requirement: r, left, unit: r.need === 'hours' ? 'credit hours' : left === 1 ? 'course' : 'courses', elective: r.accepts.length === 0 };
    })
    .filter((f) => f.left > 0)
    .sort((a, b) => Number(a.elective) - Number(b.elective));
}

export interface Clash {
  with: string;
  day: number;
  from: number;
  to: number;
  source: SourceLabel;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Where this section's meetings fall on something else: the cart's sections and the student's timed commitments. */
export function scheduleFit(course: CatalogCourse, cart: CatalogCourse[], commitments: Commitment[]): Clash[] {
  const out: Clash[] = [];
  const others = cart.filter((c) => c.id !== course.id && tidyCode(c.code) !== tidyCode(course.code));
  for (const hit of conflicts([course, ...others]).filter((x) => x.a.id === course.id || x.b.id === course.id)) {
    const other = hit.a.id === course.id ? hit.b : hit.a;
    for (const day of hit.days) {
      // The meeting that overlaps, not the first one that day: a section can
      // meet twice on a Monday, and only one of those clashes.
      for (const m of course.meetings.filter((x) => x.days.includes(day))) {
        const overlaps = other.meetings.some((o) => o.days.includes(day) && m.start < o.end && o.start < m.end);
        if (overlaps) out.push({ with: `${other.code} (in your cart)`, day, from: m.start, to: m.end, source: 'imported' });
      }
    }
  }
  for (const c of commitments) {
    if (!c.active || c.at === null || c.minutes <= 0) continue;
    for (const m of course.meetings) {
      for (const day of m.days) {
        if (c.days.includes(day) && m.start < c.at + c.minutes && c.at < m.end) {
          out.push({ with: c.name, day, from: m.start, to: m.end, source: 'student_entered' });
        }
      }
    }
  }
  return out.sort((a, b) => a.day - b.day || a.from - b.from);
}

export const clashLine = (c: Clash) => `${DAYS[c.day]} ${clock24(c.from)}–${clock24(c.to)} overlaps ${c.with}.`;

export function meetingLine(course: CatalogCourse): string {
  if (!course.meetings.length) return 'No meeting times in the catalog';
  return course.meetings.map((m) => `${m.days.map((d) => DAYS[d]).join('/')} ${clock24(m.start)}–${clock24(m.end)}`).join('; ');
}

export interface Impact {
  inCart: boolean;
  /** Another section of the same course already in the cart. */
  sameCourse: CatalogCourse | null;
  before: number;
  after: number;
  target: number | null;
  says: string;
}

export function planImpact(course: CatalogCourse, cart: CatalogCourse[], target: number | null): Impact {
  const inCart = cart.some((c) => c.id === course.id);
  const sameCourse = cart.find((c) => c.id !== course.id && tidyCode(c.code) === tidyCode(course.code)) ?? null;
  const before = cart.filter((c) => c.id !== course.id).reduce((n, c) => n + c.credits, 0);
  const after = before + course.credits;
  const toTarget =
    target === null ? '' : after === target ? ` That matches your target of ${target}.` : after > target ? ` That is ${after - target} over your target of ${target}.` : ` That is ${target - after} under your target of ${target}.`;
  const says = sameCourse
    ? `Section ${sameCourse.section} of ${course.code} is already in your cart; adding this one as well would count it twice.`
    : `Your cart goes from ${before} to ${after} credits.${toTarget}`;
  return { inCart, sameCourse, before, after, target, says };
}

/** Catalog courses that list this one in their prerequisites — one entry per course code. */
export function relatedFuture(course: CatalogCourse, catalog: CatalogCourse[]): CatalogCourse[] {
  const code = tidyCode(course.code);
  const seen = new Set<string>();
  const out: CatalogCourse[] = [];
  for (const c of catalog) {
    const key = tidyCode(c.code);
    if (key === code || seen.has(key)) continue;
    if (codesIn(c.prerequisites).includes(code)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out.slice(0, 8);
}

/** Skills the description's own words name — suggestions, read from the text and nothing else. */
export function describedSkills(course: CatalogCourse): string[] {
  return deriveSkillClaims({ courses: [{ id: course.id, title: course.title, details: course.description }], projects: [], work: [], organizations: [] })
    .map((c) => c.skill);
}

/** The opportunities the student saved in Career that ask for one of those skills. Never an invented career. */
export function careerDirections(skills: string[], opportunities: Opportunity[]): { title: string; skills: string[] }[] {
  const want = new Set(skills.map((s) => s.toLowerCase()));
  return opportunities
    .map((o) => {
      const asks = `${o.skills} ${o.description} ${o.requirements}`.toLowerCase();
      return { title: [o.title, o.organization].filter(Boolean).join(' · '), skills: [...want].filter((s) => asks.includes(s)) };
    })
    .filter((o) => o.title && o.skills.length)
    .slice(0, 5);
}

/** How old the imported catalog is, and whether to say so. */
export function catalogAge(importedAt: string | null, now: Date): { at: number | null; stale: boolean } {
  const at = importedAt ? Date.parse(importedAt) : NaN;
  if (!Number.isFinite(at)) return { at: null, stale: false };
  return { at, stale: now.getTime() - at > 60 * 86_400_000 };
}

export function seatLine(course: CatalogCourse): string {
  if (course.seats === null) return 'The catalog file does not give seats.';
  return `${course.seats === 0 ? 'Reported closed' : `${course.seats} seats reported`} in the catalog file when it was imported — not live availability, and not a seat for you.`;
}

/** "Why it may fit": reasons from the facts above, and what they cannot say. */
export function whyItMayFit(input: {
  course: CatalogCourse;
  fit: Fit[];
  reqs: Requisites;
  clashes: Clash[];
  impact: Impact;
}): Explanation & { reasons: string[] } {
  const { course, fit, reqs, clashes, impact } = input;
  const reasons: string[] = [];
  for (const f of fit.slice(0, 3)) {
    reasons.push(`It may count toward ${f.requirement.programme ? `${f.requirement.programme}: ` : ''}${f.requirement.name}, where ${f.left} ${f.unit} ${f.left === 1 ? 'is' : 'are'} still needed.`);
  }
  if (course.meetings.length && clashes.length === 0) reasons.push('Its meeting times do not overlap your cart or your timed commitments.');
  const pre = reqs.items.filter((i) => i.kind === 'prerequisite');
  if (pre.length && pre.every((i) => i.state === 'recorded' || i.state === 'in_progress')) reasons.push('Every course its prerequisites name is in what you have recorded.');
  if (impact.target !== null && !impact.sameCourse && impact.after <= impact.target) reasons.push(`It keeps your cart at or under your ${impact.target}-credit target.`);
  return {
    reasons,
    trigger: 'You opened this course.',
    factors: [
      'Requirements and completed courses you recorded on My Path',
      'The prerequisites, meetings and credits in the imported catalog',
      'Your registration cart, credit target and timed commitments',
    ],
    expectedImpact: impact.says,
    limitations: [
      'Only your school’s degree audit decides what counts toward a requirement.',
      'The department decides whether prerequisites are met; Semester reads only the course codes in the catalog’s wording.',
      'Seats and times are from the imported file, not live.',
      'Semester has no workload or teaching-quality information for this course.',
    ],
    alternatives: ['Compare it with courses you saved.', 'Ask your advisor before adding it.', 'Check the official catalog entry.'],
  };
}

/* ── The shortlist: saved courses and what is being compared ─────────────── */

export const SHORTLIST_KEY = 'semester.course-shortlist.v1';
export const MAX_SAVED = 30;
export const MAX_COMPARE = 3;

export interface Shortlist {
  saved: string[];
  compare: string[];
  /**
   * The course code each saved id had when it was saved. The store outlives a
   * catalog import, and another institution's file can reuse an id for an
   * unrelated section; the code is how a reused id is told apart.
   */
  codes?: Record<string, string>;
}

export const EMPTY_SHORTLIST: Shortlist = { saved: [], compare: [] };

export function readShortlist(value: unknown): Shortlist {
  const ids = (v: unknown, max: number): string[] => {
    if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== 'string' || !x || x.length > 200)) throw new Error('The saved courses are not valid.');
    return [...new Set(v as string[])];
  };
  if (!obj(value)) throw new Error('The saved courses are not valid.');
  const saved = ids(value.saved, MAX_SAVED);
  const compare = ids(value.compare ?? [], MAX_COMPARE).filter((id) => saved.includes(id));
  if (value.codes === undefined) return { saved, compare };
  const codes = value.codes;
  if (!obj(codes) || Object.values(codes).some((c) => typeof c !== 'string' || c.length > 40)) throw new Error('The saved courses are not valid.');
  return { saved, compare, codes: Object.fromEntries(saved.filter((id) => typeof codes[id] === 'string').map((id) => [id, codes[id] as string])) };
}

/**
 * The shortlist as it stands against the catalog on this device: a saved id
 * whose section is gone, or whose id now names a different course, is dropped
 * — so it neither takes a place in the limit nor makes an unrelated section
 * look saved.
 */
export function liveShortlist(list: Shortlist, catalog: readonly { id: string; code: string }[]): Shortlist {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const keep = (id: string) => {
    const c = byId.get(id);
    return c !== undefined && (list.codes?.[id] === undefined || tidyCode(c.code) === list.codes[id]);
  };
  const saved = list.saved.filter(keep);
  const out: Shortlist = { saved, compare: list.compare.filter((id) => saved.includes(id)) };
  if (list.codes) out.codes = Object.fromEntries(saved.filter((id) => list.codes![id] !== undefined).map((id) => [id, list.codes![id]]));
  return out;
}

export function toggleSaved(list: Shortlist, id: string, code?: string): Shortlist {
  if (list.saved.includes(id)) {
    const codes = list.codes ? Object.fromEntries(Object.entries(list.codes).filter(([k]) => k !== id)) : undefined;
    return { saved: list.saved.filter((x) => x !== id), compare: list.compare.filter((x) => x !== id), ...(codes ? { codes } : {}) };
  }
  if (list.saved.length >= MAX_SAVED) return list;
  return { ...list, saved: [...list.saved, id], ...(code ? { codes: { ...list.codes, [id]: tidyCode(code) } } : {}) };
}

export function toggleCompare(list: Shortlist, id: string): Shortlist {
  if (list.compare.includes(id)) return { ...list, compare: list.compare.filter((x) => x !== id) };
  if (!list.saved.includes(id) || list.compare.length >= MAX_COMPARE) return list;
  return { ...list, compare: [...list.compare, id] };
}

