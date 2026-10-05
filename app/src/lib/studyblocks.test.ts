import { describe, expect, it } from 'vitest';
import { blankDoc, toMarkdown, type Block, type Doc } from './document';
import { parts } from './docx';
import { studyBlocks, type StudySection, type StudySource } from './studystudio';

/**
 * A study guide saved to Write, as the student will print it.
 *
 * Before this, the save went through Markdown and came out with the source's
 * internal id in the document, the place as a bullet and the quotation as a
 * loose paragraph under it. See `studyBlocks`.
 */

const SOURCES: StudySource[] = [
  { id: 'upload-f1-7', title: 'Chapter 1.pdf', locator: 'Page 7', text: 'The opportunity cost of a choice is the value of the next best alternative.' },
  { id: 'unit-0', title: 'Scarcity', locator: 'Prepared course guide · Unit 1; original page not recorded', text: 'Scarcity means choosing.' },
];
const SECTION: StudySection = {
  id: 's',
  format: 'summary',
  title: 'Costs',
  body: 'Opportunity cost is what you give up [upload-f1-7]. Every choice has one [unit-0]. See [sic] and [a,b].',
  citations: [{ sourceId: 'upload-f1-7', quote: 'the value of the next best alternative', at: { start: 35, end: 73 } }],
};
const blocks = studyBlocks([SECTION], SOURCES);
const doc = (b: Block[]): Doc => ({ ...blankDoc('ECON · Study guide'), id: 'd', blocks: b });

describe('a study guide saved to Write', () => {
  it('keeps each citation as a quotation with its source and place', () => {
    const quotes = blocks.filter((b) => b.kind === 'quote');
    expect(quotes).toEqual([{ kind: 'quote', text: 'the value of the next best alternative', source: '[1] Chapter 1.pdf · Page 7 · characters 36–73' }]);
  });

  it('puts no internal source id in the document', () => {
    expect(JSON.stringify(blocks)).not.toMatch(/upload-f1-7|unit-0/);
  });

  it('numbers the body’s markers to match, and drops one with no checked quotation behind it', () => {
    const text = blocks.filter((b) => b.kind === 'text').map((b) => (b.kind === 'text' ? b.text : '')).join(' ');
    expect(text).toContain('what you give up [1].');
    expect(text).toContain('Every choice has one.');
    // Brackets that were never source ids are the student's, and stay.
    expect(text).toContain('[sic] and [a,b]');
  });

  it('prints the source beside the quotation in Word and in Markdown', () => {
    const xml = parts(doc(blocks), () => undefined).text['word/document.xml'];
    expect(xml).toContain('the value of the next best alternative');
    expect(xml).toContain('— [1] Chapter 1.pdf · Page 7');
    expect(toMarkdown(doc(blocks))).toContain('> — [1] Chapter 1.pdf · Page 7');
  });

  it('says so, rather than inventing one, when a source is gone', () => {
    const lost = studyBlocks([{ ...SECTION, citations: [{ sourceId: 'gone', quote: 'the value of the next best alternative' }] }], SOURCES);
    expect(lost.find((b) => b.kind === 'quote')).toMatchObject({ source: '[1] Source no longer available' });
  });
});
