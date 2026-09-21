// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Proposal } from './ScoreShot';
import { categoryFor, scoresIn, type Found } from '../lib/readout';
import { COMMON_LETTER } from '../lib/cutoffs';

/**
 * Choosing a number off a photographed screen, and saying where it goes.
 *
 * `lib/readout.test.ts` proves what is read out of a transcript. This proves
 * what happens to it afterwards — that a candidate can be chosen, that a
 * category has to be agreed, and that nothing reaches the grade a student is
 * projecting from until both have happened.
 *
 * It drives `Proposal` rather than `ScoreShot`, and that is the reason the two
 * are separate. `ScoreShot` owns a camera, and jsdom has no canvas to prepare
 * a shot with — so a test of the whole thing could only ever press the file
 * input and assert that nothing happened, which is what a broken probe does
 * too. `Proposal` takes candidates, which a test can hand it honestly.
 */

/** The transcript a Top Hat page would give, read the way the app reads it. */
const TOP_HAT = scoresIn(
  `Top Hat
PSCI 1104 — Section 01
Join code 782449
Top Hat participation 92%
Attendance 13/14`,
  COMMON_LETTER,
);

const CATEGORIES = ['Problem sets', 'Exams — best of three', 'Top Hat participation'];

let host: HTMLElement;
let root: Root;
let filed: { index: number; value: string }[];

beforeAll(async () => {
  // See `screens/deadends.test.tsx`: the store's own seed import is a promise
  // still in flight when the file ends unless it has already resolved.
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  filed = [];
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/**
 * The state `ScoreShot` holds, held here instead.
 *
 * Not a re-implementation: `choose` is the same two lines the real one runs —
 * take the candidate, ask `categoryFor` where it goes — and keeping them
 * together is the point, since a harness that pre-selected the category itself
 * would test the chips and not the matching.
 */
function Harness({ found }: { found: Found[] }) {
  const [picked, setPicked] = useState<Found | null>(null);
  const [where, setWhere] = useState<number | null>(null);
  return (
    <Proposal
      found={found}
      categories={CATEGORIES}
      picked={picked}
      where={where}
      onChoose={(f) => {
        setPicked(f);
        setWhere(categoryFor(f.line, CATEGORIES));
      }}
      onWhere={setWhere}
      onFile={() => {
        if (picked && where !== null) filed.push({ index: where, value: picked.saw });
      }}
    />
  );
}

const show = (found: Found[] = TOP_HAT) => {
  // The chips and the button reach for the store, so the panel needs one even
  // though nothing it does is about state the store holds.
  act(() =>
    root.render(
      <StoreProvider>
        <Harness found={found} />
      </StoreProvider>,
    ),
  );
};

const buttons = () => [...host.querySelectorAll('button')];

/*
 * Three kinds of button on this panel, and two of them can read the same.
 *
 * A candidate row shows the line it came from, so the candidate for
 * "Top Hat participation 92%" contains the text of the chip called "Top Hat
 * participation". A substring match found the row and pressed that instead,
 * and the test failed one assertion later on a button that was never going to
 * be there. So each kind is addressed by what only it has.
 */
const candidate = (saw: string) =>
  buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${saw}, from the line`));
const chip = (label: string) =>
  buttons().find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim() === label);
const named = (text: string) =>
  buttons().find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').includes(text));
const press = (b: Element | undefined) => {
  expect(b, 'no button like that on screen').toBeTruthy();
  act(() => b!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

describe('the candidates', () => {
  it('offers every number the transcript really held', () => {
    show();
    // The control on the fixture: the page has two scores on it and a join
    // code, and a run that offered one or three would mean this whole file
    // was testing the wrong thing.
    expect(TOP_HAT.map((f) => f.saw)).toEqual(['92%', '13/14']);
    expect(text()).toContain('92%');
    expect(text()).toContain('13/14');
  });

  it('shows the line each one came from, which is what tells them apart', () => {
    show();
    expect(text()).toContain('Top Hat participation 92%');
    expect(text()).toContain('Attendance 13/14');
  });

  it('names each candidate for a reader, number and line together', () => {
    show();
    const labels = buttons().map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('92%, from the line Top Hat participation 92%');
  });
});

describe('choosing one', () => {
  it('marks it chosen, and only it', () => {
    show();
    press(candidate('92%'));
    // Among the candidates only. The category chips carry `aria-pressed` too,
    // and the one this proposes is pressed on purpose.
    const rows = buttons().filter((b) => (b.getAttribute('aria-label') ?? '').includes('from the line'));
    const on = rows.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toContain('92%');
  });

  it('proposes the category its line names', () => {
    show();
    press(candidate('92%'));
    // "Top Hat participation 92%" against a category called exactly that.
    expect(named('File 92% there')).toBeTruthy();
  });

  it('proposes nothing where the line names no category, and says so', () => {
    show();
    press(candidate('13/14'));
    // "Attendance 13/14" matches none of the three — and the button says what
    // is missing rather than sitting there disabled and silent.
    expect(text()).toContain('this is yours to say');
    expect(named('Pick a category')).toBeTruthy();
  });
});

describe('filing it', () => {
  it('files the number against the category, exactly as it was written', () => {
    show();
    press(candidate('13/14'));
    press(chip('Top Hat participation'));
    press(named('File 13/14 there'));
    // "13/14", not "92.857" — `components/ScoreField.tsx` reads the fraction
    // the same way it reads a typed one, and the student sees what they
    // photographed when they open the field later.
    expect(filed).toEqual([{ index: 2, value: '13/14' }]);
  });

  it('files nothing at all until a category has been agreed', () => {
    show();
    press(candidate('13/14'));
    const button = named('Pick a category');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    press(button);
    expect(filed).toEqual([]);
  });

  it('files nothing before a candidate is chosen either', () => {
    show();
    // Nothing to file, so there is nothing to file it with: the whole panel
    // is absent until a number is picked.
    expect(named('Pick a category')).toBeFalsy();
    expect(named('File')).toBeFalsy();
    expect(filed).toEqual([]);
  });

  it('lets a proposed category be overruled', () => {
    show();
    press(candidate('92%'));
    // It proposed Top Hat participation. The student says Problem sets.
    press(chip('Problem sets'));
    press(named('File 92% there'));
    expect(filed).toEqual([{ index: 0, value: '92%' }]);
  });
});
