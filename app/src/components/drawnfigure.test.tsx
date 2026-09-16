// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { FigureCard } from './FigureCard';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { readDrawn } from '../lib/figure';
import type { Figure } from '../lib/types';

/**
 * A drawn figure, on the card that shows it.
 *
 * `lib/figure.test.ts` checks what may become one. This checks the other half,
 * which is the half that matters to a reader: what reaches the page, and what
 * the page says about where it came from.
 *
 * Two claims, and the first is a security one. A drawn figure is the only
 * arm of `Figure` holding markup somebody else wrote — every other arm is
 * fields this app formats itself. `components/Drawing.tsx` puts it through
 * `cleanSvg` on the way to `dangerouslySetInnerHTML`, and `lib/diagram.test.ts`
 * covers that sanitiser thoroughly. What is not covered there is that this
 * card actually uses it: a `FigureCard` that rendered `figure.code` directly
 * would pass every test in that file and put a live `<script>` in the page.
 * So the payload goes in as a stored figure and the assertion is made about
 * the document.
 *
 * The second is about trust. The seventeen hand-drawn diagrams were checked by
 * a person; a drawn one was written to a description by a model and kept by
 * whoever was reading it. Those are different claims and the card has to say
 * which it is making — the per-row version of the argument `lib/where.ts`
 * makes about six kinds of fact in one typeface.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/**
 * Rendered and flushed, including the lazily-imported `Drawing`.
 *
 * Inside a `StoreProvider` because `components/Blueprint.tsx` — the frame every
 * figure card is drawn in — reads the shell setting out of the store, and a
 * card rendered without one throws before anything can be asserted about it.
 *
 * The seed is awaited rather than raced for the reason `components/softtop`
 * gives at length: the provider starts `loadSeed()` on mount, that dynamically
 * imports four course modules, and a dynamic import still in flight when the
 * environment goes ends the run with an `EnvironmentTeardownError` and a
 * non-zero exit — a green suite that fails anyway. `loadSeed` memoises, so
 * awaiting it here is the work the provider is already doing.
 */
async function show(node: ReactNode, ready: () => boolean) {
  await act(async () => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
  await loadSeed().catch(() => []);
  await settle(ready);
}

/**
 * Flushed until the thing being asserted about is there, rather than a fixed
 * number of times.
 *
 * The first version of this file flushed four macrotasks and then looked, and
 * that is a race rather than a wait. `Drawing` is imported lazily — the card
 * renders a Suspense fallback first and the picture on whichever tick the
 * import resolves on — so how many flushes are enough depends on what else
 * the worker is doing. Under `isolate: false` that is every other file in the
 * run, and it failed once in a timezone pass and then passed on both zones
 * when run again: the timing class `CLAUDE.md` describes, where consecutive
 * green runs are weak evidence and a seed cannot replay it.
 *
 * Polling the condition removes the question. The ceiling is high enough that
 * a slow worker is not a failure and low enough that a genuine break is
 * reported in about a second rather than by the suite's own timeout — and a
 * broken component fails the assertion below either way, because this returns
 * on exhaustion rather than throwing.
 */
async function settle(ready: () => boolean, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    if (ready()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const said = () => (host.textContent ?? '').replace(/\s+/g, ' ');

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/*
 * Unmounted on the way out rather than dropped, for the reason
 * `src/rootunmount.test.ts` exists to enforce: under `isolate: false` a root
 * still mounted when the file ends is a root React goes on scheduling work
 * for, and that work lands as `ReferenceError: window is not defined` on
 * whichever file happens to be running when the environment has gone.
 */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a drawing on a figure card', () => {
  const drawn = (code: string): Figure =>
    readDrawn({
      title: 'A titration curve for a weak acid',
      caption: 'Drawn for CHEM 1601.',
      language: 'svg',
      code,
    })!;

  const drew = () => host.querySelector('circle') !== null;

  it('draws it', async () => {
    await show(<FigureCard figure={drawn('<svg viewBox="0 0 600 420"><circle r="5" /></svg>')} />, drew);
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelector('circle')).not.toBeNull();
  });

  it('puts the code through the sanitiser rather than into the page', async () => {
    const payload =
      '<svg viewBox="0 0 600 420">' +
      '<script>window.taken = 1</script>' +
      '<foreignObject><div>anything at all</div></foreignObject>' +
      '<circle r="5" onload="window.taken = 2" />' +
      '<image href="https://elsewhere.example/pixel.png" />' +
      '</svg>';

    await show(<FigureCard figure={drawn(payload)} />, drew);

    // Drawn at all — a sanitiser that returned nothing would pass the three
    // assertions below and show the reader an empty card.
    expect(host.querySelector('circle')).not.toBeNull();

    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('foreignObject')).toBeNull();
    expect(host.querySelector('[onload]')).toBeNull();
    // A reference that reaches outside is a tracking pixel by another name.
    expect(host.innerHTML).not.toContain('elsewhere.example');
  });

  it('says it was drawn from a description, not taken from the guide', async () => {
    await show(
      <FigureCard figure={drawn('<svg viewBox="0 0 600 420"><circle r="5" /></svg>')} />,
      drew,
    );
    expect(said()).toContain('Drawn from a description you gave, not from the guide');
  });

  it('says no such thing about one of the guide’s own diagrams', async () => {
    /*
     * The control, and the reason this test is worth having: an assertion that
     * the line is present proves nothing if the line is present on every
     * figure. A hand-drawn diagram is the app's own drawing, checked by a
     * person, and must not be labelled as though a model wrote it.
     */
    await show(
      <FigureCard
        figure={{
          type: 'diagram',
          title: 'Supply and demand',
          caption: 'The workhorse model.',
          kind: 'supply-demand',
        }}
      />,
      // The guide's own diagrams are not lazily imported, so this is there on
      // the first flush — the wait is what makes the negative assertion mean
      // something, rather than passing because nothing had rendered yet.
      () => said().includes('Supply and demand'),
    );
    expect(said()).not.toContain('Drawn from a description');
    expect(said()).toContain('Supply and demand');
  });
});
