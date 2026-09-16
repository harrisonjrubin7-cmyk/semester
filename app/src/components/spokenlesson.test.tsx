// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SpokenLesson } from '../screens/Lesson';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';

/**
 * Watch, for a unit nobody recorded.
 *
 * `lib/watch.test.ts` checks what the lesson *is*. This checks the half a
 * reader meets: that the tab is a player rather than the name of a Python
 * script, that it steps, and — the part §3.3 is most insistent about — that
 * it says which kind of narration this is.
 *
 * The player is rendered directly rather than through `LessonPlayer`, because
 * every course in the seed has forty-four recorded lessons between them and
 * the branch under test is the one taken when a course has none. Rendering
 * the component is the difference between testing this screen and testing
 * that the seed has audio.
 *
 * This browser has no `speechSynthesis`, which is not a limitation of the
 * test: it is one of the two states worth asserting. A reader on such a
 * browser should get the unit in slides and a sentence saying why there is no
 * voice, rather than a play button that does nothing when pressed.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const said = () => (host.textContent ?? '').replace(/\s+/g, ' ');

async function settle(ready: () => boolean, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    if (ready()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const button = (name: RegExp) =>
  [...host.querySelectorAll('button')].find(
    (b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''),
  );

const press = (name: RegExp) => {
  const found = button(name);
  if (!found) throw new Error(`no button matching ${name}`);
  act(() => found.click());
};

async function show(unit = 0) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <SpokenLesson unit={unit} />
      </StoreProvider>,
    );
  });
  await loadSeed().catch(() => []);
  await settle(() => /beat 1 of/i.test(said()));
}

describe('the lesson this device would read', () => {
  it('opens on the first beat of a real unit', async () => {
    await show();
    expect(said()).toMatch(/beat 1 of \d+/);
    expect(said()).toContain('This unit');
  });

  it('steps forward to the first question and back again', async () => {
    await show();
    press(/next beat/i);
    await settle(() => /beat 2 of/i.test(said()));
    expect(said()).toContain('Question');
    press(/previous beat/i);
    await settle(() => /beat 1 of/i.test(said()));
    expect(said()).toContain('This unit');
  });

  it('cannot step behind the first beat', async () => {
    await show();
    expect(button(/previous beat/i)?.disabled).toBe(true);
  });

  it('says it is not a recording, in the two places that differ', async () => {
    // §3.3: a mode that looks identical whether it has forty-four produced
    // lessons behind it or a robot voice is the failure `lib/modes.ts` was
    // written to end. The mode card carries one half of that sentence and
    // this screen carries the other.
    await show();
    expect(said()).toContain('Nothing is recorded for this unit');
  });

  it('offers no scrub bar and states no length, because it has neither', async () => {
    // `speechSynthesis` gives no duration before it speaks and no way to
    // seek. An estimated total printed where the recorded lessons print an
    // exact one is two claims in one typeface.
    await show();
    expect(said()).not.toMatch(/\d+:\d\d/);
    expect(said()).not.toMatch(/\bmin\b/);
  });

  it('does not offer a voice this browser has not got', async () => {
    // jsdom has no `speechSynthesis`, which is the same state as a locked-down
    // browser. The play control is there and disabled, and the sentence under
    // it changes to say the unit is in slides.
    await show();
    expect(button(/read it to me/i)?.disabled).toBe(true);
    expect(said()).toContain('this browser will not read aloud');
  });

  it('never sends a reader to a Python script they cannot run', async () => {
    await show();
    expect(said()).not.toContain('pipeline/lessons.py');
  });
});

describe('stepping between units', () => {
  it('offers the unit either side, so a spoken lesson is not a room with one door', async () => {
    await show(1);
    expect(button(/previous unit/i)?.disabled).toBe(false);
    expect(button(/next unit/i)?.disabled).toBe(false);
  });

  it('stops at the ends, and only at the ends', async () => {
    await show(0);
    expect(button(/previous unit/i)?.disabled).toBe(true);
    expect(button(/next unit/i)?.disabled).toBe(false);
  });
});
