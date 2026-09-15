// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Quiz } from './Drill';
import { Mine, NoteEditor } from './Mine';
import { Mail } from './Mail';
import { Degree } from './Degree';
import { Applying } from './Applying';
import { People } from './People';

/**
 * The screens somebody can arrive at cold, and whether there is a way on.
 *
 * `lib/route.ts` gives every screen an address so that a refresh, a bookmark
 * and a link somebody sent all work. The cost of that promise is that every
 * one of those addresses can be opened with nothing behind it — the app is
 * started at it, rather than walked to it — and two of them used to answer
 * with a line of grey text and no control of any kind:
 *
 *   - `#/quiz/econ` is written into the address bar the moment a quiz starts,
 *     but the ten questions are ephemeral. Refreshing, or reopening the
 *     installed app, left "Building the quiz…" on screen forever.
 *   - `#/note/<id>` outlives the note. Deleting one and reopening it from
 *     history said "Note not found." and stopped there.
 *
 * A dead end is invisible in a screenshot and easy to reintroduce, because
 * both are the *absence* of something. So the test is the crude, honest one:
 * mount the screen with nothing behind it and count the things you can press.
 */

// React asks to be told that a test is driving it, so `act` can flush what a
// browser would have flushed on its own.
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

/**
 * Press the button whose name matches, the way a reader would find it.
 *
 * By name rather than by index, and case-insensitively, because every run of
 * capitals in this app is `text-transform` — the DOM holds sentence case, so
 * an exact match on what a screenshot shows finds nothing.
 */
function press(named: RegExp) {
  const button = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!button) throw new Error(`no button reading ${named} — saw ${JSON.stringify(pressable())}`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

/** The field with this label, which is the name a screen reader reads out. */
function field(label: string): HTMLInputElement {
  const el = host.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`no field labelled “${label}”`);
  return el as HTMLInputElement;
}

