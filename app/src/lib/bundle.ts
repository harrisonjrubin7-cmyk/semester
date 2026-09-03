/**
 * A folder of readings, dropped in at once.
 *
 * Nobody has one syllabus. They have a download folder with a syllabus, four
 * PDFs, a photo of the board and a zip a professor posted, and uploading those
 * one at a time is enough friction to stop them uploading any. So every file
 * input in the app takes many, and a .zip is unpacked rather than refused.
 *
 * ## What comes out, and what does not
 *
 * PDFs, images and text. Not because zips cannot hold anything else, but
 * because those are what the rest of the app can genuinely read: `extract.ts`
 * reads PDFs, Word and text, and the vision path takes images. Video was
 * explicitly dropped — the API takes neither audio nor video, and accepting a
 * 300MB lecture recording to then say so would be a worse experience than
 * saying so up front.
 *
 * Everything skipped is *reported*, not silently dropped. A zip that quietly
 * loses half its contents is how somebody ends up studying from three of five
 * readings without knowing it.
 */

/** What the app can actually do something with. */
const READABLE =
  /\.(pdf|docx?|txt|md|markdown|csv|tsv|rtf|png|jpe?g|webp|gif|heic|heif)$/i;

/** Things a zip carries that are not files anybody meant to send. */
const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\._)/i;

/** One file that came out of a bundle, or was picked directly. */
export interface Piece {
  name: string;
  file: File;
}

export interface Unpacked {
  files: Piece[];
  /** What was left out, and why — shown rather than swallowed. */
  skipped: { name: string; why: string }[];
}

/**
 * A zip's entry limits.
 *
 * Not paranoia about a hostile file so much as about a plausible one: a
 * semester's worth of lecture recordings in a zip would exhaust the tab's
 * memory before anything told the person why, because unzipping happens fully
 * in memory.
 */
export const MAX_FILES = 60;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

export function isZip(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip';
}

export function readable(name: string): boolean {
  return READABLE.test(name) && !JUNK.test(name);
}

/** "chapter-3.pdf" from "readings/week 4/chapter-3.pdf". */
export function baseName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** A rough MIME type from an extension, since a zip entry carries none. */
export function typeOf(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const known: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    rtf: 'application/rtf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return known[ext] ?? 'application/octet-stream';
}

/**
 * Why a file was left out, in a sentence rather than a code.
 *
 * Separated from the unpacking so the wording is tested: "skipped 4 files" is
 * a message that makes somebody re-upload the same zip twice hoping for a
 * different outcome.
 */
export function whySkipped(name: string, bytes: number): string | null {
  if (JUNK.test(name)) return 'not a real file — a zip’s own bookkeeping';
  if (!READABLE.test(name)) {
    if (/\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name)) {
      return 'video — the model reads neither audio nor video, so there is nothing to do with it';
    }
    if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) {
      return 'audio — record a lecture in the app instead, where it is transcribed live';
    }
    if (/\.(pptx?|keynote|key)$/i.test(name)) {
      return 'slides — export them as a PDF and they read perfectly';
    }
    return 'not a kind of file the app can read';
  }
  if (bytes > MAX_FILE_BYTES) return `too big — ${Math.round(bytes / 1024 / 1024)}MB`;
  return null;
}

/**
 * Everything usable inside a zip.
 *
 * fflate unzips in memory, which is why the caps above exist and are checked
 * against the *declared* sizes as entries come out rather than after building
 * every File.
 */
export async function unzip(file: File): Promise<Unpacked> {
  const { unzipSync } = await import('fflate');
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(
      `${file.name} would not open. If it is password-protected or a disk image rather than a zip, nothing here can read it.`,
    );
  }

  const files: Piece[] = [];
  const skipped: Unpacked['skipped'] = [];
  let total = 0;

  for (const [path, bytes] of Object.entries(entries)) {
    // A directory entry is a zero-length name ending in a slash.
    if (path.endsWith('/')) continue;

    const why = whySkipped(path, bytes.length);
    if (why) {
      if (!JUNK.test(path)) skipped.push({ name: baseName(path), why });
      continue;
    }
    if (files.length >= MAX_FILES) {
      skipped.push({ name: baseName(path), why: `past the first ${MAX_FILES} files` });
      continue;
    }
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) {
      skipped.push({ name: baseName(path), why: 'the zip is larger than a browser tab can unpack' });
      continue;
    }

    const name = baseName(path);
    files.push({
      name,
      file: new File([bytes as unknown as BlobPart], name, { type: typeOf(name) }),
    });
  }

  return { files, skipped };
}

/**
 * A picked list of files, with any zips among them opened.
 *
 * The one entry point a screen needs: hand it whatever the file input gave,
 * get back what the app can use and a list of what it could not, whether or
 * not any of it was zipped.
 */
export async function gather(picked: File[]): Promise<Unpacked> {
  const files: Piece[] = [];
  const skipped: Unpacked['skipped'] = [];

  for (const file of picked) {
    if (isZip(file)) {
      try {
        const inside = await unzip(file);
        files.push(...inside.files);
        skipped.push(...inside.skipped);
      } catch (e) {
        skipped.push({ name: file.name, why: e instanceof Error ? e.message : 'would not open' });
      }
      continue;
    }
    const why = whySkipped(file.name, file.size);
    if (why) {
      skipped.push({ name: file.name, why });
      continue;
    }
    files.push({ name: file.name, file });
  }

  return { files, skipped };
}

/** "4 files · 2 skipped" — the line under the picker. */
export function tally(got: Unpacked): string {
  const n = got.files.length;
  const head = n === 0 ? 'Nothing usable' : `${n} file${n === 1 ? '' : 's'}`;
  return got.skipped.length === 0 ? head : `${head} · ${got.skipped.length} left out`;
}
