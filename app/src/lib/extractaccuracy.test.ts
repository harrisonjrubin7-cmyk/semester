import { describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { check, flatten } from './cite';

/**
 * The extraction-accuracy gate, measured against a corpus that carries its own
 * answers.
 *
 * The September strategy playbook asks for *"a formal extraction-accuracy audit
 * target (≥98% accuracy, 100% citation mapping)"*, and
 * [docs/IMPLEMENTATION_STATUS.md](../../../docs/IMPLEMENTATION_STATUS.md)
 * files "Measured extraction accuracy" as what remains before a syllabus
 * upload is fit for official operation. Neither the number nor a method
 * existed. This file is the method, so the figure can be taken again rather
 * than asserted. [PLAYBOOK-REVIEW.md](../../../PLAYBOOK-REVIEW.md) carries the
 * verdict this was built from.
 *
 * The first draft of this header cited `COMPETITIVE-REVIEW.md` for that target.
 * It does not contain it, and nothing in the repository did — the target came
 * from a document outside it. Caught by grepping for the phrase rather than
 * trusting a filename, which is the same mistake, and the same catch, as the
 * `lib/gpatemplate.ts` citation recorded in the review.
 *
 * ## What can honestly be measured here, and what cannot
 *
 * A syllabus becomes deadlines in two steps, and only one of them is this
 * repository's to measure.
 *
 * The second step is a model reading text. It needs an API key, it is not
 * deterministic, and a CI gate that pretends otherwise would be measuring the
 * weather. Nothing here touches it.
 *
 * The first step is `lib/extract.ts`: a file becomes plain text, in the
 * browser, and **that text is all the model ever sees**. A date lost here is
 * not a date the model reads badly, it is a date that is not there — and the
 * app's whole claim, that every deadline is traceable to the sentence it came
 * from, fails at the bottom rather than in the middle. That step is pure, it
 * is deterministic, and it is what this measures.
 *
 * So the figure below is an extraction-fidelity figure and says so. It is the
 * floor under the accuracy target, not the target itself.
 *
 * ## Why `includes` is not the probe
 *
 * The obvious implementation — did the extracted text contain the date? — is
 * the probe this repository has been caught by twice, most recently the
 * teardown probe in [CLAUDE.md](../../../CLAUDE.md) that read every file as
 * leaking. It is wrong here for a specific and demonstrable reason.
 *
`fromPdf` joins fragments on the same line with `text += str` and no separator,
 * consulting no horizontal position. Read from the source alone that is a
 * defect: a schedule row of three cells should come out
 *
 *     Week 3Oct 14Ch. 4
 *
 * and `includes('Oct 14')` is **true** of that string, so the loose probe could
 * not see it. `intact` asks the stricter question — the fact appears, *and*
 * neither edge is glued to an adjacent alphanumeric — and it does catch that
 * string, which is why the probe is written this way.
 *
 * **The first version of this file then reported the defect, and the defect is
 * not real.** It was measured against the pdf.js stub below, and the stub is not
 * pdf.js. Driven against the real library — `pdfjs-dist` 6.3.289, three
 * hand-built PDFs, a single text block with `Td` moves, separate `BT`/`ET`
 * blocks with `Tm`, and a kerned word — pdf.js puts the space in *itself*,
 * either inside one item's string or as a separate `{ str: ' ' }` item, from
 * about 0.15em of gap upward:
 *
 *     gap 0.00em  items=1  "aabb"     gap 0.30em  items=1  "aa bb"
 *     gap 0.10em  items=1  "aabb"     gap 1.00em  items=3  "aa bb"
 *     gap 0.15em  items=1  "aa bb"    gap 4.00em  items=3  "aa bb"
 *
 * Below the threshold it is one word and there is nothing to insert. So there is
 * no gap width at which a rule here would add anything, a fix written for it was
 * reverted as unreachable, and the schedule table survives extraction today.
 *
 * That is the probe lying, not the extractor, and it is the failure
 * [CLAUDE.md](../../../CLAUDE.md) documents twice over — the teardown probe that
 * read every file as leaking, including the two already fixed. The controls
 * below are what a corpus needs; **a stub faithful to the library it stands in
 * for** turns out to be the other half, and the `PDF table` document now uses
 * the fragment stream pdf.js was observed to produce rather than the one that
 * was convenient to write.
 *
 * ## The controls, which are the reason to believe the figure
 *
 * A corpus that scores 100% is also what a probe stuck on `true` looks like.
 * Four controls, each of which would catch a different way of lying:
 *
 *  - **Absent facts** score 0. A probe that says yes to everything fails here.
 *  - **A degraded text** (digits stripped) scores far under the gate. A probe
 *    that cannot fail is not a measurement.
 *  - **The loose probe disagrees** with the strict one on the welded row. A
 *    strict probe identical to `includes` has bought nothing.
 *  - **Plain text scores 100%.** A probe that fails everything also fails the
 *    gate, and would look from the summary line exactly like a real defect.
 *
 * ## The figure, as measured
 *
 * Sixty-two labelled facts over five formats and two PDF layouts, all kept:
 *
 *     plain text  11/11
 *     HTML        11/11
 *     Word        11/11
 *     slides      11/11
 *     PDF         11/11
 *     PDF table    7/7
 *     ─────────────────
 *     fidelity    62/62   100%
 *
 * Reverting the line-break restoration in `fromPdf` takes `PDF` to 7/11 and
 * `PDF table` to 5/7, and the whole figure to 90.3% — measured, not predicted;
 * the first version of this sentence guessed 8/11, 2/7 and 82.3% and was wrong
 * on all three. That is the part of `fromPdf` really holding a schedule
 * together, and it is what this gate defends.
 *
 * Citation mapping: 15 of 15 labelled quotes confirmed against a span sliced
 * out of the extracted text, and 5 of 5 forgeries built from the same
 * vocabulary refused. 100% and zero, which is what the target asks for and is
 * only worth reading beside the controls below.
 *
 * Written down here because this project's console is silenced under Vitest, so
 * the number is not printed on a green run. It is read off this header, and
 * defended by the gate below — which prints the whole per-format table, with
 * the facts it lost, whenever it goes red. Do not edit the figure to match a
 * run; if it moved, something moved.
 */

/* ── The PDF stub, as `extract.test.ts` has it ───────────────────────────── */

type Frag = { str?: string; width?: number; height?: number; transform?: number[] };
let pdfPages: Frag[][] = [];

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      get numPages() {
        return pdfPages.length;
      },
      getPage: (n: number) =>
        Promise.resolve({
          getTextContent: () => Promise.resolve({ items: pdfPages[n - 1] }),
        }),
    }),
  }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.mjs' }));

