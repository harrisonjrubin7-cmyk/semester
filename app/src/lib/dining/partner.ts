/**
 * The campus-card and dining vendor, behind one interface.
 *
 * Schools run their card office on a vendor system (CBORD, Transact, Atrium
 * and others), and that system is the source of truth for every balance and
 * every plan. Semester never is. `lib/meals.ts` exists because, without a
 * partner agreement, a student's balance page is behind single sign-on with
 * no API a student may use; the app asks the student to type the numbers and
 * says that it did. This file is the other side of that: what an adapter must
 * do once a school connects its vendor, and what the app shows when the
 * connection is not there, stale, or has just failed.
 *
 * The rule, in one place: **a figure is institution-verified only when it was
 * read over a live connection within `DINING_FRESHNESS_MINUTES`.** A failed
 * read falls back to the last good one, labelled for review with its age; no
 * partner read at all falls back to what the student entered, labelled as
 * theirs; nothing at all is a refusal, never a zero.
 */
import type { Balance } from '../meals';
import { figure, partnerLabel, type Figure } from './figures';
import { LEDGER_KEY, no, yes, type Decision } from './decision';
import type { LedgerKind } from './ledger';

export const PARTNER_STATUSES = ['not_connected', 'pending', 'live', 'degraded', 'disconnected'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface PartnerHealth {
  status: PartnerStatus;
  checkedAt: number;
  /** The last successful exchange, epoch ms. */
  lastSuccessAt: number | null;
  detail: string;
}

export interface PartnerBalances {
  /** The vendor's own reference for the cardholder. Never a university ID number shown on screen. */
  cardholderRef: string;
  /** Null when the plan has no swipes. */
  swipesRemaining: number | null;
  diningCents: number;
  campusCents: number;
  /** When the vendor says these were true. */
  asOf: number;
}

export interface PartnerPosting {
  idempotencyKey: string;
  cardholderRef: string;
  kind: LedgerKind;
  delta: number;
  at: number;
}

export interface PostingResult {
  accepted: boolean;
  replayed: boolean;
  reason: string;
}

/**
 * What a dining vendor adapter must implement. Every method takes `now`, and
 * none may keep a credential anywhere a browser can reach: the adapter runs in
 * the gateway with a secret-manager pointer, like every adapter in
 * `lib/integration/adapter.ts`.
 */
export interface DiningPartnerAdapter {
  readonly id: string;
  readonly vendor: string;
  health(now: number): Promise<PartnerHealth>;
  readBalances(cardholderRef: string, now: number): Promise<PartnerBalances>;
  /** Idempotent by `idempotencyKey`: a replay answers `replayed` and posts nothing. */
  postTransaction(posting: PartnerPosting, now: number): Promise<PostingResult>;
  /** Revoke the token and stop. After this, `health` reports `disconnected`. */
  disconnect(now: number): Promise<void>;
}

/** The last good partner read, kept so a failure can show its age instead of nothing. */
export interface PartnerCache {
  balances: PartnerBalances;
  readAt: number;
}

export interface BalanceFigures {
  swipes: Figure | null;
  diningCents: Figure;
  campusCents: Figure;
  /** Why these figures, and not fresher ones. */
  basis: 'partner_live' | 'partner_cache' | 'student_entered';
}

function fromPartner(b: PartnerBalances, readAt: number, live: boolean, now: number): BalanceFigures {
  // Judged by when the vendor says the figures were true, not by when they
  // were fetched: a fresh read of a balance the vendor last settled two hours
  // ago is a two-hour-old balance.
  const at = Math.min(b.asOf, readAt);
  const label = partnerLabel(at, live, now);
  return {
    swipes: b.swipesRemaining === null ? null : figure(b.swipesRemaining, 'swipes', label, at, now),
    diningCents: figure(b.diningCents, 'cents', label, at, now),
    campusCents: figure(b.campusCents, 'cents', label, at, now),
    basis: live ? 'partner_live' : 'partner_cache',
  };
}

function fromStudent(reading: Balance, now: number): BalanceFigures {
  return {
    swipes: reading.swipes < 0 ? null : figure(reading.swipes, 'swipes', 'student_entered', reading.at, now),
    diningCents: figure(Math.max(0, reading.diningCents), 'cents', 'student_entered', reading.at, now),
    campusCents: figure(reading.cashCents, 'cents', 'student_entered', reading.at, now),
    basis: 'student_entered',
  };
}

export interface BalanceRead {
  figures: BalanceFigures;
  cache: PartnerCache | null;
}

/**
 * The balances to show, from the best source there is, each labelled.
 * `adapter` is null when the school has no partner connection.
 */
export async function readBalances(
  adapter: DiningPartnerAdapter | null,
  cardholderRef: string,
  cache: PartnerCache | null,
  studentReading: Balance | undefined,
  now: number,
): Promise<Decision<BalanceRead>> {
  const fallback = (why: string, code: 'no_figure' | 'partner_unavailable' = 'partner_unavailable'): Decision<BalanceRead> => {
    if (cache) return yes({ figures: fromPartner(cache.balances, cache.readAt, false, now), cache }, `${why} Showing the last read from the card office, labelled with its age.`);
    if (studentReading) return yes({ figures: fromStudent(studentReading, now), cache: null }, `${why} Showing what you entered.`);
    return no(code, `${why} There is no earlier figure to show.`);
  };

  if (!adapter) return fallback('No partner connection is live for this school.', 'no_figure');
  let health: PartnerHealth;
  try {
    health = await adapter.health(now);
  } catch {
    return fallback('The card office did not answer.');
  }
  if (health.status !== 'live') return fallback(`The card office connection is ${health.status.replace('_', ' ')}.`);
  try {
    const balances = await adapter.readBalances(cardholderRef, now);
    const next: PartnerCache = { balances, readAt: now };
    const figures = fromPartner(balances, now, true, now);
    return yes({ figures, cache: next }, figures.diningCents.authoritative ? 'Read from the card office just now.' : 'Read from the card office just now, but its figures are older than they should be.');
  } catch {
    return fallback('The card office did not answer.');
  }
}

// ── A mock, for tests and the sandbox tenant ─────────────────────────────

export interface MockPartnerOptions {
  status?: PartnerStatus;
  balances?: Record<string, Omit<PartnerBalances, 'cardholderRef'>>;
  /** Make every call throw, as a vendor outage does. */
  failing?: boolean;
}

export interface MockPartner extends DiningPartnerAdapter {
  readonly postings: readonly PartnerPosting[];
  setStatus(status: PartnerStatus): void;
  setFailing(failing: boolean): void;
}

export function mockPartner(options: MockPartnerOptions = {}): MockPartner {
  let status: PartnerStatus = options.status ?? 'live';
  let failing = options.failing ?? false;
  let lastSuccessAt: number | null = null;
  const postings: PartnerPosting[] = [];
  const balances = new Map(Object.entries(options.balances ?? {}));

  const guard = (now: number) => {
    if (failing) throw new Error('partner unavailable');
    lastSuccessAt = now;
  };

  return {
    id: 'mock_dining',
    vendor: 'Mock card office',
    get postings() {
      return postings;
    },
    setStatus(s) {
      status = s;
    },
    setFailing(f) {
      failing = f;
    },
    async health(now) {
      if (failing) throw new Error('partner unavailable');
      return { status, checkedAt: now, lastSuccessAt, detail: status };
    },
    async readBalances(ref, now) {
      guard(now);
      if (status !== 'live') throw new Error(`connection ${status}`);
      const b = balances.get(ref);
      if (!b) throw new Error('no such cardholder');
      return { cardholderRef: ref, ...b };
    },
    async postTransaction(p, now) {
      guard(now);
      if (status !== 'live') return { accepted: false, replayed: false, reason: `The connection is ${status}.` };
      if (!LEDGER_KEY.test(p.idempotencyKey) || !Number.isSafeInteger(p.delta) || p.delta === 0) {
        return { accepted: false, replayed: false, reason: 'The posting is not well formed.' };
      }
      const prior = postings.find((x) => x.idempotencyKey === p.idempotencyKey);
      if (prior) {
        const same = prior.cardholderRef === p.cardholderRef && prior.kind === p.kind && prior.delta === p.delta;
        return same
          ? { accepted: true, replayed: true, reason: 'Already posted.' }
          : { accepted: false, replayed: false, reason: 'That key was used for a different posting.' };
      }
      postings.push({ ...p });
      return { accepted: true, replayed: false, reason: 'Posted.' };
    },
    async disconnect() {
      status = 'disconnected';
    },
  };
}
