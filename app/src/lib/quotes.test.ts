import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  around,
  bare,
  checkDraft,
  checkQuote,
  pieces,
  pullQuotes,
  report,
  sourcesFrom,
  verdictLine,
  type Source,
} from './quotes';
import type { Guide, StudyCard } from './types';

const READING: Source = {
  label: 'PSCI 1104 · Reading 7',
  text: 'Trounstine argues that local politics is not a neutral arbiter of competing interests. The winners of city elections are the people who turn out, and turnout in local elections is small, old and propertied.',
};

describe('pullQuotes', () => {
  it('takes both straight and curly double quotes', () => {
    const got = pullQuotes('She writes "the winners of city elections" and “turnout in local elections”.');
    expect(got.map((q) => q.text)).toEqual([
      'the winners of city elections',
      'turnout in local elections',
    ]);
  });

  it('ignores a word in scare quotes, which is not a quotation', () => {
    expect(pullQuotes('So-called "neutral" institutions.')).toEqual([]);
  });

  it('leaves apostrophes alone', () => {
    // The reason single quotes are not collected: "don't" would otherwise
    // open a quotation that swallows the rest of the paragraph.
    expect(pullQuotes("Trounstine's point doesn't depend on it, and nor does mine.")).toEqual([]);
  });

  it('records where each one starts, so they can be ordered', () => {
    const [a, b] = pullQuotes('x "the first quoted passage" y "the second quoted passage"');
    expect(a.at).toBeLessThan(b.at);
  });
});

describe('pieces and bare', () => {
  it('splits a quote at the gap the writer marked', () => {
    expect(pieces('local politics is not… a neutral arbiter of interests')).toEqual([
      'local politics is not',
      'a neutral arbiter of interests',
    ]);
    expect(pieces('local politics is not [...] a neutral arbiter of interests')).toHaveLength(2);
  });

  it('drops a fragment too short to prove anything', () => {
    expect(pieces('the winners of city elections … are … the people who turn out')).toEqual([
      'the winners of city elections',
      'the people who turn out',
    ]);
  });

  it('strips punctuation for the loose comparison', () => {
    expect(bare('“Turnout,” he writes, “is small.”')).toBe('turnout he writes is small');
  });
});

describe('checkQuote', () => {
  it('finds a quote that is word-for-word', () => {
    const r = checkQuote('the winners of city elections are the people who turn out', [READING]);
    expect(r.verdict).toBe('found');
    expect(r.where).toBe('PSCI 1104 · Reading 7');
    expect(verdictLine(r)).toContain('Found in PSCI 1104');
  });

  it('forgives typography the way a reader would', () => {
    // Curly quotes, a stray double space, different case: the same sentence.
    const r = checkQuote('The  Winners Of City Elections', [READING]);
    expect(r.verdict).toBe('found');
  });

  it('honours an ellipsis instead of failing on it', () => {
    const r = checkQuote(
      'local politics is not a neutral arbiter … turnout in local elections is small',
      [READING],
    );
    expect(r.verdict).toBe('found');
  });

  it('will not accept the pieces in the wrong order', () => {
    // An ellipsis says words are missing, not that the order is negotiable.
    const r = checkQuote(
      'turnout in local elections is small … local politics is not a neutral arbiter',
      [READING],
    );
    expect(r.verdict).not.toBe('found');
  });

  it('says "close" when the words are there but the punctuation is not', () => {
    const r = checkQuote('the winners of city elections; are the people who turn out', [READING]);
    expect(r.verdict).toBe('close');
    // The fixable part: the source's own words come back with it.
    expect(r.says).toContain('winners of city elections');
    expect(verdictLine(r)).toContain('not as typed');
  });

  it('hands back the source with its punctuation, not without it', () => {
    // An Oxford comma the source does not have. The quote is close, and what
    // comes back has to be the text as the document writes it — punctuation
    // included — because the instruction beside it is "copy those".
    const r = checkQuote('small, old, and propertied', [READING]);
    expect(r.verdict).toBe('close');
    expect(r.says).toContain('small, old and propertied');
    expect(r.says).not.toContain('small old and propertied');
  });

  it('will not call a changed word a match', () => {
    // The guard this test was written for, which has not moved: a changed
    // word is never `found` and never `close`, the two verdicts that assert
    // something. What did move is the answer underneath. This used to be
    // "not in anything here" — true of nothing, since the sentence is right
    // there with one word different — and is now the passage itself, with
    // the line under it saying to compare rather than that it matched.
    const r = checkQuote('the winners of state elections are the people who turn out', [READING]);
    expect(r.verdict).not.toBe('found');
    expect(r.verdict).not.toBe('close');
    expect(r.verdict).toBe('near');
    expect(r.says, 'the word that differs has to be visible').toContain('city elections');
    expect(verdictLine(r)).not.toMatch(/found in/i);
  });

  it('prefers a verbatim match in a later source over a loose one in the first', () => {
    const loose: Source = { label: 'A', text: 'the winners, of city elections' };
    const exact: Source = { label: 'B', text: 'the winners of city elections' };
    expect(checkQuote('the winners of city elections', [loose, exact]).where).toBe('B');
  });

  it('says missing rather than wrong when there is nothing to check against', () => {
    const r = checkQuote('the winners of city elections', []);
    expect(r.verdict).toBe('missing');
    // The wording is the whole point of this feature.
    expect(verdictLine(r)).toContain('that is all this means');
    expect(verdictLine(r)).not.toMatch(/wrong|invented|false/i);
  });
});

