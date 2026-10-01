/**
 * A timetable and an exam schedule, proposed by rule.
 *
 * A constraint model over sections, instructors, rooms and time patterns. It is
 * deterministic: the same input and seed give the same answer, so a run can be
 * reproduced, and a person publishes (`supabase/migrations/20261001080000_scheduling.sql`
 * re-checks every proposal itself and refuses a conflicted one). Nothing here
 * learns, predicts or uses a model.
 *
 * Hard constraints: a room holds one section at a time; an instructor teaches one
 * at a time; a room is big enough and has what the section needs; a section meets
 * in one of the patterns it was offered. Soft: sections that share students avoid
 * overlapping where they can. A section that cannot be placed is returned with
 * the reason, never forced in.
 */

/** Minutes since midnight; days 0 (Sunday) to 6, the registration catalog's shape. */
export interface Pattern { days: number[]; start: number; end: number }

export interface SectionInput {
  course: string;
  section: string;
  enrolment: number;
  instructor: string;
  needs: string[];
  /** The patterns this section may meet in, in order of preference. */
  patterns: Pattern[];
}

export interface RoomInput { code: string; capacity: number; features: string[]; bookable: boolean }

/** Two sections that share students: avoid overlapping them, the more the heavier. */
export interface SharedStudents { a: string; b: string; count: number }

export interface Assignment { course: string; section: string; room: string; meeting: Pattern }
export interface Unplaced { course: string; section: string; reason: string }

export interface TimetableResult {
  assignments: Assignment[];
  unplaced: Unplaced[];
  /** Pairs of placed sections that share students and overlap, with how many students. */
  softClashes: { a: string; b: string; count: number }[];
}

export const sectionKey = (s: { course: string; section: string }): string => `${s.course} ${s.section}`;

export const clash = (a: Pattern, b: Pattern): boolean =>
  a.start < b.end && b.start < a.end && a.days.some((d) => b.days.includes(d));

const eligible = (s: SectionInput, r: RoomInput): boolean =>
  r.bookable && r.capacity >= s.enrolment && s.needs.every((f) => r.features.includes(f));

