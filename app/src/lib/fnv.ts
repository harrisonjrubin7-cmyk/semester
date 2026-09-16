/**
 * A content hash, and deliberately not a cryptographic one.
 *
 * FNV-1a, 64 bits, as hex. Nothing here is a security boundary: the question
 * is only "have I already seen exactly this?", asked about a file the student
 * chose themselves or a unit this repository is about to speak aloud, and a
 * collision costs a skipped import or a stale MP3 rather than anything worse.
 *
 * The alternative, `crypto.subtle.digest`, is asynchronous, absent over plain
 * http, and absent in some test environments — three ways for the
 * de-duplication guarantee to quietly stop holding, which is the one thing it
 * must not do.
 *
 * ## Why it has a file of its own
 *
 * It lived in `lib/intake.ts`, which is about reading whatever somebody
 * dropped into the app, and it had one caller. It has two now, and the second
 * is not in the app at all: `scripts/audiocache.ts` keys rendered audio by the
 * material it was spoken from, and that job runs under Node rather than in a
 * browser. Node strips types but does not resolve extensionless imports, so a
 * module the job needs cannot import `./bundle` two steps down — and
 * `lib/intake.ts` does, on its first line.
 *
 * A second FNV-1a written out in the job would have been the other way to
 * settle that, and it is the failure every registry in this app exists to
 * prevent: two implementations of one number, agreeing until one of them is
 * improved. So the hash moved here, where nothing is imported and both sides
 * can have it. `lib/intake.ts` re-exports it and its callers did not change.
 */

export function hashOf(text: string): string {
  // Two 32-bit lanes rather than BigInt: the same arithmetic, and it runs on
  // a megabyte of syllabus without allocating per character.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}