describe('around', () => {
  it('quotes the source without cutting a word in half', () => {
    const said = around(READING.text, 'the winners of city elections');
    expect(said).toContain('winners of city elections');
    expect(said.replace(/…/g, '').trim()).not.toMatch(/^\w*[^\s\w]/);
  });

  it('returns nothing when the words are not there', () => {
    expect(around(READING.text, 'not in this text at all')).toBe('');
  });
});

describe('checkDraft and report', () => {
  const draft =
    'As Trounstine puts it, "the winners of city elections are the people who turn out". ' +
    'Elsewhere she calls turnout "small, old, and propertied". ' +
    'A third source says "markets clear at the intersection of supply and demand".';

  it('checks every quotation and keeps them in order', () => {
    const results = checkDraft(draft, [READING]);
    expect(results.map((r) => r.verdict)).toEqual(['found', 'close', 'missing']);
    expect(results[0].at).toBeLessThan(results[2].at);
  });

  it('never lets the count read as a score', () => {
    const line = report(checkDraft(draft, [READING]), [READING]);
    expect(line).toContain('3 quotations');
    expect(line).toContain('not that the quote is wrong');
    expect(line).toContain('1 piece of material');
  });

  it('says what to do when there is nothing to check against', () => {
    const line = report(checkDraft(draft, []), []);
    expect(line).toContain('nothing here to check them against');
  });

  it('says plainly when a draft quotes nothing', () => {
    expect(report(checkDraft('No quotations at all in this one.', [READING]), [READING])).toContain(
      'No quotations found',
    );
  });
});

describe('sourcesFrom', () => {
  const card = (q: string, a: string): StudyCard => ({ q, a, ui: 0 }) as StudyCard;
  const guide: Guide = {
    code: 'PSCI 1104',
    name: 'PSCI',
    blurb: '',
    source: '',
    mastery: 0.5,
    audio: false,
    units: [{ name: 'Sampling', mastery: 0.5, cards: [card('What is turnout?', 'Who shows up.')] }],
    terms: [{ t: 'Selection bias', d: 'The groups differed before any treatment.' }],
  };

  const input = {
    updates: [
      { courseId: 'psci', title: 'Reading 7', source: 'Trounstine ch. 2', body: READING.text },
      { courseId: 'econ', title: 'Reading 3', source: '', body: 'Markets clear where the curves cross.' },
      { courseId: 'psci', title: 'Empty', source: '', body: '   ' },
    ],
    guides: [{ courseId: 'psci', code: 'PSCI 1104', guide }],
    codeOf: (id: string) => (id === 'psci' ? 'PSCI 1104' : 'ECON 1020'),
  };

  it('puts the readings you added in, named as you named them', () => {
    const out = sourcesFrom(input);
    expect(out[0].label).toBe('PSCI 1104 · Trounstine ch. 2');
    // A body with nothing in it is not a source.
    expect(out.some((s) => s.label.includes('Empty'))).toBe(false);
  });

  it('includes a guide but labels it as one', () => {
    const out = sourcesFrom(input);
    const g = out.find((s) => s.label.endsWith('study guide'));
    expect(g).toBeTruthy();
    expect(g!.text).toContain('Selection bias');
  });

  it('narrows to one course when asked', () => {
    const out = sourcesFrom({ ...input, courseId: 'econ' });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('ECON 1020 · Reading 3');
  });

  it('falls back to the title when the reading was given no source', () => {
    const out = sourcesFrom({ ...input, courseId: 'econ' });
    expect(out[0].label).toContain('Reading 3');
  });
});

