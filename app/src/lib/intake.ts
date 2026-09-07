import { gather, type Unpacked } from './bundle';
import { extractText } from './extract';

/**
 * One way in for everything a course throws at you.
 *
 * Material arrived through four different doors — the syllabus importer, the
 * add-a-reading screen, the camera, the announcement box — and each door knew
 * how to read one kind of thing. So a PDF pasted into the wrong one was
 * attached and never read, a slide deck was refused outright, and which door
 * you happened to use decided how much of your material the app understood.
 *
 * This is the single door. It takes files, a zip of files, pasted text, and a
 * pasted address, reads whatever it can, and hands back the same shape for all
 * of them. Nothing here decides what the material *is* — that is `classify.ts`
 * — and nothing here writes anything.
 *
 * ## What it will not do
 *
 * It does not ask what kind of file this is. Somebody uploading their Session 7
 * slides knows they are slides and should not have to say so twice, and the
 * question is answerable from the contents.
 */

/** Where a piece of material came from, which changes how much to trust it. */
export type Door = 'file' | 'paste' | 'url' | 'photo';

export interface Intake {
  /** What to call it: the filename, or a first line for pasted text. */
  name: string;
  text: string;
  words: number;
  /**
   * Slide or page numbers, where the format actually carries them.
   *
   * Absent for a Word file and for pasted text, which know nothing about
   * pages. See `Extracted.pages` — a made-up page reference is worse than
   * none, because the point of carrying one is that it can be checked.
   */
  pages?: { page: number; text: string }[];
  /** The original PDF, base64, when small enough to send whole. */
  pdf?: string;
  door: Door;
  /**
   * The same bytes always give the same string.
   *
   * This is what makes re-importing a file produce nothing the second time.
   * See `hashOf` for why it is not a cryptographic hash.
   */
  hash: string;
  /** Bytes, for the storage warning before a large import. */
  size: number;
}

export interface IntakeResult {
  read: Intake[];
  /** Named, never silently dropped — with what to do about each. */
  refused: { name: string; why: string }[];
}

/**
 * A content hash, and deliberately not a cryptographic one.
 *
 * FNV-1a, 64 bits, as hex. Nothing here is a security boundary: the question
 * is only "have I already read exactly this?", asked about a file the student
 * chose themselves, and a collision costs a skipped import rather than
 * anything worse.
 *
 * The alternative, `crypto.subtle.digest`, is asynchronous, absent over plain
 * http, and absent in some test environments — three ways for the
 * de-duplication guarantee to quietly stop holding, which is the one thing it
 * must not do.
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

/** Handled by the camera path, which can actually see them. */
const IMAGE = /\.(png|jpe?g|webp|gif|heic|heif)$/i;

/** Enough of the first line to name a pasted block in a list. */
function nameOf(text: string): string {
  const first = text.split('\n').find((l) => l.trim()) ?? '';
  const short = first.trim().slice(0, 60);
  return short || 'Pasted text';
}

/**
 * Read whatever was dropped in.
 *
 * Zips are unpacked on the way — a professor posting a week's readings as one
 * archive is the normal case. One unreadable file does not lose the batch: it
 * is named in `refused` alongside the reason, because a folder that quietly
 * loses half its contents is how somebody studies from three of five readings
 * without knowing it.
 */
