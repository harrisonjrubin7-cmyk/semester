/**
 * The vocabulary of issued transcripts, typed.
 *
 * `supabase/migrations/20260930260000_transcripts.sql` is the authority on
 * every limit here, and `transcripts.test.ts` reads that file and holds these
 * constants equal to it. They exist so a form can name a limit before a call,
 * never so a screen can allow what the database would not.
 *
 * What these are not: an issued transcript here is the academic-record ledger
 * as of a date, in a fixed text, with a SHA-256 of that text. It is not signed.
 */

/** A limit the database enforces, repeated so a form can name it first. */
export const LIMITS = {
  recipientName: 200,
  recipientKind: 80,
  purpose: 500,
  reason: 500,
  /** Checks a signed-in account may make in an hour. */
  checksPerHour: 120,
} as const;

/** The two capabilities the database checks, both held on the school. */
export type TranscriptCapability = 'transcript:issue' | 'transcript:read';

/** What a check answers. Nothing else is ever returned. */
export type VerifyStatus = 'valid' | 'superseded' | 'unknown';

export const VERIFY_STATUSES: readonly VerifyStatus[] = ['valid', 'superseded', 'unknown'];

/** One transcript as the database kept it. */
export interface Transcript {
  id: string;
  serial: number;
  studentRef: string;
  asOf: string;
  issuedBy: string | null;
  issuedAt: string;
  /** The canonical text the hash is of. */
  bodyText: string;
  bodySha256: string;
  /** The serial of the transcript that replaced this one, when one did. */
  replacedBy: number | null;
  /** Why it was replaced, in the registrar's words. */
  replacedBecause: string | null;
}

/** One release of a transcript, as the log kept it. */
export interface Disclosure {
  id: string;
  serial: number;
  studentRef: string;
  releasedBy: string | null;
  releasedAt: string;
  recipientName: string;
  recipientKind: string;
  purpose: string;
}

/** What a check says, and the only two facts that come with it. */
export interface Verification {
  status: VerifyStatus;
  schoolName: string | null;
  issuedOn: string | null;
}