/** A small deterministic generator, so a seed fixes every tie. */
function lcg(seed: number): () => number {
  let x = (seed >>> 0) || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

/**
 * Places each section in a room and a pattern. Most-constrained sections first
 * (fewest rooms they fit, then fewest patterns, then largest), each into the
 * smallest room that fits and the pattern with the fewest soft clashes. It is
 * greedy: a section it cannot place is said so and left for a person, not
 * searched for exhaustively.
 */
export function solveTimetable(
  sections: readonly SectionInput[], rooms: readonly RoomInput[], shared: readonly SharedStudents[] = [], seed = 1,
): TimetableResult {
  const rand = lcg(seed);
  // The seed varies which of equally constrained sections goes first.
  const shuffled = [...sections];
  for (let i = shuffled.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[k]] = [shuffled[k], shuffled[i]]; }
  const weight = new Map<string, number>();
  for (const s of shared) { weight.set(`${s.a}|${s.b}`, s.count); weight.set(`${s.b}|${s.a}`, s.count); }
  const fits = (s: SectionInput) => rooms.filter((r) => eligible(s, r));
  const order = shuffled.sort((a, b) => fits(a).length - fits(b).length || a.patterns.length - b.patterns.length || b.enrolment - a.enrolment);

  const placed: Assignment[] = [];
  const unplaced: Unplaced[] = [];
  const byKey = new Map(sections.map((s) => [sectionKey(s), s]));

  const conflictFor = (s: SectionInput, room: RoomInput, p: Pattern, against: readonly Assignment[]): string | null => {
    for (const a of against) {
      const other = byKey.get(sectionKey(a));
      if (!other || sectionKey(other) === sectionKey(s)) continue;
      if (!clash(p, a.meeting)) continue;
      // The instructor first: it is the cause that moving rooms cannot fix.
      if (other.instructor !== '' && other.instructor === s.instructor) return `${s.instructor} teaches ${sectionKey(a)} then`;
      if (a.room === room.code) return `room ${room.code} is taken then by ${sectionKey(a)}`;
    }
    return null;
  };
  const softCost = (s: SectionInput, p: Pattern, against: readonly Assignment[]): number =>
    against.reduce((n, a) => (clash(p, a.meeting) ? n + (weight.get(`${sectionKey(s)}|${sectionKey(a)}`) ?? 0) : n), 0);

  const tryPlace = (s: SectionInput, against: Assignment[]): Assignment | string => {
    const candidates = fits(s).sort((a, b) => a.capacity - b.capacity || a.code.localeCompare(b.code));
    if (candidates.length === 0) return `no bookable room holds ${s.enrolment} with ${s.needs.length ? s.needs.join(', ') : 'no special need'}`;
    if (s.patterns.length === 0) return 'it was offered no time pattern';
    let best: { a: Assignment; cost: number } | null = null;
    let why = '';
    for (const p of s.patterns) {
      for (const r of candidates) {
        const reason = conflictFor(s, r, p, against);
        if (reason) { why = why || reason; continue; }
        const cost = softCost(s, p, against);
        if (!best || cost < best.cost) best = { a: { course: s.course, section: s.section, room: r.code, meeting: p }, cost };
        if (cost === 0) return best.a;
        break; // the smallest room that fits this pattern; the next pattern may cost less
      }
    }
    return best ? best.a : why || 'every pattern and room is taken';
  };

  for (const s of order) {
    const out = tryPlace(s, placed);
    if (typeof out === 'string') unplaced.push({ course: s.course, section: s.section, reason: out });
    else placed.push(out);
  }

  const soft: { a: string; b: string; count: number }[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const w = weight.get(`${sectionKey(placed[i])}|${sectionKey(placed[j])}`) ?? 0;
      if (w > 0 && clash(placed[i].meeting, placed[j].meeting)) soft.push({ a: sectionKey(placed[i]), b: sectionKey(placed[j]), count: w });
    }
  }
  placed.sort((x, y) => sectionKey(x).localeCompare(sectionKey(y)));
  unplaced.sort((x, y) => sectionKey(x).localeCompare(sectionKey(y)));
  return { assignments: placed, unplaced, softClashes: soft };
}

export interface Conflict { kind: string; sections?: string[]; section?: string; room?: string; instructor?: string }

/**
 * What is wrong with a proposal: the same checks the database makes
 * (`private.timetable_conflicts`), so a person sees them before saving. An empty
 * list is a clean proposal.
 */
export function proposalConflicts(sections: readonly SectionInput[], rooms: readonly RoomInput[], assignments: readonly Assignment[]): Conflict[] {
  const found: Conflict[] = [];
  const byKey = new Map(sections.map((s) => [sectionKey(s), s]));
  const roomBy = new Map(rooms.map((r) => [r.code, r]));
  const okPattern = (p: Pattern) => Array.isArray(p.days) && p.days.length > 0 && p.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    && Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.start <= 1439 && p.end >= 1 && p.end <= 1440 && p.end > p.start;
  for (const a of assignments) {
    const key = sectionKey(a);
    if (!okPattern(a.meeting)) { found.push({ kind: 'pattern', section: key }); continue; }
    const s = byKey.get(key);
    if (!s) { found.push({ kind: 'unknown_section', section: key }); continue; }
    const r = roomBy.get(a.room);
    if (!r || !r.bookable) { found.push({ kind: 'room_unavailable', section: key, room: a.room }); continue; }
    if (r.capacity < s.enrolment) found.push({ kind: 'too_small', section: key, room: r.code });
    if (s.needs.some((f) => !r.features.includes(f))) found.push({ kind: 'missing_feature', section: key, room: r.code });
  }
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (!okPattern(a.meeting) || !okPattern(b.meeting) || !clash(a.meeting, b.meeting)) continue;
      if (a.room === b.room) found.push({ kind: 'room_twice', room: a.room, sections: [sectionKey(a), sectionKey(b)] });
      const ia = byKey.get(sectionKey(a))?.instructor ?? '';
      if (ia !== '' && ia === (byKey.get(sectionKey(b))?.instructor ?? '')) found.push({ kind: 'instructor_twice', instructor: ia, sections: [sectionKey(a), sectionKey(b)] });
    }
  }
  return found;
}

