import { beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';

/**
 * The other end of the import pipeline from `generate.ts`.
 *
 * Everything a professor posts arrives here first, and whatever comes out is
 * all the model ever sees. Text lost at this step is a deadline that cannot be
 * found later however good the reading is — so the tests are mostly about what
 * survives the trip: the line breaks that hold a schedule table together, the
 * paragraphs of a Word file, the ampersand in "Supply & Demand".
 *
 * The .docx path is exercised against a real zip built here rather than a
 * stubbed one, because the thing worth testing is that it can read a Word file
 * at all. pdf.js is a megabyte of parser loaded on demand and is stubbed.
 */

/** Positioned fragments, the way pdf.js hands them back. */
type Frag = { str?: string; transform?: number[] };
let pages: Frag[][] = [];

/** Set to make the parser reject, the way pdf.js does on a damaged file. */
let pdfFails = false;

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: pdfFails
      ? Promise.reject(new Error('Invalid PDF structure.'))
      : Promise.resolve({
          get numPages() {
            return pages.length;
          },
          getPage: (n: number) =>
            Promise.resolve({ getTextContent: () => Promise.resolve({ items: pages[n - 1] }) }),
        }),
  }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.mjs' }));

const { extractText } = await import('./extract');

/** A fragment at a given vertical position — what restores line breaks. */
const at = (y: number, str: string): Frag => ({ str, transform: [1, 0, 0, 1, 0, y] });

const file = (name: string, body: string | Uint8Array, type = '') =>
  new File([body as BlobPart], name, { type });

/** A real .docx: a zip whose word/document.xml holds the paragraphs. */
const docx = (xml: string, path = 'word/document.xml') =>
  file('Syllabus.docx', zipSync({ [path]: strToU8(xml) }));

const para = (...runs: string[]) =>
  `<w:p><w:r>${runs.map((r) => `<w:t>${r}</w:t>`).join('')}</w:r></w:p>`;

beforeEach(() => {
  pages = [];
  pdfFails = false;
});

describe('plain text', () => {
  it('reads a .txt file through unchanged', async () => {
    const out = await extractText(file('notes.txt', 'Problem Set 1 is due Friday.'));
    expect(out.text).toBe('Problem Set 1 is due Friday.');
    expect(out.name).toBe('notes.txt');
  });

  it('counts the words, for the button that says how much was read', async () => {
    expect((await extractText(file('a.txt', 'one two three four five'))).words).toBe(5);
  });

  it('reads markdown, csv and a file the browser only knows by type', async () => {
    expect((await extractText(file('a.md', '# Heading'))).text).toBe('# Heading');
    expect((await extractText(file('a.csv', 'week,reading'))).text).toBe('week,reading');
    expect((await extractText(file('whatever', 'text', 'text/plain'))).text).toBe('text');
  });

  it('normalises Windows line endings', async () => {
    // A syllabus written on Windows must not come out with the schedule table
    // carrying a stray carriage return into every date.
    const out = await extractText(file('a.txt', 'Week 1\r\nWeek 2\r\n'));
    expect(out.text).toBe('Week 1\nWeek 2');
  });

  it('trims the trailing spaces a table leaves at the end of a line', async () => {
    expect((await extractText(file('a.txt', 'Sep 4   \nSep 11'))).text).toBe('Sep 4\nSep 11');
  });

  it('attaches no original for anything that is not a PDF', async () => {
    expect((await extractText(file('a.txt', 'x'))).pdf).toBeUndefined();
  });
});

describe('a file this cannot read', () => {
  it('names the file and says what it can take', async () => {
    await expect(extractText(file('lecture.mp4', 'x', 'video/mp4'))).rejects.toThrow(
      /lecture\.mp4 is not a kind of file this can read/i,
    );
  });

  it('says a scan needs OCR rather than failing silently', async () => {
    /*
     * The most common real failure: a syllabus photocopied and scanned is a
     * picture of text, and pdf.js finds nothing in it. Somebody staring at an
     * empty preview needs to be told that, because nothing about the file
     * looks wrong from the outside.
     */
    pages = [[at(700, '')]];
    await expect(extractText(file('scan.pdf', 'x', 'application/pdf'))).rejects.toThrow(/OCR/i);
  });

  it('says the same for a text file with nothing but whitespace in it', async () => {
    await expect(extractText(file('empty.txt', '   \n\n  '))).rejects.toThrow(/Nothing readable/i);
  });
});

