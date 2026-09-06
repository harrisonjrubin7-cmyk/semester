/**
 * Getting readable text out of whatever a professor posted.
 *
 * A syllabus arrives as a PDF nine times out of ten, sometimes as a Word file,
 * sometimes as text pasted out of an email. All of it has to become plain text
 * in the browser, because there is no server to send it to and — more to the
 * point — a syllabus is the student's document and there is no reason for it to
 * leave their machine before they have decided anything.
 *
 * PDF text comes from pdf.js, loaded on demand: it is a megabyte of parser that
 * most sessions never need, so it is only fetched the first time someone
 * actually uploads a PDF.
 */

/** What the parser needs from pdf.js, without pulling its types in. */
interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: { str?: string; transform?: number[] }[] }>;
      }>;
    }>;
  };
}

let pdfjs: PdfLib | null = null;

async function loadPdfjs(): Promise<PdfLib> {
  if (pdfjs) return pdfjs;
  const lib = (await import('pdfjs-dist')) as unknown as PdfLib;
  // The worker ships beside the library; Vite gives us a URL for it.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjs = lib;
  return lib;
}

/**
 * PDF text, page by page, with line breaks put back.
 *
 * pdf.js returns positioned fragments, not lines — a schedule table comes out
 * as a stream of cells with no rows. Comparing the vertical position of each
 * fragment to the last one restores the line breaks, which is what makes a
 * syllabus's dates survive the trip.
 */
async function fromPdf(file: File): Promise<string> {
  const lib = await loadPdfjs();
  let doc: Awaited<ReturnType<PdfLib['getDocument']>['promise']>;
  try {
    doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch {
    /*
     * pdf.js says "Invalid PDF structure." and stops there, which tells a
     * student nothing about what to do next. This file has careful wording for
     * the two failures it already knew about — a file type it cannot read, and
     * a scan that needs OCR — and a half-downloaded PDF deserves the same.
     */
    throw new Error(
      `${file.name} could not be opened as a PDF. If it stopped part-way through downloading, fetch it again — or paste the text in by hand.`,
    );
  }
  const pages: string[] = [];

  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      const str = item.str ?? '';
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += '\n';
      text += str;
      if (y !== null) lastY = y;
    }
    pages.push(text);
  }
  return pages.join('\n\n');
}

/**
 * The handful of XML and HTML entities a syllabus actually contains.
 *
 * Shared by the Word and the HTML paths, which had drifted: Word decoded five
 * of them and HTML decoded only `&nbsp;`, so "Supply &amp; Demand" — which is
 * how half the unit titles in an economics syllabus are stored — reached the
 * model with the entity still in it.
 *
 * The ampersand goes last, and that ordering is the whole point. A document
 * writing the literal characters "&lt;" encodes them "&amp;lt;"; decoding the
 * ampersand first leaves "&lt;", which the next pass turns into a tag where
 * the professor had only written the name of one.
 */
function entities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Word files, without a library.
 *
 * A .docx is a zip whose document.xml holds the text. Rather than adding a
 * dependency for the occasional Word syllabus, the paragraphs are pulled
 * straight out of that XML — enough for a syllabus, and honest about being
 * nothing more: tables come out as text, and formatting is discarded.
 */
async function fromDocx(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    // "invalid zip data" is what the unzipper says, and the commonest cause is
    // an older .doc that somebody renamed rather than re-saved — a .doc is not
    // a zip at all, so there is nothing here to open.
    throw new Error(
      `${file.name} could not be opened as a Word file. If it is an older .doc, open it in Word and save it again as .docx — or paste the text in by hand.`,
    );
  }
  const entry = zip['word/document.xml'];
  if (!entry) throw new Error('That .docx has no document inside it.');
  const xml = strFromU8(entry);
  const stripped = xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '');
  return entities(stripped).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Slide decks, the same way and for the same reason.
 *
 * A .pptx is a zip too, one XML per slide under `ppt/slides/`. The app used to
 * refuse them outright — `bundle.ts` said "export them as a PDF and they read
 * perfectly", which is true and is also a step nobody takes, so the commonest
 * thing a professor posts was the one thing the app would not read.
 *
 * The slide numbers are kept rather than flattened away. They are the only
 * page reference a deck has, and everything downstream that says where a card
 * came from — "From Session 7 slides, slide 12" — needs them.
 */