const { extractText } = await import('./extract');

const file = (name: string, body: string | Uint8Array, type = '') =>
  new File([body as BlobPart], name, { type });

/** A fragment at a vertical position. Distinct `y` is a new line. */
const at = (y: number, str: string): Frag => ({ str, transform: [1, 0, 0, 1, 0, y] });

/** A text run at a position, carrying the width and height pdf.js gives one. */
const cell = (y: number, x: number, str: string, w: number, size = 10): Frag => ({
  str,
  width: w,
  height: size,
  transform: [size, 0, 0, size, x, y],
});

/**
 * A table row as pdf.js actually hands one back.
 *
 * Observed, not assumed: driven against `pdfjs-dist` 6.3.289 over a hand-built
 * PDF whose three cells sit at x=50, 150 and 260 with no space characters in
 * the content stream, the library returns
 *
 *     { str: 'Week 3', width: 33.9, height: 10 }
 *     { str: ' ',      width: 66.1, height: 0  }
 *     { str: 'Oct 14', width: 29.5, height: 10 }
 *     { str: ' ',      width: 80.5, height: 0  }
 *     { str: 'Ch. 4',  width: 23.9, height: 10 }
 *
 * — the gap arriving as its own zero-height space item. The first version of
 * this file left those items out, which is how it manufactured a welding defect
 * that `fromPdf` does not have. A stub that omits what the library supplies is
 * not a cheaper version of the library, it is a different one.
 */
