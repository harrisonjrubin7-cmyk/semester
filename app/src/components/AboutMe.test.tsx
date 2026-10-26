// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    shell: 'plain',
    aboutMe: [
      { id: 'work', text: 'I work twenty hours a week', at: 1 },
      { id: 'work-copy', text: 'I work twenty hours a week', at: 2 },
    ],
  },
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ state: mock.state, dispatch: mock.dispatch }),
}));

import { AboutMe } from './AboutMe';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mock.dispatch.mockClear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((candidate) =>
    name.test(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''),
  );
  if (!found) throw new Error(`No button ${name}`);
  return found;
};

it('distinguishes repeated remembered lines and deletes only the represented record after confirmation', () => {
  act(() => root.render(<AboutMe />));

  expect(button(/^Delete remembered line 1 of 2: I work twenty hours a week$/)).not.toBeNull();
  act(() => button(/^Delete remembered line 2 of 2: I work twenty hours a week$/).click());

  expect(mock.dispatch).not.toHaveBeenCalled();
  const dialog = host.querySelector('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  expect(dialog.textContent).toContain('I work twenty hours a week');
  expect(dialog.textContent).toContain('stops using this line straight away');
  expect(dialog.textContent).toContain('Your other remembered lines, conversations, notes and plans stay unchanged.');
  expect(dialog.textContent).toContain('This can’t be undone. You can add the line again if you still know it.');
  expect(document.activeElement?.textContent).toBe('Cancel');

  act(() => button(/^Cancel$/, dialog).click());
  expect(mock.dispatch).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')).toBeNull();

  act(() => button(/^Delete remembered line 2 of 2: I work twenty hours a week$/).click());
  act(() => button(/^Forget$/, host.querySelector('[role="dialog"]')!).click());

  expect(mock.dispatch).toHaveBeenCalledTimes(1);
  expect(mock.dispatch).toHaveBeenCalledWith({
    type: 'setAboutMe',
    facts: [{ id: 'work', text: 'I work twenty hours a week', at: 1 }],
  });
});
