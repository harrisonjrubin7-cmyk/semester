// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { READ_SYSTEM, READ_WORK_SYSTEM } from '../lib/solve';
import { Solve } from './Solve';

/**
 * Where a photograph ends up, driven the way somebody takes one.
 *
 * `lib/solve.test.ts` holds the prompts and what `brief` builds out of the two
 * boxes, and every one of those tests passed while the screen put every
 * photograph into the wrong one. That is the gap this file is for: the defect
 * was not in a prompt or in a function, it was in which constant the screen
 * handed to which call, and nothing that tests either half in isolation can
 * see it.
 *
 * The failure it pins is the one a student would actually have hit. On "Check
 * my working" — an approach that exists to read your attempt — photographing
 * your attempt filed it under "The problem", left the working empty, and the
 * request went out carrying `brief`'s "They have not shown their working. Ask
 * for it in one line." The reply asked them for the page they had just
 * photographed.
 *
 * So these tests read the boxes after a photograph, and then press the button
 * and read what actually went out. Nothing here asserts on a string in
 * isolation; each one fails if the screen stops wiring the two together.
 */

/** Every request the screen made, in order, as `ask` received it. */
let sent: { system: string; text: string }[] = [];

/** What the transcription comes back as. Set per test. */
let transcript = '';

vi.mock('../lib/assistant', async () => {
  const real = await vi.importActual<typeof import('../lib/assistant')>('../lib/assistant');
  // Otherwise the screen draws `NeedsKey` and there is nothing to drive.
  return { ...real, configured: () => true };
});

vi.mock('../lib/claude', async () => {
  const real = await vi.importActual<typeof import('../lib/claude')>('../lib/claude');
  return {
    ...real,
    ask: (o: { system: string; messages: { content: string }[] }) => {
      sent.push({ system: o.system, text: o.messages[o.messages.length - 1]?.content ?? '' });
      return Promise.resolve(transcript);
    },
  };
});

vi.mock('../lib/shots', async () => {
  const real = await vi.importActual<typeof import('../lib/shots')>('../lib/shots');
  /*
   * jsdom decodes no images, so the real `toShots` rejects every file as
   * unreadable and the screen never reaches the request this file is about.
   * Only the decode is stood in for — `MAX_SHOTS` and `tooMany` are the real
   * ones, so the cap and its sentence stay under test elsewhere.
   */
  return {
    ...real,
    toShots: (files: File[]) => ({
      shots: files.map((f) => ({
        shot: { mediaType: 'image/jpeg', data: 'x' },
        name: f.name,
        kb: 1,
        preview: '',
      })),
      errors: [],
    }),
  };
});

/** Hands back whatever the last started dictation should transcribe into. */
let heard: ((text: string) => void) | null = null;

vi.mock('../lib/mic', async () => {
  const real = await vi.importActual<typeof import('../lib/mic')>('../lib/mic');
  /*
   * jsdom has no SpeechRecognition, so the real `dictationSupported` is false
   * and `Dictate` draws its "this browser has no speech recognition" note
   * instead of a button — there would be nothing to press and nothing to
   * prove. Only the two entry points are stood in for.
   */
  return {
    ...real,
    dictationSupported: () => true,
    dictate: (onText: (text: string) => void) => {
      heard = onText;
      return () => {
        heard = null;
      };
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  sent = [];
  transcript = '';
  heard = null;
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => {
    root.render(
      <StoreProvider>
        <Solve />
      </StoreProvider>,
    );
  });
});

afterEach(() => {
  // Unmounted here rather than left to the next file's luck — see
  // `src/rootunmount.test.ts`, which is the guard that this happens at all.
  act(() => {
    root.unmount();
  });
  host.remove();
});

function box(label: string): HTMLTextAreaElement {
  const el = host.querySelector(`textarea[aria-label="${label}"]`);
  if (!el) throw new Error(`no box labelled ${label}`);
  return el as HTMLTextAreaElement;
}

function button(named: RegExp): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!found) throw new Error(`no button reading ${named}`);
  return found as HTMLButtonElement;
}

function press(named: RegExp) {
  act(() => {
    button(named).click();
  });
}

/**
 * The button that sends the request, which shares its words with a card.
 *
 * The action button is labelled with the chosen approach's own label, so
 * "Check my working" names both the card that selects that approach and the
 * button that runs it — and the card comes first in the DOM, so pressing by
 * text alone re-selects the approach and sends nothing. The cards are the ones
 * carrying `aria-pressed`; this is the one that is not.
 */
function send(named: RegExp) {
  const found = [...host.querySelectorAll('button')].filter(
    (b) => named.test((b.textContent ?? '').trim()) && !b.hasAttribute('aria-pressed'),
  );
  if (found.length !== 1) throw new Error(`${found.length} send buttons read ${named}`);
  act(() => {
    (found[0] as HTMLButtonElement).click();
  });
}

/**
 * The camera control, which is a `<label>` rather than a button.
 *
 * `FilePick` wraps a transparent `<input type=file>` in a styled label — the
 * only way to open a picker without a click handler the browser will refuse.
 * So it is found by its own words and not by index: the working box is
 * conditional on the approach, so "the second file input" silently means the
 * problem's camera on the three approaches that draw no second one, which is
 * the exact confusion this file exists to rule out.
 */
