// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Quiz } from './Drill';
import { Mine, NoteEditor } from './Mine';

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
