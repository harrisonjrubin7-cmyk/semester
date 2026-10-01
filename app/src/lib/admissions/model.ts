/**
 * The vocabulary of the admissions record, typed.
 *
 * `supabase/migrations/20260930270000_admissions_aid.sql` is the authority on
 * every limit and every state here, and `admissionsaid.test.ts` reads that file
 * and holds these constants equal to it. They exist so a form can refuse
 * before a call, never so a form can allow what the database would not.
 *
 * An applicant is not a student and has no account. These rows are the school's
 * record of an application; Semester scores, ranks and recommends nothing.
 */
import type { AdmissionStatus } from './rules';

/** A limit the database enforces, repeated so a form can name it first. */
export const LIMITS = {
  cycle: 40,
  applicantRef: 64,
  program: 200,
  reasonMin: 3,
  reasonMax: 1000,
  studentRef: 64,
} as const;

/** The three capabilities the database checks, all held on the school. */
export type AdmissionsCapability = 'admissions:record' | 'admissions:decide' | 'admissions:read';

export interface Applicant {
  id: string;
  cycle: string;
  /** The reference the school supplies; Semester never invents one. */
  applicantRef: string;
  program: string;
  status: AdmissionStatus;
  statusAt: string;
}

export interface HistoryEntry {
  id: string;
  applicantId: string;
  seq: number;
  kind: 'status' | 'correction';
  fromStatus: AdmissionStatus | null;
  toStatus: AdmissionStatus;
  correctsSeq: number | null;
  reason: string;
  recordedBy: string | null;
  recordedAt: string;
}

/** The registrar's link from an applicant to a student reference. */
export interface ApplicantLink {
  applicantId: string;
  studentRef: string;
  linkedAt: string;
}
