// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CoursePublication } from './courserules';

const cloudMock = vi.hoisted(() => vi.fn());
vi.mock('./cloud', () => ({ cloudConfigured: true, cloud: cloudMock }));
const { loadPublications, useCoursePublications, useCoursePublicationsState } = await import('./courserules');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
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

type Loader = (codes: string[], term: string, schoolId?: string) => Promise<Record<string, CoursePublication>>;

function StatusProbe({
  accountId,
  schoolId,
  codes = ['ECON 1020'],
  term = '2026FA',
  on = true,
  load,
}: {
  accountId: string;
  schoolId: string;
  codes?: string[];
  term?: string;
  on?: boolean;
  load: Loader;
}) {
  const read = useCoursePublicationsState(codes, term, accountId, schoolId, on, load);
  const publication = read.publications[codes[0]];
  return (
    <div>
      <span data-status>{read.status}</span>
      <span data-body>{publication?.guidance?.body ?? ''}</span>
      <button type="button" onClick={read.retry}>Try again</button>
    </div>
  );
}

const status = () => host.querySelector('[data-status]')?.textContent;
const body = () => host.querySelector('[data-body]')?.textContent;

it('adds the selected school to every publication query without replacing RLS', async () => {
  const queries: Array<{ table: string; filters: Array<[string, string | string[]]> }> = [];
  const from = vi.fn((table: string) => {
    const query = { table, filters: [] as Array<[string, string | string[]]> };
    queries.push(query);
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: string) => {
        query.filters.push([column, value]);
        return builder;
      }),
      in: vi.fn((column: string, value: string[]) => {
        query.filters.push([column, value]);
        return Promise.resolve({ data: [], error: null });
      }),
    };
    return builder;
  });
  cloudMock.mockResolvedValueOnce({ from });

  await expect(loadPublications(['econ  1020'], '2026FA', 'school-a')).resolves.toEqual({});
  expect(queries).toHaveLength(3);
  expect(queries.map(({ table, filters }) => ({ table, filters }))).toEqual([
    { table: 'course_ai_rules', filters: [['tenant_id', 'school-a'], ['term', '2026FA'], ['course_code', ['ECON 1020']]] },
    { table: 'course_guidance', filters: [['tenant_id', 'school-a'], ['term', '2026FA'], ['course_code', ['ECON 1020']]] },
    { table: 'study_packs', filters: [['tenant_id', 'school-a'], ['term', '2026FA'], ['course_code', ['ECON 1020']]] },
  ]);
});

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

it('clears the previous result and reloads for every exact account, school, course and term key', async () => {
  const requests = Array.from({ length: 5 }, () => deferred<Record<string, CoursePublication>>());
  const load = vi.fn<Loader>();
  requests.forEach((request) => load.mockImplementationOnce(() => request.promise));

  await act(async () => root.render(<StatusProbe accountId="account-a" schoolId="school-a" load={load} />));
  requests[0].resolve({ 'ECON 1020': { guidance: { body: 'Account A', published: '2026-10-01' }, packs: [] } });
  await act(async () => {});
  expect([status(), body()]).toEqual(['ready', 'Account A']);

  await act(async () => root.render(<StatusProbe accountId="account-b" schoolId="school-a" load={load} />));
  expect([status(), body()]).toEqual(['loading', '']);
  requests[1].resolve({ 'ECON 1020': { guidance: { body: 'Account B', published: '2026-10-02' }, packs: [] } });
  await act(async () => {});

  await act(async () => root.render(<StatusProbe accountId="account-b" schoolId="school-b" load={load} />));
  expect([status(), body()]).toEqual(['loading', '']);
  requests[2].resolve({ 'ECON 1020': { guidance: { body: 'School B', published: '2026-10-03' }, packs: [] } });
  await act(async () => {});

  await act(async () => root.render(<StatusProbe accountId="account-b" schoolId="school-b" codes={['HIST 2100']} load={load} />));
  expect([status(), body()]).toEqual(['loading', '']);
  requests[3].resolve({ 'HIST 2100': { guidance: { body: 'History', published: '2026-10-04' }, packs: [] } });
  await act(async () => {});

  await act(async () => root.render(<StatusProbe accountId="account-b" schoolId="school-b" codes={['HIST 2100']} term="2027SP" load={load} />));
  expect([status(), body()]).toEqual(['loading', '']);
  requests[4].resolve({ 'HIST 2100': { guidance: { body: 'Spring history', published: '2027-01-05' }, packs: [] } });
  await act(async () => {});
  expect([status(), body()]).toEqual(['ready', 'Spring history']);

  expect(load.mock.calls).toEqual([
    [['ECON 1020'], '2026FA', 'school-a'],
    [['ECON 1020'], '2026FA', 'school-a'],
    [['ECON 1020'], '2026FA', 'school-b'],
    [['HIST 2100'], '2026FA', 'school-b'],
    [['HIST 2100'], '2027SP', 'school-b'],
  ]);
});

it('does not read while Course Studio is off or the exact term is unavailable', async () => {
  const load = vi.fn<Loader>().mockResolvedValue({});
  await act(async () => root.render(<StatusProbe accountId="account-a" schoolId="school-a" on={false} load={load} />));
  expect(status()).toBe('disabled');
  await act(async () => root.render(<StatusProbe accountId="account-a" schoolId="school-a" term="" load={load} />));
  expect(status()).toBe('disabled');
  expect(load).not.toHaveBeenCalled();
});

it('distinguishes an error from an empty result and can retry it', async () => {
  const failed = deferred<Record<string, CoursePublication>>();
  const retried = deferred<Record<string, CoursePublication>>();
  const load = vi.fn<Loader>()
    .mockImplementationOnce(() => failed.promise)
    .mockImplementationOnce(() => retried.promise);

  await act(async () => root.render(<StatusProbe accountId="account-a" schoolId="school-a" load={load} />));
  failed.reject(new Error('offline'));
  await act(async () => {});
  expect(status()).toBe('error');

  await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
  expect(status()).toBe('loading');
  retried.resolve({});
  await act(async () => {});
  expect(status()).toBe('empty');
  expect(load).toHaveBeenCalledTimes(2);
});