const row = (y: number, cells: { x: number; str: string; w: number }[], size = 10): Frag[] => {
  const out: Frag[] = [];
  cells.forEach((c, i) => {
    if (i > 0) {
      const prev = cells[i - 1];
      // pdf.js's own space item: zero height, width spanning the gap.
      out.push({ str: ' ', width: c.x - (prev.x + prev.w), height: 0, transform: [size, 0, 0, size, prev.x + prev.w, y] });
    }
    out.push(cell(y, c.x, c.str, c.w, size));
  });
  return out;
};

const para = (...runs: string[]) =>
  `<w:p><w:r>${runs.map((r) => `<w:t>${r}</w:t>`).join('')}</w:r></w:p>`;

const slideXml = (...paras: string[]) =>
  `<p:sld><p:cSld><p:spTree>${paras
    .map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
    .join('')}</p:spTree></p:cSld></p:sld>`;

/* ── The two probes ─────────────────────────────────────────────────────── */

/** Every index at which `fact` occurs in `text`. */
function occurrences(text: string, fact: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(fact); i !== -1; i = text.indexOf(fact, i + 1)) out.push(i);
  return out;
}

/** The loose probe, kept only to be disagreed with. */
function present(text: string, fact: string): boolean {
  return text.includes(fact);
}

/**
 * The strict probe: present, and not welded to a neighbour.
 *
 * Punctuation and whitespace on either side are fine — "Oct 14." and
 * "(Oct 14)" are the date, intact. An alphanumeric is not: "Oct 14Ch" is the
 * date fused to the next cell of a table, which is the loss this catches.
 */
function intact(text: string, fact: string): boolean {
  const glued = (c: string | undefined) => c !== undefined && /[A-Za-z0-9]/.test(c);
  return occurrences(text, fact).some(
    (i) => !glued(text[i - 1]) && !glued(text[i + fact.length]),
  );
}

/* ── The corpus, which carries its own answers ──────────────────────────── */

/**
 * One labelled fact that must survive extraction.
 *
 * `kind` exists so the report can say *what* was lost rather than only how
 * much — a corpus that loses three dates and a corpus that loses three unit
 * titles are different faults with the same percentage.
 */
interface Fact {
  kind: 'date' | 'reading' | 'unit' | 'room' | 'sentence';
  text: string;
}

interface Document {
  name: string;
  format: string;
  /** Builds the file, and seeds the PDF stub where the format needs it. */
  make: () => File;
  facts: Fact[];
  /** Sentences a citation should be able to confirm, verbatim in the source. */
  quotes: string[];
}

/*
 * The same small ECON syllabus in every format the app claims to read, so the
 * figure is per-format rather than an average over whatever was easiest to
 * build. `Supply & Demand` is in all of them on purpose: it is stored as
 * `&amp;` in the Word, HTML and PowerPoint paths, and `extract.ts`'s own
 * header records those three having drifted apart over exactly that.
 */

const DATES: Fact[] = [
  { kind: 'date', text: 'Oct 14' },
  { kind: 'date', text: 'Nov 3' },
  { kind: 'date', text: 'Dec 12' },
];
const READINGS: Fact[] = [
  { kind: 'reading', text: 'Ch. 4' },
  { kind: 'reading', text: 'Ch. 7' },
];
const UNITS: Fact[] = [
  { kind: 'unit', text: 'Supply & Demand' },
  { kind: 'unit', text: 'Elasticity' },
];
const ROOM: Fact[] = [{ kind: 'room', text: 'Buttrick 101' }];

const PS2 = 'Problem set 2 is due Oct 14 at 11:59pm.';
const FINAL = 'The final exam is Dec 12 in Buttrick 101.';
const MIDTERM = 'The midterm covers Supply & Demand through Elasticity.';

const SENTENCES: Fact[] = [
  { kind: 'sentence', text: PS2 },
  { kind: 'sentence', text: FINAL },
  // Carries an ampersand that three of the five formats store as `&amp;`, so
  // it is the one labelled quote whose confirmation depends on decoding.
  { kind: 'sentence', text: MIDTERM },
];

