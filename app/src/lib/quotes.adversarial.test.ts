import { describe, expect, it } from 'vitest';
import { checkQuote, report, verdictLine, type Result, type Source } from './quotes';

/**
 * A pass written to make the quote checker confirm a quotation that is not
 * in the source.
 *
 * `lib/quotes.test.ts` establishes that the checker works. This file was
 * written the other way round, by someone trying to break it, because the two
 * directions are not the same test and the false-positive direction is the
 * one that carries weight. A missed quotation costs a student a minute of
 * looking. A wrongly confirmed one tells them their citation is sound when it
 * is not, in a screen they opened precisely because they were unsure — and
 * the flat wording of the third verdict, which this repository argued about
 * at some length, was built to avoid saying anything that strong in the other
 * direction.
 *
 * So every case here is a quotation that ought to fail, built to look like
 * one that should pass. Four families of them, each of which found or fixed
 * something:
 *
 * - **Numbers changed** inside an otherwise verbatim passage.
 * - **Fragments assembled** out of pieces that all genuinely appear in the
 *   reading, separately.
 * - **A different work by the same author**, which shares a vocabulary and a
 *   register with the one being quoted.
 * - **Near-miss paraphrases**, where the sentence means the same and says it
 *   with other words.
 *
 * ## What counts as a pass here
 *
 * `found` and `close` are the two verdicts that assert. Either of them on a
 * quotation below is a failure of this file. `near` is not: it prints the
 * passage and says in the same line that it is *not* what the student wrote,
 * which is the correct answer to "there is something here that resembles
 * this" — so the cases that legitimately resemble something assert `near` and
 * then assert that the printed passage contains the word that differs, which
 * is the whole reason for showing it.
 *
 * ## The controls, which are the reason to believe the rest
 *
 * A file of adversarial cases that all come back `missing` is exactly what a
 * matcher switched off looks like. [CLAUDE.md](../../../CLAUDE.md) has the
 * story of the teardown probe that read every file as leaking, including the
 * two that were already fixed. So this file ends with three quotations that
 * must *not* be refused — one verbatim, one retyped, one from a different
 * edition — and they fail first if the matching is disabled, mis-thresholded,
 * or reduced to returning nothing.
 */

/** The reading being quoted. One passage, with numbers and a repeated word. */
const READING = `Chapter four opens with the claim the rest of the book is built on. The
modern state is not, in any serious sense, a neutral arbiter standing above the
contest of classes. It presents itself as one, and the presentation is itself
part of the machinery being described.

The figures bear this out. In 1979 the share of national income going to wages
fell to 58 percent, the lowest figure recorded since the war, and the
legislation of the following decade did nothing to reverse it.

Much later in the same volume the argument turns to monetary arrangements. A
currency board is a strong commitment device, and its strength is exactly what
makes it dangerous in the circumstances described above.

Two chapters further on the consequence arrives. The exchange rate collapsed in
the summer, taking the board with it and a great deal else besides.`;

/**
 * A different essay by the same author: same subject, same register, same
 * habits of phrasing. This is what a quotation from the wrong book is
 * checked against, and it is much harder than an unrelated text.
 */
const OTHER = `In the second essay the author turns to method. It is not the case
that the historian can stand above the material and describe the contest of
classes from nowhere. The position is itself part of what is being described,
and any serious sense of the word objectivity has to make room for that. In
1983 the same argument was put more sharply, and less well.`;

const shelf: Source[] = [
  { label: 'POLS 2100 · Reading 4', text: READING },
  { label: 'POLS 2100 · Reading 9', text: OTHER },
];

const check = (quote: string): Result => checkQuote(quote, shelf);

/** The two verdicts that assert something. Neither may appear below. */
const asserts = (r: Result) => r.verdict === 'found' || r.verdict === 'close';

