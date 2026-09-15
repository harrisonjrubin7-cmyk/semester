import { describe, expect, it } from 'vitest';
import {
  LEAVE,
  answerShown,
  ladderFor,
  nextRungLabel,
  opening,
  overlap,
  scoreLine,
  termIn,
  type Askable,
  type Rung,
} from './ladder';
import type { Term } from './types';

const TERMS: Term[] = [
  { t: 'cost', d: 'what something takes' },
  { t: 'opportunity cost', d: 'what you give up to get the thing you chose' },
  { t: 'elasticity', d: 'how much quantity answers a change in price' },
];

function ask(over: Partial<Askable> = {}): Askable {
  return {
    q: 'What does a demand curve slope down for?',
    full: 'Because buyers substitute away, which is the substitution effect at work',
    opts: [
      { text: 'Because buyers substitute away, which is the substitution effect at work', ok: true },
      { text: 'Because firms raise output when prices rise', ok: false },
      { text: 'Because the tax incidence falls on sellers', ok: false },
      { text: 'Because buyers substitute toward it as income rises', ok: false },
    ],
    ...over,
  };
}

describe('finding the term an answer turns on', () => {
  it('finds one that is there', () => {
    expect(termIn('Price elasticity is what this measures.', TERMS)?.t).toBe('elasticity');
  });

  it('prefers the longest match, because terms nest', () => {
    // "cost" and "opportunity cost" are both in the guide. The useful hint is
    // the specific one; the general one is true and says nothing.
    expect(termIn('The opportunity cost of an hour.', TERMS)?.t).toBe('opportunity cost');
  });

  it('does not match inside a longer word', () => {
    // Substring matching found "cost" inside "costly" and inside "costume",
    // which produced hints that were true of nothing in the question.
    expect(termIn('A costly mistake in a costume shop.', TERMS)).toBeNull();
  });

  it('matches across punctuation, which is where a term usually sits', () => {
    expect(termIn('It is the elasticity, roughly.', TERMS)?.t).toBe('elasticity');
    expect(termIn('elasticity', TERMS)?.t).toBe('elasticity');
  });

  it('ignores a term too short to be one', () => {
    expect(termIn('It is up to us.', [{ t: 'us', d: 'we' }])).toBeNull();
  });

  it('says nothing rather than guessing', () => {
    expect(termIn('Nothing here matches at all.', TERMS)).toBeNull();
    expect(termIn('anything', [])).toBeNull();
  });
});

describe('how alike two answers are', () => {
  it('counts the words that carry meaning', () => {
    expect(overlap('the marginal cost of output', 'marginal cost falls')).toBe(2);
  });

  it('does not count the words every sentence has', () => {
    // Without the noise list, two answers sharing "the" and "of" score 2 and
    // the striking-out picks the wrong decoys.
    expect(overlap('the of and to is', 'the of and to is')).toBe(0);
  });

  it('is zero for two answers with nothing in common', () => {
    expect(overlap('marginal revenue', 'housing lottery')).toBe(0);
  });
});

describe('the opening of an answer', () => {
  it('is the first clause', () => {
    expect(opening('Because buyers substitute away, which is the substitution effect')).toBe(
      'Because buyers substitute away',
    );
  });

  it('falls back to the first few words when there is no punctuation', () => {
    const head = opening('Marginal revenue equals marginal cost at the profit maximising output');
    expect(head).toBe('Marginal revenue equals marginal cost at');
  });

  it('refuses when the answer is too short to have one', () => {
    // A hint that is the answer is not a hint. This is the rule the whole
    // module turns on.
    expect(opening('Deadweight loss')).toBeNull();
    expect(opening('It falls on sellers')).toBeNull();
  });

  it('refuses when the first clause is nearly the whole answer', () => {
    // Punctuation late in a sentence gives a "clause" that is the answer with
    // the last two words removed.
    expect(opening('Marginal revenue equals marginal cost at the maximising output, roughly')).toBeNull();
  });

  it('refuses a short answer even when its first clause is short too', () => {
    /*
     * The case the length floor is actually for, and it took a mutation to
     * find: "Sellers bear it, mostly, in the end" has a first clause of
     * "Sellers bear it" — only 44% of the characters, so the two-thirds rule
     * lets it through, and two meaningful words, so the clause-length rule
     * does too. It is still the entire answer as far as anybody reading it is
     * concerned.
     *
     * Every other short answer tested here is caught by one of the other two
     * rules, which is why removing this one broke nothing.
     */
    expect(opening('Sellers bear it, mostly, in the end')).toBeNull();
  });

  it('never returns the whole answer', () => {
    for (const full of [
      'Because buyers substitute away, which is the substitution effect',
      'Marginal revenue equals marginal cost at the profit maximising output',
      'The elasticity of demand; measured at a point on the curve, not over a range',
    ]) {
      const head = opening(full);
      if (head === null) continue;
      expect(head.length).toBeLessThan(full.length);
      expect(full.startsWith(head)).toBe(true);
    }
  });
});