const ALL_FACTS = [...DATES, ...READINGS, ...UNITS, ...ROOM, ...SENTENCES];

/** The syllabus as lines, which every text-shaped format reuses. */
const LINES = [
  'ECON 1020 — Principles of Microeconomics',
  '',
  'Unit 1: Supply & Demand — read Ch. 4',
  'Unit 2: Elasticity — read Ch. 7',
  '',
  PS2,
  'Reading response 3 is due Nov 3.',
  MIDTERM,
  FINAL,
];

const CORPUS: Document[] = [
  {
    name: 'Syllabus.txt',
    format: 'plain text',
    make: () => file('Syllabus.txt', LINES.join('\n'), 'text/plain'),
    facts: ALL_FACTS,
    quotes: [PS2, FINAL, MIDTERM],
  },
  {
    name: 'Syllabus.html',
    format: 'HTML',
    make: () =>
      file(
        'Syllabus.html',
        [
          '<h1>ECON 1020 — Principles of Microeconomics</h1>',
          '<p>Unit 1: Supply &amp; Demand — read Ch. 4</p>',
          '<p>Unit 2: Elasticity — read Ch. 7</p>',
          `<p>${PS2}</p>`,
          '<p>Reading response 3 is due Nov 3.</p>',
          '<p>The midterm covers Supply &amp; Demand through Elasticity.</p>',
          `<p>The final exam is Dec 12 in Buttrick 101.</p>`,
        ].join('\n'),
        'text/html',
      ),
    facts: ALL_FACTS,
    quotes: [PS2, FINAL, MIDTERM],
  },
  {
    name: 'Syllabus.docx',
    format: 'Word',
    make: () =>
      file(
        'Syllabus.docx',
        zipSync({
          'word/document.xml': strToU8(
            [
              para('ECON 1020 — Principles of Microeconomics'),
              para('Unit 1: Supply &amp; Demand — read Ch. 4'),
              para('Unit 2: Elasticity — read Ch. 7'),
              // Split mid-sentence across runs, which is what Word actually
              // does to a line somebody edited.
              para('Problem set 2 is due ', 'Oct 14', ' at 11:59pm.'),
              para('Reading response 3 is due Nov 3.'),
              para('The midterm covers Supply &amp; Demand through Elasticity.'),
              para('The final exam is Dec 12 in Buttrick 101.'),
            ].join(''),
          ),
        }),
      ),
    facts: ALL_FACTS,
    quotes: [PS2, FINAL, MIDTERM],
  },
  {
    name: 'Session 7.pptx',
    format: 'slides',
    make: () =>
      file(
        'Session 7.pptx',
        zipSync({
          '[Content_Types].xml': strToU8('<Types/>'),
          'ppt/slides/slide1.xml': strToU8(
            slideXml('Unit 1: Supply &amp; Demand', 'read Ch. 4', PS2),
          ),
          'ppt/slides/slide2.xml': strToU8(
            slideXml(
              'Unit 2: Elasticity',
              'read Ch. 7',
              'Reading response 3 is due Nov 3.',
              'The midterm covers Supply &amp; Demand through Elasticity.',
            ),
          ),
          'ppt/slides/slide3.xml': strToU8(slideXml(FINAL)),
        }),
      ),
    facts: ALL_FACTS,
    quotes: [PS2, FINAL, MIDTERM],
  },
  {
    name: 'Syllabus.pdf',
    format: 'PDF',
    /*
     * A well-formed PDF: one line per `y`, which is what a prose syllabus
     * gives pdf.js. The schedule-table case is not here — it is its own
     * finding below, because it does not survive and saying so in a gate that
     * excludes it would be the flattering version of this measurement.
     */
    make: () => {
      pdfPages = [
        [
          at(760, 'ECON 1020 — Principles of Microeconomics'),
          at(730, 'Unit 1: Supply & Demand — read Ch. 4'),
          at(710, 'Unit 2: Elasticity — read Ch. 7'),
          at(680, PS2),
          at(660, 'Reading response 3 is due Nov 3.'),
          at(645, MIDTERM),
          at(620, FINAL),
        ],
      ];
      return file('Syllabus.pdf', 'ignored, the stub answers', 'application/pdf');
    },
    facts: ALL_FACTS,
    quotes: [PS2, FINAL, MIDTERM],
  },
];

