/**
 * What a kept transcript says, in words, and what a form may ask before it asks
 * the database.
 *
 * Pure. It phrases what the database kept and checks the form's own fields. It
 * decides nothing about a record, a hash or a check: the text, the hash and the
 * three-word answer were all worked out by the database and kept.
 *
 * ## What it will not say
 *
 * It never calls a transcript signed, and it never says who issued one on the
 * strength of a hash. The standing sentence is `NOT_SIGNED`, and a screen puts
 * it where the transcript is. It does not use the words "official", "certified"
 * or "authenticated" about what these are, because none of them is true: a hash
 * proves the text was not changed after issue, not who issued it.
 */
import { formatDate } from '../locale';
import { STUDENT_REF } from '../record/ledger';
import { LIMITS, type Transcript, type Verification, type VerifyStatus } from './model';
import type { Body } from './body';

/** The sentence every screen that shows an issued transcript carries, next to it. */
export const NOT_SIGNED =
  'This is not a signed transcript. It is your school’s academic record as of a date, in a fixed text, with a SHA-256 of that text. The hash shows the text has not changed since it was issued; it does not show who issued it. Signing needs a decision about who holds a key, and Semester’s owner has not made it. Treat it as a signed transcript only if your school’s own process says so.';

/** What nothing has been issued means, in one sentence. */
export const NOTHING_ISSUED = 'Nothing has been issued yet.';

/** What a check answered, in a sentence, and no more than it knows. */
export function verificationSentence(v: Verification): string {
  const on = v.issuedOn ? formatDate(new Date(`${v.issuedOn}T12:00:00Z`).getTime(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
  const who = v.schoolName ?? 'a school';
  switch (v.status) {
    case 'valid':
      return `The serial and the hash belong together: ${who} issued this transcript on ${on ?? 'a date it did not give'}, and it has not been replaced.`;
    case 'superseded':
      return `The serial and the hash belong together: ${who} issued this transcript on ${on ?? 'a date it did not give'}, and has since replaced it with a later one. Ask for the current one.`;
    default:
      return 'No transcript has that serial with that hash. Nothing else is said, so this does not tell you which of the two is wrong.';
  }
}

export const VERIFY_LABEL: Record<VerifyStatus, string> = {
  valid: 'Matches',
  superseded: 'Matches, replaced since',
  unknown: 'No match',
};

/** The two values a student hands someone, as one block of text to copy. */
export function copyText(t: Pick<Transcript, 'serial' | 'bodySha256'>): string {
  return `Transcript serial ${t.serial}\nSHA-256 ${t.bodySha256}`;
}

/** The first twelve characters of a hash, for a person to compare by eye. Never a substitute for the whole. */
export function shortHash(sha256: string): string {
  return sha256.slice(0, 12);
}

/** Today as `YYYY-MM-DD` in the caller's own calendar: what the date field holds and what a transcript is "as of". */
export function todayIso(now: Date): string {
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** What is wrong with the as-of date, in the form's words, before the database is asked. */
export function asOfProblem(asOf: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) return 'Give the date the transcript is as of.';
  if (asOf > today) return 'A transcript is as of today or an earlier date, never a later one.';
  if (asOf < '1900-01-01') return 'That is not a date a transcript can be as of.';
  return null;
}

/** What is wrong with a student reference, as the migration's check allows it. */
export function studentRefProblem(ref: string): string | null {
  if (ref.trim() === '') return 'Give the student’s reference, as your school writes it.';
  if (!STUDENT_REF.test(ref.trim())) return 'A student reference is letters, digits, dots, dashes or underscores, up to 64.';
  return null;
}

/** What is wrong with the serial of a transcript to replace, or null when it is blank (nothing is replaced) or fine. */
export function replacesProblem(replaces: string, reason: string): string | null {
  const r = replaces.trim();
  if (r === '' && reason.trim() === '') return null;
  if (r === '') return 'A reason goes with a replacement. Give the serial it replaces, or clear the reason.';
  if (!/^[1-9][0-9]{0,17}$/.test(r)) return 'A serial is a whole number, such as 12.';
  if (reason.trim() === '') return 'Say why it is replaced, in your own words.';
  if (reason.trim().length > LIMITS.reason) return `A reason is up to ${LIMITS.reason} characters.`;
  return null;
}

/** What is wrong with a release's three fields, in the form's words; one entry per field that is wrong. */
export function releaseProblems(name: string, kind: string, purpose: string): { name?: string; kind?: string; purpose?: string } {
  const out: { name?: string; kind?: string; purpose?: string } = {};
  if (name.trim() === '') out.name = 'Say who it was released to.';
  else if (name.trim().length > LIMITS.recipientName) out.name = `A name is up to ${LIMITS.recipientName} characters.`;
  if (kind.trim() === '') out.kind = 'Say what kind of recipient that is, in your own words.';
  else if (kind.trim().length > LIMITS.recipientKind) out.kind = `A kind is up to ${LIMITS.recipientKind} characters.`;
  if (purpose.trim() === '') out.purpose = 'Say why it was released.';
  else if (purpose.trim().length > LIMITS.purpose) out.purpose = `A purpose is up to ${LIMITS.purpose} characters.`;
  return out;
}

/** What is wrong with the serial and hash of a check, in the form's words. */
export function checkProblems(serial: string, hash: string): { serial?: string; hash?: string } {
  const out: { serial?: string; hash?: string } = {};
  if (!/^[1-9][0-9]{0,17}$/.test(serial.trim())) out.serial = 'A serial is a whole number, such as 12.';
  if (!/^[0-9a-fA-F]{64}$/.test(hash.trim())) out.hash = 'A hash is 64 letters and digits, 0 to 9 and a to f.';
  return out;
}

/**
 * The kept text read back into a body, or null when it is not a body this build
 * knows. A screen that cannot read one says so and shows the text as it is; it
 * never shows a rendering of its own in place of what was kept.
 */
export function readBody(bodyText: string): Body | null {
  try {
    const v: unknown = JSON.parse(bodyText);
    if (!v || typeof v !== 'object') return null;
    const b = v as Partial<Body>;
    if (b.format !== 'semester-transcript-body-1' || !Array.isArray(b.terms) || !b.school || typeof b.school.name !== 'string') return null;
    return v as Body;
  } catch {
    return null;
  }
}

/** One course's line: what the ledger holds for it, as it is, and nothing it did not say. */
export function courseLine(c: { course: string; enrollment: string; grade: string; credit: string }): string {
  const parts = [c.grade ? `grade ${c.grade}` : c.enrollment ? c.enrollment.toLowerCase() : 'no grade or enrollment on the record'];
  if (c.credit) parts.push(`credit ${c.credit}`);
  return `${c.course}: ${parts.join(', ')}`;
}