describe('numbers changed inside an otherwise verbatim passage', () => {
  it('will not confirm a date the source does not give', () => {
    // Every word but one is the source's, in the source's order. Word overlap
    // alone scores this at 0.95 and would call it a match; a changed year in
    // a quotation is the difference the screen exists to catch.
    const r = check(
      'In 1987 the share of national income going to wages fell to 58 percent, the lowest figure recorded since the war',
    );
    expect(asserts(r), 'a changed year must not be confirmed').toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not confirm a figure the source does not give', () => {
    const r = check(
      'In 1979 the share of national income going to wages fell to 53 percent, the lowest figure recorded since the war',
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not confirm two numbers swapped for each other', () => {
    const r = check(
      'In 1958 the share of national income going to wages fell to 79 percent, the lowest figure recorded since the war',
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not let a number from a different essay stand in for this one', () => {
    // 1983 is genuinely on the shelf — in the other reading. A check that
    // asked only "is this number somewhere in the material" would pass it.
    const r = check(
      'In 1983 the share of national income going to wages fell to 58 percent, the lowest figure recorded since the war',
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });
});

describe('sentences assembled from fragments that each appear separately', () => {
  it('will not join two passages two chapters apart', () => {
    // Both halves are verbatim. They are nine hundred characters apart, and
    // the writer marked no gap, so as a quotation the sentence is invented.
    const r = check(
      'A currency board is a strong commitment device and the exchange rate collapsed in the summer',
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not silently close an omission the writer did not mark', () => {
    // The two halves are in one paragraph with a whole sentence between them
    // and no ellipsis. Written with one it is a quotation and the checker
    // honours it; written without one it is a claim the source does not make.
    //
    // A quotation that runs straight across a paragraph break is *not* this
    // case and must not be caught by it: those words really are adjacent, and
    // the first draft of this test got that wrong.
    const r = check(
      'Much later in the same volume the argument turns to monetary arrangements and its strength is exactly what makes it dangerous',
    );
    expect(asserts(r)).toBe(false);
  });

  it('will not accept words in order but spread over three times the span', () => {
    // Every word is present, in order, in one paragraph — with thirty words
    // of the source in between. Order alone is not enough; the passage has
    // to be one passage.
    const r = check(
      'A currency board is a strong commitment device makes it dangerous in the circumstances described',
    );
    expect(asserts(r)).toBe(false);
  });
});

describe('a different work by the same author', () => {
  it('will not confirm the quoted sentence against the other essay', () => {
    // The other essay contains `any serious sense`, `the contest of classes`
    // and `stand above`. It does not contain this sentence.
    const only: Source[] = [shelf[1]];
    const r = checkQuote(
      'The modern state is not, in any serious sense, a neutral arbiter standing above the contest of classes',
      only,
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not build a quotation out of a shared vocabulary', () => {
    const only: Source[] = [shelf[1]];
    const r = checkQuote(
      'the historian is in any serious sense standing above the contest of classes and the material',
      only,
    );
    expect(asserts(r)).toBe(false);
  });
});

describe('near-miss paraphrases', () => {
  it('will not confirm the same claim in other words', () => {
    const r = check(
      'The contemporary government is by no measure an impartial referee positioned over the struggle of social groups',
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not confirm a sentence whose clauses have been reordered', () => {
    // Every word is the source's. The order is not, and the order is what a
    // quotation claims.
    const r = check(
      'a neutral arbiter standing above the contest of classes the modern state is not in any serious sense',
    );
    expect(asserts(r)).toBe(false);
  });

  it('will not confirm a quotation that drops the negation', () => {
    // The most consequential misquotation there is, and the one case here
    // that legitimately resembles the source: every word the student typed
    // is in the passage, in order — they left one out. `near` is the right
    // answer, and it earns that by printing the word they dropped.
    const r = check(
      'The modern state is, in any serious sense, a neutral arbiter standing above the contest of classes',
    );
    expect(asserts(r), 'a dropped negation must never be confirmed').toBe(false);
    expect(r.verdict).toBe('near');
    expect(r.says, 'the passage has to show what was left out').toContain('is not');
    expect(verdictLine(r)).not.toMatch(/found in/i);
  });

  it('will not let a near verdict read as a confirmation, anywhere it is shown', () => {
    const r = check(
      'The modern state is, in any serious sense, a neutral arbiter standing above the contest of classes',
    );
    const line = verdictLine(r);
    expect(line).toMatch(/not found as typed/i);
    expect(line).toMatch(/compare/i);
    const summary = report([r], shelf);
    expect(summary).not.toMatch(/1 found/);
    expect(summary).toMatch(/not saying they match/);
  });
});

describe('short quotations, where resemblance is a coincidence', () => {
  it('gives no near verdict to a handful of ordinary words', () => {
    const r = check('in the sense that the figure is above the rest of the state and was not');
    expect(r.verdict).toBe('missing');
  });

  it('gives no near verdict to a short phrase the reading nearly contains', () => {
    // One word off a phrase that is genuinely in the reading, and four words
    // long. At this length the passage would be offered on the strength of
    // `standing above the` — which proves nothing about either.
    const r = check('a neutral umpire standing');
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });
});

/**
 * The controls. Everything above asserts a refusal, and a matcher that
 * refuses everything passes all of it — so these three have to hold at the
 * same time, and they are the ones that fail if it is switched off.
 */
describe('controls — the quotations that must not be refused', () => {
  it('still finds a quotation typed word for word', () => {
    const r = check('a neutral arbiter standing above the contest of classes');
    expect(r.verdict).toBe('found');
    expect(r.where).toBe('POLS 2100 · Reading 4');
  });

  it('still forgives typography, and says so as its own verdict', () => {
    const r = check('a neutral arbiter standing above — the contest of classes');
    expect(r.verdict).toBe('close');
  });

  it('still offers the passage when one word is an edition apart', () => {
    const r = check(
      'The modern state is not, in any serious sense, a neutral umpire standing above the contest of classes',
    );
    expect(r.verdict).toBe('near');
    expect(r.says).toContain('neutral arbiter');
  });
});

/**
 * The cases that exist because the guard above them survived being removed.
 *
 * Each of these is here because reverting one line of `nearest` left every
 * other test in this repository green. A guard nothing can fail is not known
 * to be a guard, and these two were not.
 */
describe('guards that nothing else was failing on', () => {
  it('will not let the words everybody uses carry a match', () => {
    // Five sixths of this lines up with the source, in order — and every
    // word that does is `and it is not the case that the has been in any`.
    // The words the sentence is actually about are all different.
    const only: Source[] = [
      {
        label: 'Reading',
        text: 'and it is not the case that the state has been in any serious sense a neutral arbiter',
      },
    ];
    const r = checkQuote(
      'and it is not the case that the market has been in any serious sense a fair umpire',
      only,
    );
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });

  it('will not offer a passage for a seven-word phrase one word off', () => {
    // Six of seven words, in order, with the distinctive ones lining up:
    // over the eight-word floor this is a near match, and under it the
    // resemblance is `standing above the contest` — which two books on the
    // same subject share without either quoting the other.
    const r = check('a neutral umpire standing above the contest');
    expect(asserts(r)).toBe(false);
    expect(r.verdict).toBe('missing');
  });
});