/*
 * And the schedule table, as its own document.
 *
 * Every fact in it exists *only* in a table cell — nowhere in prose — so the
 * gate covers the layout that actually loses things rather than only the
 * paragraph that never did. `intact` searches every occurrence of a fact, so a
 * date written in a sentence above would have covered for a welded cell below
 * and this document would have proved nothing.
 *
 * The fragments are the stream pdf.js was observed to return for exactly this
 * shape — cells with their gaps arriving as space items. What this document
 * gates is therefore that a schedule table survives extraction, which it does;
 * it is not a gate on a repair, because there was none to make.
 */
const TABLE_FACTS: Fact[] = [...DATES, ...READINGS, ...UNITS];

const SCHEDULE: Document = {
  name: 'Schedule.pdf',
  format: 'PDF table',
  make: () => {
    const line = (y: number, week: string, unit: string, read: string, due: string) =>
      row(y, [
        { x: 50, str: week, w: 32 },
        { x: 130, str: unit, w: 78 },
        { x: 250, str: read, w: 28 },
        { x: 320, str: due, w: 34 },
      ]);
    pdfPages = [
      [
        ...line(760, 'Week', 'Unit', 'Reading', 'Due'),
        ...line(730, 'Week 1', 'Supply & Demand', 'Ch. 4', 'Oct 14'),
        ...line(700, 'Week 2', 'Elasticity', 'Ch. 7', 'Nov 3'),
        ...line(670, 'Finals', 'Review', '—', 'Dec 12'),
      ],
    ];
    return file('Schedule.pdf', 'ignored, the stub answers', 'application/pdf');
  },
  facts: TABLE_FACTS,
  quotes: [],
};

CORPUS.push(SCHEDULE);

/* ── The measurement ────────────────────────────────────────────────────── */

/** The gate the audit target asks for. */
const GATE = 0.98;

interface Score {
  doc: string;
  format: string;
  kept: number;
  total: number;
  lost: Fact[];
  text: string;
  /** Set when extraction threw, rather than letting the file fail to collect. */
  threw?: string;
}

/**
 * One document's score, and never a thrown exception.
 *
 * The catch is not defensive padding. `#567` lost an entire guard to this
 * exact shape: a revert made the setup throw, the file errored during
 * collection, and the one assertion written to catch that revert never got to
 * make it. A break in `extract.ts` has to arrive as a red assertion that names
 * the format, not as a file that did not run — so a throw is recorded as a
 * total loss and the gate reports it.
 */
async function score(doc: Document): Promise<Score> {
  try {
    const out = await extractText(doc.make());
    const lost = doc.facts.filter((f) => !intact(out.text, f.text));
    return {
      doc: doc.name,
      format: doc.format,
      kept: doc.facts.length - lost.length,
      total: doc.facts.length,
      lost,
      text: out.text,
    };
  } catch (e) {
    return {
      doc: doc.name,
      format: doc.format,
      kept: 0,
      total: doc.facts.length,
      lost: doc.facts,
      text: '',
      threw: e instanceof Error ? e.message : String(e),
    };
  }
}

const scores: Score[] = [];
for (const doc of CORPUS) scores.push(await score(doc));

const kept = scores.reduce((n, s) => n + s.kept, 0);
const total = scores.reduce((n, s) => n + s.total, 0);