describe('the ladder as a whole', () => {
  it('offers the three rungs in order of how much they give away', () => {
    // Options that do not carry the answer — the recall shape, where quoting
    // the opening is a hint rather than a pointer. See the next block.
    const rungs = ladderFor(
      {
        q: 'Why does demand slope down?',
        full:
          'Because elasticity means buyers substitute away, and the income effect pushes ' +
          'the same way for a normal good',
        opts: [
          { text: 'the substitution effect and the income effect together', ok: true },
          { text: 'firms raise output when prices rise', ok: false },
          { text: 'tax incidence falls on sellers', ok: false },
          { text: 'buyers substitute toward it as income rises', ok: false },
        ],
      },
      TERMS,
    );
    expect(rungs.map((r) => r.kind)).toEqual(['term', 'narrow', 'narrow', 'opening']);
  });

  it('finds a term named in the question when the answer does not repeat it', () => {
    /*
     * Measured on ECON's own deck: "Explain the death spiral." has an answer
     * that never says the term, so an answer-only search found nothing and the
     * ladder opened on "Take two away" — the rung that gives the most, offered
     * first.
     */
    const rungs = ladderFor(
      ask({ q: 'What does elasticity measure?', full: 'How much quantity answers a price change' }),
      TERMS,
    );
    expect(rungs[0].kind).toBe('term');
    expect(rungs[0].says).toContain('elasticity');
  });

  it('strikes out the decoys least like the right answer', () => {
    /*
     * The near-miss is the discrimination the question is asking for, so it
     * stays until last. Striking it first would leave the two obviously-wrong
     * options and turn a hint into a giveaway.
     *
     * Option 3 shares "buyers substitute" with the answer; 1 and 2 share
     * nothing that carries meaning.
     */
    const narrow = ladderFor(ask(), TERMS).filter((r) => r.kind === 'narrow');
    expect(narrow[0].out).not.toContain(3);
    expect(narrow[0].out).not.toContain(0);
  });

  it('takes one option at a time, not a pair', () => {
    /*
     * Measured across the four shipped decks before this: 24 of 40 questions
     * offered exactly one rung, because striking a pair used up the whole
     * narrowing in a single press. One at a time is a progression — each rung
     * gives less than the one before — and costs nothing to build.
     */
    const narrow = ladderFor(ask(), TERMS).filter((r) => r.kind === 'narrow');
    expect(narrow.map((r) => r.out?.length)).toEqual([1, 2]);
    expect(narrow.map((r) => r.says)).toEqual([
      'One of these is out. 3 left.',
      'Another is out. 2 left.',
    ]);
  });

  it('each rung names every option gone by the time it is reached', () => {
    // So a screen can render any prefix of the ladder without accumulating
    // the strikes itself.
    const narrow = ladderFor(ask(), TERMS).filter((r) => r.kind === 'narrow');
    expect(narrow[1].out).toEqual(expect.arrayContaining(narrow[0].out!));
  });

  it('never strikes below two options, whatever the question holds', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const opts = Array.from({ length: n }, (_, i) => ({ text: `option ${i}`, ok: i === 0 }));
      const rungs = ladderFor({ q: 'Which?', full: 'option 0', opts }, []);
      const last = rungs.filter((r) => r.kind === 'narrow').at(-1);
      expect(n - (last?.out?.length ?? 0), `${n} options`).toBeGreaterThanOrEqual(LEAVE);
    }
  });

  it('never strikes the right answer', () => {
    for (let right = 0; right < 4; right += 1) {
      const opts = Array.from({ length: 4 }, (_, i) => ({
        text: i === right ? 'the correct one about elasticity' : `decoy number ${i}`,
        ok: i === right,
      }));
      const rungs = ladderFor(ask({ opts, full: opts[right].text }), TERMS);
      const narrow = rungs.find((r) => r.kind === 'narrow');
      expect(narrow?.out ?? [], `right at ${right}`).not.toContain(right);
    }
  });

  it('does not narrow a question that is already down to two', () => {
    // Striking one of one leaves the answer alone on screen.
    const opts = [
      { text: 'right', ok: true },
      { text: 'wrong one', ok: false },
    ];
    expect(ladderFor(ask({ opts }), TERMS).some((r) => r.kind === 'narrow')).toBe(false);
  });

  it('leaves out a rung it cannot honestly build', () => {
    // No terms to find and an answer with no opening to give: narrowing only.
    const rungs = ladderFor(ask({ full: 'Sellers bear it' }), []);
    expect(new Set(rungs.map((r) => r.kind))).toEqual(new Set(['narrow']));
  });

  it('returns nothing rather than an empty gesture', () => {
    const opts = [
      { text: 'Sellers bear it', ok: true },
      { text: 'Buyers bear it', ok: false },
    ];
    expect(ladderFor({ q: 'Who?', full: 'Sellers bear it', opts }, [])).toEqual([]);
  });

  it('survives a question with no right answer marked at all', () => {
    const opts = [
      { text: 'one', ok: false },
      { text: 'two', ok: false },
    ];
    expect(() => ladderFor({ q: 'Which?', full: 'none of them', opts }, TERMS)).not.toThrow();
  });

  /**
   * The failure the first version shipped with, which every test passed.
   *
   * `buildQuiz` puts a clipped `full` in as the correct option, so the answer
   * is on screen. "It begins: *Insurers raise premiums to cover a sick pool…*"
   * appeared directly under the option starting with those exact words — after
   * a narrowing rung had already cut the field to two. `opening` was behaving
   * perfectly and the rung was a finger pointing at the answer. A screenshot
   * caught it.
   */
  describe('when the answer is one of the options', () => {
    const shown = (): Askable => ({
      q: 'Explain the death spiral.',
      full: 'Insurers raise premiums to cover a sick pool, the healthiest drop out, the pool gets sicker',
      opts: [
        { text: 'Insurers raise premiums to cover a sick pool, the healthiest drop out, the pool…', ok: true },
        { text: 'Adverse selection hides a type, before the deal', ok: false },
        { text: 'A pure monopoly scores ten thousand on the index', ok: false },
        { text: 'Memorizers do fine until asked to do something new', ok: false },
      ],
    });

    it('offers no opening rung at all', () => {
      expect(ladderFor(shown(), TERMS).some((r) => r.kind === 'opening')).toBe(false);
    });

    it('still offers the rungs that do not give it away', () => {
      // Not "no ladder" — narrowing is still honest, and so is the term.
      expect(ladderFor(shown(), TERMS).map((r) => r.kind)).toEqual(['narrow', 'narrow']);
    });

    it('spots a decoy that starts the same way, not only the right one', () => {
      /*
       * A rung that singles out any one option has decided the question,
       * whichever option it is — a hint that points at a *wrong* answer is
       * worse than one that points at the right one.
       *
       * The correct option deliberately does not start this way here, so a
       * check that looked only at `o.ok` would come back false. An earlier
       * version of this test had the right option starting the same way too,
       * and passed against exactly that mistake.
       */
      const q = shown();
      q.opts[0].text = 'A sick pool, rising premiums, and the healthiest leaving first';
      q.opts[1].text = 'Adverse selection hides a type before the deal is struck';
      expect(answerShown(q, 'Adverse selection hides')).toBe(true);
    });

    it('says nothing is shown when nothing starts that way', () => {
      expect(answerShown(shown(), 'Adverse selection is the reason')).toBe(false);
    });
  });

  it('never puts the answer in a rung', () => {
    // Said once as a property rather than once per rung, because the rungs
    // will change and this is what must not.
    const question = ask();
    for (const rung of ladderFor(question, TERMS)) {
      expect(rung.says).not.toContain(question.full);
    }
  });
});

describe('the button that offers the next rung', () => {
  const rungs: Rung[] = [
    { kind: 'term', says: '…' },
    { kind: 'narrow', says: '…', out: [1] },
    { kind: 'narrow', says: '…', out: [1, 2] },
    { kind: 'opening', says: '…' },
  ];

  it('names each rung by what it will do', () => {
    expect([0, 1, 2, 3].map((n) => nextRungLabel(rungs, n))).toEqual([
      'What is this about?',
      'Take one away',
      'Take another away',
      'How does it start?',
    ]);
  });

  it('says nothing once the ladder is climbed', () => {
    expect(nextRungLabel(rungs, 4)).toBeNull();
    expect(nextRungLabel([], 0)).toBeNull();
  });
});

describe('what the score says it cost', () => {
  it('counts the hinted ones apart rather than deducting them', () => {
    // Getting there with a hint beats not getting there, and a rule that
    // punishes asking teaches people not to ask.
    expect(scoreLine(7, 10, 3)).toBe('7 of 10, 3 with help');
  });

  it('says so plainly when nothing was hinted', () => {
    expect(scoreLine(10, 10, 0)).toBe('10 of 10, none with help');
  });
});
