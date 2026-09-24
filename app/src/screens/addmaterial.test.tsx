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

/**
 * Whether the screen believes the assistant is available, per test.
 *
 * Not a constant: with a key in app/.env.local, vite.config.ts bakes
 * VITE_CLAUDE_PROXY into the page when it evaluates the config for vitest, so
 * `configured()` answers true and this file stopped being hermetic —
 * `ANTHROPIC_API_KEY=sk-ant-test npm test` failed two of these tests and
 * `look()` would have posted the fixture to the real API. So the gate is
 * declared here, defaulting to off, and the one test that needs a harvest
 * turns it on and cans what comes back.
 */
let assistant = false;

/** What `harvest()` returns when a test has turned the assistant on. */
let harvested: { pieces: unknown[]; says: string; dropped: string[] } | null = null;

/**
 * Whether storage takes the file.
 *
 * `addFile` genuinely fails in a private window and when the quota is spent —
 * `pick()` catches it and says so in its own comment — and that is the one
 * state where an import can propose a deadline with no file behind it.
 */
let storageTakesFiles = true;

vi.mock('../lib/assistant', async () => {
  const real = await vi.importActual<typeof import('../lib/assistant')>('../lib/assistant');
  return { ...real, configured: () => assistant };
});

vi.mock('../lib/harvest', async () => {
  const real = await vi.importActual<typeof import('../lib/harvest')>('../lib/harvest');
  return { ...real, harvest: () => Promise.resolve(harvested) };
});

vi.mock('../lib/classify', async () => {
  const real = await vi.importActual<typeof import('../lib/classify')>('../lib/classify');
  return {
    ...real,
    // Only reached when `guess` was not confident, and it posts to the API.
    classify: (item: { name: string }) =>
      Promise.resolve({
        kind: 'reading' as const,
        confidence: 0.9,
        says: 'a reading',
        about: item.name,
        because: [],
      }),
  };
});

vi.mock('../lib/claude', async () => {
  const real = await vi.importActual<typeof import('../lib/claude')>('../lib/claude');
  // Nothing in this file should reach the network. Anything that tries fails
  // loudly rather than hanging or, worse, succeeding.
  const refuse = () => Promise.reject(new Error('no network in a test'));
  return { ...real, ask: refuse, readMaterial: refuse, readShots: refuse };
});

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
      storageTakesFiles
        ? Promise.resolve({
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
          })
        : Promise.reject(new Error('storage refused it')),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let reveals: Element[] = [];

/** What the store and the merge say, read from inside the provider. */
let seen: { updates: ReturnType<typeof useStore>['state']['updates']; live: Live };

/**
 * Bumped to remount the screen while the store underneath it survives.
 *
 * The difference between "the same visit" and "coming back next week", which
 * is the only way to reach the duplicate guard: it compares what is on the
 * screen now against updates already written.
 */
let visit = 0;

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

/**
 * Attach a file through the real input, which is what `FilePick` draws.
 *
 * By its `accept` list, not by being first. `<Capture>` renders two camera
 * inputs above this one whenever the assistant is configured, so
 * `querySelector('input[type=file]')` returned the camera and the file never
 * reached `pick()` — two tests in this file failed for anyone with a key, in
 * a way that looked like the screen was broken.
 */
