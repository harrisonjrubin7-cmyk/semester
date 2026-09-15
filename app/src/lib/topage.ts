/**
 * From the sentence on screen to the page it is printed on.
 *
 * Every imported deadline carries the sentence it came from, `lib/cite.ts`
 * checks that sentence against the spans the API says it actually read, and
 * the screen prints the page underneath it — `· p. 12`. The comment above
 * that line has said, since it was written, that this is what turns *"the app
 * says the syllabus says this"* into something you can check in ten seconds.
 *
 * It was not. The page number was a string. `Item` had no link to any
 * document, and the import path did not keep one: `intakeFiles` read the text
 * out of the PDF and let the bytes go. The app printed a reference to a
 * document it had thrown away, which is a footnote to a library nobody can
 * visit.
 *
 * This module is the link, and it is deliberately made of things the app
 * already had rather than a new field on the state.
 *
 * ## The drive is the link
 *
 * A stored file already records which course it belongs to. So the syllabus
 * is kept in the drive, filed against the course it built, and the way back
 * from a deadline to its document is: *the PDF filed against this course
 * whose name is the one the citation gave.* No id is written into the course
 * record, which matters for three reasons — a shared pack cannot carry a file
 * id that means anything on somebody else's device, a course restored from a
 * backup cannot point at a file that is not in it, and binning the syllabus
 * makes the link go away by itself rather than leaving a button that opens
 * nothing.
 *
 * ## Naming the document, rather than assuming there is one
 *
 * Two PDFs go up together often enough — a syllabus and a schedule posted
 * separately — and `p. 4` then names a page in each of them. The API returns
 * the title it was given for the document it cited, so the app is not
 * guessing; `Item.checked.doc` carries it. Where a course predates that, the
 * course's own `source` names the file the app read, which is the same answer
 * whenever there was only one.
 *
 * **What is not done is a fallback to "the only PDF filed against this
 * course".** Readings are filed against courses too. Opening a student's
 * week-three reading at page 12 and presenting it as the syllabus would be
 * worse than the inert text this replaces, because it would look right. Where
 * the document cannot be named, {@link sourceFor} answers null and the screen
 * prints what it always printed.
 */

import { addFile, isPdf, listFiles } from './files';

/** What this module needs of a stored file. Narrow, so a test need not build one. */
export interface Held {
  id: string;
  name: string;
  type: string;
  size: number;
  /** When it arrived, for choosing between two printings of one syllabus. */
  added: number;
  courseId: string | null;
  /** Set while it is in the bin. */
  trashedAt?: number | null;
}

/** What this module needs of a deadline. */
export interface Cited {
  /** The course id — `Item.c`. */
  c: string;
  checked?: { page?: number; doc?: string };
}

/** Names compare as a person would read them: case and surrounding space aside. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Base64 back to bytes.
 *
 * `Intake.pdf` holds the original PDF as base64 because that is the form the
 * API takes it in, and it is already in memory at the moment the import is
 * saved. Decoding it there costs nothing and means the import path does not
 * have to carry the `File` object through five functions that have no use for
 * it.
 *
 * A plain loop rather than the spread form `asBase64` in `lib/extract.ts` had
 * to write around: `String.fromCharCode(...bytes)` overflows the call stack on
 * anything of this size, and reading a character at a time never does. It is
 * also the only form that needs no chunk size nobody can justify.
 */
export function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * The file to keep, out of what the import read.
 *
 * Null for anything with no original to keep: pasted text, a Word file, a
 * slide deck, and a PDF too large to have been carried whole. Every one of
 * those is also a source that cannot produce a page number — only a PDF sent
 * whole is cited with pages — so the set of documents worth keeping is
 * exactly the set a citation can point into.
 */
export function pdfFrom(read: { name: string; pdf?: string }): File | null {
  if (!read.pdf) return null;
  let bytes: Uint8Array;
  try {
    bytes = bytesOf(read.pdf);
  } catch {
    // A truncated or re-encoded string. The import still goes through; the
    // page numbers it produces simply stay inert, which is where they were.
    return null;
  }
  return new File([bytes as BlobPart], read.name, { type: 'application/pdf' });
}

/**
 * Whether this document is already in the drive against this course.
 *
 * Name and size together. Re-importing the same syllabus to pick up a fix in
 * the reader should not leave two copies of it; a syllabus that has actually
 * been reissued differs in size, and is kept beside the old one rather than
 * over it — the old one is what the deadlines you already ticked were read
 * from.
 */
export function alreadyHeld(files: Held[], courseId: string, file: File): boolean {
  return files.some(
    (f) =>
      f.courseId === courseId &&
      !f.trashedAt &&
      f.size === file.size &&
      sameName(f.name, file.name),
  );
}

/**
 * The stored document a deadline's page number is a page of, or null.
 *
 * Null is the ordinary answer and not a failure: a course imported before
 * this existed, a course built from pasted text, a deadline the API did not
 * cite, a syllabus the student has binned. Every one of those leaves the page
 * printed as text, which is what the screen did before.
 *
 * Two copies under one name is not a tie to refuse — a reissued syllabus is
 * kept beside the one it replaces — so the most recent wins, which is the one
 * the course was last read from.
 */
export function sourceFor(files: Held[], item: Cited, courseSource: string): Held | null {
  const page = item.checked?.page;
  if (typeof page !== 'number' || page < 1) return null;

  const wanted = item.checked?.doc ?? courseSource;
  if (!wanted.trim()) return null;

  const matches = files.filter(
    (f) =>
      f.courseId === item.c && !f.trashedAt && isPdf(f.type, f.name) && sameName(f.name, wanted),
  );
  if (matches.length === 0) return null;
  return matches.reduce((newest, f) => (f.added > newest.added ? f : newest));
}

/**
 * Keep the documents a course was read from, filed against that course.
 *
 * Called after the import is committed, and deliberately not awaited by it:
 * a student who has just approved twelve deadlines should not watch a
 * progress bar for a write they did not ask for, and IndexedDB is simply
 * absent in some private windows. A failure here costs the page numbers their
 * link and nothing else, which is exactly the state the app was in before.
 *
 * Returns how many were newly kept, for a caller that wants to say so.
 */
export async function keepSources(
  read: { name: string; pdf?: string }[],
  courseId: string,
): Promise<number> {
  const wanted: File[] = [];
  for (const piece of read) {
    const file = pdfFrom(piece);
    // The same document twice in one basket — a zip containing the syllabus
    // alongside a loose copy of it — is one document.
    if (file && !wanted.some((w) => w.size === file.size && sameName(w.name, file.name))) {
      wanted.push(file);
    }
  }
  if (wanted.length === 0) return 0;

  let held: Held[];
  try {
    held = await listFiles();
  } catch {
    return 0;
  }

  let kept = 0;
  for (const file of wanted) {
    if (alreadyHeld(held, courseId, file)) continue;
    try {
      await addFile(file, courseId);
      kept += 1;
    } catch {
      // Out of quota, or a browser refusing storage. The rest still go.
    }
  }
  return kept;
}
