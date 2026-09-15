// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { Grades } from './Grades';

/**
 * A course whose weights could not be read must not claim to be finished.
 *
 * `standing` reports `remaining` as `total - counted`, which is nought in two
 * unrelated situations: every weighted row has a score, and no row is weighted
 * at all. The screen read the second as the first, so CORE 2500 — whose
 * syllabus states points beside an attendance row stating neither points nor a
 * percentage, which `asWeights` refuses to convert on a guess — drew
 * "Everything is in" beside "Nothing graded yet", over its own rows showing
 * two of four with no score at all.
 *
 * Mounted rather than grepped for the reason `directory.test.tsx` gives: the
 * line is a ternary inside a conditional, and a static check would pass on a
 * file that still renders the wrong branch.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  // Two of CORE's four rows scored, in the points its syllabus uses, and both
  // ECON rows scored so the card that *is* finished still says so.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      grades: { 'core:0': '68 pts', 'core:1': '112 pts', 'econ:0': '88%', 'econ:1': '83' },
    }),
  );
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
  // Async: the store hydrates from storage after mount, and the sample term's
  // courses are what this screen draws.
  await act(async () => {
    root.render(<StoreProvider>{<Grades />}</StoreProvider>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

describe('a course the app could not weight', () => {
  it('marks its rows unweighted rather than pretending to a figure', () => {
    expect(text()).toContain('not weighted');
  });

  it('says the weights add to nothing, and that rows are marked', () => {
    expect(text()).toContain('yours add to 0%');
  });

  it('keeps the scores the student typed, in the notation they typed them in', () => {
    const boxes = [...host.querySelectorAll('input')].map((i) => i.value);
    expect(boxes).toContain('68 pts');
    expect(boxes).toContain('112 pts');
  });
});

describe('"Everything is in"', () => {
  /** The screen as one string per course, since every card draws the phrase. */
  const sections = () => {
    const parts = text().split(/(?=ECON 1020|PSCI 1104|CORE 2500|BUS 1600)/);
    const of = (code: string) => parts.filter((p) => p.startsWith(code)).join(' ');
    return { econ: of('ECON 1020'), core: of('CORE 2500'), bus: of('BUS 1600') };
  };

  it('is said of the course that really is in', () => {
    // ECON: both weighted rows scored, so nought remaining means finished.
    // Twice, and correctly — the line beside the figure, and `lib/worth.ts`
    // saying what it finishes at.
    expect(sections().econ).toContain('Everything is in');
  });

  it('is not said of the course whose weights could not be read', () => {
    // The bug: CORE's `remaining` is nought because nothing is weighted, not
    // because everything is scored — and its own rows show two of four empty.
    expect(sections().core).not.toContain('Everything is in');
  });

  it('still says what it can about that course rather than going blank', () => {
    expect(sections().core).toContain('Nothing graded yet');
  });

  it('leaves the ordinary unscored course alone', () => {
    // BUS has readable weights and no scores: a hundred per cent to play for
    // is the right answer, and this change must not have touched it.
    expect(sections().bus).toContain('100% still to play for');
  });
});