/** Type into it the way a person does — React listens for `input`, not `value`. */
function type(label: string, text: string) {
  const el = field(label);
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** And then press a key in it. */
function key(label: string, name: string) {
  const el = field(label);
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

/*
 * The sample semester, fetched before anything renders.
 *
 * `StoreProvider` pulls the four shipped courses in with a dynamic import and
 * does not await it — right, in an app, where the screen fills in when they
 * land. In a test it is a promise still in flight when the file ends, and
 * Vitest tears the environment down underneath it: every assertion passes and
 * the run still exits non-zero on `EnvironmentTeardownError`. Intermittently,
 * which is the worst version — it depends on whether the import happens to
 * resolve first.
 *
 * `loadSeed` caches its promise, so awaiting it once here means the store's
 * own call is already resolved by the time it makes it, and there is nothing
 * outstanding to tear down. `lib/transcript.test.ts` awaits it for its own
 * reasons; this is the same call.
 */
beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  if (root) act(() => root.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

describe('arriving at the quiz cold', () => {
  it('builds a quiz rather than waiting for one that is never coming', () => {
    show(<Quiz />);
    // The wording is what somebody stared at for the length of a refresh.
    expect(host.textContent).not.toContain('Building the quiz…');
  });

  it('puts answers on screen to press', () => {
    show(<Quiz />);
    expect(pressable().length).toBeGreaterThan(0);
  });
});

describe('arriving at a note that is gone', () => {
  it('says so in words, rather than as a fault', () => {
    show(<NoteEditor />);
    expect(host.textContent).toContain('That note is gone');
  });

  it('offers the way back to the notes', () => {
    show(<NoteEditor />);
    expect(pressable()).toContain('Open Notes');
  });
});

/**
 * The key that ends typing, on the boxes that ask you to type.
 *
 * Both add boxes on this screen open with the cursor already in a single-line
 * field — they autofocus it — and then ignored Return. The row that *edits* a
 * task has always taken it, so one screen answered the same key two ways
 * depending on whether the task was new. See `submitOnEnter` in `Mine.tsx`.
 */
describe('the add boxes on Mine', () => {
  const open = (named: RegExp) => {
    show(<Mine />);
    press(named);
  };

  it('adds the task on Return, without reaching for the button', () => {
    open(/new task/i);
    type('Task', 'Office hours with Stromme');
    key('Task', 'Enter');
    expect(host.textContent).toContain('Office hours with Stromme');
  });

  it('closes the box on Return, so the next thing typed is not appended to it', () => {
    open(/new task/i);
    type('Task', 'Office hours with Stromme');
    key('Task', 'Enter');
    expect(host.querySelector('[aria-label="Task"]')).toBeNull();
  });

  it('throws the box away on Escape, and keeps nothing from it', () => {
    open(/new task/i);
    type('Task', 'discard me');
    key('Task', 'Escape');
    expect(host.querySelector('[aria-label="Task"]')).toBeNull();
    expect(host.textContent).not.toContain('discard me');
  });

  it('takes Return on the appointment box too, which is the same form', () => {
    show(<Mine />);
    press(/^events$/i);
    press(/new appointment/i);
    type('Appointment', 'Advisor meeting');
    key('Appointment', 'Enter');
    expect(host.textContent).toContain('Advisor meeting');
  });
});

/**
 * A control that looks like it works and does nothing is the same dead end,
 * reached from the other side.
 *
 * `#/quiz` and `#/note` above are screens with nothing behind them. This is a
 * screen that renders fine and offers one control that cannot do its job:
 * Mail's refresh, with no mailbox connected. `pull` opens with
 * `if (accounts.length === 0) return`, which is correct — there is nothing to
 * ask — and the button stayed enabled and silent, so pressing it was
 * indistinguishable from the app being broken.
 *
 * Found by clicking every visible control on every screen and recording which
 * ones changed nothing at all; this is the one that was not a tab already on,
 * a download, or a browser permission the container refuses.
 */
describe('a control that cannot do its job', () => {
  // jsdom has no layout, so `matchMedia` is absent and `useMedia` throws on
  // the first render. The same stub `Calendar.keyboard.test.tsx` uses.
  beforeEach(() => {
    window.matchMedia = (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  });

  it('turns Mail\u2019s refresh off while there is no account to check', () => {
    show(<Mail />);
    const refresh = host.querySelector('[aria-label="Check for new mail"]') as HTMLButtonElement | null;
    expect(refresh, `no refresh control — saw ${JSON.stringify(pressable())}`).not.toBeNull();
    expect(refresh!.disabled).toBe(true);
    // And it says why on the control, rather than only in the empty state
    // three inches below it.
    expect(refresh!.title).toMatch(/connect an account/i);
  });

  it('still offers the two things that do work without one', () => {
    show(<Mail />);
    // Writing an email needs no mailbox, and connecting one is the way out.
    expect(pressable().join(' | ')).toMatch(/compose/i);
    expect(host.textContent).toMatch(/no account connected/i);
  });

  /*
   * The same shape, three more times: a handler that opens with a guard and a
   * button that did not carry it.
   *
   *   Degree     `if (!code.trim()) return`
   *   Degree     `if (!programme.trim() || !name.trim()) return`
   *   Applying   `if (!org.trim() && !role.trim()) return`
   *
   * Each is correct in the handler and left its control pressable, so the one
   * thing a person does first on an empty form — press the button to see what
   * happens — did nothing at all. Off until the field the guard reads has
   * something in it, and on again the moment it does, which is the half that
   * matters: a control that never comes back is worse than one that did
   * nothing.
   */
  const named = (label: string) =>
    [...host.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim().toLowerCase() === label.toLowerCase(),
    ) as HTMLButtonElement | undefined;

  it('turns Degree\u2019s two Add buttons off until their fields say something', () => {
    show(<Degree />);
    press(/^taken$/i);
    const course = named('Add the course');
    expect(course, `no Add the course — saw ${JSON.stringify(pressable())}`).toBeDefined();
    expect(course!.disabled).toBe(true);
    type('Course code', 'ECON 2010');
    expect(named('Add the course')!.disabled).toBe(false);
  });

  it('adds the course once the code is there, so the button is not merely off', () => {
    show(<Degree />);
    press(/^taken$/i);
    type('Course code', 'ECON 2010');
    press(/^add the course$/i);
    expect(host.textContent).toContain('ECON 2010');
  });

  it('turns People\u2019s Add off until there is a name to add', () => {
    show(<People />);
    const add = named('Add');
    expect(add, `no Add — saw ${JSON.stringify(pressable())}`).toBeDefined();
    expect(add!.disabled).toBe(true);
    type('Their name', 'Dr. Stromme');
    expect(named('Add')!.disabled).toBe(false);
    press(/^add$/i);
    expect(host.textContent).toContain('Dr. Stromme');
  });

  it('turns Applying\u2019s Add it off until one of the two it reads is filled', () => {
    show(<Applying />);
    press(/^add one$/i);
    const add = named('Add it');
    expect(add, `no Add it — saw ${JSON.stringify(pressable())}`).toBeDefined();
    expect(add!.disabled).toBe(true);
    // Either one satisfies the guard, so either one must turn it on.
    type('What the post is', 'Research assistant');
    expect(named('Add it')!.disabled).toBe(false);
  });
});

/*
 * The last root, unmounted before the file ends.
 *
 * `beforeEach` takes down the *previous* test's tree, which leaves the final
 * one mounted when the file finishes. React's scheduler still has work queued
 * against it, the environment is torn down underneath, and the callback then
 * throws `ReferenceError: window is not defined` — reported against whichever
 * file was running, not this one. `src/rootunmount.test.ts` is why this cannot
 * quietly go away again.
 */
afterAll(() => {
  if (root) act(() => root.unmount());
});