async function attach(name: string, body: string, type: string) {
  const input = [...host.querySelectorAll('input[type="file"]')].find((el) =>
    (el.getAttribute('accept') ?? '').includes('.pdf'),
  ) as HTMLInputElement | undefined;
  if (!input) throw new Error('no file picker on the screen');
  Object.defineProperty(input, 'files', {
    value: [new File([body], name, { type })],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // The read, classifier, harvest and diff are all promises behind that
  // event. Wait for the screen's own working state rather than a guessed
  // number of microtasks.
  if (/^image\//.test(type)) {
    await vi.waitFor(() => expect(host.textContent).toContain(name));
  } else if (assistant) {
    await vi.waitFor(() => expect([...host.querySelectorAll('button')].some((candidate) =>
      /^What it would change in/.test(candidate.textContent?.trim() ?? ''),
    )).toBe(true));
  } else {
    await vi.waitFor(() => expect([...host.querySelectorAll('button')].some((candidate) =>
      /^Review and add to/.test(candidate.textContent?.trim() ?? '') && !(candidate as HTMLButtonElement).disabled,
    )).toBe(true));
  }
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
  assistant = false;
  harvested = null;
  storageTakesFiles = true;
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
  visit = 0;
  draw();
});

/** Render the tree as it stands. StoreProvider keeps its state across this. */
function draw() {
  act(() => {
    root.render(
      <StoreProvider>
        <Probe courseId={'econ' as CourseId} />
        <AddMaterial key={visit} />
      </StoreProvider>,
    );
  });
}

/** Leave the screen and come back to it, with everything written still written. */
function revisit() {
  visit += 1;
  draw();
}

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
});

/**
 * A harvested change set, carrying something the raw text does not say.
 *
 * The distinction is the whole point of the guard it tests: a file's pieces
 * come back with quotes, slide numbers and dates that re-deriving from the
 * text in the box cannot produce. A card whose question appears nowhere in
 * the fixture is the cheapest way to tell the two apart on screen.
 */
const HARVEST_ONLY = 'Which clause did the harvest carry?';

const WHERE = { source: 'reading.txt', sourceHash: 'harvest-hash', as: 'reading' as const, at: 0 };

const HARVESTED_CARD = {
  what: 'card',
  unit: 'Trounstine ch 4',
  card: { q: HARVEST_ONLY, a: 'The one only the harvest knows.' },
  quote: 'Suburban boundaries were drawn by policy',
  where: WHERE,
  hash: 'harvested-piece-1',
};

/**
 * A deadline and nothing else.
 *
 * Deliberately alone: a harvest that also carries a card produces an update
 * through `adopt`, and it is the branch for a harvest that produces *no*
 * update — where the dates are the only thing there is to record — that this
 * file is short a guard for.
 */
const HARVESTED_DEADLINE = {
  what: 'item',
  title: 'Reading response 7',
  kind: 'assignment',
  month: 10,
  day: 3,
  dueTime: '',
  weight: '5%',
  detail: '',
  quote: '',
  where: WHERE,
  hash: 'harvested-item-1',
};

function cannedHarvest(pieces: unknown[] = [HARVESTED_CARD]) {
  return { pieces, says: 'A reading about who decides where people live.', dropped: [] };
}

/** Prose with no Q/A in it, so `parseMaterial` finds nothing to re-derive. */
const CHAPTER = 'Suburban boundaries were drawn by policy rather than by preference. '.repeat(30);

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

  it('leaves the button dead while there is nothing to review', () => {
    expect(button(/^Review and add to/).disabled).toBe(true);
  });
});