// ── Exams ──────────────────────────────────────────────────────────────────

export interface ExamInput { course: string; section: string; enrolment: number; needs: string[] }
export interface ExamSlot { id: string; label: string }
export interface ExamAssignment { course: string; section: string; slot: string; room: string }
export interface ExamResult { assignments: ExamAssignment[]; unplaced: Unplaced[] }

/**
 * Exams into slots and rooms. Two exams that share any student never share a
 * slot (a hard rule: a student cannot sit two at once); a room holds one exam per
 * slot; capacity and needs as for classes. Slots are filled in order, so the
 * schedule is as short as the rule allows.
 */
export function solveExams(
  exams: readonly ExamInput[], slots: readonly ExamSlot[], rooms: readonly RoomInput[], shared: readonly SharedStudents[] = [],
): ExamResult {
  const share = new Set(shared.filter((s) => s.count > 0).flatMap((s) => [`${s.a}|${s.b}`, `${s.b}|${s.a}`]));
  const fitsExam = (e: ExamInput) => rooms.filter((r) => r.bookable && r.capacity >= e.enrolment && e.needs.every((f) => r.features.includes(f))).sort((a, b) => a.capacity - b.capacity || a.code.localeCompare(b.code));
  const order = [...exams].sort((a, b) => {
    const conflictsOf = (e: ExamInput) => exams.filter((x) => share.has(`${sectionKey(e)}|${sectionKey(x)}`)).length;
    return conflictsOf(b) - conflictsOf(a) || b.enrolment - a.enrolment || sectionKey(a).localeCompare(sectionKey(b));
  });
  const out: ExamAssignment[] = [];
  const unplaced: Unplaced[] = [];
  for (const e of order) {
    const rooms2 = fitsExam(e);
    if (rooms2.length === 0) { unplaced.push({ course: e.course, section: e.section, reason: `no bookable room holds ${e.enrolment}${e.needs.length ? ` with ${e.needs.join(', ')}` : ''}` }); continue; }
    let done = false;
    for (const slot of slots) {
      if (out.some((o) => o.slot === slot.id && share.has(`${sectionKey(e)}|${sectionKey(o)}`))) continue;
      const room = rooms2.find((r) => !out.some((o) => o.slot === slot.id && o.room === r.code));
      if (!room) continue;
      out.push({ course: e.course, section: e.section, slot: slot.id, room: room.code });
      done = true;
      break;
    }
    if (!done) unplaced.push({ course: e.course, section: e.section, reason: 'every slot has a shared student or no free room' });
  }
  out.sort((a, b) => a.slot.localeCompare(b.slot) || sectionKey(a).localeCompare(sectionKey(b)));
  unplaced.sort((a, b) => sectionKey(a).localeCompare(sectionKey(b)));
  return { assignments: out, unplaced };
}

/** Exam assignments that break a rule: a shared student in one slot, a room twice, a room too small. */
export function examConflicts(exams: readonly ExamInput[], rooms: readonly RoomInput[], assignments: readonly ExamAssignment[], shared: readonly SharedStudents[] = []): Conflict[] {
  const found: Conflict[] = [];
  const share = new Set(shared.filter((s) => s.count > 0).flatMap((s) => [`${s.a}|${s.b}`, `${s.b}|${s.a}`]));
  const byKey = new Map(exams.map((e) => [sectionKey(e), e]));
  const roomBy = new Map(rooms.map((r) => [r.code, r]));
  for (const a of assignments) {
    const e = byKey.get(sectionKey(a));
    const r = roomBy.get(a.room);
    if (!e || !r || !r.bookable) found.push({ kind: 'room_unavailable', section: sectionKey(a), room: a.room });
    else if (r.capacity < e.enrolment) found.push({ kind: 'too_small', section: sectionKey(a), room: r.code });
  }
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (a.slot !== b.slot) continue;
      if (a.room === b.room) found.push({ kind: 'room_twice', room: a.room, sections: [sectionKey(a), sectionKey(b)] });
      if (share.has(`${sectionKey(a)}|${sectionKey(b)}`)) found.push({ kind: 'student_twice', sections: [sectionKey(a), sectionKey(b)] });
    }
  }
  return found;
}

