/**
 * Four years, not four months.
 *
 * The app is called Semester and it ends in December. Everything in it is
 * about the term in front of you, and the questions that actually decide a
 * degree — what is left, what has to be taken before what, whether a course
 * counts twice — live in a PDF from an advisor, a screenshot of a degree audit,
 * and somebody's head.
 *
 * ## It does not know your requirements, and will not pretend to
 *
 * This is the whole design and it is not caution for its own sake. Degree
 * requirements are specific to a university, a college, a catalogue year and a
 * declaration date; they change; and a student reading a confidently wrong list
 * would find out in their final year, when nothing can be done. There is no
 * built-in list of AXLE categories, no major template, and no "typical"
 * anything.
 *
 * What there is instead is a place to put *your* requirements — copied from
 * your own audit, in your own words — and the arithmetic done against them,
 * which is the tedious part and the part a person gets wrong. The app is a
 * calculator over facts you supply, and every screen says so.
 *
 * ## Double counting is allowed, because rules differ
 *
 * One course satisfying a minor and a distribution requirement at once is
 * normal at some universities and forbidden at others, and the app cannot know
 * which. So a course counts wherever it is listed, and every requirement says
 * which courses it is counting — so a rule against it is visible and fixable
 * rather than silently applied or silently ignored.
 *
 * ## In progress is not done
 *
 * A course you are sitting right now counts towards "on track" and not towards
 * "finished", and the two are reported separately. Rolling them together is
 * how somebody arrives at their last semester one course short.
 */

/** A course you have taken or are taking. */
export interface Taken {
  id: string;
  /** "ECON 1020", as your transcript writes it. */
  code: string;
  title: string;
  /** "Fall 2026". Free text — the app does not parse or order it. */
  term: string;
  /** Credit hours. */
  hours: number;
  /** The letter, exactly as recorded. Empty while in progress. */
  grade: string;
  /** Being taken now rather than finished. */
  current: boolean;
}

/** One thing a programme asks for. */
export interface Requirement {
  id: string;
  /** "Economics major", "AXLE", "Sports & Society minor". Yours to name. */
  programme: string;
  /** "Humanities and Creative Arts", "Core theory", as your audit words it. */
  name: string;
  /** Whether it is counted in courses or in credit hours. */
  need: 'courses' | 'hours';
  /** How many of them. */
  count: number;
  /**
   * The course codes that satisfy it, as you recorded them.
   *
   * Empty means "anything", which is how a free-elective block works: the
   * count still has to be met and any course can meet it.
   */
  accepts: string[];
  note: string;
}

