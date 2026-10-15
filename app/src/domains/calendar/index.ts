/**
 * Calendar: what is on a day, from every calendar the student has.
 *
 * Public entry; see `architecture.test.ts` for what may import past it.
 */
export { agendaFor, conflictsIn, isRealDay } from './domain/agenda';
export type { Conflict, Entry, EntryKind, Provenance } from './domain/agenda';
export { getAgenda } from './application/get-agenda';
export type { Agenda, AgendaDeps, CalendarSource, Guard } from './application/get-agenda';
