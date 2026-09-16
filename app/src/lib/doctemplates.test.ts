import { describe, expect, it } from 'vitest';
import { says } from './casework';
import { TEMPLATES, fromGuide, fromTemplate, templateById } from './doctemplates';
import BUS from '../data/courses/bus';
import CORE from '../data/courses/core';
import ECON from '../data/courses/econ';
import PSCI from '../data/courses/psci';
import { hasContent, unmarked, words } from './document';

describe('every template', () => {
  it('is a shape, never a sentence anybody could hand in', () => {
    /*
     * The rule this file exists under. A template that arrived with a
     * paragraph in it is a template that gets submitted with that paragraph
     * still in it — so every one of them is headings and blanks, and the words
     * they do carry are labels for fields.
     */
    for (const t of TEMPLATES) {
      const doc = fromTemplate(t, 'A title');
      for (const block of doc.blocks) {
        if (block.kind !== 'text') continue;
        const text = unmarked(block.text).trim();
        // A field label like "To · From · Date · Subject" is allowed; a
        // sentence is not. Nothing here reaches ten words or ends in a stop.
        expect(text.split(/\s+/).filter(Boolean).length).toBeLessThan(10);
        expect(text.endsWith('.')).toBe(false);
      }
    }
  });

  it('is short enough that nothing in it reads as written work', () => {
    for (const t of TEMPLATES) {
      expect(words({ ...fromTemplate(t, 'T'), id: 'x' })).toBeLessThan(60);
    }
  });

  it('has structure in it, so it beats a blank page', () => {
    for (const t of TEMPLATES) {
      const doc = fromTemplate(t, 'T');
      expect(hasContent({ ...doc, id: 'x' })).toBe(true);
      expect(doc.blocks.filter((b) => b.kind === 'heading').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('takes the title it is given, and falls back to its own name', () => {
    const t = templateById('lecture')!;
    expect(fromTemplate(t, 'Week 4').title).toBe('Week 4');
    expect(fromTemplate(t, '   ').title).toBe('Lecture notes');
  });

  it('files itself against a course when it is given one', () => {
    expect(fromTemplate(TEMPLATES[0], 'x', 'econ').courseId).toBe('econ');
    expect(fromTemplate(TEMPLATES[0], 'x').courseId).toBeNull();
  });

  it('has a unique id and a blurb', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.blurb.length).toBeGreaterThan(10);
  });
});

describe('the three citation styles', () => {
  const of = (id: string) => fromTemplate(templateById(id)!, 'Paper').blocks;
  const headings = (id: string) =>
    of(id).filter((b) => b.kind === 'heading').map((b) => (b as { text: string }).text);

  it('names each reference list the way its style names it', () => {
    // The one thing about a citation style that is a fact rather than content.
    expect(headings('essay-mla')).toContain('Works Cited');
    expect(headings('essay-apa')).toContain('References');
    expect(headings('essay-chicago')).toContain('Bibliography');
  });

  it('puts MLA’s four lines before the title, with no title page', () => {
    const blocks = of('essay-mla');
    expect(blocks[0]).toMatchObject({ kind: 'text', text: 'Your name' });
    expect(blocks[4]).toMatchObject({ kind: 'heading', level: 1 });
    expect(blocks.some((b) => b.kind === 'break')).toBe(true);
  });

  it('gives APA and Chicago a title page, ended by a break', () => {
    for (const id of ['essay-apa', 'essay-chicago']) {
      const blocks = of(id);
      expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
      const firstBreak = blocks.findIndex((b) => b.kind === 'break');
      expect(firstBreak).toBeGreaterThan(0);
      expect(firstBreak).toBeLessThan(8);
    }
  });

  it('leaves every field blank, because the app does not know who you are', () => {
    for (const id of ['essay-mla', 'essay-apa', 'essay-chicago']) {
      const texts = of(id).filter((b) => b.kind === 'text').map((b) => (b as { text: string }).text);
      expect(texts).not.toContain(expect.stringContaining('@'));
      // The placeholders name the field; none of them is a real name.
      expect(texts.some((t) => t === 'Your name')).toBe(true);
    }
  });
});

describe('the ones a policy or economics course sets', () => {
  it('puts the memo’s recommendation before its background', () => {
    // The way a brief is actually read: the answer, then why.
    const blocks = fromTemplate(templateById('memo')!, 'Memo').blocks;
    const at = (text: string) =>
      blocks.findIndex((b) => b.kind === 'heading' && (b as { text: string }).text === text);
    expect(at('Recommendation')).toBeLessThan(at('Background'));
    expect(at('Recommendation')).toBeLessThan(at('Analysis'));
  });

  it('puts the lab report’s method before its results', () => {
    const blocks = fromTemplate(templateById('lab')!, 'Lab').blocks;
    const at = (text: string) =>
      blocks.findIndex((b) => b.kind === 'heading' && (b as { text: string }).text === text);
    expect(at('Method')).toBeLessThan(at('Results'));
    expect(at('Results')).toBeLessThan(at('Analysis'));
  });

  it('gives the problem set somewhere to show the working', () => {
    const blocks = fromTemplate(templateById('problem')!, 'PS1').blocks;
    expect(blocks.filter((b) => b.kind === 'equation').length).toBeGreaterThanOrEqual(2);
  });

  it('gives the reading response a citation to fill in', () => {
    const blocks = fromTemplate(templateById('reading')!, 'R').blocks;
    const quote = blocks.find((b) => b.kind === 'quote');
    expect(quote).toMatchObject({ text: '', source: 'Author, title, page' });
  });
});

/**
 * A fixture with one of everything, so a section that stopped being written
 * fails here rather than in a student's copy.
 *
 * Built by hand rather than taken from a course, because the four sample
 * courses do not all carry all six parts — a test that reads ECON would pass
 * with the case files dropped.
 */
const fullGuide = () => ({
  code: 'PSCI 1100',
  name: 'Introduction to American Government',
  blurb: 'Who governs, and what difference the rules make.',
  source: 'Syllabus, 14 Jan',
  units: [
    { name: 'Federalism', mastery: 0, cards: [{ q: 'What is preemption?', a: 'Federal law displacing state law.' }] },
    { name: 'Nothing here yet', mastery: 0, cards: [] },
  ],
  terms: [{ t: 'Median voter', d: 'The voter at the middle of the distribution.' }],
  frames: [{ t: 'Institutions or interests', d: 'Whether the rules or the players explain the outcome.' }],
  examples: [{ tag: 'Preemption', t: 'California emissions', d: 'A waiver is the exception that shows the rule.' }],
  cases: [
    {
      title: 'Who governs New Haven',
      when: '1961',
      claim: 'A single elite runs the city.',
      test: 'Dahl traced three decisions through to who prevailed.',
      verdict: 'Different people won on different issues.',
      lesson: 'Power is issue-specific until somebody shows otherwise.',
    },
  ],
  selfTest: [{ q: 'Say what federalism buys and what it costs.', a: 'Local fit against unequal provision.' }],
});

describe('a study guide opened as a document', () => {
  const headings = (blocks: ReturnType<typeof fromGuide>['blocks'], level?: number) =>
    blocks.filter((b) => b.kind === 'heading' && (level === undefined || b.level === level)).map((b) => (b as { text: string }).text);

  it('carries all six parts of the guide, in the order the field guide reads them', () => {
    const { blocks } = fromGuide(fullGuide(), 'psci');
    expect(headings(blocks, 2)).toEqual([
      'Federalism',
      'Frames',
      'Worked examples',
      'Case files',
      'Self-test',
      'Terms',
      'My notes',
    ]);
  });

  /*
   * The three that were being dropped. They are the long-form end of the guide
   * — what `lib/study.ts` keeps growing as readings arrive — and a copy that
   * held only the question-and-answer parts was a copy of the flashcards.
   */
  it('carries the framings, the worked examples and the case files', () => {
    const text = JSON.stringify(fromGuide(fullGuide(), 'psci').blocks);
    expect(text).toContain('Whether the rules or the players explain the outcome.');
    expect(text).toContain('A waiver is the exception that shows the rule.');
    expect(text).toContain('Dahl traced three decisions through to who prevailed.');
  });

  it('writes a case as a heading and four labelled lines, not a six-column table', () => {
    const blocks = fromGuide(fullGuide(), 'psci').blocks;
    expect(headings(blocks, 3)).toEqual(['Who governs New Haven · 1961']);
    const lines = blocks.find((b) => b.kind === 'bullets');
    expect(lines).toMatchObject({
      kind: 'bullets',
      items: [
        '**Claim** — A single elite runs the city.',
        '**Test** — Dahl traced three decisions through to who prevailed.',
        '**Verdict** — Different people won on different issues.',
        '**So what** — Power is issue-specific until somebody shows otherwise.',
      ],
    });
    // Every table in the document stays narrow enough to print.
    for (const block of blocks) {
      if (block.kind === 'table') expect(block.rows[0].length).toBeLessThanOrEqual(3);
    }
  });

  /*
   * PSCI's framings are debates and ECON's are question types. The screen
   * reads that name off the module, so a document that printed "Frames" at
   * everybody would be a document that does not match what it was made from.
   */
  it('calls the framings what this course calls them', () => {
    const doc = fromGuide(fullGuide(), 'psci', { frameLabel: 'The seven debates' });
    expect(headings(doc.blocks, 2)).toContain('The seven debates');
    expect(headings(doc.blocks, 2)).not.toContain('Frames');
  });

  /* Named rather than dropped in silence — the rule `Read.notes` set. */
  it('says how many diagrams stayed behind, and says nothing when none did', () => {
    const note = (diagrams?: number) => {
      const found = fromGuide(fullGuide(), 'psci', { diagrams }).blocks.find((b) => b.kind === 'quote');
      return found && found.kind === 'quote' ? found.text : '';
    };
    expect(note(4)).toContain('The 4 diagrams are not here');
    expect(note(1)).toContain('The diagram is not here');
    expect(note(0)).not.toContain('not here');
    expect(note()).not.toContain('not here');
  });

  it('leaves out a part the guide has not got, rather than writing an empty heading', () => {
    const bare = {
      code: 'ECON 1010',
      name: 'Principles',
      source: 'Syllabus',
      units: [{ name: 'Supply', mastery: 0, cards: [{ q: 'q', a: 'a' }] }],
      terms: [],
    };
    expect(headings(fromGuide(bare).blocks, 2)).toEqual(['Supply', 'My notes']);
    // A unit with nothing in it does not become a heading over nothing either.
    expect(headings(fromGuide(fullGuide(), 'psci', {}).blocks, 2)).not.toContain('Nothing here yet');
  });

  it('says where it came from, and files itself against the course', () => {
    const doc = fromGuide(fullGuide(), 'psci');
    expect(doc.courseId).toBe('psci');
    expect(doc.title).toBe('PSCI 1100 — study guide');
    expect(doc.subtitle).toContain('Syllabus, 14 Jan');
    expect(doc.blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(doc.blocks[1]).toMatchObject({ kind: 'text', text: 'Who governs, and what difference the rules make.' });
    const quote = doc.blocks.find((b) => b.kind === 'quote');
    expect(quote).toMatchObject({ source: 'Syllabus, 14 Jan' });
  });

  /*
   * Against the real guides rather than the fixture. A card, a term, a
   * framing or a case that the app shows on the Guide screen and the document
   * does not carry is the bug this whole change was about, and only the
   * shipped data has enough of each to catch it.
   */
  it('loses nothing from any of the four courses the app ships', () => {
    for (const module of [ECON, PSCI, CORE, BUS]) {
      const guide = module.guide;
      const doc = fromGuide(guide, guide.code as never, { frameLabel: module.frameLabel });
      const text = JSON.stringify(doc.blocks);
      const where = `${guide.code}`;
      for (const unit of guide.units) {
        for (const card of unit.cards) expect(text, where).toContain(JSON.stringify(card.q).slice(1, -1));
      }
      for (const term of guide.terms) expect(text, where).toContain(JSON.stringify(term.t).slice(1, -1));
      for (const frame of guide.frames ?? []) expect(text, where).toContain(JSON.stringify(frame.t).slice(1, -1));
      for (const file of guide.cases ?? []) expect(text, where).toContain(JSON.stringify(file.verdict).slice(1, -1));
      for (const ex of module.examples ?? []) {
        expect(JSON.stringify(fromGuide({ ...guide, examples: module.examples }, null).blocks), where).toContain(
          JSON.stringify(says(ex)).slice(1, -1),
        );
      }
    }
  });

  /*
   * `words` counts prose and not tables, by a rule older than this function —
   * and this document is mostly tables, so a word count is the wrong measure
   * of whether anything came across. Rows are the right one.
   */
  it('is long enough to be the guide rather than a heading over nothing', () => {
    for (const module of [ECON, PSCI, CORE, BUS]) {
      const doc = { ...fromGuide(module.guide, null, { frameLabel: module.frameLabel }), id: 'x' };
      expect(hasContent(doc)).toBe(true);
      const rows = doc.blocks.reduce((n, b) => n + (b.kind === 'table' ? b.rows.length - 1 : 0), 0);
      expect(rows, module.guide.code).toBeGreaterThan(40);
    }
  });
});
