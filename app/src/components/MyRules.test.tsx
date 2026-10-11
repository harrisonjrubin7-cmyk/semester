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
  it('uses the dedicated undoable delete action and keeps an exact accessible name', async () => {
    await act(async () => root.render(<MyRules />));
    const remove = host.querySelector<HTMLButtonElement>('button[aria-label^="Delete:"]');
    expect(remove?.getAttribute('aria-label')).toBe('Delete: 3 days before every deadline, at 9am.');

    await act(async () => remove?.click());

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteMyRule', id: 'rule-one' });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setMyRules' }));
  });
});