describe('a review, and the material moving under it', () => {
  it('keeps a harvested change set rather than re-deriving it from the text', async () => {
    assistant = true;
    harvested = cannedHarvest();
    await attach('reading.txt', CHAPTER, 'text/plain');

    /*
     * What the file path produced: a card the text in the box does not
     * contain. This is what a second press used to destroy — `review()` ran
     * again and rebuilt the set out of the raw text, losing every quote and
     * page number the harvest carried.
     */
    expect(rows()).toContain(HARVEST_ONLY);
    press(/^What it would change in/);
    expect(rows()).toContain(HARVEST_ONLY);
    // And it is still the harvest that gets written, not a re-reading.
    press(/^Add the/);
    expect(seen.updates).toHaveLength(1);
    expect(seen.updates[0].cards.map((c) => c.q)).toEqual([HARVEST_ONLY]);
  });

  it('drops a review the material has outgrown, and reviews the rest', () => {
    paste(READING);
    press(/^Review and add to/);
    expect(rows()).toHaveLength(2);

    /*
     * The bug this is the guard for: the press stopped rebuilding once a
     * review was standing, and nothing invalidated one, so a third card
     * pasted afterwards was never reviewed — and applying wrote the first two
     * and navigated away with the third gone and nothing said.
     */
    paste(`${READING}\n\nQ: What is selection bias?\nA: When the sample decides the answer.`);
    expect(has(/^Add the/), 'a stale review should not still be standing').toBe(false);
    expect(has(/^Review and add to/)).toBe(true);

    press(/^Review and add to/);
    expect(rows()).toHaveLength(3);
    press(/^Add the/);
    expect(seen.updates[0].cards.map((c) => c.q)).toContain('What is selection bias?');
  });

  it('drops a review when the course changes under it', () => {
    paste(READING);
    press(/^Review and add to/);
    expect(has(/^Add the/)).toBe(true);

    // A set is diffed against one course's guide. Applying ECON's proposals
    // to PSCI is not a smaller mistake for being invisible.
    press(/^PSCI 1104$/);
    expect(has(/^Add the/)).toBe(false);
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
    expect(row?.textContent).toMatch(/more characters, all of them kept/);
  });

  it('never cuts an emoji in half', () => {
    // The cut counts UTF-16 units and an emoji is two of them, so a passage
    // with one sitting on the boundary used to end in a lone high surrogate
    // — a replacement glyph on screen. Same guard as `cut` in lib/xlsx.ts.
    paste(`${'x'.repeat(259)}\u{1F600}${'y'.repeat(80)}`);
    press(/^Review and add to/);
    const shown = sheet().textContent ?? '';
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(shown), 'a lone surrogate is half a character').toBe(
      false,
    );
  });

  it('counts what is left in characters, which is true of a reading with no spaces', () => {
    // Counting words split the tail on whitespace, so Japanese prose — or a
    // URL, or a base64 blob — reported one more word however much was left.
    const unbroken = 'あ'.repeat(3000);
    paste(unbroken);
    press(/^Review and add to/);
    const row = [...host.querySelectorAll('button')].find((b) =>
      /^A unit:/.test((b.textContent ?? '').trim()),
    );
    expect(row?.textContent).toMatch(/and 27\d\d more characters/);
  });
});

