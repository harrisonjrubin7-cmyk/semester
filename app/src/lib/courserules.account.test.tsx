// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CoursePublication } from './courserules';

vi.mock('./cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
const { useCoursePublications } = await import('./courserules');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function Probe({
  accountId,
  load,
}: {
  accountId: string;
  load: (codes: string[], term: string) => Promise<Record<string, CoursePublication>>;
}) {
  const publications = useCoursePublications(['ECON 1020'], '2026FA', accountId, true, load);
  return <span>{publications['ECON 1020']?.guidance?.body ?? ''}</span>;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('discards account A publications after account B becomes active', async () => {
  const a = deferred<Record<string, CoursePublication>>();
  const b = deferred<Record<string, CoursePublication>>();
  const load = vi.fn()
    .mockImplementationOnce(() => a.promise)
    .mockImplementationOnce(() => b.promise);

  await act(async () => root.render(<Probe accountId="account-a" load={load} />));
  await act(async () => root.render(<Probe accountId="account-b" load={load} />));

  a.resolve({ 'ECON 1020': { guidance: { body: 'Account A policy', published: '2026-10-01' }, packs: [] } });
  await act(async () => {});
  expect(host.textContent).toBe('');

  b.resolve({ 'ECON 1020': { guidance: { body: 'Account B policy', published: '2026-10-02' }, packs: [] } });
  await act(async () => {});
  expect(host.textContent).toBe('Account B policy');
  expect(load).toHaveBeenCalledTimes(2);
});
