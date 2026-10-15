// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  dispatch: vi.fn(),
  say: vi.fn(),
  state: {
    accent: 'sterling',
    ground: 'ink',
    hue: -1,
    plots: [
      { id: 'demand', text: 'y = 10 - x', on: true },
      { id: 'supply', text: 'y = x + 2', on: true },
    ],
  },
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ state: mock.state, dispatch: mock.dispatch, say: mock.say }),
}));
vi.mock('../lib/prefers', () => ({ usePrefersDark: () => true }));
vi.mock('./Plot', () => ({ Plot: () => <div aria-label="Graph preview" /> }));
vi.mock('./Surface', () => ({ Surface: () => <div aria-label="Surface preview" /> }));

import { Grapher } from './Grapher';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mock.dispatch.mockClear();
  mock.say.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('uses the recoverable graph-clear action without changing example loading', () => {
  act(() => root.render(<Grapher />));
  const clear = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Clear');
  expect(clear).toBeTruthy();

  act(() => clear!.click());

  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'clearPlots' });
  expect(mock.dispatch).not.toHaveBeenCalledWith({ type: 'setPlot', lines: [] });
  expect(mock.say).toHaveBeenCalledWith('The graph is clear. You can undo that for eight seconds.');
});
