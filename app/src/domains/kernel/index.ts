/** The kernel: the few things every domain shares, and nothing a domain owns. */
export { ERROR_CODES, andThen, err, isRetryable, map, ok } from './result';
export type { AppError, ErrorCode, Result } from './result';
export { ISO_DATE, addDays, daysBetween, fixedClock, isIsoDate, systemClock } from './clock';
export type { Clock, IsoDate, LocalMoment } from './clock';
export type { DomainEvent, Outcome } from './events';
export { defineMachine, send } from './machine';
export type { Machine, MachineSpec } from './machine';
