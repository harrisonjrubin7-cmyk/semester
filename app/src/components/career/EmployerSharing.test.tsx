// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Career › Employers, on screen. The student's side: adding a saved version
 * as evidence and withdrawing it, sharing named items with one employer until
 * a date and ending it — every write naming the portfolio revision read, a
 * stale one offering a reload, a refusal in the server's words, not set up
 * said as such. The employer's side: offered only to an account holding the
 * employer role, read-only, and an ended share read as "no longer shared".
 * The server's rules are proved by `supabase/career-evidence.check.sql`.
 */

const ME = '11111111-1111-4111-8111-111111111111';

type Reply = { data: unknown; error: { message: string; code?: string } | null };
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  say: vi.fn(),
  dispatch: vi.fn(),
  account: null as { id: string } | null,
  tables: {} as Record<string, Reply>,
}));

function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    order: () => q,
    then: (ok: (r: Reply) => unknown, no?: (e: unknown) => unknown) => Promise.resolve(mock.tables[table] ?? { data: [], error: null }).then(ok, no),
  };
  return q;
}

vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: (t: string) => query(t) }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say, dispatch: mock.dispatch, account: mock.account }) }));
const { EmployerSharing } = await import('./EmployerSharing');
const { SharedWithMe } = await import('./SharedWithMe');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  mock.dispatch.mockReset();
  mock.account = { id: ME };
  mock.tables = {};
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const HASH = '3f9a' + '0'.repeat(56) + 'c210';
const ok = (data: unknown): Reply => ({ data, error: null });
function answers(map: Record<string, Reply[]>) {
  mock.rpc.mockImplementation((name: string) => {
    const q = map[name];
    if (!q || q.length === 0) return Promise.resolve({ data: null, error: null });
    return Promise.resolve(q.length > 1 ? q.shift()! : q[0]);
  });
}
const calls = (name: string) => mock.rpc.mock.calls.filter((c) => c[0] === name);

const ITEM = { evidence: 'e-1', object: 'o-1', version: 'v-2', label: 'Capstone report', title: 'Capstone', version_number: 2, saved_at: '2026-10-20T12:00:00Z', added_at: '2026-10-20T13:00:00Z' };
const GRANT = {
  grant: 'g-1', employer_email: 'hiring@acme.example', employer_scope: 'acme', shared_as: 'Maya R.', purpose: 'Internship application',
  granted_at: '2026-10-20T14:00:00Z', expires_at: '2027-01-10T23:59:59Z', employer_active: true, evidence: ['e-1'],
};
const portfolio = (revision: number, evidence: unknown[] = [], grants: unknown[] = []) => ok({ revision, evidence, grants });

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''));
const dialogButton = (text: string) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === text) as HTMLButtonElement;
const fieldByLabel = (label: string) => {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent === label)!;
  return host.querySelector(`#${CSS.escape(l.htmlFor)}`) as HTMLInputElement | HTMLSelectElement;
};
const type = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });
const inDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

it('adds a saved version as evidence on the revision it read', async () => {
  answers({
    career_evidence_mine: [portfolio(3), portfolio(4, [ITEM])],
    workspace_objects_mine: [ok([{ object: 'o-1', kind: 'document', title: 'Capstone', revision: 2, version: 'v-2', updated_at: '2026-10-20T12:00:00Z' }])],
    career_evidence_add: [ok({ evidence: 'e-1', revision: 4 })],
  });
  mock.tables.workspace_object_versions = ok([
    { id: 'v-2', version_number: 2, title: 'Capstone', byte_length: 10, content_sha256: HASH, created_at: '2026-10-20T12:00:00Z' },
    { id: 'v-1', version_number: 1, title: 'Capstone', byte_length: 8, content_sha256: HASH, created_at: '2026-10-19T12:00:00Z' },
  ]);
  act(() => root.render(<EmployerSharing />));
  await flush();
  expect(host.textContent).toContain('No evidence yet');

  type(fieldByLabel('Label'), 'Capstone report');
  act(() => button(/Add to portfolio/)!.click());
  await flush();
  expect(calls('career_evidence_add')[0][1]).toMatchObject({ want_version: 'v-2', want_label: 'Capstone report', want_expected_revision: 3 });
  expect(host.textContent).toContain('is in your portfolio. Nobody can read it until you share it.');
  expect(host.querySelector('table')!.textContent).toContain('Capstone · version 2');
});

