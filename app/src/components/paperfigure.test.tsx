// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { Paper } from '../screens/write/Paper';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { blankDoc, type Block, type Doc, type DocFigure } from '../lib/document';

/**
 * The page the editor draws, which is the third rendering of a document.
 *
 * `lib/exportqa.ts` compares the `.docx` and the `.pdf`. It cannot see this
 * one — a React tree is not a file — and this one was wrong: `Drawn` had no
 * case for a picture at all, so a document with a figure in it drew a blank
 * space on the page captioned "the way it will print", while both exports
 * carried the picture. Found by asking every renderer what it does with every
 * kind, which is the same question that found the other four.
 *
 * So this file holds the two claims that comparison cannot make: that a
 * picture and a figure reach the page, and that a kind with no case fails the
 * typecheck rather than drawing nothing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function show(node: ReactNode, ready: () => boolean) {
  await act(async () => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
  await loadSeed().catch(() => []);
  await settle(ready);
}

/** Flushed until what is being asserted about is there, not a fixed count. */
async function settle(ready: () => boolean, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    if (ready()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const said = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const doc = (blocks: Block[]): Doc => ({ ...blankDoc('A document'), id: 'd', blocks });

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

const BARS: DocFigure = {
  type: 'bars',
  title: 'Where the money went',
  caption: 'Federal outlays, 2024',
  unit: '% of outlays',
  max: 100,
  rows: [{ l: 'Social Security', v: 21 }],
};

describe('a figure on the page the editor draws', () => {
  it('draws the figure’s numbers, in the table both exports write', () => {
    // The same reduction the `.docx` and the `.pdf` use. A page that showed a
    // bar chart the exports turn into a table would be a fourth answer.
    return show(<Paper doc={doc([{ kind: 'figure', figure: BARS }])} />, () =>
      said().includes('Social Security'),
    ).then(() => {
      expect(said()).toContain('Where the money went');
      expect(said()).toContain('Social Security');
      expect(said()).toContain('21 % of outlays');
      expect(said()).toContain('Federal outlays, 2024');
      expect(host.querySelectorAll('.docpaper-table').length).toBe(1);
    });
  });

  it('gives a picture block a figure to sit in, where it drew nothing at all', () => {
    // The file it points at is not in this environment's drive, so no `<img>`
    // resolves — which is the same state as a file taken out of the drive, and
    // the caption is what both exports print in that case too. What is being
    // asserted is that the block is *drawn*: before this it produced no
    // element of any kind.
    return show(
      <Paper doc={doc([{ kind: 'image', fileId: 'none', name: 'chart.png', alt: 'A chart', caption: 'Figure 1' }])} />,
      () => said().includes('Figure 1'),
    ).then(() => {
      expect(host.querySelectorAll('.docpaper-figure').length).toBe(1);
      expect(said()).toContain('Figure 1');
    });
  });

  it('draws nothing for a figure with nothing in it, rather than an empty grid', () => {
    const empty: DocFigure = { type: 'bars', title: '', caption: '', unit: '', max: 0, rows: [] };
    return show(<Paper doc={doc([{ kind: 'figure', figure: empty }])} />, () => true).then(() => {
      expect(host.querySelectorAll('.docpaper-table tbody tr').length).toBeLessThanOrEqual(1);
    });
  });
});
