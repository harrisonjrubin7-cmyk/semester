/**
 * The vocabulary of the financial-aid record, typed.
 *
 * `supabase/migrations/20260930270000_admissions_aid.sql` is the authority on
 * every limit and every state here, and `admissionsaid.test.ts` reads that file
 * and holds these constants equal to it. There is no field here for federal
 * data, tax data, a citizenship or any identifier beyond the school's own
 * student reference: those are refused and never held.
 */
import type { AidStatus, AwardType } from './rules';

export const LIMITS = {
  fundName: 200,
  reasonMin: 3,
  reasonMax: 1000,
  noteMax: 1000,
  studentRef: 64,
  amountMaxCents: 100000000000,
} as const;

/** The three capabilities the database checks, all held on the school. */
export type AidCapability = 'aid:record' | 'aid:approve_high' | 'aid:read';

export interface Award {
  id: string;
  studentRef: string;
  aidYear: string;
  fundName: string;
  awardType: AwardType;
  amountCents: number;
  status: AidStatus;
  highValue: boolean;
  /** Set when a second person approved it; a student sees a high award only after. */
  approvedAt: string | null;
  recordedAt: string;
}

export interface AwardHistoryEntry {
  id: string;
  awardId: string;
  seq: number;
  kind: 'status' | 'correction';
  fromStatus: AidStatus | null;
  toStatus: AidStatus;
  correctsSeq: number | null;
  reason: string;
  recordedBy: string | null;
  recordedAt: string;
}

export interface Disbursement {
  id: string;
  awardId: string;
  amountCents: number;
  disbursedOn: string;
  /** The student-accounts ledger aid credit this reconciles with, if one was linked. Read, never written, from here. */
  ledgerEntryId: string | null;
  recordedAt: string;
}
