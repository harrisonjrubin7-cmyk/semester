/**
 * Today: the day, in one read model.
 *
 * Public entry; see `architecture.test.ts` for what may import past it.
 */
export { isQuiet } from './domain/next';
export type { NextAction, Ranking } from './domain/next';
export { getToday } from './application/get-today';
export type { Guard, TodayDeps, TodayInputs, TodayView } from './application/get-today';
export { getCommitments } from './application/get-commitments';
export type { CommitmentDay, CommitmentsDeps } from './application/get-commitments';
export { MAX_HORIZON_DAYS, addDays, daysFrom } from './domain/horizon';
