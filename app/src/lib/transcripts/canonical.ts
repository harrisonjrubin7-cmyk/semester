/**
 * The canonical text of a transcript body, and its SHA-256.
 *
 * This is the TypeScript twin of `private.transcript_canonical` and
 * `private.transcript_sha256` in `20260930260000_transcripts.sql`, and the two
 * are held equal by one fixtures file (`fixtures.json`) that both
 * `transcripts.test.ts` and `supabase/transcripts.check.sql` must reproduce
 * exactly. The hash is of a text, so the text has to be a function of the body
 * alone, and a hash that two implementations disagree about is a transcript
 * nobody can check.
 *
 * ## The rules (the migration says them too)
 *
 *  - A body holds only objects, arrays and strings. A number, a boolean or a
 *    null is refused, so there is no number formatting to disagree about.
 *  - An object's keys are sorted by their UTF-8 bytes. That is not
 *    `Array.prototype.sort`, which sorts by UTF-16 code unit and puts a
 *    character outside the basic plane (an emoji) before U+FFFF, where its bytes
 *    put it after. The fixtures hold both.
 *  - A string is escaped as JSON escapes it: `"` and `\`, the five short
 *    escapes `\b \f \n \r \t`, every other character below U+0020 as `\u00xx`
 *    in lower case, and everything else as itself. `JSON.stringify` does
 *    exactly that for a well-formed string, so it is used; a string with a lone
 *    surrogate is refused, because a database holds none and `JSON.stringify`
 *    would write one a database could not read back.
 *  - No whitespace, no normalisation. The bytes are the bytes.
 */

export type Json = string | readonly Json[] | { readonly [key: string]: Json };

const encoder = new TextEncoder();

/** Compares two strings by their UTF-8 bytes: the order of collation "C" on a UTF-8 database. */
export function byBytes(a: string, b: string): number {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}

/** Whether a string holds a surrogate with no partner: not text a database can keep. */
function loneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
      else return true;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}

/** What a value the canonical text cannot hold is called, for the refusal. */
export const NOT_CANONICAL = 'a transcript body holds only text, lists and objects';

function text(s: string): string {
  if (loneSurrogate(s)) throw new Error(NOT_CANONICAL);
  return JSON.stringify(s);
}

/** The canonical text of a body. Throws if it holds anything but objects, arrays and strings. */
export function canonicalize(value: unknown): string {
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  // A plain object only: a Date, a Map or a class instance has no keys of its
  // own to write and would read as `{}`, which is a silent wrong answer.
  if (value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort(byBytes)
      .map((k) => `${text(k)}:${canonicalize(o[k])}`)
      .join(',')}}`;
  }
  throw new Error(NOT_CANONICAL);
}

/** SHA-256 of the UTF-8 bytes of a text, in lower-case hex, by the platform's own implementation. */
export async function sha256Hex(given: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(given));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
