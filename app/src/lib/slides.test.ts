import { describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { ANSWERS, bullets, comparison, deckOf, passage, PASSAGE, type Slide } from './slides';
import type { StudyCard, Unit } from './types';

const card = (q: string, a: string): StudyCard => ({ q, a });
const unit = (cards: StudyCard[], name = '3 · A unit'): Unit => ({ name, mastery: 0, cards });
const cut = (u: Unit) => ({ unit: u, code: 'TEST 100', figures: [], added: [], standing: 'not started' });

describe('two sides, where the card has two', () => {
  it('splits a contrast the answer names on both sides', () => {
    const got = comparison(
      card(
        'Adverse selection vs. moral hazard?',
        'Adverse selection hides a type, before the deal. Moral hazard hides an action, after it.',
      ),
    );
    expect(got?.left).toBe('Adverse selection');
    expect(got?.right).toBe('moral hazard');
    expect(got?.leftSays).toContain('hides a type');
    expect(got?.rightSays).toContain('hides an action');
    expect(got?.also).toBe('');
  });

  it('keeps what belonged to neither side out of both', () => {
    // "The trap", the mnemonic, the caveat. Put under one column it reads as
    // a fact about that side, which is the wrong reading of every one of them.
    const got = comparison(
      card(
        'Positive vs. normative — and the trap?',
        'Positive is an objective, falsifiable claim; normative is a value judgment. The trap: a positive statement can be wrong and still be positive.',
      ),
    );
    expect(got?.leftSays).not.toContain('The trap');
    expect(got?.rightSays).not.toContain('The trap');
    expect(got?.also).toContain('The trap');
  });

  it('reads the question’s aside as an aside, not as a side', () => {
    const got = comparison(card('Movement along vs. shift — the #1 tested thing?', 'A change in the good’s own price moves you along the curve. A change in anything else shifts the whole curve.'));
    expect(got?.right).toBe('shift');
  });

  it('takes the side even where the other label’s words are in its half', () => {
    // "Economic profit subtracts…" mentions profit, a word from the *other*
    // label, and is plainly the left side. What would make it the right side
    // is opening with it.
    const got = comparison(
      card(
        'Economic vs. accounting profit?',
        'Economic profit subtracts all opportunity costs; accounting profit subtracts only explicit money costs.',
      ),
    );
    expect(got?.leftSays).toContain('Economic profit');
    expect(got?.rightSays).toContain('accounting profit');
  });
});

describe('the comparisons it refuses, which is the harder half', () => {
  /*
   * §3.2's condition is that no unit maps to a layout a reviewer calls
   * forced, so each of these is a `vs.` card in a shipped course that the
   * rule declines — and the reason it declines is the test.
   */
  it('refuses an answer that argues for one side rather than contrasting two', () => {
    expect(
      comparison(card('Total vs. marginal analysis — why does marginal win?', 'Same answer, less arithmetic. Keep going while MB ≥ MC and stop where they cross.')),
    ).toBeNull();
  });

  it('refuses halves named by something other than the two sides', () => {
    expect(
      comparison(card('Shutdown vs. exit rule?', 'Short run: shut down if P < min AVC. Long run: exit if P < min ATC.')),
    ).toBeNull();
  });

  it('refuses two labels that share every word that could tell them apart', () => {
    expect(
      comparison(card('Type I vs. Type II error?', 'Type I is a false positive. Type II is a false negative, usually from too small a sample.')),
    ).toBeNull();
  });

  it('refuses a vs. buried inside a clause rather than asked about', () => {
    expect(
      comparison(card('How does within- vs. between-group variation depend on the trait?', '~90% of skull-shape variation is within groups; ~90% of skin-color variation is between them.')),
    ).toBeNull();
    // The shipped card above is refused one step earlier, by the hyphen in
    // `within-` taking the rest of the question with it as an aside. This one
    // reaches the question-word test, which is the guard being asserted: the
    // left side would otherwise come out as "What is the difference between
    // primary".
    expect(
      comparison(
        card(
          'What is the difference between primary vs. secondary data?',
          'Primary is gathered for your project. Secondary already exists for another purpose.',
        ),
      ),
    ).toBeNull();
  });

  it('will not take the next sentence as the other side merely for being next', () => {
    // The second half has to *name* the second side. Taking whatever follows
    // the first would put "the classic lemons problem" in the moral hazard
    // column, which is a sentence about adverse selection.
    const got = comparison(
      card(
        'Adverse selection vs. moral hazard?',
        'Adverse selection hides a type, before the deal. That is the classic lemons problem. Moral hazard hides an action, after it.',
      ),
    );
    expect(got?.rightSays).toContain('hides an action');
    expect(got?.also).toContain('lemons');
  });

  it('refuses three sides, because two columns would drop one', () => {
    expect(
      comparison(card('Owned vs. earned vs. paid media?', 'Owned — your site and list — compounds. Earned is press, reviews, word of mouth. Paid stops the day you stop paying.')),
    ).toBeNull();
  });

  it('refuses an answer with nothing to split', () => {
    expect(comparison(card('Bias vs. variability?', 'Two different problems.'))).toBeNull();
  });
});

describe('an answer that enumerates', () => {
  it('becomes the list it already was', () => {
    const got = bullets(card('Name the four hurdles, in order.', '1. Is there a credible causal mechanism? 2. Can we rule out that Y causes X? 3. Is there covariation? 4. Have we controlled for confounders Z?'));
    expect(got).toHaveLength(4);
    expect(got?.[0]).toContain('credible causal mechanism');
  });

  it('refuses a calculation, which semicolons would have made three facts', () => {
    // The obvious second rule and the wrong one: drawn as bullets, the three
    // steps of one sum become three unrelated statements.
    expect(bullets(card('Elastic or inelastic?', '%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56 → inelastic.'))).toBeNull();
  });

  it('refuses two items, which is a contrast and has its own layout', () => {
    expect(bullets(card('Two things?', '1. The first thing. 2. The second thing.'))).toBeNull();
  });

  it('refuses a list that does not start at one, because it is not a list', () => {
    // "…in 2. Then 3. And 4." splits into three pieces and is prose with
    // numbers in it. A list a reader is meant to follow begins at its first
    // item.
    expect(bullets(card('Q?', 'It landed in 2. Then 3. And 4. arrived later.'))).toBeNull();
  });
});

describe('a passage from a reading', () => {
  const said = (body: string, source = 'Trounstine, ch. 4') => ({ body, source, title: 'Reading 7' });

  it('is a quotation when it is short enough to be one', () => {
    expect(passage(said('Local politics is not, in any serious sense, a neutral arbiter of competing interests.'))).toBe(true);
  });

  it('is prose when it is a paragraph, whatever its length', () => {
    expect(passage(said('One sentence. Two sentences. Three sentences. And a fourth.'))).toBe(false);
  });

  it('is prose when it is longer than a passage', () => {
    expect(passage(said('x'.repeat(PASSAGE + 1)))).toBe(false);
  });

  it('is prose when nothing says where it came from', () => {
    expect(passage(said('A short sentence worth quoting.', ''))).toBe(false);
  });
});

describe('the deck, over every unit of every shipped course', () => {
  /*
   * §3.2's own condition, run rather than asserted: every unit of the four
   * courses this app ships maps to a layout, and the invariant the deck is
   * built on survives the three new kinds.
   */
  const decks = async () => {
    const mods = await loadSeed();
    return mods.flatMap((m) =>
      m.guide.units.map((u) => ({
        code: m.guide.code,
        name: u.name,
        unit: u,
        slides: deckOf({ unit: u, code: m.guide.code, figures: [], added: [], standing: 'not started' }),
      })),
    );
  };

  it('lands every question before its own answer, still', () => {
    return decks().then((all) => {
      expect(all.length).toBeGreaterThan(40);
      for (const deck of all) {
        for (const [i, slide] of deck.slides.entries()) {
          if (!ANSWERS.includes(slide.kind)) continue;
          const before = deck.slides[i - 1];
          expect(before?.kind, `${deck.code} ${deck.name} slide ${i}`).toBe('q');
          const answered = slide.kind === 'a' || slide.kind === 'compare' || slide.kind === 'bullet' ? slide.q : '';
          expect(before?.kind === 'q' && before.text).toBe(answered);
        }
      }
    });
  });

  it('gives every card exactly one answer slide, of some kind', () => {
    return decks().then((all) => {
      for (const deck of all) {
        const answers = deck.slides.filter((s) => ANSWERS.includes(s.kind));
        expect(answers.length, `${deck.code} ${deck.name}`).toBe(deck.unit.cards.length);
      }
    });
  });

  it('draws twenty comparisons out of the material, and forces none', () => {
    // The measured yield. A number rather than "some", because a rule that
    // quietly stopped firing would otherwise pass this file unchanged — and
    // because the five it refuses are each asserted above by name.
    return decks().then((all) => {
      const found = all.flatMap((d) => d.slides.filter((s) => s.kind === 'compare'));
      expect(found).toHaveLength(20);
      for (const slide of found) {
        if (slide.kind !== 'compare') continue;
        expect(slide.leftSays.length, slide.q).toBeGreaterThan(0);
        expect(slide.rightSays.length, slide.q).toBeGreaterThan(0);
        expect(slide.leftSays).not.toBe(slide.rightSays);
      }
    });
  });

  it('draws the one enumerated answer the shipped material has', () => {
    // One card in 279, and that is the honest yield: this material is written
    // as prose. §3.2 expected more of it.
    return decks().then((all) => {
      const found = all.flatMap((d) => d.slides.filter((s) => s.kind === 'bullet'));
      expect(found).toHaveLength(1);
    });
  });

  it('opens on a title and closes on the end, every time', () => {
    return decks().then((all) => {
      for (const deck of all) {
        expect(deck.slides[0].kind).toBe('title');
        expect(deck.slides[deck.slides.length - 1].kind).toBe('end');
      }
    });
  });
});

describe('the deck a reading has been added to', () => {
  const one = unit([card('A question?', 'An answer.')]);

  it('quotes a passage and prints prose as prose', () => {
    const made = deckOf({
      ...cut(one),
      added: [
        { body: 'A short sentence worth quoting.', source: 'Trounstine', title: 'Reading 7' },
        { body: `A paragraph. ${'Another sentence. '.repeat(20)}`, source: 'Trounstine', title: 'Reading 8' },
      ],
    });
    const kinds = made.map((s) => s.kind);
    expect(kinds).toContain('quote');
    expect(kinds).toContain('note');
  });

  it('never puts an added reading before the cards it belongs to', () => {
    const made: Slide[] = deckOf({ ...cut(one), added: [{ body: 'Short.', source: 'S', title: 'T' }] });
    expect(made.findIndex((s) => s.kind === 'quote' || s.kind === 'note')).toBeGreaterThan(
      made.findIndex((s) => s.kind === 'a'),
    );
  });
});

describe('a course the app generated', () => {
  /*
   * §3.2 asks for "one generated test course" alongside the four shipped
   * ones. A generated course is not a different kind of course to this file:
   * `lib/generate.ts:463` says figures, examples and audio belong to a course
   * built by hand, so what a generated one brings here is units and cards and
   * nothing else — which is exactly the shape every assertion above already
   * runs against, since they all pass `figures: []`.
   *
   * What is worth asserting separately is that the deck is still whole
   * without them: a unit with no figure and no reading is the commonest deck
   * in a generated course and must not come out as a title and an end.
   */
  it('makes a whole deck out of units and cards alone', () => {
    const made = deckOf(
      cut(
        unit([
          card('What is a currency board?', 'A hard peg with full reserve backing.'),
          card('Fixed vs. floating?', 'Fixed pins the rate to an anchor. Floating lets the market set it.'),
        ]),
      ),
    );
    expect(made.map((s) => s.kind)).toEqual(['title', 'q', 'a', 'q', 'compare', 'end']);
  });

  it('still lands the question first when the answer is drawn as two columns', () => {
    const made = deckOf(cut(unit([card('Fixed vs. floating?', 'Fixed pins the rate to an anchor. Floating lets the market set it.')])));
    const at = made.findIndex((s) => s.kind === 'compare');
    expect(made[at - 1].kind).toBe('q');
  });
});
