// Office hours and appointments (Semester Faculty "office hours"; D14 advising appointments; D15 tutoring). Pure; tested in
// tests/aptRules.test.ts. The database repeats the booking checks under a row lock (lib/aptMigration.ts).
export type SlotKind = 'Office hours' | 'Advising' | 'Tutoring';
export const KIND_ROLES: Record<SlotKind, string[]> = { 'Office hours': ['Faculty'], Advising: ['Advisor', 'Staff', 'Administrator'], Tutoring: ['Tutor', 'Staff'] };
const MIN = 60_000;

export type SlotDraft = { kind: SlotKind; startsAt: string; minutes: number; capacity: number; weeks: number; location: string; sectionId: string | null };
/** Returns a refusal message, or null. `now` is passed in so the rule stays pure. */
export function validateSlots(d: SlotDraft, now: number): string | null {
  const t = Date.parse(d.startsAt);
  if (!Number.isFinite(t)) return 'Choose a start date and time.';
  if (t < now + 5 * MIN) return 'Office hours must start at least 5 minutes from now.';
  if (t > now + 120 * 24 * 60 * MIN) return 'Schedule at most 120 days ahead.';
  if (!Number.isInteger(d.minutes) || d.minutes < 5 || d.minutes > 240) return 'Each slot is 5 to 240 minutes.';
  if (!Number.isInteger(d.capacity) || d.capacity < 1 || d.capacity > 50) return 'Each slot holds 1 to 50 people.';
  if (!Number.isInteger(d.weeks) || d.weeks < 1 || d.weeks > 16) return 'Repeat for 1 to 16 weeks.';
  if (d.location.trim().length < 2 || d.location.length > 200) return 'Say where it happens (a room or a meeting link).';
  if (d.kind === 'Office hours' && !d.sectionId) return 'Choose the section these office hours are for.';
  if (d.kind !== 'Office hours' && d.sectionId) return 'Only office hours belong to a section.';
  return null;
}
/** Weekly repeats, same wall-clock offset in UTC. */
export function expand(startsAt: string, minutes: number, weeks: number): { start: string; end: string }[] {
  const t = Date.parse(startsAt);
  return Array.from({ length: weeks }, (_, i) => { const s = t + i * 7 * 24 * 60 * MIN; return { start: new Date(s).toISOString(), end: new Date(s + minutes * MIN).toISOString() }; });
}

export type SlotView = { start: string; end: string; capacity: number; booked: number; cancelled: boolean };
export type Mine = { start: string; end: string };
/** Student booking check (the database re-checks capacity and overlap under lock). */
export function bookBlocker(slot: SlotView, mine: Mine[], now: number, eligible: boolean): string | null {
  if (!eligible) return 'These office hours are for students in that section.';
  if (slot.cancelled) return 'That slot was cancelled.';
  if (Date.parse(slot.start) <= now) return 'That slot has already started.';
  if (slot.booked >= slot.capacity) return 'That slot is full. Pick another.';
  const s = Date.parse(slot.start), e = Date.parse(slot.end);
  if (mine.some((m) => Date.parse(m.start) < e && s < Date.parse(m.end))) return 'You already have an appointment at that time.';
  return null;
}
export const cancelBlocker = (start: string, now: number) => (Date.parse(start) <= now ? 'It has already started. Ask your host instead.' : null);
export const markBlocker = (start: string, now: number) => (Date.parse(start) > now ? 'You can record attendance once it has started.' : null);