/**
 * A file that is the right kind and the wrong contents.
 *
 * These used to hand the student the library's own words — "invalid zip data"
 * from the unzipper, "Invalid PDF structure." from pdf.js — which name the
 * problem and say nothing about what to do. This file already had careful
 * wording for the two failures it knew about; these two bypassed it.
 */
describe('a file that will not open', () => {
  it('tells somebody who renamed a .doc what to do instead', async () => {
    // The commonest cause by far: a .doc is not a zip at all, so there is
    // nothing inside it to open, and renaming it did not change that.
    const broken = file('Syllabus.docx', 'this is an old .doc, not a zip');
    await expect(extractText(broken)).rejects.toThrow(/save it again as \.docx/i);
    await expect(extractText(broken)).rejects.toThrow(/Syllabus\.docx/);
    await expect(extractText(broken)).rejects.not.toThrow(/invalid zip data/i);
  });

  it('suggests downloading a half-fetched PDF again', async () => {
    pdfFails = true;
    const broken = file('Syllabus.pdf', '%PDF-1.4 truncated', 'application/pdf');
    await expect(extractText(broken)).rejects.toThrow(/could not be opened as a PDF/i);
    await expect(extractText(broken)).rejects.toThrow(/fetch it again|paste the text/i);
  });

  it('still says plainly when a .docx opens but holds no document', async () => {
    // The zip was fine; it simply is not a Word file. That wording already
    // existed and must not be swallowed by the new one around it.
    await expect(extractText(docx('<x/>', 'word/other.xml'))).rejects.toThrow(/no document inside/i);
  });
});