export async function intakeFiles(
  list: File[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<IntakeResult> {
  const got: Unpacked = await gather(list);
  const read: Intake[] = [];
  const refused: { name: string; why: string }[] = got.skipped.map((s) => ({
    name: s.name,
    why: s.why,
  }));

  let done = 0;
  for (const piece of got.files) {
    if (signal?.aborted) break;
    onProgress?.(done, got.files.length);
    done += 1;

    if (IMAGE.test(piece.name)) {
      refused.push({
        name: piece.name,
        why: 'a photograph — read it with the camera, which can see it',
      });
      continue;
    }
    try {
      const out = await extractText(piece.file);
      read.push({
        name: out.name,
        text: out.text,
        words: out.words,
        door: 'file',
        hash: hashOf(out.text),
        size: piece.file.size,
        ...(out.pages ? { pages: out.pages } : {}),
        ...(out.pdf ? { pdf: out.pdf } : {}),
      });
    } catch (e) {
      refused.push({ name: piece.name, why: e instanceof Error ? e.message : String(e) });
    }
  }
  onProgress?.(done, got.files.length);
  return { read, refused };
}

/** Text somebody pasted. The one door with no file behind it. */
export function intakeText(text: string, door: Door = 'paste'): Intake | null {
  const body = text.replace(/\r\n/g, '\n').trim();
  if (!body) return null;
  return {
    name: nameOf(body),
    text: body,
    words: body.split(/\s+/).length,
    door,
    hash: hashOf(body),
    size: body.length,
  };
}

/** Anything that is only an address, so the paste box can tell them apart. */
export function isUrl(text: string): boolean {
  const one = text.trim();
  if (/\s/.test(one)) return false;
  return /^(https?:\/\/|webcal:\/\/|www\.)\S+$/i.test(one);
}

/**
 * An address somebody pasted.
 *
 * A browser cannot fetch an arbitrary page: the site has to send CORS headers
 * and a course site does not. The app already has one way round this — the
 * `/feed` route the dev server provides, which `Connect.tsx` uses for calendar
 * subscriptions — and it is honest there about the limit. This is honest about
 * the same one rather than failing with a network error that reads like a bug.
 */
export async function intakeUrl(url: string, signal?: AbortSignal): Promise<Intake> {
  const target = url.trim().replace(/^webcal:\/\//i, 'https://').replace(/^www\./i, 'https://www.');
  let text: string;
  try {
    const res = await fetch(`/feed?url=${encodeURIComponent(target)}`, { signal });
    if (!res.ok) throw new Error(`That address answered ${res.status}.`);
    text = await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new Error(
      'A pasted address can only be fetched with the dev proxy running — a browser is not allowed to read another site directly. Download the file and add it, or paste the text itself.',
    );
  }
  // A page comes back as HTML. Reuse the reader rather than a second stripper.
  const looksHtml = /^\s*<(!doctype|html|head|body)/i.test(text);
  const file = new File([text], looksHtml ? 'page.html' : 'page.txt', {
    type: looksHtml ? 'text/html' : 'text/plain',
  });
  const out = await extractText(file);
  return {
    name: target.replace(/^https?:\/\//, '').slice(0, 60),
    text: out.text,
    words: out.words,
    door: 'url',
    hash: hashOf(out.text),
    size: text.length,
  };
}

/**
 * One hash for everything a hand-added piece of material is made of.
 *
 * The file path has had this since it existed — `held()` compares
 * `sourceHash`, so re-posting a deck as "Session 7 (updated).pptx" is
 * recognised as the same material under a different name. The paste path had
 * nothing: pasting the same reading twice, which is what happens when you are
 * not sure the first one saved, made two copies of it, and every count in the
 * app doubled.
 *
 * Whitespace is collapsed before hashing because the same passage pasted from
 * a PDF twice differs by line breaks and nothing else, and a de-duplication
 * that a stray newline defeats is not one.
 */
export function materialHash(parts: (string | undefined)[]): string {
  const text = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .join('\n');
  return text ? hashOf(text) : '';
}

/**
 * The earlier import of this same material, if there is one.
 *
 * Scoped to the course, because the same handout genuinely can belong to two
 * of them, and because an update carries the course it was filed against.
 */
export function alreadyAdded<T extends { courseId: string; sourceHash?: string }>(
  updates: T[],
  courseId: string,
  hash: string,
): T | undefined {
  if (!hash) return undefined;
  return updates.find((u) => u.courseId === courseId && u.sourceHash === hash);
}
