// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { FirstRun } from './FirstRun';
import { Import } from './Import';
import { configured } from '../lib/assistant';

/**
 * A fresh install with no key, and whether there is a way to add a course.
 *
 * A sweep of all sixty destinations in the deployed app found this and put it
 * first: onboarding's own instruction is "add a course → upload a syllabus",
 * and on a fresh install that is the one action that is blocked. Everything
 * the student can see is populated — the four sample courses fill Today,
 * Courses, Study and Calendar — so the gate is invisible until the moment
 * they try to add the course the app is for.
 *
 * The screens are not lying about the gate. `generateCourse` needs a key and
 * says so. What was wrong is narrower and worse: `ByHand` on the import
 * screen has needed no key since it was written, and nothing pointed at it.
 *
 * Half of that has since been answered on `main`, by the commit that moved
 * the gate into the build button's place — its `NO_KEY_HERE` names this door
 * in words. What is left is the two places the words do not reach: the
 * first-run screen, which still offers a syllabus card and a sample
 * semester and nothing else, and the door itself, which the sentence points
 * at while it is still a 12.5px link at 0.65 opacity.
 *
 * ## Why this is mounted rather than read
 *
 * Because what broke is a pair across two files, and each half looks right on
 * its own. The first-run screen promises a form on the next screen; the form
 * is there only because `ByHand` opens itself when `configured()` is false.
 * Either half can be reverted with the other still in place, and the reading
 * of the source stays plausible — a `useState(false)` in `ByHand` is not
 * obviously a bug next to a card that says "add a course by hand".
 *
 * So both halves are mounted, and both directions are checked: with no key
 * the route is on screen, and with a key nothing moves, because the syllabus
 * is the better route and a second card beside it is a choice for nobody.
 * The keyed cases are the control — a probe that found "no key needed" on
 * every install would read exactly the same as this one on the half that
 * matters.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

/** Everything on screen a person could press, by the name they would read. */
function pressable(): string[] {
  return [...host.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
}

/** Whether the by-hand field itself is on screen — not a link promising it. */
function byHandField(): boolean {
  return host.querySelector('[aria-label="Add a course by hand"]') !== null;
}

/**
 * A key on this device, the way the settings screen leaves one.
 *
 * `configured()` answers from `localStorage` under this one name, so a test
 * that wants the keyed install writes it and a test that wants the fresh one
 * writes nothing — `beforeEach` clears it. Asserted rather than assumed,
 * below: an env proxy in `app/.env.local` would make `configured()` true for
 * every case here and quietly turn half this file into a tautology.
 */
function keyIt() {
  localStorage.setItem('semester.claude.v1', JSON.stringify({ apiKey: 'sk-ant-test' }));
}

// See `screens/deadends.test.tsx` — the store pulls the shipped courses in
// with a dynamic import it does not await, and a promise still in flight when
// the file ends fails the run on teardown rather than on an assertion.
beforeAll(async () => {
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

// No root outlives the test that made it. See `src/rootunmount.test.ts`.
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the probe itself', () => {
  it('is looking at an install that really has no key', () => {
    // If this fails, every "with no key" case below is running keyed and
    // proves nothing. `VITE_CLAUDE_PROXY` is the usual reason.
    expect(configured()).toBe(false);
  });

  it('and can make one that has', () => {
    keyIt();
    expect(configured()).toBe(true);
  });
});

describe('the first-run screen, with no key', () => {
  it('offers a way in that is not the syllabus and not the sample', () => {
    show(<FirstRun />);
    expect(pressable().join(' | ')).toMatch(/by hand/i);
  });

  it('says what the syllabus route needs, rather than leaving it to be found', () => {
    show(<FirstRun />);
    expect(host.textContent).toMatch(/sign in to use the shared key/i);
  });

  it('still leads with the syllabus, which is the product', () => {
    show(<FirstRun />);
    expect(host.textContent).toContain('Add your first course');
  });
});

describe('the first-run screen, with a key', () => {
  it('does not offer the by-hand card, because the syllabus is better', () => {
    keyIt();
    show(<FirstRun />);
    expect(pressable().join(' | ')).not.toMatch(/by hand/i);
  });

  it('and does not explain a gate that is not there', () => {
    keyIt();
    show(<FirstRun />);
    expect(host.textContent).not.toMatch(/sign in to use the shared key/i);
  });
});

describe('the import screen, with no key', () => {
  it('has the by-hand field on screen, not behind a link', () => {
    show(<Import />);
    expect(byHandField()).toBe(true);
  });

  it('still gates the upload, which is the thing that needs the key', () => {
    // The control on the other side: a screen that stopped gating would pass
    // every assertion above for the wrong reason.
    show(<Import />);
    expect(host.textContent).toMatch(/Needs /);
  });

  it('keeps the promise the gate makes, rather than only making it', () => {
    // `NO_KEY_HERE` names this door — "adding a course by hand … needs no
    // key at all". That sentence and the field's default are one thing: the
    // prose landed separately, and either half alone is worse than neither.
    // A sentence pointing at a 12.5px link is small print about small print.
    show(<Import />);
    expect(host.textContent).toMatch(/by hand[^.]*needs no key/i);
    expect(byHandField()).toBe(true);
  });

  it('does not take the caret for a field nobody asked for', () => {
    // Opened by default, the field must not `autoFocus` — that pulls the
    // cursor off a screen headed "Upload it. Walk away." before it has been
    // read, and raises a phone keyboard over the drop box. Found in a
    // screenshot of this change, not by the suite, which is why it is here.
    show(<Import />);
    expect(byHandField()).toBe(true);
    expect(document.activeElement).not.toBe(host.querySelector('[aria-label="Add a course by hand"]'));
  });
});

describe('the import screen, with a key', () => {
  it('keeps by-hand as the quiet aside it was', () => {
    keyIt();
    show(<Import />);
    expect(byHandField()).toBe(false);
    expect(pressable().join(' | ')).toMatch(/add a course by hand, with no syllabus/i);
  });

  it('and still hands the caret over when the link is pressed', () => {
    keyIt();
    show(<Import />);
    const link = [...host.querySelectorAll('button')].find((b) =>
      /add a course by hand, with no syllabus/i.test(b.textContent ?? ''),
    )!;
    act(() => {
      (link as HTMLButtonElement).click();
    });
    expect(document.activeElement).toBe(host.querySelector('[aria-label="Add a course by hand"]'));
  });
});
