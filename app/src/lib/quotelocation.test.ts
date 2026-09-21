import { describe, expect, it } from 'vitest';
import {
  citationLocation,
  locateQuote,
  parseStudySections,
  quoteContext,
  studyMarkdown,
  type StudySource,
} from './studystudio';

/**
 * "Original page not recorded" — the line the competitive review names as the
 * open P1, and the one the whole positioning rests on.
 *
 * The studio has always *found* the place a quotation sits: a citation is
 * only accepted because `normalized(source.text).includes(normalized(quote))`
 * said so. What it did with the answer was keep the yes and drop the index,
 * so the app could tell a student the quotation was in their material and
 * not where in it — and the panel that showed the evidence printed the whole
 * source for them to search by eye.
 *
 * Three of the four source kinds have no page to fall back on. A prepared
 * guide unit, a pasted excerpt and an uploaded file with no page structure
 * all carry a locator ending "page not recorded", which is true of the
 * original and useless to the reader. An offset is a location those sources
 * do have, and this file is what says it is the right one.
 *
 * ## The controls
 *
 * Two, because a mapper that returns a span for everything it is shown is
 * indistinguishable from a broken one, and because the search that finds the
 * place is stricter than the search that decides a citation is real:
 *
 * - a quotation that is genuinely not in the source must come back `null`
 *   *and* still be refused by `parseStudySections`;
 * - a quotation that only the looser whole-string check can match — the
 *   composed-accent case below — must still be **accepted**, with no span.
 *   If this file ever shows that citation being rejected, the location work
 *   has become a new way to refuse a true citation, which is worse than the
 *   thing it set out to fix.
 */

const source = (over: Partial<StudySource> = {}): StudySource => ({
  id: 's1',
  title: 'Lecture',
  locator: 'Slide 2',
  text: 'Opportunity cost is the value of the next best alternative.',
  ...over,
});

const reply = (quote: string) =>
  JSON.stringify({
    sections: [
      {
        format: 'summary',
        title: 'Opportunity cost',
        body: 'Consider the next best alternative [s1].',
        citations: [{ sourceId: 's1', quote }],
      },
    ],
  });

const folded = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

describe('locateQuote', () => {
  it('returns a span that reads back as the quotation in the original text', () => {
    const s = source();
    const at = locateQuote(s.text, 'the value of the next best alternative');
    expect(at).not.toBeNull();
    expect(s.text.slice(at!.start, at!.end)).toBe('the value of the next best alternative');
  });

  it('spans a quotation that crosses a line break, where an index search fails', () => {
    // The ordinary case, not an exotic one: the model quotes a sentence the
    // source wrapped. `indexOf` on the raw text returns -1 here, so any
    // mapping that skips normalization would silently report no location for
    // most real quotations.
    const text = 'Opportunity cost is the value\nof the   next best alternative.';
    const quote = 'the value of the next best alternative';
    expect(text.indexOf(quote)).toBe(-1);
    const at = locateQuote(text, quote);
    expect(at).not.toBeNull();
    expect(text.slice(at!.start, at!.end)).toBe('the value\nof the   next best alternative');
    expect(folded(text.slice(at!.start, at!.end))).toBe(folded(quote));
  });

  it('spans a quotation whose source characters expand or change case under NFKC', () => {
    // ﬁ is one character in the source and two in the normalized form, so
    // a normalized offset used as an original offset lands mid-word and the
    // read-back is wrong rather than absent — the failure that does not
    // announce itself.
    const text = 'The ﬁrst principle of SCARCITY is unavoidable.';
    const at = locateQuote(text, 'first principle of scarcity');
    expect(at).not.toBeNull();
    expect(text.slice(at!.start, at!.end)).toBe('ﬁrst principle of SCARCITY');
  });

  it('control: a quotation that is not in the source has no location, and is still refused', () => {
    expect(locateQuote(source().text, 'An unsupported claim about elasticity')).toBeNull();
    expect(() => parseStudySections(reply('An unsupported claim about elasticity'), [source()], ['summary'])).toThrow(
      /could not be verified/,
    );
  });

  it('control: a quotation only the whole-string check can match keeps its citation and loses only the span', () => {
    // NFKC composes across characters: the source writes "e" + U+0301 and the
    // model quotes the precomposed "é". Normalizing the string joins them;
    // normalizing character by character cannot. The citation is true, so it
    // is kept — with no location, because none was found.
    const s = source({ text: 'The café experiment measured queue time and nothing else.' });
    const quote = 'The café experiment measured queue time';
    expect(locateQuote(s.text, quote)).toBeNull();
    const parsed = parseStudySections(reply(quote), [s], ['summary']);
    expect(parsed[0].citations[0].at).toBeUndefined();
    expect(citationLocation(s, parsed[0].citations[0].at)).toBe('Slide 2');
  });
});

describe('citationLocation', () => {
  it('names the place inside the source, not only where the source came from', () => {
    const s = source();
    const parsed = parseStudySections(reply('the value of the next best alternative'), [s], ['summary']);
    expect(citationLocation(s, parsed[0].citations[0].at)).toBe('Slide 2 · characters 21–58');
    expect(studyMarkdown(parsed, [s])).toContain('Lecture · Slide 2 · characters 21–58');
  });

  it('counts paragraphs where the source has them, which is where "page not recorded" bites hardest', () => {
    // A prepared guide unit is its cards joined by a blank line, and its
    // locator ends "original page not recorded" because the guide has no
    // pages. The paragraph is the card, and it is a real answer to "where".
    const s = source({
      locator: 'Prepared course guide · Unit 1; original page not recorded',
      text: 'What is scarcity?\nResources are limited.\n\nWhat is opportunity cost?\nThe value of the next best alternative.',
    });
    const parsed = parseStudySections(reply('The value of the next best alternative'), [s], ['summary']);
    expect(citationLocation(s, parsed[0].citations[0].at)).toContain('paragraph 2, characters ');
  });

  it('falls back to the source locator alone rather than inventing a place', () => {
    expect(citationLocation(source())).toBe('Slide 2');
    expect(citationLocation(undefined)).toBe('');
  });
});

describe('quoteContext', () => {
  it('marks exactly the quotation and keeps enough either side to recognise the place', () => {
    const s = source({ text: `${'a'.repeat(400)} the value of the next best alternative ${'b'.repeat(400)}` });
    const at = locateQuote(s.text, 'the value of the next best alternative')!;
    const place = quoteContext(s.text, at, 20);
    expect(place.match).toBe('the value of the next best alternative');
    expect(place.before).toBe(`…${'a'.repeat(19)} `);
    expect(place.after).toBe(` ${'b'.repeat(19)}…`);
  });

  it('does not claim elision it did not do', () => {
    const s = source();
    const at = locateQuote(s.text, 'the value of the next best alternative')!;
    const place = quoteContext(s.text, at, 999);
    expect(place.before).toBe('Opportunity cost is ');
    expect(place.after).toBe('.');
  });
});
