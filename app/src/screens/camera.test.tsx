// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Import } from './Import';
import { configured } from '../lib/assistant';

/**
 * The syllabus that only exists on paper.
 *
 * `lib/intake.ts` has refused an image since it was written, with directions
 * attached: *"a photograph — read it with the camera, which can see it."* The
 * camera it meant was on `screens/Update.tsx`, which adds material to a course
 * you already have — so a student photographing a syllabus, who by definition
 * has not got the course yet, was being pointed at a door that was not on
 * their screen and would not have helped if it were.
 *
 * Import now has its own. These hold the two halves that make it real: the
 * camera is on the screen, and what comes off it lands in the same place an
 * uploaded PDF lands, so nothing downstream had to learn about photographs.
 *
 * ## Mounted rather than read, for `keyless.test.tsx`'s reason
 *
 * The failure this replaces was a pair across two files, each half plausible
 * on its own. So is this one: `readPages` could exist with nothing calling it,
 * or the camera could draw with its output going nowhere, and the source would
 * read fine either way. The screen is mounted and asked what is on it.
 *
 * The keyed and unkeyed cases are each other's control. A probe that found a
 * camera on every install would look exactly like this one on the half that
 * matters — so the unkeyed case has to come back empty, and does.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

/** Every file input on screen, as `accept` + `capture`. */
function pickers(): { accept: string; capture: string }[] {
  return [...host.querySelectorAll('input[type="file"]')].map((el) => ({
    accept: el.getAttribute('accept') ?? '',
    capture: el.getAttribute('capture') ?? '',
  }));
}

/** A key on this device, the way the settings screen leaves one. */
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

afterAll(() => {
  localStorage.clear();
});

describe('the probe itself', () => {
  it('is looking at an install that really has no key', () => {
    // If this fails the unkeyed case below proves nothing. `VITE_CLAUDE_PROXY`
    // in `app/.env.local` is the usual reason.
    expect(configured()).toBe(false);
  });
});

describe('the camera on the import screen', () => {
  it('opens the rear camera, on the screen a new course starts from', () => {
    keyIt();
    show(<Import />);
    const rear = pickers().filter((p) => p.capture === 'environment');
    expect(rear).toHaveLength(1);
    expect(rear[0].accept).toContain('image/');
  });

  it('offers the photo library beside it, which is a different intention', () => {
    // `components/Capture.tsx` draws the pair and says why: `capture` opens
    // the camera, its absence opens the library, and on a laptop the first
    // falls back to the file dialog.
    keyIt();
    show(<Import />);
    const images = pickers().filter((p) => p.accept.includes('image/'));
    expect(images).toHaveLength(2);
    expect(images.filter((p) => p.capture === '')).toHaveLength(1);
  });

  it('says what it does with what it reads', () => {
    keyIt();
    show(<Import />);
    expect(host.textContent).toMatch(/grading table stays a table/i);
  });

  it('is not there without a key, because a photograph has to be read', () => {
    // The control. Two doors on this screen need no key — by hand, and a
    // shared course — and `NO_KEY_HERE` names those two rather than this one.
    show(<Import />);
    expect(pickers().filter((p) => p.accept.includes('image/'))).toHaveLength(0);
  });

  it('leaves the document picker documents-only', () => {
    /*
     * The two doors stay two doors. An image in the *file* picker would be
     * handed to `extractText`, which cannot see it, and refused — so offering
     * it there would be a control that answers every use with an error.
     * `screens/Import.tsx`'s own comment on `ACCEPT` records that.
     */
    keyIt();
    show(<Import />);
    const docs = pickers().filter((p) => p.accept.includes('application/pdf'));
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) expect(d.accept).not.toContain('image/');
  });
});

describe('what a photograph becomes', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), '..', p), 'utf8');

  it('lands as an ordinary intake, through the door the type already had', () => {
    /*
     * `Door` in `lib/intake.ts` has listed `'photo'` since it was written, and
     * nothing produced one. This is what closes that: `readPages` gives back
     * text and `intakeText(text, 'photo')` makes it the same shape a PDF makes,
     * so the review step, the hashing and `generateCourse` cannot tell.
     *
     * Source-read because the alternative is a jsdom test that stubs the
     * model, and what would break here is the wiring rather than the
     * arithmetic — the same instrument, and the same reason, as
     * `lib/pushchain.test.ts`.
     */
    const src = read('app/src/screens/Import.tsx');
    expect(src).toContain('readPages(');
    expect(src).toContain("intakeText(text, 'photo')");
    // Into the same list the file door fills, not a second one.
    expect(src).toMatch(/setFiles\(\(f\) => \[\.\.\.f\.filter\(\(x\) => x\.name !== read\.name\), read\]\)/);
  });

  it('is transcribed rather than turned into flashcards', () => {
    /*
     * The mistake this avoids, named because it is the obvious shortcut:
     * `readShots` already existed and already read photographs, so wiring the
     * camera to it would have compiled and half-worked. It reads a *board* —
     * it writes exam questions from course material — and a syllabus through
     * it comes back as cards about the attendance policy rather than as the
     * dates.
     */
    const src = read('app/src/lib/claude.ts');
    const fn = src.slice(src.indexOf('export async function readPages'));
    expect(fn).toContain('Transcribe faithfully');
    // The grading table is the one thing on a syllabus that must survive
    // verbatim: `lib/grades.ts` parses "25%", "25–30%" and "80 pts" literally.
    expect(fn).toContain('keep "25%", "25–30%" and "80 pts" exactly as written');
    expect(fn).toContain('[unreadable]');
  });

  it('still refuses an image in the file picker, and now points somewhere real', () => {
    // The refusal was always right; what was wrong was where it pointed.
    const intake = read('app/src/lib/intake.ts');
    expect(intake).toContain('read it with the camera, which can see it');
  });
});
