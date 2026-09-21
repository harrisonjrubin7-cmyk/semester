// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../state/store';
import type { QuizQuestion } from '../state/store';
import { loadSeed } from '../data/seed';
import { Quiz } from './Drill';

/**
 * The three kinds of quiz question, drawn.
 *
 * `lib/quiz.test.ts` proves what the builder makes; this proves the screen
 * knows what to do with it. They are different failures: a true-or-false with
 * its claim missing, or a matching question whose definitions never appear,
 * is a correct question nobody can answer.
 *
 * The questions are fixtures rather than a built run, for two reasons. A run
 * is seeded, so pinning one means a test that changes subject whenever the
 * generator does; and `screens/deadends.test.tsx` shows the other problem —
 * it mounts this same screen with no catalogue behind it and gets the empty
 * state, so its "puts answers on screen to press" has been passing on an
 * "Open the guide" button for as long as it has existed. `startQuiz` puts
 * questions in the store directly and needs no catalogue at all.
 */

const CHOICE: QuizQuestion = {
  kind: 'choice',
  q: 'What does elasticity measure?',
  unit: 'Unit 2',
  full: 'How much quantity responds to a change in price.',
  opts: [
    { text: 'How much quantity responds to a change in price.', ok: true },
    { text: 'The slope of the supply curve at the origin.', ok: false },
    { text: 'Total revenue divided by quantity sold.', ok: false },
    { text: 'The sum of squared market shares.', ok: false },
  ],
};

const TRUE_FALSE: QuizQuestion = {
  kind: 'truefalse',
  q: 'What does elasticity measure?',
  unit: 'Unit 2',
  full: 'How much quantity responds to a change in price.',
  claim: 'The sum of squared market shares.',
  opts: [
    { text: 'True', ok: false },
    { text: 'False', ok: true },
  ],
};

const MATCH: QuizQuestion = {
  kind: 'match',
  q: 'Match each term to its definition.',
  unit: 'Key terms',
  full: 'Elasticity — Responsiveness.\nHHI — Squared shares.',
  opts: [],
  pairs: [
    { left: 'Elasticity', right: 'Responsiveness.' },
    { left: 'HHI', right: 'Squared shares.' },
  ],
  shown: [1, 0],
};

let host: HTMLElement;
let root: Root;

