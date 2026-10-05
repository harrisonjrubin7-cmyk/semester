/**
 * The private account safety state — the thing that is not karma.
 *
 * Jodel's karma is public and it moves with votes and penalties. Semester has
 * no karma. If Trust & Safety needs a running sense of an account's standing,
 * it is this: 0–100, visible only to authorized staff, changed only by
 * confirmed policy outcomes with a reason, reversible, audited, and behind a
 * high-risk flag.
 *
 * It is never an input to the feed, to search, to academics, aid, admissions,
 * housing, work or advising. feed.ts refuses a `safetyState` field and a
 * structural test checks the ranker never imports this file. The student sees
 * what happened and how to appeal, in words — never the number.
 */

import { enabled, type CommunityFlags } from './flags';
import type { Severity } from './moderation';

export interface SafetyEntry {
  at: string;
  delta: number;
  caseId: string;
  reasonCode: string;
  actorId: string;
  reversedAt?: string;
}

export const SEVERITY_DELTA: Record<Severity, number> = { P0: -40, P1: -20, P2: -8, P3: 0 };

/** What a student is told, and all they are told. my_community_standing() says the same. */
export const STANDING_WORDS = {
  clear: 'Your Community account is in good standing.',
  affected:
    'A past decision still affects your Community account. You can see each decision about your posts, and appeal eligible ones.',
} as const;

export class SafetyStateRefused extends Error {}

/** Current value: 100 less every unreversed confirmed outcome, floored at 0. */
export function safetyValue(entries: SafetyEntry[]): number {
  const total = entries.filter((e) => !e.reversedAt).reduce((n, e) => n + e.delta, 100);
  return Math.max(0, Math.min(100, total));
}

export function recordOutcome(
  flags: CommunityFlags,
  entries: SafetyEntry[],
  outcome: { caseId: string; severity: Severity; reasonCode: string; actorId: string; actorKind: string; at: string },
): SafetyEntry[] {
  if (!enabled(flags, 'accountSafetyState')) return entries;
  if (outcome.actorKind !== 'professional' && outcome.actorKind !== 'senior_professional') {
    throw new SafetyStateRefused('Only a confirmed professional decision changes safety state.');
  }
  const delta = SEVERITY_DELTA[outcome.severity];
  if (delta === 0) return entries;
  return [...entries, { at: outcome.at, delta, caseId: outcome.caseId, reasonCode: outcome.reasonCode, actorId: outcome.actorId }];
}

/** Reverse on a successful appeal. The entry stays, marked, for the audit trail. */
export function reverse(entries: SafetyEntry[], caseId: string, at: string): SafetyEntry[] {
  return entries.map((e) => (e.caseId === caseId && !e.reversedAt ? { ...e, reversedAt: at } : e));
}

export type SafetyReader = 'trust_and_safety' | 'student' | 'peer' | 'volunteer' | 'advisor' | 'admin';

/** Staff get the number; the student gets words; everyone else gets nothing. */
export function readSafetyState(reader: SafetyReader, entries: SafetyEntry[]): number | string | null {
  if (reader === 'trust_and_safety') return safetyValue(entries);
  if (reader === 'student') {
    const active = entries.filter((e) => !e.reversedAt).length;
    return active === 0 ? STANDING_WORDS.clear : STANDING_WORDS.affected;
  }
  return null;
}
