// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();

vi.mock('../state/store', () => ({
  useStore: () => ({
    state: {
      myRules: [
        { id: 'rule-one', watches: 'deadline', days: 3, hour: 9, courseId: '', on: true },
        { id: 'rule-two', watches: 'deadline', days: 3, hour: 9, courseId: '', on: true },
      ],
    },
    dispatch,
    catalog: { courses: [] },
    courseCode: (id: string) => id,
  }),
}));

const { MyRules } = await import('./MyRules');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  dispatch.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('student reminder rule deletion', () => {
  it('distinguishes identical rules and deletes only the represented rule', async () => {
    await act(async () => root.render(<MyRules />));
    const remove = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete custom reminder"]')];
    expect(remove.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Delete custom reminder 1 of 2: 3 days before every deadline, at 9am.',
      'Delete custom reminder 2 of 2: 3 days before every deadline, at 9am.',
    ]);

    await act(async () => remove[1].click());

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteMyRule', id: 'rule-two' });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setMyRules' }));
  });
});