// ── Typing sections in ─────────────────────────────────────────────────────

const DAYS: Record<string, number> = { SU: 0, M: 1, T: 2, W: 3, R: 4, F: 5, SA: 6 };

/** `MWF 09:00-09:50` or `TR 9:00-10:15` as a pattern, or null. */
export function parsePattern(text: string): Pattern | null {
  const m = /^\s*([SMTWRFU]+)\s+([0-9]{1,2}):([0-9]{2})\s*-\s*([0-9]{1,2}):([0-9]{2})\s*$/i.exec(text);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const days: number[] = [];
  for (let i = 0; i < letters.length; i++) {
    const two = letters.slice(i, i + 2);
    if (two === 'SU' || two === 'SA') { days.push(DAYS[two]); i++; continue; }
    const d = DAYS[letters[i]] ?? (letters[i] === 'U' ? 0 : undefined);
    if (d === undefined) return null;
    days.push(d);
  }
  const start = Number(m[2]) * 60 + Number(m[3]);
  const end = Number(m[4]) * 60 + Number(m[5]);
  if (Number(m[3]) > 59 || Number(m[5]) > 59 || end <= start || end > 1440 || days.length === 0) return null;
  return { days: [...new Set(days)].sort(), start, end };
}

/**
 * Sections one per line: `ECON 1010 | 01 | 30 | Dr Rao | projector | MWF 09:00-09:50, TR 09:00-10:15`.
 * Returns the sections or the first line that is not one, by number.
 */
export function parseSections(input: string): { sections: SectionInput[] } | { error: string } {
  const out: SectionInput[] = [];
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return { error: 'Add at least one section.' };
  for (const [i, line] of lines.entries()) {
    const p = line.split('|').map((x) => x.trim());
    const at = `Line ${i + 1}`;
    if (p.length !== 6 || !/^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.test(p[0]) || !/^[A-Za-z0-9-]{1,10}$/.test(p[1])) return { error: `${at}: write “COURSE | section | enrolment | instructor | needs | patterns”.` };
    const enrolment = Number(p[2]);
    if (!Number.isInteger(enrolment) || enrolment < 0 || enrolment > 10000) return { error: `${at}: enrolment is a whole number.` };
    const patterns: Pattern[] = [];
    for (const raw of p[5].split(',').map((x) => x.trim()).filter((x) => x !== '')) {
      const pat = parsePattern(raw);
      if (!pat) return { error: `${at}: “${raw}” is not a pattern like MWF 09:00-09:50.` };
      patterns.push(pat);
    }
    if (patterns.length === 0) return { error: `${at}: offer at least one pattern.` };
    out.push({ course: p[0], section: p[1], enrolment, instructor: p[3], needs: p[4].split(',').map((x) => x.trim().toLowerCase()).filter((x) => x !== ''), patterns });
  }
  if (new Set(out.map(sectionKey)).size !== out.length) return { error: 'Each course and section appears once.' };
  return { sections: out };
}

/** A pattern as the catalog prints it: `MWF 09:00-09:50`. */
export function patternWords(p: Pattern): string {
  const letters = p.days.map((d) => ['Su', 'M', 'T', 'W', 'R', 'F', 'Sa'][d]).join('');
  const t = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return `${letters} ${t(p.start)}-${t(p.end)}`;
}