it('a stale portfolio refuses the write and offers a reload, not a retry', async () => {
  answers({
    career_evidence_mine: [portfolio(3)],
    workspace_objects_mine: [ok([{ object: 'o-1', kind: 'document', title: 'Capstone', revision: 1, version: 'v-1', updated_at: '2026-10-20T12:00:00Z' }])],
    career_evidence_add: [{ data: null, error: { message: 'semester: your portfolio changed', code: '40001' } }],
  });
  mock.tables.workspace_object_versions = ok([{ id: 'v-1', version_number: 1, title: 'Capstone', byte_length: 8, content_sha256: HASH, created_at: '2026-10-19T12:00:00Z' }]);
  act(() => root.render(<EmployerSharing />));
  await flush();
  type(fieldByLabel('Label'), 'Capstone report');
  act(() => button(/Add to portfolio/)!.click());
  await flush();
  expect(host.textContent).toContain('Your portfolio changed since you opened it');
  expect(button(/^Try again$/)).toBeUndefined();
  act(() => button(/Reload your portfolio/)!.click());
  await flush();
  expect(calls('career_evidence_mine')).toHaveLength(2);
});

it('shares named evidence with one employer until a date, after a preview', async () => {
  answers({
    career_evidence_mine: [portfolio(4, [ITEM]), portfolio(5, [ITEM], [GRANT])],
    workspace_objects_mine: [ok([])],
    career_evidence_grant: [ok({ grant: 'g-1', expires_at: '2027-01-10T23:59:59Z', revision: 5 })],
  });
  act(() => root.render(<EmployerSharing />));
  await flush();
  expect(host.textContent).toContain('No employer can see any of your evidence');

  type(fieldByLabel('Employer’s email address'), 'hiring@acme.example');
  type(fieldByLabel('Employer'), 'acme');
  act(() => (host.querySelector('fieldset input[type="checkbox"]') as HTMLInputElement).click());
  type(fieldByLabel('How they should know you'), 'Maya R.');
  type(fieldByLabel('What it is shared for'), 'Internship application');
  const ends = host.querySelector('input[type="date"]') as HTMLInputElement;

  type(ends, inDays(200));
  expect(host.textContent).toContain('A share with an employer ends within 180 days.');
  expect(button(/Review and share/)!.disabled).toBe(true);

  type(ends, inDays(30));
  act(() => button(/Review and share/)!.click());
  expect(calls('career_evidence_grant')).toHaveLength(0);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('Capstone report (Capstone, version 2)');
  expect(dialog.textContent).toContain('your grades are not shared');

  act(() => dialogButton('Share').click());
  await flush();
  const args = calls('career_evidence_grant')[0][1];
  expect(args).toMatchObject({
    want_employer_email: 'hiring@acme.example', want_employer_scope: 'acme', want_evidence: ['e-1'],
    want_shared_as: 'Maya R.', want_purpose: 'Internship application', want_expected_revision: 4,
  });
  expect(new Date(args.want_expires_at).getDate()).toBe(new Date(`${inDays(30)}T12:00:00`).getDate());
  expect(host.textContent).toContain('hiring@acme.example can read 1 item until');
  // Who can see it, and until when, is on screen.
  expect(host.textContent).toContain('hiring@acme.example · for acme');
});

it('ends an employer’s access and withdraws evidence, each after a preview', async () => {
  answers({
    career_evidence_mine: [portfolio(5, [ITEM], [GRANT]), portfolio(6, [ITEM]), portfolio(7)],
    workspace_objects_mine: [ok([])],
    career_evidence_revoke: [ok({ grant: 'g-1', revoked_at: '2026-10-21T12:00:00Z', revision: 6 })],
    career_evidence_withdraw: [ok({ evidence: 'e-1', withdrawn_at: '2026-10-21T12:05:00Z', revision: 7 })],
  });
  act(() => root.render(<EmployerSharing />));
  await flush();

  act(() => button(/End hiring@acme.example’s access/)!.click());
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain('can no longer read Capstone report');
  act(() => dialogButton('End access').click());
  await flush();
  expect(calls('career_evidence_revoke')[0][1]).toMatchObject({ want_grant: 'g-1', want_expected_revision: 5 });
  expect(host.textContent).toContain('access ended at');

  act(() => button(/Withdraw Capstone report/)!.click());
  act(() => dialogButton('Withdraw').click());
  await flush();
  expect(calls('career_evidence_withdraw')[0][1]).toMatchObject({ want_evidence: 'e-1', want_expected_revision: 6 });
  expect(host.textContent).toContain('is out of your portfolio');
});

