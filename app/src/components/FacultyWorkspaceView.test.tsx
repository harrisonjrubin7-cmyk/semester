// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The faculty teaching workspace on Account (see the spec's faculty view
 * section): it reuses the existing Course Studio entry, offers personal
 * preparation through the existing `import` destination, and says plainly
 * what it does not add. No roster, submission or grade request is made here.
 */

const mock = vi.hoisted(() => ({
  account: null as { id: string } | null,
  dispatch: vi.fn(),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.reject(new Error('not reached in this test')) }));
vi.mock('../lib/experience-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/experience-flags')>()),
  moduleOn: () => true,
}));
vi.mock('../state/store', () => ({
  useStore: () => ({ account: mock.account, school: { id: 'school-a' }, state: { term: '2026FA' }, dispatch: mock.dispatch }),
}));
const { FacultyWorkspaceView } = await import('./FacultyWorkspaceView');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.account = null;
  mock.dispatch.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('offers personal preparation through the existing import destination', async () => {
  await act(async () => root.render(<FacultyWorkspaceView />));
  expect(host.querySelector('h2')?.textContent).toBe('Teaching workspace');
  expect(host.textContent).toContain('Personal preparation does not publish to students');

  const add = [...host.querySelectorAll('button')].find((b) => /Add course materials/.test(b.textContent ?? ''))!;
  act(() => add.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'import' });
});

it('asks a signed-out visitor to sign in before checking connected courses', async () => {
  await act(async () => root.render(<FacultyWorkspaceView />));
  expect(host.textContent).toContain('Personal preparation is available. Sign in to check connected teaching access.');
  expect(host.textContent).toContain('Sign in to check connected teaching access for this account.');
});

it('states what the view does not add', async () => {
  await act(async () => root.render(<FacultyWorkspaceView />));
  expect(host.textContent).toContain('This view does not add rosters, submission review, grading or grade-release capabilities.');
  expect(host.textContent).toContain('Choosing a teaching presentation does not assign a course');
});