describe('when the press cannot do all of what was ticked', () => {
  it('says so where the press left you looking', async () => {
    assistant = true;
    /*
     * A deadline, on one of the courses the app ships with. Those live in the
     * catalogue rather than in the store, so their dates cannot be changed,
     * and `applyChanges` says so instead of dropping the row in silence.
     */
    harvested = cannedHarvest([HARVESTED_DEADLINE]);
    /*
     * And storage refuses the file — a private window, or a spent quota. It is
     * the only way an import reaches the apply press with a deadline and no
     * file behind it, which is the case `addedItems` has to survive: there is
     * no other update for `adopt` to write it onto.
     */
    storageTakesFiles = false;
    await attach('reading.txt', CHAPTER, 'text/plain');
    expect(rows()).toHaveLength(1);
    press(/^Add the 1 ticked/);

    /*
     * And the import records which deadlines were its. `addedItems` was
     * hardcoded to [] on this branch, so the REMOVE row beside the import
     * deleted the update and left the dates on the course, with nothing left
     * tying the two together.
     */
    expect(seen.updates[0].addedItems, 'undo needs to know what this import added').toHaveLength(1);

    const note = [...host.querySelectorAll('[role="alert"]')].find((el) =>
      /sample courses built into the app/.test(el.textContent ?? ''),
    );
    expect(note, 'the press should say why the deadline could not be added').toBeTruthy();
    /*
     * And it has to be where the reader is. This message used to be drawn up
     * beside the material box — five sections above the sheet, so the press
     * cleared the review, said why off the top of the viewport, and looked
     * exactly like the dead button this whole change is about.
     */
    const primary = button(/^(Review and add to|What it would change in|Already added)/);
    expect(
      primary.compareDocumentPosition(note as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the message belongs under the press, not above it',
    ).toBeTruthy();
  });
});

describe('two files that share a name', () => {
  it('lets the second photograph of the board in', async () => {
    await attach('board.png', 'monday', 'image/png');
    press(/^Review and add to/);
    press(/^Attach it to/);
    expect(seen.updates).toHaveLength(1);

    /*
     * Next week, a different board, and a camera that calls it the same
     * thing. Hashing the names alone made this identical to Monday's, so
     * `alreadyAdded` matched, the button went dead reading "Already added",
     * and there was nothing on the screen that let the real second
     * photograph through. Scanners and messaging apps produce Scan.pdf and
     * image.png all day.
     */
    revisit();
    await attach('board.png', 'friday, and a different board entirely', 'image/png');
    const primary = button(/^(Review and add to|What it would change in|Already added)/);
    expect(primary.textContent?.trim()).not.toBe('Already added');
    expect(primary.disabled).toBe(false);
    press(/^Review and add to/);
    press(/^Attach it to/);
    expect(seen.updates).toHaveLength(2);
  });

  it('still recognises the same file attached twice', async () => {
    await attach('board.png', 'monday', 'image/png');
    press(/^Review and add to/);
    press(/^Attach it to/);

    revisit();
    await attach('board.png', 'monday', 'image/png');
    expect(button(/^Already added/).disabled).toBe(true);
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
    /*
     * And it is drawn. `offered()` types every attachment as an image whether
     * or not it is one, so the `type` test here is the type checker's, not a
     * claim about the file — what this asserts is that the id reached the
     * figures the course draws at all, which before this it never did.
     */
    const drawn = [...Object.values(seen.live.figures).filter(Boolean), ...seen.live.extras];
    expect(
      drawn.some((f) => f && f.type === 'image' && f.fileId === 'file-board.png'),
    ).toBe(true);
  });

  it('keeps the file when every proposal is unticked, and leaves the text addable', async () => {
    paste(READING);
    await attach('board.png', 'not really a png', 'image/png');
    press(/^Review and add to/);

    // Untick both proposed cards. The file is not a proposal and does not
    // untick — a disabled button here used to lose it.
    for (const q of ['What does the four-hurdle test ask first?', 'What is a rival explanation?']) {
      press(new RegExp(`^${q.replace(/\?/g, '\\?')}`));
    }
    press(/^Attach the file only/);

    expect(seen.updates).toHaveLength(1);
    expect(seen.updates[0].fileIds).toEqual(['file-board.png']);
    expect(seen.updates[0].cards).toEqual([]);
    /*
     * And the cards that were refused are still addable. Stamping this import
     * with the whole material's hash marked them as already added, after which
     * `alreadyAdded` disabled the button and they could never be added to this
     * course at all. Asserted the way the reader would meet it rather than on
     * the hash: the button must not have gone dead on material nobody took.
     */
    const primary = button(/^(Review and add to|What it would change in|Already added)/);
    expect(primary.textContent?.trim(), 'the refused cards should still be addable').not.toBe(
      'Already added',
    );
    expect(primary.disabled).toBe(false);
  });
});

/**
 * The sheet itself, found from the one control only it draws.
 *
 * By ancestry rather than by matching text: the screen has course chips and
 * unit rows that are also `aria-pressed` buttons, and a `rows()` that matched
 * on wording counted "What it is" among the proposals.
 */
function sheet(): HTMLElement {
  const buttons = [...host.querySelectorAll('button')];
  const apply = buttons.find((b) => /^Add the/.test((b.textContent ?? '').trim()))
    ?? buttons.find((b) => /^Attach /.test((b.textContent ?? '').trim()));
  if (!apply) throw new Error('no review sheet on screen');
  return apply.parentElement as HTMLElement;
}

/** What each proposal row says it is — the first line of the row. */
function rows(): string[] {
  return [...sheet().querySelectorAll('button[aria-pressed]')].map((b) =>
    (b.querySelector('span')?.textContent ?? '').trim(),
  );
}