describe('the near verdict', () => {
  /*
   * Breadth, and the shape it had to take. `lib/quotes.adversarial.test.ts`
   * holds the pass written to break it; these are the properties it must
   * have when it works.
   */
  const EDITION: Source = {
    label: 'PHIL 2003 · Reading 2',
    text: 'The philosophers have only interpreted the world, in various ways; the point, however, is to change it. What follows in the same section is a longer argument about the conditions under which that becomes possible at all.',
  };

  it('offers the passage when the student has a different translation', () => {
    const r = checkQuote(
      'The philosophers have merely interpreted the world, in various ways; the point, however, is to change it',
      [EDITION],
    );
    expect(r.verdict).toBe('near');
    expect(r.where).toBe('PHIL 2003 · Reading 2');
    expect(r.says).toContain('only interpreted');
  });

  it('shows the passage with its own punctuation, which is what makes it comparable', () => {
    const r = checkQuote(
      'The philosophers have merely interpreted the world in various ways the point however is to change it',
      [EDITION],
    );
    expect(r.verdict).toBe('near');
    expect(r.says).toContain('various ways; the point, however,');
  });

  it('never runs when a source holds the quotation outright', () => {
    // Order matters here in a way it does not elsewhere: an approximate
    // passage in the first reading must never be preferred to the sentence
    // itself in the second.
    const exact: Source = { label: 'B', text: 'The philosophers have merely interpreted the world' };
    const r = checkQuote('The philosophers have merely interpreted the world', [EDITION, exact]);
    expect(r.verdict).toBe('found');
    expect(r.where).toBe('B');
  });

  it('gives no verdict at all below eight words', () => {
    const r = checkQuote('philosophers have merely interpreted', [EDITION]);
    expect(r.verdict).toBe('missing');
  });

  it('reads as an instruction to compare, never as a confirmation', () => {
    const r = checkQuote(
      'The philosophers have merely interpreted the world, in various ways; the point, however, is to change it',
      [EDITION],
    );
    expect(verdictLine(r)).toMatch(/not found as typed/i);
    expect(verdictLine(r)).toMatch(/compare it word for word/i);
    expect(verdictLine(r)).not.toMatch(/\bfound in\b/i);
  });

  it('is counted on its own line in the summary, outside the found count', () => {
    const r = checkQuote(
      'The philosophers have merely interpreted the world, in various ways; the point, however, is to change it',
      [EDITION],
    );
    const line = report([r], [EDITION]);
    expect(line).toContain('1 quotation.');
    expect(line).not.toMatch(/\d+ found/);
    expect(line).toContain('the app is not saying they match');
  });

  it('leaves the wording of the third verdict exactly where it was', () => {
    // The sentence this whole feature was argued into shape around. Nothing
    // about adding a fourth verdict is allowed to soften it, and nothing
    // about it is allowed to start reading as a finding.
    const r = checkQuote('a sentence from a book this app has never held', [EDITION]);
    expect(r.verdict).toBe('missing');
    expect(verdictLine(r)).toBe(
      'Not in anything the app holds. If the source is not in here, that is all this means.',
    );
    expect(report([r], [EDITION])).toContain(
      'not in anything the app holds — which means it has not seen the source, not that the quote is wrong',
    );
  });
});

describe('what this file is allowed to import', () => {
  /*
   * The safety argument, asserted rather than described.
   *
   * "Your draft never leaves the device" is the claim that makes this screen
   * usable at all — a student checks their own unsubmitted writing here, and
   * the check would be worthless if that writing went anywhere. The evidence
   * for it has always been that `lib/quotes.ts` imports two local files and
   * nothing else, which is true and is checkable by eye, and eye-checkable
   * is not the same as checked. Widening the matcher is exactly the kind of
   * change that gets a model call added "just for the hard cases", so the
   * property gets a test rather than a paragraph.
   */
  const source = readFileSync('src/lib/quotes.ts', 'utf8');

  it('imports nothing but the two local files it has always imported', () => {
    const imports = [...source.matchAll(/^import[^;]*?from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['./cite', './types']);
  });

  it('cannot reach the network by any name', () => {
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'navigator.send', 'WebSocket', 'EventSource', 'import(']) {
      expect(source, `${forbidden} has no business in this file`).not.toContain(forbidden);
    }
  });

  it('holds no key and no address to send anything to', () => {
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/api[._-]?key/i);
  });
});

describe('a draft with several quotations in it', () => {
  /*
   * A property of the implementation rather than of the answer, and it is
   * here because it stopped being free. Each of the three passes reduces a
   * source — `flatten`, then `bare`, then a word index — and each used to be
   * redone for every quotation in the draft. `screens/Proof.tsx` re-checks
   * the whole draft on every keystroke, so that multiplication is felt as
   * typing lag rather than as a slow function.
   *
   * Counted rather than timed: a clock makes this test flaky on a loaded
   * machine and tells you nothing about why.
   */
  const counting = (label: string, text: string) => {
    let reads = 0;
    const s = { label } as Source;
    Object.defineProperty(s, 'text', {
      get() {
        reads += 1;
        return text;
      },
    });
    return { s, reads: () => reads };
  };

  it('reads each source a fixed number of times, not once per quotation', () => {
    const body = 'A reading with nothing in it that any of the quotations below are drawn from, at all.';
    const draft = Array.from(
      { length: 12 },
      (_, i) => `He writes "the quangos of zeppelin elections number ${i} exactly" here.`,
    ).join(' ');

    const one = counting('R', body);
    expect(checkDraft(draft, [one.s])).toHaveLength(12);
    const many = one.reads();

    const two = counting('R', body);
    expect(checkDraft('He writes "the quangos of zeppelin elections number 0 exactly" here.', [two.s])).toHaveLength(1);

    expect(many, 'twelve quotations must not cost twelve reductions').toBe(two.reads());
  });
});
