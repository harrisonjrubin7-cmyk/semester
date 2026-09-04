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
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
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
 * Word files, without a library.
 *
 * A .docx is a zip whose document.xml holds the text. Rather than adding a
 * dependency for the occasional Word syllabus, the paragraphs are pulled
 * straight out of that XML — enough for a syllabus, and honest about being
 * nothing more: tables come out as text, and formatting is discarded.
 */
async function fromDocx(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const entry = zip['word/document.xml'];
  if (!entry) throw new Error('That .docx has no document inside it.');
  const xml = strFromU8(entry);
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface Extracted {
  name: string;
  text: string;
  /** Words, so the UI can say how much was read. */
  words: number;
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
  } else if (/^text\//.test(file.type) || /\.(txt|md|markdown|csv|rtf|html?)$/i.test(name)) {
    text = await file.text();
    if (/\.html?$/i.test(name)) {
      // Keep the structure a syllabus page carries: headings and rows.
      text = text
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
        .replace(/<(br|td|th)[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
    }
  } else {
    throw new Error(`${name} is not a kind of file this can read — PDF, Word, or text.`);
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
  };
}
