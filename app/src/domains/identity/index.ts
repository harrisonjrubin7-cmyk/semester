/**
 * Identity: who is asking, as every other domain sees them.
 *
 * Public entry. Nothing outside this slice may import past this file
 * (`architecture.test.ts`, rule slice-doors-stay-shut).
 */
export { makeSubject, hasCapability } from './domain/subject';
export type { Subject, IdentityFacts } from './domain/subject';
export { currentSubject } from './application/current-subject';
export type { IdentitySource } from './application/ports';
