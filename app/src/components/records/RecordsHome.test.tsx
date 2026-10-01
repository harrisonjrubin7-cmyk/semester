// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Records as the person sees them: nothing in Connect, a student's documents
 * and the log of who has seen their record, the registrar's office only for
 * someone holding a records capability, and a release to anyone but the student
 * asking for its basis. The rules are `supabase/records.check.sql`'s.
 */
const DOC = {
  id: 'd1', studentRef: 'S-ANA', kind: 'transcript', code: '0123456789ABCDEF01234567', asOf: '2026-10-01', hash: 'a'.repeat(64),
  recipient: '', recipientKind: 'student', issuedAt: '2026-10-01T10:00:00Z', expiresAt: '2027-03-30T10:00:00Z', revoked: false,
  content: { entries: [
    { kind: 'grade', key: 'ECON 1020 · Fall 2026', value: 'B+' }, { kind: 'credit', key: 'ECON 1020 · Fall 2026', value: '3' },
  ] },
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  docs: [] as unknown[],
  log: [] as unknown[],
  issue: vi.fn(async () => ({ id: 'd2', code: 'AAAABBBBCCCCDDDDEEEEFFFF' })),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/records/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/records/client')>()),
  loadDocuments: () => Promise.resolve(mock.docs),
  loadDisclosures: () => Promise.resolve(mock.log),
  loadClearances: () => Promise.resolve([]),
  issueDocument: mock.issue,
}));
vi.mock('../../lib/gradebook/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/gradebook/client')>()),
  loadBook: () => Promise.resolve({ course: 'ECON 1020', term: '2026FA', scheme: null, schemeVersion: 0, items: [], entries: [], regrades: [], resolutions: [] }),
}));
const { RecordsHome } = await import('./RecordsHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'records', mode: 'core', frozen: false, killed: false }];
const OFFICE = [{ capability: 'records:issue', scopeKind: 'school', scopeId: 'vu' }, { capability: 'records:audit', scopeKind: 'school', scopeId: 'vu' }];
const TEACHER = [{ capability: 'grades:release', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.docs = []; mock.log = [];
  mock.issue.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<RecordsHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own system holds records while the school is in Connect', async () => {
  mock.rows = [{ module: 'records', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds your records');
});

it('shows a student their documents and the log of who has seen their record', async () => {
  mock.docs = [DOC];
  mock.log = [{ id: 'x1', studentRef: 'S-ANA', recipient: 'Acme Corp', recipientKind: 'consent', basis: 'Student authorised it in writing', consentRef: 'form 12', what: 'Official transcript', releasedAt: '2026-10-02T10:00:00Z' }];
  await render();
  expect(host.textContent).toContain('Acme Corp');
  expect(host.textContent).toContain('on the student’s written consent');
  expect(host.textContent).toContain('consent: form 12');
  expect(host.textContent).not.toContain('Records office');
  await act(async () => button(/^Show$/)!.click());
  expect(host.textContent).toContain('Fall 2026');
  expect(host.textContent).toContain('ECON 1020 B+ (3)');
  expect(host.textContent).toContain('0123-4567-89AB-CDEF-0123-4567');
});

it('tells a student with nothing issued, and with nothing released, so', async () => {
  await render();
  expect(host.textContent).toContain('Nothing issued yet');
  expect(host.textContent).toContain('Nothing has been released to anyone but you.');
});

it('shows the office only to a records capability, and asks a third-party release for its basis', async () => {
  mock.grants = OFFICE;
  await render();
  expect(button(/^Records office$/)).toBeDefined();
  await act(async () => button(/^Records office$/)!.click());
  const count = (word: string) => (host.textContent ?? '').split(word).length - 1;
  expect(host.textContent).toContain('Official transcript');
  const before = count('Basis');
  const select = [...host.querySelectorAll('select')].find((s) => [...s.options].some((o) => /written consent/.test(o.textContent ?? ''))) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'consent');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(count('Basis')).toBe(before + 1);
  expect(host.textContent).toContain('Reference to the written consent');
});

it('shows an instructor holding grades:release the final-grades tab, and an office-less student neither', async () => {
  mock.grants = TEACHER;
  await render();
  expect(button(/^Final grades$/)).toBeDefined();
  expect(button(/^Records office$/)).toBeUndefined();
  await act(async () => button(/^Final grades$/)!.click());
  expect(host.textContent).toContain('Final grades · ECON 1020 · 2026FA');
  expect(host.textContent).toContain('No released grades yet');
});