function picker(named: RegExp): HTMLInputElement {
  const label = [...host.querySelectorAll('label')].find((l) =>
    named.test((l.textContent ?? '').trim()),
  );
  if (!label) throw new Error(`no camera control reading ${named}`);
  const input = label.querySelector('input[type="file"]');
  if (!input) throw new Error(`no file input inside ${named}`);
  return input as HTMLInputElement;
}

/** Photograph something, through the picker the screen actually draws. */
async function photograph(named: RegExp) {
  const input = picker(named);
  Object.defineProperty(input, 'files', {
    value: [new File(['x'], 'page.jpg', { type: 'image/jpeg' })],
    configurable: true,
  });
  await act(async () => {
    (input as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('photographing the problem', () => {
  it('reads it with the problem prompt and puts it in the problem box', async () => {
    transcript = 'A firm faces demand Q = 120 − 2P. Find the elasticity at P = 20.';
    await photograph(/photograph the problem/i);

    expect(sent).toHaveLength(1);
    expect(sent[0].system).toBe(READ_SYSTEM);
    expect(box('The problem').value).toContain('Q = 120 − 2P');
  });
});

describe('photographing your working', () => {
  // The working box only exists on the approaches that want it.
  const openIt = () => press(/check my working/i);

  it('is offered at all', () => {
    openIt();
    expect(() => picker(/photograph your working/i)).not.toThrow();
  });

  it('is not offered where the approach does not want working', () => {
    // The control. "Explain the idea" asks for no attempt, so a camera for
    // one would be a box the screen then ignores.
    press(/explain the idea/i);
    expect(() => picker(/photograph your working/i)).toThrow();
    expect(() => picker(/photograph the problem/i)).not.toThrow();
  });

  it('reads it with the prompt that does not correct it', async () => {
    openIt();
    transcript = 'ε = (ΔQ/Q) × (P/ΔP) = (−4/40) × (20/2) = −1.0';
    await photograph(/photograph your working/i);

    expect(sent).toHaveLength(1);
    expect(sent[0].system).toBe(READ_WORK_SYSTEM);
    expect(sent[0].system).not.toBe(READ_SYSTEM);
  });

  it('puts it in the working box, not the problem box', async () => {
    // The whole defect, in one assertion. Both halves are asserted: landing
    // in the right box is only half of it if it also lands in the wrong one.
    openIt();
    transcript = 'ε = (ΔQ/Q) × (P/ΔP)';
    await photograph(/photograph your working/i);

    expect(box('What you did').value).toContain('ε = (ΔQ/Q)');
    expect(box('The problem').value).toBe('');
  });

  it('sends it as the working, so the reply does not ask for what it was given', async () => {
    /*
     * The end of the chain, and the part a student would have seen. `brief`
     * appends "They have not shown their working" whenever the approach wants
     * working and there is none — so a photograph filed as the problem
     * produced a reply asking for the page it had just read.
     */
    openIt();
    transcript = 'ε = (ΔQ/Q) × (P/ΔP)';
    await photograph(/photograph your working/i);
    // Something has to be in the problem box for the button to be live.
    const problem = box('The problem');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        problem,
        'Find the elasticity.',
      );
      problem.dispatchEvent(new Event('input', { bubbles: true }));
    });
    send(/check my working/i);
    await act(async () => {
      await Promise.resolve();
    });

    const brief = sent[sent.length - 1].text;
    expect(brief).toContain('What the student did:');
    expect(brief).toContain('ε = (ΔQ/Q)');
    expect(brief).not.toContain('They have not shown their working');
  });
});

describe('dictating your working', () => {
  const openIt = () => press(/check my working/i);

  /** Start the dictation under a given control and say something into it. */
  function say(named: RegExp, words: string) {
    press(named);
    if (!heard) throw new Error(`${named} started no dictation`);
    act(() => {
      heard!(words);
    });
  }

  it('is offered under the working box, named for it', () => {
    openIt();
    expect(() => button(/read your working out/i)).not.toThrow();
    // And the problem keeps its own, distinctly named — one label on two
    // controls is how you press the wrong one.
    expect(() => button(/read the problem out/i)).not.toThrow();
  });

  it('lands in the working box, not the problem box', async () => {
    /*
     * The same misrouting the camera had, in the control next to it:
     * `Dictate` is handed the field it appends to and the field it reads as
     * already-written, and a copy-pasted pair pointing at `problem` would
     * quietly file spoken working under the question — with nothing on
     * screen to say so, because both boxes are in view.
     */
    openIt();
    say(/read your working out/i, 'epsilon equals delta Q over Q times P over delta P');

    expect(box('What you did').value).toContain('delta Q over Q');
    expect(box('The problem').value).toBe('');
  });

  it('appends after what is already in the box rather than replacing it', async () => {
    // `Dictate` promises this and the promise is only kept if it was given
    // the right `current` — the other half of the same wiring.
    openIt();
    const work = box('What you did');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        work,
        'step one',
      );
      work.dispatchEvent(new Event('input', { bubbles: true }));
    });
    say(/read your working out/i, 'step two');

    expect(box('What you did').value).toContain('step one');
    expect(box('What you did').value).toContain('step two');
  });

  it('is not offered where the approach wants no working', () => {
    // The control, matching the camera's.
    press(/explain the idea/i);
    expect(() => button(/read your working out/i)).toThrow();
    expect(() => button(/read the problem out/i)).not.toThrow();
  });
});