describe('PDFs', () => {
  const pdf = (size?: number) => {
    const f = file('Syllabus.pdf', 'x', 'application/pdf');
    if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  it('puts back the line breaks pdf.js throws away', async () => {
    /*
     * pdf.js returns positioned fragments, not lines — a schedule table comes
     * out as a stream of cells with no rows. Without this the dates and the
     * readings they belong to are one run-on sentence, which is the difference
     * between a course that imports and one that does not.
     */
    pages = [[at(700, 'Week 1'), at(700, ' Reading A'), at(680, 'Week 2'), at(680, ' Reading B')]];
    expect((await extractText(pdf())).text).toBe('Week 1 Reading A\nWeek 2 Reading B');
  });

  it('does not break a line over a fragment that only wobbles', async () => {
    // Subscripts and kerning move the baseline a little. Breaking on those
    // would put every formula on four lines.
    pages = [[at(700, 'P'), at(699, '1'), at(700, ' = MC')]];
    expect((await extractText(pdf())).text).toBe('P1 = MC');
  });

  it('keeps the pages apart', async () => {
    pages = [[at(700, 'Page one')], [at(700, 'Page two')]];
    expect((await extractText(pdf())).text).toBe('Page one\n\nPage two');
  });

  it('reads a fragment carrying no position at all', async () => {
    pages = [[{ str: 'No transform on this one' }]];
    expect((await extractText(pdf())).text).toBe('No transform on this one');
  });

  it('sends the file itself as well, so the model can read the page', async () => {
    // A table with weeks down the left and dates across only says which date
    // belongs to which reading through its column alignment, and flattening
    // to text loses exactly that.
    pages = [[at(700, 'Week 1')]];
    const out = await extractText(pdf(1024));
    expect(out.pdf).toBeTruthy();
    expect(out.pdf).not.toMatch(/^data:/);
    expect(out.pdf).not.toMatch(/\s/);
  });

  it('sends only the text for a PDF too large to go whole', async () => {
    // Over the ceiling it is a scan rather than a syllabus, and the extracted
    // text is the better input anyway.
    pages = [[at(700, 'Week 1')]];
    const out = await extractText(pdf(20 * 1024 * 1024));
    expect(out.text).toBe('Week 1');
    expect(out.pdf).toBeUndefined();
  });
});

describe('Word files', () => {
  it('reads the paragraphs out of a real .docx', async () => {
    const out = await extractText(docx(`<w:document><w:body>${para('Week 1')}${para('Week 2')}</w:body></w:document>`));
    expect(out.text).toBe('Week 1\nWeek 2');
  });

  it('joins the runs Word splits a sentence into', async () => {
    // Word breaks a paragraph at every formatting change, so one sentence can
    // arrive as five runs. They are one sentence again here.
    const out = await extractText(docx(`<w:document>${para('Problem Set 1', ' is due ', 'Friday')}</w:document>`));
    expect(out.text).toBe('Problem Set 1 is due Friday');
  });

  it('keeps the tabs that hold a schedule table together', async () => {
    const out = await extractText(
      docx(`<w:document><w:p><w:r><w:t>Sep 4</w:t><w:tab/><w:t>Chapter 1</w:t></w:r></w:p></w:document>`),
    );
    expect(out.text).toBe('Sep 4\tChapter 1');
  });

  it('says so when the zip has no document in it', async () => {
    await expect(extractText(docx('<x/>', 'word/other.xml'))).rejects.toThrow(/no document inside/i);
  });

  it('collapses the runs of blank paragraphs Word leaves behind', async () => {
    const xml = `<w:document>${para('One')}<w:p/><w:p/><w:p/>${para('Two')}</w:document>`;
    expect((await extractText(docx(xml))).text).not.toMatch(/\n{3,}/);
  });
});

describe('entities, which a course title is full of', () => {
  it('decodes an ampersand in a Word file', async () => {
    // "Supply &amp; Demand" is how Word stores the title of half the units in
    // an economics syllabus.
    const out = await extractText(docx(`<w:document>${para('Supply &amp; Demand')}</w:document>`));
    expect(out.text).toBe('Supply & Demand');
  });

  it('decodes an ampersand in an HTML page too', async () => {
    const out = await extractText(file('page.html', '<p>Supply &amp; Demand</p>'));
    expect(out.text).toBe('Supply & Demand');
  });

  it('does not decode an entity twice', async () => {
    /*
     * A document that writes the literal characters "&lt;" encodes them as
     * "&amp;lt;". Decoding the ampersand first turns that into "&lt;" and the
     * next pass turns it into "<" — a tag where the professor wrote the name
     * of one. The ampersand has to go last.
     */
    const out = await extractText(docx(`<w:document>${para('Write &amp;lt;name&amp;gt; here')}</w:document>`));
    expect(out.text).toBe('Write &lt;name&gt; here');
  });
});

describe('HTML pages', () => {
  it('keeps the structure a syllabus page carries', async () => {
    const out = await extractText(
      file('page.html', '<h1>ECON 1020</h1><p>Week 1</p><p>Week 2</p>'),
    );
    expect(out.text).toBe('ECON 1020\nWeek 1\nWeek 2');
  });

  it('turns table cells into separated text rather than running them together', async () => {
    const out = await extractText(file('p.html', '<tr><td>Sep 4</td><td>Chapter 1</td></tr>'));
    expect(out.text).toBe('Sep 4 Chapter 1');
  });

  it('throws away the script and the styling', async () => {
    // A page saved from a course site brings a great deal that is not text.
    const out = await extractText(
      file('p.html', '<style>p{color:red}</style><p>Week 1</p><script>var x=1;</script>'),
    );
    expect(out.text).toBe('Week 1');
  });

  it('reads a non-breaking space as a space', async () => {
    expect((await extractText(file('p.html', '<p>Sep&nbsp;4</p>'))).text).toBe('Sep 4');
  });
});

/**
 * Slide decks.
 *
 * The file the spec's own example is about, and the one the app refused
 * outright until now — "export them as a PDF" is true and is also a step
 * nobody takes, so the commonest thing a professor posts was the one thing
 * that could not be read.
 *
 * Built here as a real zip, like the .docx fixtures above, because what is
 * worth testing is that it can open a PowerPoint file at all.
 */
describe('slide decks', () => {
  /** `<a:t>` runs inside `<a:p>` paragraphs — how PowerPoint stores a slide. */
  const slide = (...paras: string[]) =>
    `<p:sld><p:cSld><p:spTree>${paras
      .map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
      .join('')}</p:spTree></p:cSld></p:sld>`;

  const deck = (slides: Record<number, string>, extra: Record<string, string> = {}) =>
    file(
      'Session 7.pptx',
      zipSync({
        '[Content_Types].xml': strToU8('<Types/>'),
        ...Object.fromEntries(
          Object.entries(slides).map(([n, xml]) => [`ppt/slides/slide${n}.xml`, strToU8(xml)]),
        ),
        ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
      }),
    );

  it('reads the text off each slide', async () => {
    const out = await extractText(deck({ 1: slide('Conjoint analysis', 'What buyers trade off') }));
    expect(out.text).toContain('Conjoint analysis');
    expect(out.text).toContain('What buyers trade off');
  });

  it('keeps the slide numbers, which are the only page reference a deck has', async () => {
    const out = await extractText(deck({ 1: slide('Title'), 2: slide('Segmentation') }));
    expect(out.pages).toEqual([
      { page: 1, text: 'Title' },
      { page: 2, text: 'Segmentation' },
    ]);
  });

  it('numbers the slides in the flat text as well', async () => {
    // Whatever reads this is being asked where something came from, so the
    // number has to be in front of the text and not only in the metadata.
    const out = await extractText(deck({ 1: slide('First'), 2: slide('Second') }));
    expect(out.text).toBe('Slide 1\nFirst\n\nSlide 2\nSecond');
  });

  it('does not put slide 10 before slide 2', async () => {
    /*
     * Object keys sort as strings, so "slide10.xml" lands between "slide1" and
     * "slide2" — which silently renumbers every deck over nine slides and puts
     * the provenance on the wrong slide for the rest of the file.
     */
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, slide(`Slide ${i + 1} body`)]),
    );
    const out = await extractText(deck(many));
    expect(out.pages?.map((p) => p.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps a title and its bullets as separate lines', async () => {
    // One run-on sentence is the difference between a readable slide and a
    // wall, and it is what a naive tag-strip produces.
    const out = await extractText(deck({ 1: slide('Pricing', 'Cost-plus', 'Value-based') }));
    expect(out.pages?.[0].text).toBe('Pricing\nCost-plus\nValue-based');
  });

  it('joins the runs PowerPoint splits a line into', async () => {
    const split =
      '<p:sld><a:p><a:r><a:t>Problem </a:t></a:r><a:r><a:t>Set 3</a:t></a:r></a:p></p:sld>';
    expect((await extractText(deck({ 1: split }))).pages?.[0].text).toBe('Problem Set 3');
  });

  it('decodes an ampersand, as everywhere else', async () => {
    expect((await extractText(deck({ 1: slide('Supply &amp; Demand') }))).pages?.[0].text).toBe(
      'Supply & Demand',
    );
  });

  it('says so when the zip holds no slides', async () => {
    await expect(extractText(deck({}, { 'ppt/notes/notes1.xml': '<x/>' }))).rejects.toThrow(
      /no slides inside/i,
    );
  });

  it('tells somebody who renamed a .ppt what to do instead', async () => {
    const broken = file('Session 7.pptx', 'this is an old .ppt, not a zip');
    await expect(extractText(broken)).rejects.toThrow(/save it again as \.pptx|export the deck/i);
    await expect(extractText(broken)).rejects.not.toThrow(/invalid zip data/i);
  });

  it('attaches no page list to a file that has no pages to speak of', async () => {
    // A Word file and a pasted block know nothing about pages, and a made-up
    // reference is worse than none.
    expect((await extractText(file('a.txt', 'x'))).pages).toBeUndefined();
    expect((await extractText(docx('<w:document><w:p><w:r><w:t>x</w:t></w:r></w:p></w:document>'))).pages)
      .toBeUndefined();
  });
});