beforeAll(async () => {
  // See the note in `screens/deadends.test.tsx`: the store's own seed import
  // is a promise in flight when the file ends unless it is already resolved.
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* The last root would otherwise outlive the file. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Mount the quiz screen with exactly these questions in the store. */
function ask(quiz: QuizQuestion[]) {
  function Harness() {
    const { dispatch } = useStore();
    useEffect(() => {
      dispatch({ type: 'startQuiz', quiz });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <Quiz />;
  }
  act(() => {
    root.render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
  });
}

const buttons = () => [...host.querySelectorAll('button')];
const press = (b: Element) =>
  act(() => b.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const named = (text: string) =>
  buttons().find((b) => (b.textContent ?? '').trim().startsWith(text));

describe('a true-or-false question', () => {
  it('draws the claim being judged, not only the question', () => {
    ask([TRUE_FALSE]);
    // Without this the student is asked "true or false" about nothing.
    expect(host.textContent).toContain('The sum of squared market shares.');
    expect(host.textContent).toContain('The answer given');
  });

  it('offers two options and no more', () => {
    ask([TRUE_FALSE]);
    expect(named('True')).toBeTruthy();
    expect(named('False')).toBeTruthy();
  });

  /*
   * No hint on a true-or-false, because every rung the ladder has for one
   * gives the answer away.
   *
   * `ladderFor` does not refuse these — measured, it returns `term` and
   * `opening` on the true-or-false fixture below. The `opening` rung says how
   * the *real* answer starts, and the whole question is whether the answer on
   * screen is the real one, so that single press decides it. `narrow` is the
   * rung that would strike an option, and with two options striking one is
   * the answer outright.
   *
   * Every label is checked, not one. The first version of this test looked
   * for the word "hint", which appears nowhere on this screen, and the second
   * looked only for "Take one away" — the one label a two-option question can
   * never produce. Both passed against a build with the refusal taken out.
   * `lib/ladder.ts:nextRungLabel` is where these three strings live.
   */
  const HINTS = ['Take one away', 'Take another away', 'What is this about?', 'How does it start?'];

  it('offers no hint of any kind, because each one would give it away', () => {
    ask([TRUE_FALSE]);
    for (const label of HINTS) expect(host.textContent, label).not.toContain(label);
    // The control: the same screen, the same harness, does offer one on a
    // multiple choice. Without it this cannot tell "refused" from "there were
    // never any rungs here".
    ask([CHOICE]);
    expect(HINTS.some((label) => host.textContent?.includes(label))).toBe(true);
  });

  it('reveals the real answer, which is not the claim it proposed', () => {
    ask([TRUE_FALSE]);
    press(named('False')!);
    expect(host.textContent).toContain('How much quantity responds to a change in price.');
  });
});

describe('a matching question', () => {
  it('draws every term and every definition', () => {
    ask([MATCH]);
    for (const text of ['Elasticity', 'HHI', 'Responsiveness.', 'Squared shares.']) {
      expect(host.textContent, text).toContain(text);
    }
  });

  it('says which terms are still unmatched', () => {
    ask([MATCH]);
    expect(host.textContent).toContain('Not matched yet');
  });

  it('joins a term to a definition in two taps, and marks when the last lands', () => {
    ask([MATCH]);
    press(named('Elasticity')!);
    press(buttons().find((b) => (b.textContent ?? '').includes('Responsiveness.'))!);
    press(named('HHI')!);
    press(buttons().find((b) => (b.textContent ?? '').includes('Squared shares.'))!);
    // The key appears only once the question is answered.
    expect(host.textContent).toContain('The pairs');
  });

  it('takes the definitions away once the question is marked', () => {
    ask([MATCH]);
    expect(host.textContent).toContain('The definitions');
    press(named('Elasticity')!);
    press(buttons().find((b) => (b.textContent ?? '').includes('Responsiveness.'))!);
    press(named('HHI')!);
    press(buttons().find((b) => (b.textContent ?? '').includes('Squared shares.'))!);
    expect(host.textContent).not.toContain('The definitions');
  });
});

/**
 * The answer, once it is the answer, is not drawn in the faintest ink there is.
 *
 * Every option is `disabled` the moment one is picked, and `.bare:disabled` in
 * `styles/app.css` paints a disabled control `--app-faint`. That is the right
 * rule for a control nobody can press and the wrong one here: being disabled
 * is exactly when an option stops being a control and becomes the thing the
 * student is there to read. Measured in Chromium at rgba(236,238,242,.42) on
 * the ticked, accent-washed correct option — and `lib/contrast.test.ts`
 * records that same fade measuring *under* its own 3:1 bar on five grounds.
 *
 * Asserted on the inline style rather than on `getComputedStyle`, because
 * jsdom does not load `app.css` and would report the cascade empty either way
 * — which is also exactly what a broken probe reports.
 */
describe('the revealed answer', () => {
  for (const [what, question] of [
    ['a multiple choice', CHOICE],
    ['a true-or-false', TRUE_FALSE],
  ] as const) {
    it(`is given a colour of its own on ${what}`, () => {
      ask([question]);
      press(buttons().find((b) => !b.disabled && (b.textContent ?? '').length > 3)!);
      const off = buttons().filter((b) => b.disabled);
      expect(off.length).toBeGreaterThan(0);
      for (const button of off) {
        const span = button.querySelector('span:last-child') as HTMLElement | null;
        // A span carrying no colour at all would pass a "not faint" check
        // while inheriting precisely the fade being guarded against.
        expect(span?.style.color, button.textContent ?? '').toBeTruthy();
        expect(span?.style.color).not.toContain('faint');
      }
    });
  }
});
