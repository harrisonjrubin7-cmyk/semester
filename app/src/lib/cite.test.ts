import { describe, expect, it } from 'vitest';
import { check, flatten, tally, worthCiting } from './cite';
import type { Citation } from './claude';

const cite = (text: string, page?: number, title?: string): Citation => ({
  text,
  ...(page ? { page } : {}),
  ...(title ? { title } : {}),
});

const REAL =
  'Problem sets are due Fridays at 11:59 PM on Gradescope. The lowest score is dropped.';

describe('reducing a quote to its sentence', () => {
  it('forgives the noise a PDF and a model both introduce', () => {
    // Extraction breaks lines mid-sentence; a model normalises a dash or a
    // curly quote without meaning anything by it.
    expect(flatten('Problem  sets\nare  due')).toBe('problem sets are due');
    expect(flatten('the “drop”')).toBe('the "drop"');
    expect(flatten('nine—thirty')).toBe('nine-thirty');
    expect(flatten("it’s")).toBe("it's");
  });
});

describe('checking a quote against what the API cited', () => {
  it('confirms a quote the document contains', () => {
    const out = check('Problem sets are due Fridays at 11:59 PM on Gradescope.', [cite(REAL, 4)]);
    expect(out.confirmed).toBe(true);
    expect(out.page).toBe(4);
  });

  it('confirms it through line breaks and curly quotes', () => {
    const messy = 'Problem sets are due Fridays\n  at 11:59 PM on Gradescope.';
    expect(check(messy, [cite(REAL, 4)]).confirmed).toBe(true);
  });

  it('confirms a citation that is a fragment of the quote', () => {
    // Either direction counts: the model may quote a sentence out of a cited
    // paragraph, or cite a fragment of a sentence it quoted in full.
    expect(check(REAL, [cite('due Fridays at 11:59 PM on Gradescope', 4)]).confirmed).toBe(true);
  });

  it('refuses a paraphrase', () => {
    // The exact failure this exists to catch: a sentence that shares most of
    // its words and changes the one that matters.
    expect(check('Problem sets are due Fridays at 11:59 AM on Gradescope.', [cite(REAL, 4)])
      .confirmed).toBe(false);
    expect(check('Problem sets are due each Friday night on Gradescope.', [cite(REAL, 4)])
      .confirmed).toBe(false);
  });

  it('refuses a quote with nothing to check it against', () => {
    expect(check(REAL, []).confirmed).toBe(false);
  });

  it('refuses a fragment too short to mean anything', () => {
    // Two strings sharing "due" is a coincidence, not a quotation.
    expect(check('due', [cite(REAL, 4)]).confirmed).toBe(false);
    expect(check(REAL, [cite('due')]).confirmed).toBe(false);
  });

  it('carries the document’s own wording back, not the model’s', () => {
    const out = check('problem sets are due fridays at 11:59 pm on gradescope.', [cite(REAL, 4)]);
    expect(out.source).toBe(REAL);
  });

  it('confirms without a page where the document has none', () => {
    const out = check(REAL, [cite(REAL)]);
    expect(out.confirmed).toBe(true);
    expect(out.page).toBeUndefined();
  });

  it('says which document the page is in', () => {
    // A page number is only an answer where one document went up. Two do —
    // a syllabus and a schedule posted separately — and the API returns the
    // title it was given, so the app need not guess. `lib/topage.ts` matches
    // it against the drive to decide whether the page can be opened.
    expect(check(REAL, [cite(REAL, 4, 'Econ1020_Fall.pdf')]).doc).toBe('Econ1020_Fall.pdf');
  });

  it('names no document where the citation named none', () => {
    // Claiming the only PDF is how the wrong document gets opened at p. 4.
    expect(check(REAL, [cite(REAL, 4)]).doc).toBeUndefined();
  });

  it('names the document the matching citation came from, not the first one', () => {
    const out = check(REAL, [
      cite('Attendance is recorded from the second week.', 2, 'Schedule.pdf'),
      cite(REAL, 4, 'Econ1020_Fall.pdf'),
    ]);
    expect(out).toMatchObject({ page: 4, doc: 'Econ1020_Fall.pdf' });
  });
});

describe('how a whole import came out', () => {
  const ok = { checked: { confirmed: true, page: 1 } };
  const no = { checked: { confirmed: false } };

  it('says so when everything held up', () => {
    expect(tally([ok, ok])).toBe('Every quote was found word-for-word in the file you uploaded.');
  });

  it('says so when nothing did', () => {
    expect(tally([no, no])).toContain('None of the quotes could be matched');
  });

  it('gives the count in between', () => {
    expect(tally([ok, no, ok])).toBe(
      '2 of 3 quotes were found word-for-word in the file. The rest are flagged where they appear.',
    );
  });

  it('says nothing at all where nothing was checked', () => {
    // An import from pasted text has no document to cite, and a silent
    // absence is better than a reassurance the app cannot back.
    expect(tally([{}, {}])).toBe('');
  });
});

describe('when citing is worth asking for', () => {
  it('needs a document sent whole', () => {
    // Text already flattened by pdf.js has no pages left to point at, and
    // offsets into a string the student never sees are worse than nothing.
    expect(worthCiting([{ mediaType: 'application/pdf' }])).toBe(true);
    expect(worthCiting([])).toBe(false);
  });
});
