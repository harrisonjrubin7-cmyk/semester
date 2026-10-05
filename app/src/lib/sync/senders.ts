import type { Senders } from './outbox';
import type { SharePayload } from '../advisor-meeting';
import type { Contributed } from '../course-demand';

/**
 * The only two functions a held request can call.
 *
 * Imported when the student taps Send, not before, so the outbox costs a
 * first load nothing. `classes.test.ts` reads this file and fails if it names
 * a third, and reads the two it names for any call to an official or
 * financial record.
 */
export const senders: Senders = {
  share: async (p: { email: string; title: string; payload: SharePayload; days: number }) =>
    (await import('../advisor-shares')).shareWithAdvisor(p.email, p.title, p.payload, p.days),
  contribute: async (p: { term: string; courses: readonly Contributed[] }) =>
    (await import('../course-demand-remote')).contribute(p.term, p.courses),
} as unknown as Senders;