describe('extraction fidelity, over a labelled corpus', () => {
  it(`keeps at least ${GATE * 100}% of the labelled facts`, () => {
    /*
     * The figure, per format, so a regression names the format it is in. A
     * bare percentage over five formats is a number to quote and not a place
     * to go — the same complaint `scripts/targets-sweep.mjs` makes about its
     * own grouped counts.
     */
    const report = scores
      .map(
        (s) =>
          `  ${s.format.padEnd(11)} ${s.kept}/${s.total}` +
          (s.threw ? `  THREW: ${s.threw}` : '') +
          (s.lost.length ? `  lost: ${s.lost.map((f) => `${f.kind} "${f.text}"`).join(', ')}` : ''),
      )
      .join('\n');
    expect(kept / total, `extraction fidelity ${kept}/${total}\n${report}`).toBeGreaterThanOrEqual(
      GATE,
    );
  });

  for (const s of scores) {
    it(`loses nothing from a well-formed ${s.format} syllabus`, () => {
      expect(s.threw, `${s.format} extraction threw`).toBeUndefined();
      expect(s.lost.map((f) => `${f.kind}:${f.text}`)).toEqual([]);
    });
  }

  it('decodes the ampersand in every format that stores one', () => {
    // The drift `extract.ts` records: Word decoded five entities and HTML one.
    for (const s of scores) {
      expect(intact(s.text, 'Supply & Demand'), `${s.format} lost the ampersand`).toBe(true);
      expect(s.text, `${s.format} left the entity undecoded`).not.toContain('&amp;');
    }
  });

  it('keeps the slide numbers, which are a deck’s only page reference', () => {
    const deck = scores.find((s) => s.format === 'slides')!;
    expect(deck.text).toContain('Slide 1');
    expect(deck.text).toContain('Slide 3');
  });
});

/* ── The finding this corpus turned up ──────────────────────────────────── */

describe('a schedule table, and the defect that was not there', () => {
  /*
   * This file was written expecting to find welding here, reported it, and was
   * wrong. The record is kept rather than quietly deleted, because the mistake
   * is more instructive than the measurement: every assertion below passed
   * against the unfaithful stub too, and the figure looked like a finding.
   *
   * What settled it was leaving the stub behind and driving `pdfjs-dist`
   * 6.3.289 over three hand-built PDFs. pdf.js supplies the inter-cell space
   * itself. A repair written for the welding was reverted as unreachable: there
   * is no gap width at which it could fire, because by the time a gap is wide
   * enough to want a space, the library has already put one there.
   */
  const pdf = async (frags: Frag[]) => {
    pdfPages = [frags];
    return (await extractText(file('Schedule.pdf', 'x', 'application/pdf'))).text;
  };

  it('survives, on the fragment stream pdf.js really returns', async () => {
    const text = await pdf(
      row(700, [
        { x: 50, str: 'Week 3', w: 33.9 },
        { x: 150, str: 'Oct 14', w: 29.5 },
        { x: 260, str: 'Ch. 4', w: 23.9 },
      ]),
    );
    expect(text).toBe('Week 3 Oct 14 Ch. 4');
    expect(intact(text, 'Oct 14')).toBe(true);
    expect(intact(text, 'Ch. 4')).toBe(true);
  });

  it('welds only when the stub leaves out what the library supplies', async () => {
    /*
     * The same three cells with the space items dropped — the shape the first
     * version of this file used, and the shape nothing observed produces. Kept
     * as the standing reminder of what the reported defect actually was, and as
     * the one string on which the two probes are known to disagree.
     */
    const text = await pdf([at(700, 'Week 3'), at(700, 'Oct 14'), at(700, 'Ch. 4')]);
    expect(text).toBe('Week 3Oct 14Ch. 4');
    expect(present(text, 'Oct 14'), 'the loose probe is satisfied').toBe(true);
    expect(intact(text, 'Oct 14'), 'the strict probe is not').toBe(false);
  });

  it('is still worth asking the strict question, for the losses that are real', async () => {
    /*
     * `intact` did not find a live defect, and it is not therefore decoration.
     * Line-break restoration is the thing in `fromPdf` that genuinely holds a
     * schedule together, and dropping it welds across rows rather than within
     * them — which `present` would again wave through. Simulated here by
     * putting two rows at one `y`, since that is what losing the break amounts
     * to.
     */
    const text = await pdf([at(700, 'Week 1 Ch. 4'), at(700, 'Week 2 Ch. 7')]);
    expect(text).toBe('Week 1 Ch. 4Week 2 Ch. 7');
    expect(present(text, 'Ch. 4')).toBe(true);
    expect(intact(text, 'Ch. 4'), 'welded to the row below it').toBe(false);
  });
});

