// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../state/store';
import { loadSeed } from '../data/seed';
import { useLive, type Live } from '../lib/live';
import type { CourseId } from '../lib/types';
import { AddMaterial } from './Update';

/**
 * Adding a reading, driven the way somebody adds one.
 *
 * `lib/pasted.test.ts` holds the pieces a paste produces, `lib/changeset.test.ts`
 * what comparing them against the course concludes and `lib/adopt.test.ts` what
 * an accepted change writes. All three passed while the screen they are for did
 * nothing you could see.
 *
 * That is the gap this file is for. The pipeline was sound end to end and the
 * button on top of it was not: the review it produced was drawn five sections
 * higher up the page than the button that made it, so on a phone the press
 * changed nothing on screen. Measured in Chromium at 420×900 with a reading
 * attached — the button at y=738, and the sheet's own "Add the 1 ticked"
 * landing at y=-567, which is 567px above the top of the window.
 *
 * So these tests press the button and ask where the answer went, and then
 * follow what was accepted all the way into `useLive` — the one merge every
 * study screen reads. Nothing here asserts on a library function in isolation;
 * each one fails if the screen stops wiring them together.
 */

vi.mock('../lib/files', async () => {
  const real = await vi.importActual<typeof import('../lib/files')>('../lib/files');
  return {
    ...real,
    /*
     * jsdom has no IndexedDB, so the real `addFile` throws — and the screen
     * catches it and keeps no file, which is exactly the state these tests
     * need to be able to reach. Everything else in the module is the real
     * thing; only the write to storage is stood in for.
     */
    addFile: (file: File, courseId: string | null) =>
      Promise.resolve({
        id: `file-${file.name}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        added: 0,
        courseId,
        folderId: null,
        starred: false,
        trashedAt: null,
        openedAt: null,
        itemId: null,
      }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let reveals: Element[] = [];

/** What the store and the merge say, read from inside the provider. */
let seen: { updates: ReturnType<typeof useStore>['state']['updates']; live: Live };

function Probe({ courseId }: { courseId: CourseId }) {
  const { state } = useStore();
  const live = useLive(courseId);
  // After the commit rather than during the render: reassigning a module
  // variable while rendering is a side effect, and oxlint says so.
  useEffect(() => {
    seen = { updates: state.updates, live };
  });
  return null;
}

function button(named: RegExp): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!found) throw new Error(`no button reading ${named}`);
  return found as HTMLButtonElement;
}

function has(named: RegExp): boolean {
  return [...host.querySelectorAll('button')].some((b) =>
    named.test((b.textContent ?? '').trim()),
  );
}

function press(named: RegExp) {
  const el = button(named);
  act(() => {
    el.click();
  });
}

/** Type into the material box the way React's own onChange sees it. */
function paste(text: string) {
  const el = host.querySelector('textarea[aria-label="New material"]') as HTMLTextAreaElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Attach a file through the real input, which is what `FilePick` draws. */
async function attach(name: string, body: string, type: string) {
  const input = host.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: [new File([body], name, { type })],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // The read, the classifier and the diff are all promises behind that event.
  await act(async () => {
    await Promise.resolve();
  });
}

/** Two cards and a term, written the way `parseMaterial` reads them. */
const READING = [
  'Q: What does the four-hurdle test ask first?',
  'A: Whether there is a plausible causal mechanism.',
  '',
  'Q: What is a rival explanation?',
  'A: A third variable that would produce the same correlation.',
].join('\n');

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  reveals = [];
  /*
   * jsdom implements no scrolling at all — `scrollIntoView` is not merely a
   * no-op there, it is absent, and `revealKindly` would throw. Recorded rather
   * than stubbed away, because "the page moved to it" is half of what this
   * file is testing.
   */
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView =
    function scrollIntoView(this: Element) {
      reveals.push(this);
    };
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => {
    root.render(
      <StoreProvider>
        <Probe courseId={'econ' as CourseId} />
        <AddMaterial />
      </StoreProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
});

describe('the press that reviews', () => {
  it('draws the review after the button, not above it', () => {
    paste(READING);
    press(/^Review and add to/);

    // By either name it can carry, so this fails on where the sheet is drawn
    // and not on what the button says.
    const asked = button(/^(Review and add to|What it would change in)/);
    const apply = button(/^Add the/);
    /*
     * Document order, not pixels: jsdom has no layout, and the pixel reading
     * that found this is in the file header. `DOCUMENT_POSITION_FOLLOWING` is
     * the thing the measurement was a symptom of — the sheet was earlier in
     * the tree than the control that creates it, so it drew above it at every
     * width and on every shell.
     */
    expect(asked.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('moves the page to the review, so the press is never silent', () => {
    paste(READING);
    expect(reveals).toHaveLength(0);
    press(/^Review and add to/);
    const apply = button(/^Add the/);
    expect(reveals.some((el) => el.contains(apply))).toBe(true);
  });

  it('does not rebuild a review that is already standing', () => {
    paste(READING);
    press(/^Review and add to/);
    expect(has(/^Review and add to/)).toBe(false);
    press(/^What it would change in/);
    // One sheet, still the same one, and the page moved to it again.
    expect(host.querySelectorAll('button')).toBeTruthy();
    expect([...host.querySelectorAll('button')].filter((b) => /^Add the/.test((b.textContent ?? '').trim()))).toHaveLength(1);
  });

  it('leaves the button dead while there is nothing to review', () => {
    expect(button(/^Review and add to/).disabled).toBe(true);
  });
});

describe('the sheet a reading produces', () => {
  it('shows a taste of the prose, not the whole chapter', async () => {
    const chapter = 'Local governments shape who lives where. '.repeat(80);
    await attach('Trounstine ch 4.txt', chapter, 'text/plain');
    press(/^Review and add to/);

    const row = [...host.querySelectorAll('button')].find((b) =>
      /^A unit:/.test((b.textContent ?? '').trim()),
    );
    expect(row, 'the reading should be proposed as a unit').toBeTruthy();
    /*
     * The row is a decision, and it used to be the reading. Measured in
     * Chromium at 420×900: the whole chapter in one row put "Add the 1
     * ticked" 1,400px below the top of the sheet the press had just scrolled
     * to. What is accepted is still the whole passage — hence the count.
     */
    expect((row?.textContent ?? '').length).toBeLessThan(chapter.length / 2);
    expect(row?.textContent).toMatch(/more words, all of them kept/);
  });
});

describe('what the ticked changes reach', () => {
  it('puts a pasted reading into the guide every study screen reads', () => {
    paste(READING);
    press(/^Review and add to/);
    press(/^Add the/);

    expect(seen.updates).toHaveLength(1);
    expect(seen.updates[0].cards.map((c) => c.q)).toEqual([
      'What does the four-hurdle test ask first?',
      'What is a rival explanation?',
    ]);

    // And through the merge, which is what Cards, Read, Quiz, Cram, the field
    // guide and the slides all render from.
    const questions = seen.live.guide.units.flatMap((u) => u.cards.map((c) => c.q));
    expect(questions).toContain('What does the four-hurdle test ask first?');
    expect(questions).toContain('What is a rival explanation?');
  });

  it('keeps a photograph of the board, which has nothing to review', async () => {
    await attach('board.png', 'not really a png', 'image/png');
    press(/^Review and add to/);

    /*
     * An image produces no pieces — the camera path is what reads one — so
     * this is the sheet with an empty change set, and it used to be a sentence
     * with no control under it. The screen's own hint promises images become
     * figures for the unit, and nothing on the screen could keep one.
     */
    press(/^Attach it to/);

    expect(seen.updates).toHaveLength(1);
    expect(seen.updates[0].fileIds).toEqual(['file-board.png']);
    // Under the name it arrived with. "What you pasted" was the old fallback,
    // and it is not what a photograph of the board is called.
    expect(seen.updates[0].source).toBe('board.png');
    const drawn = [
      ...Object.values(seen.live.figures).filter(Boolean),
      ...seen.live.extras,
    ];
    expect(drawn.some((f) => f && f.type === 'image' && f.fileId === 'file-board.png')).toBe(true);
  });
});