it('shows a refusal in the server’s words', async () => {
  answers({
    career_evidence_mine: [portfolio(4, [ITEM], [GRANT])],
    workspace_objects_mine: [ok([])],
    career_evidence_revoke: [{ data: null, error: { message: 'semester: no such grant here', code: '42501' } }],
  });
  act(() => root.render(<EmployerSharing />));
  await flush();
  act(() => button(/End hiring@acme.example’s access/)!.click());
  act(() => dialogButton('End access').click());
  await flush();
  expect(host.textContent).toContain('No such grant here.');
});

it('says when sharing with employers is not set up, and offers nothing that would fail', async () => {
  answers({ career_evidence_mine: [{ data: null, error: { message: 'function does not exist', code: '42883' } }] });
  act(() => root.render(<EmployerSharing />));
  await flush();
  expect(host.textContent).toContain('Sharing evidence with employers is not set up at your school yet');
  expect(button(/Add to portfolio|Review and share/)).toBeUndefined();
});

it('asks a signed-out student to sign in rather than calling the server', async () => {
  mock.account = null;
  act(() => root.render(<EmployerSharing />));
  await flush();
  expect(host.textContent).toContain('Sign in to share evidence with an employer');
  expect(mock.rpc).not.toHaveBeenCalled();
});

it('offers an employer what was shared with it, read-only', async () => {
  mock.tables.role_grants = ok([{ scope_id: 'acme', expires_at: null, revoked_at: null }]);
  answers({
    career_evidence_shared_with_me: [
      ok([{ grant: 'g-1', shared_as: 'Maya R.', purpose: 'Internship application', employer_scope: 'acme', granted_at: '2026-10-20T14:00:00Z', expires_at: '2027-01-10T23:59:59Z',
        evidence: [{ evidence: 'e-1', label: 'Capstone report', title: 'Capstone', version_number: 2, saved_at: '2026-10-20T12:00:00Z' }] }]),
    ],
    career_evidence_read: [
      ok({ grant: 'g-1', evidence: 'e-1', label: 'Capstone report', title: 'Capstone', body: 'What I built and why.', mime_type: 'text/plain', content_schema: 'semester.document/1',
        version_number: 2, byte_length: 21, content_sha256: HASH, saved_at: '2026-10-20T12:00:00Z' }),
    ],
  });
  act(() => root.render(<SharedWithMe />));
  await flush();
  expect(host.textContent).toContain('Shared with you');
  expect(host.textContent).toContain('Maya R.');

  act(() => button(/Read Capstone report/)!.click());
  await flush();
  expect(calls('career_evidence_read')[0][1]).toEqual({ want_grant: 'g-1', want_evidence: 'e-1' });
  expect(host.querySelector('[role="document"]')!.textContent).toBe('What I built and why.');
  expect(host.textContent).toContain('Read only');
  expect(host.textContent).not.toMatch(/grade/i);
  expect(host.querySelector('textarea, input')).toBeNull();
});

it('an ended share reads as no longer shared', async () => {
  mock.tables.role_grants = ok([{ scope_id: 'acme', expires_at: null, revoked_at: null }]);
  answers({
    career_evidence_shared_with_me: [
      ok([{ grant: 'g-1', shared_as: 'Maya R.', purpose: 'Internship', employer_scope: 'acme', granted_at: '2026-10-20T14:00:00Z', expires_at: '2027-01-10T23:59:59Z',
        evidence: [{ evidence: 'e-1', label: 'Capstone report', title: 'Capstone', version_number: 2, saved_at: '2026-10-20T12:00:00Z' }] }]),
    ],
    career_evidence_read: [{ data: null, error: { message: 'semester: no such evidence here', code: '42501' } }],
  });
  act(() => root.render(<SharedWithMe />));
  await flush();
  act(() => button(/Read Capstone report/)!.click());
  await flush();
  expect(host.textContent).toContain('This is no longer shared with you');
});

it('an employer with nothing shared is told so', async () => {
  mock.tables.role_grants = ok([{ scope_id: 'acme', expires_at: null, revoked_at: null }]);
  answers({ career_evidence_shared_with_me: [ok([])] });
  act(() => root.render(<SharedWithMe />));
  await flush();
  expect(host.textContent).toContain('Nothing is shared with you now');
});

it('shows nothing, and asks nothing, to an account that is not an employer', async () => {
  mock.tables.role_grants = ok([{ scope_id: 'acme', expires_at: '2020-01-01T00:00:00Z', revoked_at: null }]);
  act(() => root.render(<SharedWithMe />));
  await flush();
  expect(host.textContent).toBe('');
  expect(calls('career_evidence_shared_with_me')).toHaveLength(0);
});