/* ── The controls ───────────────────────────────────────────────────────── */

describe('the controls, without which the figure above is not evidence', () => {
  const prose = scores.find((s) => s.format === 'plain text')!;

  it('scores 0 for facts the document does not contain', () => {
    // A probe stuck on `true` passes everything above and fails here.
    for (const absent of ['Sep 2', 'Ch. 19', 'Opportunity Cost', 'Featheringill 300']) {
      expect(intact(prose.text, absent), `invented "${absent}"`).toBe(false);
    }
  });

  it('falls far under the gate on a text that has lost its numbers', () => {
    /*
     * A measurement that cannot come out low has not been shown to measure
     * anything. Digits stripped is the cheapest total loss to simulate, and it
     * should take every date and every reading with it.
     */
    const gutted = prose.text.replace(/\d/g, '');
    const survived = ALL_FACTS.filter((f) => intact(gutted, f.text));
    expect(survived.length / ALL_FACTS.length).toBeLessThan(0.5);
    for (const f of [...DATES, ...READINGS]) {
      expect(intact(gutted, f.text), `${f.text} survived a digit strip`).toBe(false);
    }
  });

  it('is a stricter question than the loose probe, on a string that differs', () => {
    // If these two ever agree everywhere, `intact` is `includes` with extra
    // steps and this whole file is measuring nothing.
    const welded = 'Week 3Oct 14Ch. 4';
    expect(present(welded, 'Oct 14')).toBe(true);
    expect(intact(welded, 'Oct 14')).toBe(false);
  });

  it('does not fail everything, which would read the same from the summary', () => {
    // The other direction of the same worry: a probe that refuses every fact
    // drives the gate red and looks like a defect in `extract.ts`.
    expect(prose.kept).toBe(prose.total);
    expect(prose.total).toBeGreaterThan(5);
  });

  it('accepts a fact at either edge of the text', () => {
    // `text[i - 1]` and `text[i + len]` are `undefined` at the edges, and an
    // off-by-one here would silently fail the first and last fact of every
    // document in the corpus.
    expect(intact('Oct 14 is the date', 'Oct 14')).toBe(true);
    expect(intact('the date is Oct 14', 'Oct 14')).toBe(true);
    expect(intact('Oct 14', 'Oct 14')).toBe(true);
  });

  it('accepts punctuation against a fact and refuses an alphanumeric', () => {
    expect(intact('due (Oct 14).', 'Oct 14')).toBe(true);
    expect(intact('due Oct 14, in room 4', 'Oct 14')).toBe(true);
    expect(intact('dueOct 14', 'Oct 14')).toBe(false);
    expect(intact('Oct 142', 'Oct 14')).toBe(false);
  });

  it('finds a later intact occurrence when an earlier one is welded', () => {
    // `some` over every occurrence rather than the first: a fact welded in a
    // table and written properly in the prose below it has survived.
    expect(intact('Week 3Oct 14Ch. 4 — and again, Oct 14 in prose.', 'Oct 14')).toBe(true);
  });
});

/* ── Citation mapping, which the target puts at 100% ────────────────────── */