function tidy(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Whether a course is one this requirement accepts. */
export function accepts(req: Requirement, course: Taken): boolean {
  if (req.accepts.length === 0) return true;
  const want = req.accepts.map(tidy);
  const has = tidy(course.code);
  // A prefix match so "ECON" in the list accepts every ECON course, which is
  // how most distribution blocks are actually written.
  return want.some((w) => has === w || (/^[A-Z]+$/.test(w) && has.startsWith(`${w} `)));
}

export interface Progress {
  req: Requirement;
  /** Finished courses counting towards it. */
  done: Taken[];
  /** Courses being taken now that will count. */
  doing: Taken[];
  /** Courses or hours finished. */
  have: number;
  /** Courses or hours finished plus in progress. */
  willHave: number;
  /** Still to find after this term. Never negative. */
  left: number;
  /** True once the finished work alone meets it. */
  met: boolean;
  /** True when this term finishes it. */
  meetsAfter: boolean;
}

function amount(req: Requirement, list: Taken[]): number {
  return req.need === 'hours' ? list.reduce((n, c) => n + (c.hours || 0), 0) : list.length;
}

export function progress(req: Requirement, taken: Taken[]): Progress {
  const eligible = taken.filter((c) => accepts(req, c));
  const done = eligible.filter((c) => !c.current);
  const doing = eligible.filter((c) => c.current);
  const have = amount(req, done);
  const willHave = have + amount(req, doing);
  return {
    req,
    done,
    doing,
    have,
    willHave,
    left: Math.max(0, req.count - willHave),
    met: have >= req.count,
    // In progress is not done, and the two are reported separately: rolling
    // them together is how somebody arrives at their last semester one course
    // short.
    meetsAfter: !(have >= req.count) && willHave >= req.count,
  };
}

/** Every requirement of one programme, with what has been done to each. */
export function forProgramme(reqs: Requirement[], taken: Taken[], programme: string): Progress[] {
  return reqs.filter((r) => r.programme === programme).map((r) => progress(r, taken));
}

/** The programmes named, in the order they were first entered. */
export function programmes(reqs: Requirement[]): string[] {
  const out: string[] = [];
  for (const r of reqs) if (!out.includes(r.programme)) out.push(r.programme);
  return out;
}

export interface Rollup {
  programme: string;
  met: number;
  after: number;
  total: number;
  /** Courses or hours still to find, summed. */
  left: number;
}

export function rollup(reqs: Requirement[], taken: Taken[], programme: string): Rollup {
  const all = forProgramme(reqs, taken, programme);
  return {
    programme,
    met: all.filter((p) => p.met).length,
    after: all.filter((p) => p.met || p.meetsAfter).length,
    total: all.length,
    left: all.reduce((n, p) => n + p.left, 0),
  };
}

/**
 * What a programme's line says.
 *
 * Finished and in-progress separately, always, for the reason above. Never a
 * percentage: "78% of the way through a major" is a number that feels like
 * progress and tells nobody which course to register for.
 */
export function rollupLine(r: Rollup): string {
  if (r.total === 0) return 'Nothing recorded for this yet.';
  const head = `${r.met} of ${r.total} met.`;
  const inFlight = r.after - r.met;
  if (inFlight > 0) {
    return `${head} ${inFlight} more ${inFlight === 1 ? 'finishes' : 'finish'} if this term goes through.`;
  }
  return r.left > 0 ? `${head} ${r.left} still to find.` : head;
}

/** One requirement's line. */
export function progressLine(p: Progress): string {
  // The unit agrees with what is *needed*, not with what is done: pluralising
  // off `have` produced "1 of 2 course", which the browser showed and no unit
  // test would have.
  const unit =
    p.req.need === 'hours' ? 'hours' : p.req.count === 1 ? 'course' : 'courses';
  if (p.met) return `Met — ${p.have} of ${p.req.count} ${unit}.`;
  if (p.meetsAfter) {
    return `${p.have} of ${p.req.count} ${unit}, and this term covers the rest.`;
  }
  return `${p.have} of ${p.req.count} ${unit}. ${p.left} to find.`;
}

/**
 * Courses counting towards nothing recorded.
 *
 * The most useful thing on the screen for anybody who has been in a hurry:
 * either the course really is a free elective, or a requirement has not been
 * entered yet, and both are worth knowing. The app does not guess which.
 */
export function spare(reqs: Requirement[], taken: Taken[]): Taken[] {
  return taken.filter((c) => !reqs.some((r) => accepts(r, c)));
}

/** Where one course is counting. Names every programme, so double counting shows. */
export function countingIn(reqs: Requirement[], course: Taken): Requirement[] {
  return reqs.filter((r) => accepts(r, course));
}

/**
 * Grade points, on a scale the student states.
 *
 * There is no built-in scale and there will not be one. A 4.0 scale is close
 * to universal in the United States and the plus and minus values are not: an
 * A− is 3.7 at most places and 3.75 at some, some institutions do not use
 * minus grades at all, and a few weight differently by course level. A wrong
 * GPA displayed confidently is worse than no GPA, so the table is entered and
 * anything not in it is not counted.
 */
export type Scale = Record<string, number>;

/** A common table, offered as a starting point and clearly labelled as one. */
export const COMMON_SCALE: Scale = {
  'A+': 4,
  A: 4,
  'A-': 3.7,
  'B+': 3.3,
  B: 3,
  'B-': 2.7,
  'C+': 2.3,
  C: 2,
  'C-': 1.7,
  'D+': 1.3,
  D: 1,
  'D-': 0.7,
  F: 0,
};

export interface Gpa {
  points: number;
  hours: number;
  gpa: number;
  /** Finished courses whose grade is not in the scale — pass/fail, W, or a typo. */
  uncounted: Taken[];
}

export function gpa(taken: Taken[], scale: Scale): Gpa | null {
  let points = 0;
  let hours = 0;
  const uncounted: Taken[] = [];
  for (const c of taken) {
    if (c.current) continue;
    const key = c.grade.trim().toUpperCase();
    const value = scale[key];
    if (typeof value !== 'number' || !(c.hours > 0)) {
      if (c.grade.trim()) uncounted.push(c);
      continue;
    }
    points += value * c.hours;
    hours += c.hours;
  }
  if (hours === 0) return null;
  return { points, hours, gpa: Math.round((points / hours) * 1000) / 1000, uncounted };
}

/**
 * The GPA in a sentence, with what it left out.
 *
 * The exclusions travel with the number rather than sitting in a footnote,
 * because a GPA that quietly dropped three pass/fail courses is a GPA somebody
 * will compare against their transcript and not be able to explain.
 */
export function gpaLine(g: Gpa | null): string {
  if (!g) return 'No finished course has both a grade and credit hours yet.';
  const head = `${g.gpa.toFixed(3)} across ${g.hours} hours.`;
  if (g.uncounted.length === 0) return `${head} This is your arithmetic, not the registrar’s.`;
  const n = g.uncounted.length;
  return `${head} ${n} ${n === 1 ? 'course is' : 'courses are'} left out — the grade is not in your scale. This is your arithmetic, not the registrar’s.`;
}

/** Credit hours finished, and finished plus in progress. */
export function hours(taken: Taken[]): { done: number; withThisTerm: number } {
  const done = taken.filter((c) => !c.current).reduce((n, c) => n + (c.hours || 0), 0);
  const doing = taken.filter((c) => c.current).reduce((n, c) => n + (c.hours || 0), 0);
  return { done, withThisTerm: done + doing };
}

export function newRequirement(patch: Partial<Requirement>, at: number): Requirement {
  return {
    id: `r${at}${Math.random().toString(36).slice(2, 7)}`,
    programme: (patch.programme ?? '').trim(),
    name: (patch.name ?? '').trim(),
    need: patch.need === 'hours' ? 'hours' : 'courses',
    count: Math.max(1, Math.round(patch.count ?? 1)),
    accepts: (patch.accepts ?? []).map(tidy).filter(Boolean),
    note: patch.note ?? '',
  };
}

export function newTaken(patch: Partial<Taken>, at: number): Taken {
  return {
    id: `t${at}${Math.random().toString(36).slice(2, 7)}`,
    code: tidy(patch.code ?? ''),
    title: (patch.title ?? '').trim(),
    term: (patch.term ?? '').trim(),
    hours: Math.max(0, Number(patch.hours) || 0),
    grade: (patch.grade ?? '').trim(),
    current: patch.current ?? false,
  };
}

/** Course codes typed as a list, read into an array. */
export function readAccepts(text: string): string[] {
  return text
    .split(/[,\n;]+/)
    .map(tidy)
    .filter(Boolean);
}

/** Stored lists made safe. */
export function readRequirements(raw: unknown): Requirement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Requirement => Boolean(r) && typeof r === 'object' && typeof r.id === 'string')
    .map((r) => ({
      ...r,
      need: r.need === 'hours' ? 'hours' : 'courses',
      count: Math.max(1, Math.round(Number(r.count) || 1)),
      accepts: Array.isArray(r.accepts) ? r.accepts.map(tidy).filter(Boolean) : [],
      programme: typeof r.programme === 'string' ? r.programme : '',
      name: typeof r.name === 'string' ? r.name : '',
      note: typeof r.note === 'string' ? r.note : '',
    }));
}

export function readTaken(raw: unknown): Taken[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Taken => Boolean(c) && typeof c === 'object' && typeof c.id === 'string')
    .map((c) => ({
      ...c,
      code: tidy(typeof c.code === 'string' ? c.code : ''),
      title: typeof c.title === 'string' ? c.title : '',
      term: typeof c.term === 'string' ? c.term : '',
      hours: Math.max(0, Number(c.hours) || 0),
      grade: typeof c.grade === 'string' ? c.grade : '',
      current: c.current === true,
    }));
}