export async function fromPptx(file: File): Promise<{ slide: number; text: string }[]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(
      `${file.name} could not be opened as a slide deck. If it is an older .ppt, open it and save it again as .pptx — or export the deck as a PDF.`,
    );
  }

  // `slide10.xml` must not sort before `slide2.xml`, which is what plain
  // string ordering does and what would silently renumber every deck over
  // nine slides.
  const names = Object.keys(zip)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
  if (names.length === 0) throw new Error('That .pptx has no slides inside it.');

  const out: { slide: number; text: string }[] = [];
  for (const n of names) {
    const xml = strFromU8(zip[n]);
    /*
     * `<a:p>` is a paragraph and `<a:t>` is a run of text inside it. Breaking
     * on the paragraph and joining the runs is the same shape as the Word
     * path: a title and its bullets come out as lines rather than as one
     * run-on sentence, which is the difference between a readable slide and a
     * wall.
     */
    const text = xml
      .replace(/<a:p[ >]/g, '\n<a:p ')
      .replace(/<a:br\/>/g, '\n')
      .replace(/<\/a:t>\s*<a:t[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((l) => entities(l).trim())
      .filter(Boolean)
      .join('\n');
    out.push({ slide: Number(/(\d+)/.exec(n)![1]), text });
  }
  return out;
}

export interface Extracted {
  name: string;
  text: string;
  /** Words, so the UI can say how much was read. */
  words: number;
  /**
   * Where each piece of the text came from, when the format says.
   *
   * A slide deck knows its slide numbers and a PDF knows its pages; a Word
   * file and a pasted block know nothing. Present only where it is real,
   * because a made-up page reference is worse than none — the whole point of
   * carrying it is that somebody can go and check.
   */
  pages?: { page: number; text: string }[];
  /**
   * The file itself, base64, for a PDF small enough to send whole.
   *
   * Extraction is still done — the word count, the preview and every
   * non-Claude path need text. But a syllabus flattened to text has lost the
   * one thing that makes it readable: a table with weeks down the left and
   * dates across, where column alignment is the only thing saying which date
   * belongs to which reading. Where the original can go too, it does, and the
   * model reads the page. See `lib/claude.ts` and `lib/cite.ts`.
   *
   * Absent for anything that is not a PDF, and for a PDF over the limit.
   */
  pdf?: string;
}

/**
 * How large a PDF may be and still be sent whole.
 *
 * The API's own ceiling is 32 MB for the whole request, and base64 costs a
 * third on top. Twelve leaves room for the prompt and for a second document,
 * and a syllabus over twelve megabytes is a scan rather than a syllabus —
 * for which the extracted text is the better input anyway.
 */
const SENDABLE_PDF = 12 * 1024 * 1024;

/** A file as base64, with no data: prefix and no newlines. */
async function asBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  // In chunks: `String.fromCharCode(...bigArray)` overflows the call stack on
  // anything of this size.
  const STEP = 0x8000;
  for (let i = 0; i < buf.length; i += STEP) {
    binary += String.fromCharCode(...buf.subarray(i, i + STEP));
  }
  return btoa(binary);
}

export async function extractText(file: File): Promise<Extracted> {
  const name = file.name;
  let text: string;
  /** The PDF itself, where it can go whole as well as flattened. */
  let original: string | undefined;
  let pages: { page: number; text: string }[] | undefined;

  if (/\.pdf$/i.test(name) || file.type === 'application/pdf') {
    text = await fromPdf(file);
    if (file.size <= SENDABLE_PDF) {
      try {
        original = await asBase64(file);
      } catch {
        // Out of memory on a huge file, or a browser without btoa. The text
        // still went through, which is what the app had before this existed.
      }
    }
  } else if (/\.docx$/i.test(name)) {
    text = await fromDocx(file);
  } else if (/\.pptx$/i.test(name)) {
    const slides = await fromPptx(file);
    pages = slides.map((s) => ({ page: s.slide, text: s.text }));
    // Numbered in the flat text as well. A model reading this is being asked
    // where something came from, and the number has to be in front of it.
    text = slides.map((s) => `Slide ${s.slide}\n${s.text}`).join('\n\n');
  } else if (/^text\//.test(file.type) || /\.(txt|md|markdown|csv|rtf|html?)$/i.test(name)) {
    text = await file.text();
    if (/\.html?$/i.test(name)) {
      // Keep the structure a syllabus page carries: headings and rows.
      text = entities(
        text
          .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
          .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
          .replace(/<(br|td|th)[^>]*>/gi, ' ')
          .replace(/<[^>]+>/g, ''),
      ).replace(/\n{3,}/g, '\n\n');
    }
  } else {
    throw new Error(`${name} is not a kind of file this can read — PDF, Word, slides, or text.`);
  }

  text = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) {
    throw new Error(
      `Nothing readable came out of ${name}. A scanned PDF is a picture of text — it needs to be run through OCR first, or pasted in by hand.`,
    );
  }
  return {
    name,
    text,
    words: text.split(/\s+/).length,
    ...(original ? { pdf: original } : {}),
    ...(pages ? { pages } : {}),
  };
}
