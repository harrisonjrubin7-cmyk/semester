// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  dropPart: vi.fn(async () => {}),
  groupsIn: vi.fn(async () => [
    { id: 'group-1', name: 'Case team', about: '', due: '2026-10-30', created_by: 'me', created_at: '2026-10-01T12:00:00Z' },
  ]),
  membersOf: vi.fn(async () => [
    { user_id: 'me', handle: 'Harrison', about: '' },
    { user_id: 'partner', handle: 'Sam', about: '' },
  ]),
  partsOf: vi.fn(async () => [
    { id: 'part-1', group_id: 'group-1', title: 'Draft findings', owner: 'me', done: false, due: '2026-10-20', created_at: '2026-10-10T12:00:00Z' },
    { id: 'part-2', group_id: 'group-1', title: 'Draft findings', owner: 'partner', done: true, due: '', created_at: '2026-10-11T12:00:00Z' },
  ]),
  store: {
    account: { id: 'me', email: 'me@example.edu', via: 'email' },
    state: { courseId: 'course-1', schoolId: 'school-1' },
    catalog: {
      courses: [{ id: 'course-1', code: 'BUS 1600', name: 'Business' }],
      byId: { 'course-1': { id: 'course-1', code: 'BUS 1600', name: 'Business' } },
    },
    dispatch: vi.fn(),
  },
}));

vi.mock('../lib/classmates', async (original) => ({
  ...(await original<typeof import('../lib/classmates')>()),
  dropPart: mock.dropPart,
  groupsIn: mock.groupsIn,
  membersOf: mock.membersOf,
  partsOf: mock.partsOf,
}));

vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-10-16T12:00:00Z'),
  useStore: () => mock.store,
}));

const { Groupwork } = await import('./Groupwork');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const button = (name: string) => {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name || candidate.textContent?.includes(name),
  );
  if (!found) throw new Error(`No button named ${name}. Screen: ${host?.textContent ?? ''}`);
  return found;
};

beforeEach(async () => {
  mock.dropPart.mockReset();
  mock.dropPart.mockResolvedValue(undefined);
  mock.groupsIn.mockClear();
  mock.membersOf.mockClear();
  mock.partsOf.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Groupwork />));
  await flush();
  await act(async () => button('Case team').click());
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('distinguishes duplicate-titled shared parts by their represented facts', () => {
  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove part "]')]
    .map((candidate) => candidate.ariaLabel);

  expect(names).toEqual([
    'Remove part 1 of 2, Draft findings: not done · assigned to Harrison · due 2026-10-20',
    'Remove part 2 of 2, Draft findings: done · assigned to Sam · no part deadline',
  ]);
  expect(new Set(names).size).toBe(2);
});

it('previews the shared consequence and cancellation performs no server write', async () => {
  await act(async () => button('Remove part 1 of 2, Draft findings: not done · assigned to Harrison · due 2026-10-20').click());

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Remove this shared part?');
  expect(dialog?.textContent).toContain('Draft findings');
  expect(dialog?.textContent).toContain('removes this part from the shared Case team checklist for everyone in the group');
  expect(dialog?.textContent).toContain('Assigned to Harrison · not done · due 2026-10-20');
  expect(dialog?.textContent).toContain('Group membership, the other parts and official course records stay unchanged');
  expect(dialog?.textContent).toContain('A group member would need to add the part again');
  expect(document.activeElement?.textContent).toBe('Cancel');
  expect(mock.dropPart).not.toHaveBeenCalled();

  await act(async () => button('Cancel').click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mock.dropPart).not.toHaveBeenCalled();
});

it('deletes only after confirmation through the existing server operation', async () => {
  await act(async () => button('Remove part 2 of 2, Draft findings: done · assigned to Sam · no part deadline').click());
  await act(async () => button('Remove part').click());
  await flush();

  expect(mock.dropPart).toHaveBeenCalledTimes(1);
  expect(mock.dropPart).toHaveBeenCalledWith('part-2');
  expect(mock.partsOf).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('keeps the represented part and offers a retry when the server refuses removal', async () => {
  mock.dropPart.mockRejectedValueOnce(new Error('The group changed. Try again.'));

  await act(async () => button('Remove part 1 of 2, Draft findings: not done · assigned to Harrison · due 2026-10-20').click());
  await act(async () => button('Remove part').click());
  await flush();

  expect(host.textContent).toContain('The group changed. Try again.');
  expect(button('Remove part 1 of 2, Draft findings: not done · assigned to Harrison · due 2026-10-20')).not.toBeNull();
  expect(mock.partsOf).toHaveBeenCalledTimes(1);
});
