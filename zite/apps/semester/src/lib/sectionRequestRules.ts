// New-section requests (Semester Institution, first cross-office workflow; S-55 §10, D07).
// department requests → chair review → scheduling/room checks → registrar authorization → canonical section created
// → instructor assigned → open for registration → reconciled with a receipt. Pure; unit-tested in tests/sectionRequest.test.ts.
// The database re-runs the room and instructor checks under a per-term lock (lib/sreqMigration.ts).

export type SreqState = 'submitted' | 'chair_approved' | 'authorized' | 'creating' | 'created' | 'reconciled' | 'rejected' | 'withdrawn';
export type SreqStep = 'withdraw' | 'chair' | 'registrar' | 'begin_create' | 'created' | 'create_failed' | 'reconciled';

/** Which state each step may start from, and where it goes. Anything else is refused. */
const MOVES: Record<SreqStep, { from: SreqState[]; to: (approve: boolean) => SreqState }> = {
  withdraw: { from: ['submitted'], to: () => 'withdrawn' },
  chair: { from: ['submitted'], to: (ok) => (ok ? 'chair_approved' : 'rejected') },
  registrar: { from: ['chair_approved'], to: (ok) => (ok ? 'authorized' : 'rejected') },
  begin_create: { from: ['authorized'], to: () => 'creating' },
  created: { from: ['creating'], to: () => 'created' },
  create_failed: { from: ['creating'], to: () => 'authorized' },
  reconciled: { from: ['created'], to: () => 'reconciled' },
};
export function nextState(state: SreqState, step: SreqStep, approve = true): SreqState | null {
  const m = MOVES[step];
  return m.from.includes(state) ? m.to(approve) : null;
}

export type Meeting = { days: string[]; start: number; end: number };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Same format the catalog uses: "Mon/Wed 09:00-10:15". */
export function parseMeeting(t: string): Meeting | null {
  const m = t.trim().match(/^([A-Za-z/]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return null;
  const days = m[1].split('/');
  if (!days.length || days.some((d) => !DAYS.includes(d)) || new Set(days).size !== days.length) return null;
  const [sh, sm, eh, em] = [+m[2], +m[3], +m[4], +m[5]];
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  const start = sh * 60 + sm, end = eh * 60 + em;
  return end > start && end - start <= 6 * 60 ? { days, start, end } : null;
}
export const clash = (a: Meeting, b: Meeting) => a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;

export type Draft = { sectionCode: string; capacity: number; meetingTimes: string; roomCapacity: number | null; instructorIsFaculty: boolean };
/** Returns a refusal message, or null when the request may be submitted. */
export function validateDraft(d: Draft): string | null {
  if (!/^[A-Z0-9-]{1,8}$/.test(d.sectionCode)) return 'Use a section code of 1 to 8 capital letters, digits or dashes, for example 002.';
  if (!Number.isInteger(d.capacity) || d.capacity < 1 || d.capacity > 500) return 'Capacity must be a whole number from 1 to 500.';
  if (!parseMeeting(d.meetingTimes)) return 'Write the meeting time like “Mon/Wed 09:00-10:15” (days Mon–Sun, at most 6 hours).';
  if (d.roomCapacity == null) return 'Choose an active room.';
  if (d.roomCapacity < d.capacity) return `That room holds ${d.roomCapacity}; the section asks for ${d.capacity}.`;
  if (!d.instructorIsFaculty) return 'The instructor must be an active faculty member of your institution.';
  return null;
}

export type Booking = { ref: string; roomId: string | null; instructorId: string | null; times: string };
/** Scheduling check against everything already booked in the same term (other live requests and existing sections). */
export function scheduleConflicts(req: { roomId: string; instructorId: string; times: string }, booked: Booking[]): string[] {
  const mine = parseMeeting(req.times);
  if (!mine) return ['The meeting time cannot be read.'];
  const out: string[] = [];
  for (const b of booked) {
    const t = parseMeeting(b.times);
    if (!t || !clash(mine, t)) continue;
    if (b.roomId && b.roomId === req.roomId) out.push(`Room is already booked then by ${b.ref}.`);
    if (b.instructorId && b.instructorId === req.instructorId) out.push(`Instructor already teaches then (${b.ref}).`);
  }
  return out;
}

/** The canonical section's label, in the catalog's format. */
export const sectionLabel = (courseCode: string, sectionCode: string, termCode: string) => `${courseCode} · ${sectionCode} · ${termCode}`;

/** Reconciliation: the created section must match what was authorized. Returns the fields that differ. */
export function reconcile(req: { courseId: string; termCode: string; capacity: number; times: string; instructorId: string; label: string },
  sec: { course: string[]; term: string; capacity: number | null; times: string; instructors: string[]; label: string; state: string } | null): string[] {
  if (!sec) return ['section missing'];
  const d: string[] = [];
  if (!sec.course.includes(req.courseId)) d.push('course');
  if (sec.term !== req.termCode) d.push('term');
  if (sec.capacity !== req.capacity) d.push('capacity');
  if (sec.times !== req.times) d.push('meeting time');
  if (!sec.instructors.includes(req.instructorId)) d.push('instructor');
  if (sec.label !== req.label) d.push('label');
  if (sec.state !== 'Open') d.push('not open for registration');
  return d;
}
