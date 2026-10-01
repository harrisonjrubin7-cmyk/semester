// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportItem, exportItems, importItem, importItems, type QtiItem } from './qti3';

const ITEMS: QtiItem[] = [
  { kind: 'multiple_choice', stem: 'Price rises, demand falls: that is', options: [{ id: 'a', text: 'supply' }, { id: 'b', text: 'the law of demand' }], key: { correct: 'b' }, points: 2 },
  { kind: 'multiple_response', stem: 'Which are factors of production?', options: [{ id: 'a', text: 'land' }, { id: 'b', text: 'a coupon' }, { id: 'c', text: 'labour' }], key: { correct: ['a', 'c'] }, points: 3 },
  { kind: 'true_false', stem: 'Scarcity exists in every economy.', options: [], key: { correct: true }, points: 1 },
  { kind: 'numeric', stem: 'Pi to two places', options: [], key: { value: 3.14, tolerance: 0 }, points: 1 },
  { kind: 'short_answer', stem: 'Name the market model', options: [], key: { accepted: ['supply and demand', 'S&D'] }, points: 1 },
  { kind: 'essay', stem: 'Discuss scarcity.', options: [], key: {}, points: 5 },
];

describe('QTI 3 export then import', () => {
  it('round-trips every kind the server holds, keys and points included', () => {
    const back = importItems(exportItems(ITEMS));
    expect(back.warnings).toEqual([]);
    expect(back.items).toEqual(ITEMS);
  });

  it('writes a document a QTI reader would recognise', () => {
    const { xml } = exportItem(ITEMS[0], 1);
    expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"');
    expect(xml).toContain('<qti-choice-interaction');
    expect(xml).toContain('<qti-correct-response><qti-value>b</qti-value>');
  });

  it('escapes what would break the XML, and reads it back as it was', () => {
    const odd: QtiItem = { kind: 'short_answer', stem: 'Is 3 < 5 & 5 > 3?', options: [], key: { accepted: ['yes & no'] }, points: 1 };
    const back = importItem(exportItem(odd, 1).xml);
    expect(back.items[0]).toEqual(odd);
  });
});

describe('what it will not guess at', () => {
  const wrap = (inner: string, decl = '') => `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="x" title="t">${decl}<qti-item-body><p>Question?</p>${inner}</qti-item-body></qti-assessment-item>`;

  it('omits a matching interaction and says which', () => {
    const r = importItem(wrap('<qti-match-interaction response-identifier="R"/>'), 'q1.xml');
    expect(r.items).toEqual([]);
    expect(r.warnings[0]).toMatch(/q1\.xml: omitted — <qti-match-interaction> is not supported/);
  });

  it('omits an item with two interactions, a choice with no correct response, and bad XML', () => {
    expect(importItem(wrap('<qti-text-entry-interaction response-identifier="A"/><qti-text-entry-interaction response-identifier="B"/>')).warnings[0]).toMatch(/2 interactions/);
    expect(importItem(wrap('<qti-choice-interaction response-identifier="R" max-choices="1"><qti-simple-choice identifier="a">x</qti-simple-choice><qti-simple-choice identifier="b">y</qti-simple-choice></qti-choice-interaction>', '<qti-response-declaration identifier="R" cardinality="single" base-type="identifier"/>')).warnings[0]).toMatch(/no correct response/);
    expect(importItem('<not-closed').warnings[0]).toMatch(/not readable as XML/);
    expect(importItem('<p>hello</p>').warnings[0]).toMatch(/not a QTI assessment item/);
  });

  it('keeps the good items when one in a batch is omitted, and says so', () => {
    const r = importItems([
      { name: 'good.xml', xml: exportItem(ITEMS[2], 1).xml },
      { name: 'bad.xml', xml: wrap('<qti-order-interaction response-identifier="R"/>') },
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});
