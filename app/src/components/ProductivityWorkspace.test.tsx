// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'student-a' } }),
}));
import { ProductivityWorkspace } from './ProductivityWorkspace';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
it('creates a private decision, caps options, and saves an independent snapshot', async () => {
  await act(async () => root.render(<ProductivityWorkspace />));
  await click('New decision');
  await click('Add option (0/3)');
  await click('Add option (1/3)');
  await click('Add option (2/3)');
  expect(
    [...host.querySelectorAll('button')].find((x) =>
      x.textContent?.includes('Add option (3/3)'),
    )?.disabled,
  ).toBe(true);
  await click('Save scenario snapshot');
  const saved = JSON.parse(
    localStorage.getItem('semester.productivity.v1:student-a')!,
  );
  expect(saved.decisions[0].options).toHaveLength(3);
  expect(saved.journal[0].decision.options).toHaveLength(3);
  await click('Remove option');
  const changed = JSON.parse(
    localStorage.getItem('semester.productivity.v1:student-a')!,
  );
  expect(changed.decisions[0].options).toHaveLength(2);
  expect(changed.journal[0].decision.options).toHaveLength(3);
});
it('prepares drafts for review and excludes unauthorized knowledge', async () => {
  await act(async () => root.render(<ProductivityWorkspace />));
  await click('Prepare');
  await click('Prepare for me');
  const saved = JSON.parse(
    localStorage.getItem('semester.productivity.v1:student-a')!,
  );
  expect(saved.drafts[0].status).toBe('Prepared');
  await click('Knowledge');
  await click('Preview authorized source summary');
  expect(host.textContent).toContain('No items authorized');
});