describe('citation mapping, at 100% or it is not a claim', () => {
  /**
   * A citation as the API returns one: a verbatim span of the document.
   *
   * Taken as a real slice of what `extract.ts` produced rather than written
   * out by hand, so a quote is checked against the text the app would actually
   * have sent — which is the whole question.
   */
  const spanOf = (text: string, quote: string): string => {
    const flat = flatten(quote);
    const lines = text.split('\n').filter(Boolean);
    const line = lines.find((l) => flatten(l).includes(flat));
    // The paragraph the API would have cited, not the sentence alone.
    return line ?? '';
  };

  it('confirms every labelled quote, in every format', () => {
    const failures: string[] = [];
    for (const s of scores) {
      const doc = CORPUS.find((d) => d.name === s.doc)!;
      for (const quote of doc.quotes) {
        const span = spanOf(s.text, quote);
        const verdict = check(quote, [{ text: span, page: 1, title: s.doc } as never]);
        if (!verdict.confirmed) failures.push(`${s.format}: "${quote}" against "${span}"`);
      }
    }
    expect(failures, `citation mapping below 100%\n  ${failures.join('\n  ')}`).toEqual([]);
  });

  it('carries back the page and the document, so somebody can go and look', () => {
    const prose = scores.find((s) => s.format === 'plain text')!;
    const verdict = check(PS2, [
      { text: spanOf(prose.text, PS2), page: 2, title: 'Syllabus.txt' } as never,
    ]);
    expect(verdict.confirmed).toBe(true);
    expect(verdict.page).toBe(2);
    expect(verdict.doc).toBe('Syllabus.txt');
  });

  it('refuses a quote the corpus does not support — zero false positives', () => {
    /*
     * The direction that carries the weight, and the same argument
     * `quotes.adversarial.test.ts` makes at length: a missed quotation costs a
     * minute of looking, a wrongly confirmed one tells a student their
     * citation is sound when it is not.
     *
     * Every one of these is built out of the corpus so that it shares its
     * vocabulary, which is what a paraphrase looks like from the inside.
     */
    const prose = scores.find((s) => s.format === 'plain text')!;
    const span = spanOf(prose.text, PS2);
    const forgeries = [
      'Problem set 2 is due Oct 15 at 11:59pm.', // a date changed
      'Problem set 3 is due Oct 14 at 11:59pm.', // a number changed
      'Problem set 2 is due Oct 14 at 11:00pm.', // a time changed
      'Problem set 2 must be handed in by Oct 14.', // a paraphrase
      'Problem set 2 is due Oct 14.', // a clause dropped
    ];
    for (const forged of forgeries) {
      expect(check(forged, [{ text: span } as never]).confirmed, `confirmed "${forged}"`).toBe(
        false,
      );
    }
  });

  it('confirms the real sentence against the same span the forgeries failed', () => {
    // The control on the test above: if the span were wrong, or `check` were
    // simply refusing everything, all five forgeries would fail for a reason
    // that has nothing to do with them being forged.
    const prose = scores.find((s) => s.format === 'plain text')!;
    expect(check(PS2, [{ text: spanOf(prose.text, PS2) } as never]).confirmed).toBe(true);
  });

  it('confirms a quote carrying an ampersand the format stored as an entity', () => {
    /*
     * Where the two halves of this file meet, in the other direction. `cite.ts`
     * forgives whitespace, curly quotes, dashes and case — and not an
     * ampersand, because `flatten` has no business knowing about XML. So a
     * format that shipped `&amp;` through undecoded produces a quote that
     * cannot be confirmed against its own document, and the failure surfaces as
     * a citation problem whose entire cause is in the extractor.
     *
     * Asserted on the three formats that store the entity, because on plain
     * text and PDF the character is literal and the case is vacuous.
     */
    for (const format of ['HTML', 'Word', 'slides']) {
      const s = scores.find((d) => d.format === format)!;
      expect(s.text, `${format} left the entity in`).not.toContain('&amp;');
      const verdict = check(MIDTERM, [{ text: spanOf(s.text, MIDTERM) } as never]);
      expect(verdict.confirmed, `${format} could not confirm its own sentence`).toBe(true);
    }
  });

  it('confirms a quote whose source was split across Word runs', () => {
    /*
     * The case where the two halves of this file meet. Word had split that
     * sentence into three runs; if extraction had not rejoined them, the quote
     * would be unconfirmable against its own document — a citation failure
     * whose cause is entirely in the extractor.
     */
    const word = scores.find((s) => s.format === 'Word')!;
    expect(word.text).toContain(PS2);
    expect(check(PS2, [{ text: spanOf(word.text, PS2) } as never]).confirmed).toBe(true);
  });

  it('cannot confirm a quote out of the welded table row', () => {
    // And the other way: the row's own date is not quotable, because the text
    // the model would be citing does not contain the sentence anybody wrote.
    expect(check('Week 3 Oct 14 Ch. 4', [{ text: 'Week 3Oct 14Ch. 4' } as never]).confirmed).toBe(
      false,
    );
  });
});
