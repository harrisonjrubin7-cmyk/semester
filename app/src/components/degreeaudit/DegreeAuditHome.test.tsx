// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The official degree audit as the person sees it: nothing in Connect, a
 * student's own audit with the courses behind every line, and staff tools only
 * for whoever the database gave a degree capability. A person who proposed an
 * exception is told someone else decides it. The rules are
 * `supabase/degree_audit.check.sql`'s.
 */
const AUDIT = {
  program: 'ECON', program_name: 'Economics', catalog_year: 2026, as_of: '2026-10-01', status: 'in_progress', version: 'v1', what_if: false, saved: null,
  credits: { have: 12, need: 120, met: false }, gpa: { have: 2.25, need: 2, met: true },
  groups: [
    { position: 1, name: 'Core', kind: 'all', need: 2, have: 2, met: true, waived: false, courses: ['ECON 1010', 'ECON 1020'], substituted: [] },
    { position: 2, name: 'Electives', kind: 'n_of', need: 2, have: 1, met: false, waived: false, courses: ['ECON 2010'], substituted: [] },
  ],
  unmet: ['Electives'], unused: ['MATH 1010'], warnings: ['No credit entry for MATH 1010; it counts for no credits until the record has one.'],
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  ref: 'S-ANA' as string | null,
  exceptions: [] as unknown[],
  run: vi.fn(),
  decide: vi.fn(async () => undefined),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/degreeaudit/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/degreeaudit/client')>()),
  myStudentRef: () => Promise.resolve(mock.ref),
  loadVersions: () => Promise.resolve([]),
  loadExceptions: () => Promise.resolve(mock.exceptions),
  runAudit: mock.run,
  decideException: mock.decide,
}));
const { DegreeAuditHome } = await import('./DegreeAuditHome');
const { readAudit } = await import('../../lib/degreeaudit/client');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'degree_audit', mode: 'core', frozen: false, killed: false }];
const STAFF = [
  { capability: 'degree:read', scopeKind: 'school', scopeId: 'vu' },
  { capability: 'degree:approve', scopeKind: 'school', scopeId: 'vu' },
];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.ref = 'S-ANA'; mock.exceptions = [];
  mock.run.mockReset(); mock.run.mockImplementation(async () => readAudit(AUDIT));
  mock.decide.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<DegreeAuditHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own audit is the record while the school is in Connect', async () => {
  mock.rows = [{ module: 'degree_audit', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own degree audit is the official one');
  expect(mock.run).not.toHaveBeenCalled();
});

it('shows a student their audit with the courses behind each line, and says what counts nowhere', async () => {
  await render();
  expect(mock.run).toHaveBeenCalledWith('S-ANA', null, false, expect.any(String));
  expect(host.textContent).toContain('Economics · catalog 2026');
  expect(host.textContent).toContain('ECON 1010, ECON 1020');
  expect(host.textContent).toContain('Electives · not met');
  expect(host.textContent).toContain('Counted nowhere: MATH 1010');
  expect(host.textContent).toContain('No credit entry for MATH 1010');
  expect(host.textContent).not.toContain('Degree audit · staff');
});

it('shows a student with no record link nothing rather than a guess', async () => {
  mock.ref = null;
  await render();
  expect(mock.run).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('catalog 2026');
});

it('shows staff the lookup only for what they hold, and no authoring without degree:author', async () => {
  mock.grants = STAFF; mock.ref = null;
  await render();
  expect(host.textContent).toContain('Degree audit · staff');
  expect(host.textContent).toContain('Student’s record reference');
  expect(host.textContent).not.toContain('Save as a draft');
});

it('tells the person who proposed an exception that someone else decides it', async () => {
  mock.grants = STAFF; mock.ref = null;
  mock.exceptions = [
    { id: 'e1', studentRef: 'S-ANA', versionId: 'v1', groupId: 'g1', kind: 'waive', courseCode: '', credits: null, reason: 'Documented transfer coursework', status: 'proposed', note: '', proposedAt: '2026-10-01T10:00:00Z', mine: true },
    { id: 'e2', studentRef: 'S-ANA', versionId: 'v1', groupId: 'g1', kind: 'substitute', courseCode: 'MATH 2010', credits: 3, reason: 'Equivalent course elsewhere', status: 'proposed', note: '', proposedAt: '2026-10-01T10:00:00Z', mine: false },
  ];
  await render();
  const input = host.querySelector('input.input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'S-ANA');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button(/^Run the audit$/)!.click());
  expect(host.textContent).toContain('You proposed this, so someone else decides it.');
  expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
  expect([...host.querySelectorAll('button')].filter((b) => /^Approve$/.test(b.textContent ?? ''))).toHaveLength(1);
  await act(async () => button(/^Approve$/)!.click());
  expect(mock.decide).toHaveBeenCalledWith('e2', true, '', expect.any(String));
});
