// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { Essay } from './Essay';
import type { CourseModule } from '../lib/types';

/**
 * "Record the policy" edits the course the picker names.
 *
 * Essay has its own course picker — `useState` at `Essay.tsx:59`, nothing to
 * do with the store — because the question it asks is *which course is this
 * essay for*, which is not the same as which course you last opened. Under it
 * sits that course's recorded AI policy, and a button to go and set it.
 *
 * The button dispatched `openGuide`, and `openGuide` sets `guideId`.
 * `EditCourse.tsx:43` reads `state.courseId`. So the two halves named
 * different pointers, and nothing connected them:
 *
 *     pick PSCI 1104 → "Record the policy" → Edit the course, editing ECON 1020
 *
 * Silent, and worse than a wrong screen: what you type is a course's AI
 * policy, and it is recorded against whichever course the store happened to
 * be holding. A student reading the Honor Code section of one syllabus writes
 * it onto another.
 *
 * ## Why a test rather than a careful read
 *
 * The seventeenth simplify pass found this by asking of every `go` to `edit`
 * whether it was a front door or an action on a thing you were already
 * holding. Six of the seven carried a course. This one meant to and did not,
 * which is invisible from the call site — `openGuide(course.id)` reads
 * exactly like carrying the course, and the id it passes is even correct.
 * Only the destination knows it reads a different field.
 *
 * Two cases, because one would not be evidence. The first fails against the
 * old line; the second fails against a "fix" that always pushed the picker's
 * course, whether or not you pressed anything, which would make the button a
 * side effect of rendering the screen.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A course of the student's own — `editable` is what draws the button. */
function own(id: string, code: string): CourseModule {
  return {
    course: {
      id,
      code,
      name: `${code} by hand`,
      prof: '',
      email: '',
      meets: '',
      room: '',
      credits: '',
      source: '',
      grading: [],
    },
    items: [],
    schedule: [],
    guide: { code, name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
    planMinutes: '45 min',
    frameLabel: 'Frames',
  };
}

const FIRST = own('aaa', 'AAA 1000');
const SECOND = own('bbb', 'BBB 2000');

/*
 * The sample, awaited once — `seedawait.test.ts` holds every store-mounting
 * file to this and explains why: `StoreProvider` starts the fetch and does not
 * await it, so a promise still in flight at teardown fails against whichever
 * file happens to be running. `loadSeed` caches, so this costs one resolve.
 * These cases seed `sample: false` and never read it; the rule is about the
 * fetch being started, not about the courses being used.
 */
beforeAll(async () => {
  await loadSeed();
});

let host: HTMLDivElement;
let root: Root;

/**
 * Reads the pointer `EditCourse` reads, so the assertion is the real one.
 *
 * `data-probe` rather than a bare `span`: Essay draws its own spans — each
 * use option is a label and a blurb in two of them — and the first draft of
 * this file read `querySelector('span')`, which found Essay's and reported
 * every pointer as `null`. A probe that can be shadowed by the thing it is
 * measuring is not a probe.
 */
function Open() {
  const { state } = useStore();
  return <span data-probe data-course={state.courseId} data-screen={state.screen} />;
}

const probe = () => host.querySelector('[data-probe]');
const openCourse = () => probe()?.getAttribute('data-course');
const screen = () => probe()?.getAttribute('data-screen');

beforeEach(() => {
  /*
   * The address bar, cleared.
   *
   * `store.tsx` reads `fromHash(window.location.hash)` on mount once
   * onboarding is behind you — that is the whole mechanism of `#513` — and
   * pressing the button under test writes `#/edit` into it. jsdom keeps one
   * `location` for the file, so the second case mounted a fresh store that
   * read the *first* case's address and came up on `edit` before it had
   * pressed anything. It passed alone and failed after its neighbour, which
   * is the shape `npm run test:shuffle` exists to catch; stating the
   * precondition is cheaper than depending on the order.
   */
  window.location.hash = '';
  /* The sample off, so the catalogue is exactly these two and the picker's
   * order is not a fact about `data/seed.ts`. */
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      courses: [FIRST, SECOND],
    }),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

function show() {
  act(() => {
    root.render(
      <StoreProvider>
        <Essay />
        <Open />
      </StoreProvider>,
    );
  });
}

/**
 * Essay opens on "What is this for", and the course picker is behind the one
 * answer that is coursework — `u.coursework`, which is the `For a class`
 * option in `lib/essay.ts`. Without this the screen has no `select` at all,
 * which is how the first draft of this file failed: not on the bug, but on
 * its own setup, reporting "no course picker on Essay".
 */
function forAClass() {
  press(/for a class/i);
}

/** Choose a course in Essay's own picker, the way a person does. */
function pick(id: string) {
  const select = host.querySelector('select');
  if (!select) throw new Error('no course picker on Essay');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, id);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function press(named: RegExp) {
  const button = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!button) {
    const saw = [...host.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
    throw new Error(`no button reading ${named} — saw ${JSON.stringify(saw)}`);
  }
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

describe('recording an AI policy from Essay', () => {
  it('opens the course the picker names, not the one already open', () => {
    show();
    forAClass();
    // The store settles on the first course; the picker is moved off it, so
    // the two pointers disagree and the bug has somewhere to show.
    expect(openCourse()).toBe('aaa');

    pick('bbb');
    press(/record the policy|change what is recorded/i);

    expect(openCourse()).toBe('bbb');
    expect(screen()).toBe('edit');
  });

  it('does not move the open course until the button is pressed', () => {
    // The control. A fix that pushed the picker's course on every render
    // would pass the case above and quietly rewrite the open course for
    // anybody who merely visited Essay.
    show();
    forAClass();
    pick('bbb');

    expect(openCourse()).toBe('aaa');
    expect(screen()).not.toBe('edit');
  });
});
