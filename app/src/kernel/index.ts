/**
 * The kernel: the few things every domain shares, and nothing a domain owns.
 *
 * It depends on nothing in this app. A thing belongs here only if two domains
 * need it *and* it has no opinion about students, courses or tenants. The test
 * is whether it could be lifted into another product unchanged.
 */
export { ok, err, mapOk, andThen } from './result';
export type { Ok, Err, Result } from './result';
export { fail, toEnvelope, ERROR_KINDS, ERROR_CODE_PATTERN } from './errors';
export type { DomainError, ErrorKind, ErrorEnvelope, UserAction, FailOptions } from './errors';
export { systemClock, fixedClock, localDay } from './clock';
export { systemIds, counterIds } from './ids';
export type { IdSource } from './ids';
export type { Clock } from './clock';
export { nullSink, MemorySink } from './events';
export type { DomainEvent, EventSink } from './events';
