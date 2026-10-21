// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Mine › Documents, on screen: listing, making a document, saving a version
 * on the revision read, a stale save that shows the newer version and never
 * overwrites the student's text, an earlier version opened read-only, sharing
 * and stopping a share, and the not-set-up, refused and signed-out states.
 * The server's rules are proved by `supabase/workspace-objects.check.sql`.
 */

const ME = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';

type Reply = { data: unknown; error: { message: string; code?: string } | null };
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  say: vi.fn(),
  dispatch: vi.fn(),
  account: null as { id: string } | null,
  tables: {} as Record<string, Reply>,
  queries: [] as { table: string; filters: unknown[][] }[],
}));

/** A PostgREST query that records its filters and resolves to the table's fixture. */
function query(table: string) {
  const record = { table, filters: [] as unknown[][] };
  mock.queries.push(record);
  const q = {
    select: () => q,
    eq: (...a: unknown[]) => { record.filters.push(['eq', ...a]); return q; },
    is: (...a: unknown[]) => { record.filters.push(['is', ...a]); return q; },
    order: () => q,
    then: (ok: (r: Reply) => unknown, no?: (e: unknown) => unknown) => Promise.resolve(mock.tables[table] ?? { data: [], error: null }).then(ok, no),
  };
  return q;
}

vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: (t: string) => query(t) }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say, dispatch: mock.dispatch, account: mock.account }) }));
const { Documents } = await import('./Documents');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  mock.dispatch.mockReset();
  mock.account = { id: ME };
  mock.tables = {};
  mock.queries = [];
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
const DOC = { object: 'o-1', kind: 'document', title: 'Capstone report', revision: 1, version: 'v-1', updated_at: '2026-10-20T12:00:00Z' };
const v = (n: number, body: string, extra: Record<string, unknown> = {}) => ({
  object: 'o-1', kind: 'document', version: `v-${n}`, version_number: n, title: 'Capstone report', body, mime_type: 'text/plain',
  content_schema: 'semester.document/1', byte_length: body.length, content_sha256: HASH, saved_at: `2026-10-2${n}T12:00:00Z`,
  access: 'owner', revision: n, current: true, ...extra,
});
const versionRow = (n: number) => ({ id: `v-${n}`, version_number: n, title: 'Capstone report', byte_length: 10, content_sha256: HASH, created_at: `2026-10-2${n}T12:00:00Z` });

/** Answers each RPC from a queue per name; the last answer repeats. */
function answers(map: Record<string, Reply[]>) {
  mock.rpc.mockImplementation((name: string) => {
    const q = map[name];
    if (!q || q.length === 0) return Promise.resolve({ data: null, error: null });
    return Promise.resolve(q.length > 1 ? q.shift()! : q[0]);
  });
}
const ok = (data: unknown): Reply => ({ data, error: null });
const calls = (name: string) => mock.rpc.mock.calls.filter((c) => c[0] === name);

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''));
const fieldByLabel = (label: string) => {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent === label)!;
  return host.querySelector(`#${CSS.escape(l.htmlFor)}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
};
const type = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
const render = async () => { act(() => root.render(<Documents />)); await flush(); };
const openDoc = async () => {
  act(() => button(/^Capstone report$/)!.click());
  await flush();
};

it('lists the student’s documents with how many versions each has', async () => {
  answers({ workspace_objects_mine: [ok([DOC])] });
  await render();
  expect(host.querySelector('table')!.textContent).toContain('Capstone report');
  expect(host.textContent).toContain('1 document');
  expect(host.textContent).toContain(ME);
});

it('says what would fill an empty list', async () => {
  answers({ workspace_objects_mine: [ok([])] });
  await render();
  expect(host.textContent).toContain('No documents kept in Semester yet');
  expect(button(/New document/)).toBeDefined();
});

it('makes a document as version 1 and opens it with the receipt', async () => {
  answers({
    workspace_objects_mine: [ok([])],
    workspace_object_create: [ok({ object: 'o-1', version: 'v-1', version_number: 1, revision: 1, content_sha256: HASH, byte_length: 12, saved_at: '2026-10-21T12:00:00Z' })],
    workspace_object_read: [ok(v(1, 'First draft.'))],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  await render();
  act(() => button(/New document/)!.click());

  act(() => button(/Create document/)!.click());
  expect(calls('workspace_object_create')).toHaveLength(0);
  expect(host.textContent).toContain('Give it a title first.');

  type(fieldByLabel('Title'), 'Capstone report');
  type(fieldByLabel('Format'), 'text/markdown');
  type(fieldByLabel('Text'), 'First draft.');
  act(() => button(/Create document/)!.click());
  await flush();

  expect(calls('workspace_object_create')).toHaveLength(1);
  expect(calls('workspace_object_create')[0][1]).toMatchObject({
    want_kind: 'document', want_title: 'Capstone report', want_body: 'First draft.', want_mime: 'text/markdown', want_schema: 'semester.document/1',
  });
  expect(String(calls('workspace_object_create')[0][1].want_key)).toMatch(/^create/);
  expect(host.textContent).toContain('Capstone report is kept in Semester as version 1');
  expect(host.textContent).toContain('3f9a…c210');
  expect(button(/Save version 2/)).toBeDefined();
});

it('saves a new version on the revision it read', async () => {
  answers({
    workspace_objects_mine: [ok([DOC])],
    workspace_object_read: [ok(v(1, 'First draft.'))],
    workspace_object_save: [ok({ object: 'o-1', version: 'v-2', version_number: 2, revision: 2, content_sha256: HASH, byte_length: 13, saved_at: '2026-10-22T12:00:00Z' })],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  await render();
  await openDoc();

  expect(button(/Save version 2/)!.disabled).toBe(true);
  type(fieldByLabel('Text'), 'Second draft.');
  act(() => button(/Save version 2/)!.click());
  await flush();

  expect(calls('workspace_object_save')[0][1]).toMatchObject({ want_object: 'o-1', want_expected_revision: 1, want_body: 'Second draft.' });
  expect(host.textContent).toContain('Saved as version 2');
  expect(host.textContent).toContain('Version 1 and earlier are unchanged');
  expect(button(/Save version 3/)).toBeDefined();
});

it('on a stale save shows the newer version, keeps the student’s text, and loads it only when asked', async () => {
  answers({
    workspace_objects_mine: [ok([DOC])],
    workspace_object_read: [ok(v(1, 'First draft.')), ok(v(2, 'Saved on my laptop.'))],
    workspace_object_save: [{ data: null, error: { message: 'semester: changed since you read it', code: '40001' } }],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  await render();
  await openDoc();

  type(fieldByLabel('Text'), 'Written on my phone.');
  act(() => button(/Save version 2/)!.click());
  await flush();

  expect(host.textContent).toContain('This changed since you opened it');
  expect(host.textContent).toContain('nothing was overwritten');
  // The newer version is shown, and the editor still holds what the student wrote.
  expect(host.querySelector('[aria-label="Version 2, saved since you opened this"]')!.textContent).toBe('Saved on my laptop.');
  expect((fieldByLabel('Text') as HTMLTextAreaElement).value).toBe('Written on my phone.');
  expect(button(/Save version 2/)!.disabled).toBe(true);
  expect(calls('workspace_object_save')).toHaveLength(1);

  act(() => button(/Load version 2 to edit/)!.click());
  expect((fieldByLabel('Text') as HTMLTextAreaElement).value).toBe('Saved on my laptop.');
  expect(host.querySelector('[aria-label="Your text that was not saved"] [role="document"]')!.textContent).toBe('Written on my phone.');
  expect(button(/Save version 3/)).toBeDefined();
});

it('opens an earlier version read-only', async () => {
  answers({
    workspace_objects_mine: [ok([{ ...DOC, revision: 2, version: 'v-2' }])],
    workspace_object_read: [ok(v(2, 'Second draft.')), ok(v(1, 'First draft.', { current: false, revision: 2 }))],
  });
  mock.tables.workspace_object_versions = ok([versionRow(2), versionRow(1)]);
  await render();
  await openDoc();

  act(() => button(/View version 1 read-only/)!.click());
  await flush();
  expect(calls('workspace_object_read')[1][1]).toEqual({ want_object: 'o-1', want_version: 'v-1' });
  expect(host.textContent).toContain('Read only. This is version 1');
  expect(host.textContent).toContain('Saving never changes it');
  expect(host.querySelector('[role="document"]')!.textContent).toBe('First draft.');
  expect(host.querySelector('textarea')).toBeNull();
});

it('shares the live document after a preview, and offers edit only on the live document', async () => {
  answers({
    workspace_objects_mine: [ok([DOC])],
    workspace_object_read: [ok(v(1, 'First draft.'))],
    workspace_object_grant: [ok({ grant: 'g-1', object: 'o-1', version: null, permission: 'edit', expires_at: null, granted_at: '2026-10-21T12:00:00Z' })],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  await render();
  await openDoc();
  expect(host.textContent).toContain('Only you can open this document');

  type(fieldByLabel('What to share'), 'v-1');
  const editOption = (fieldByLabel('They can') as HTMLSelectElement).querySelector('option[value="edit"]') as HTMLOptionElement;
  expect(editOption.disabled).toBe(true);
  type(fieldByLabel('What to share'), 'live');
  expect(editOption.disabled).toBe(false);

  type(fieldByLabel('Their account id'), ME);
  type(fieldByLabel('What it is shared for'), 'Peer review');
  expect(host.textContent).toContain('That is your own account');
  expect(button(/Review and share/)!.disabled).toBe(true);

  type(fieldByLabel('Their account id'), FRIEND);
  type(fieldByLabel('They can'), 'edit');
  act(() => button(/Review and share/)!.click());
  expect(calls('workspace_object_grant')).toHaveLength(0);
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain('including versions you save later');

  act(() => button(/^Share$/)!.click());
  await flush();
  expect(calls('workspace_object_grant')[0][1]).toMatchObject({
    want_object: 'o-1', want_version: null, want_grantee: FRIEND, want_permission: 'edit', want_purpose: 'Peer review', want_expires_at: null,
  });
  expect(host.textContent).toContain(`Shared with ${FRIEND}: read and save new versions until you stop it.`);
});

it('stops a live share after a preview', async () => {
  answers({
    workspace_objects_mine: [ok([DOC])],
    workspace_object_read: [ok(v(1, 'First draft.'))],
    workspace_object_revoke: [ok({ grant: 'g-1', revoked_at: '2026-10-21T13:00:00Z' })],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  mock.tables.workspace_object_grants = ok([
    { id: 'g-1', version_id: null, grantee: FRIEND, permission: 'read', purpose: 'Peer review', expires_at: null, revoked_at: null, created_at: '2026-10-20T12:00:00Z' },
    { id: 'g-0', version_id: 'v-1', grantee: FRIEND, permission: 'comment', purpose: 'Old', expires_at: null, revoked_at: '2026-10-19T12:00:00Z', created_at: '2026-10-18T12:00:00Z' },
  ]);
  await render();
  await openDoc();

  const table = [...host.querySelectorAll('table')].at(-1)!;
  expect(table.textContent).toContain('Active until you stop it');
  expect(table.textContent).toContain('Version 1 only');
  expect(table.textContent).toMatch(/Stopped/);
  // Only the live share can be stopped.
  expect([...table.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([`Stop sharing with ${FRIEND}`]);

  act(() => button(new RegExp(`Stop sharing with ${FRIEND}`))!.click());
  expect(calls('workspace_object_revoke')).toHaveLength(0);
  act(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Stop sharing')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
  expect(calls('workspace_object_revoke')[0][1]).toEqual({ want_grant: 'g-1' });
  expect(host.textContent).toContain(`Stopped sharing with ${FRIEND}`);
});

it('shows a refusal in the server’s words and keeps the text', async () => {
  answers({
    workspace_objects_mine: [ok([DOC])],
    workspace_object_read: [ok(v(1, 'First draft.'))],
    workspace_object_save: [{ data: null, error: { message: 'semester: no such object here', code: '42501' } }],
  });
  mock.tables.workspace_object_versions = ok([versionRow(1)]);
  await render();
  await openDoc();
  type(fieldByLabel('Text'), 'Second draft.');
  act(() => button(/Save version 2/)!.click());
  await flush();
  expect(host.textContent).toContain('No such object here.');
  expect((fieldByLabel('Text') as HTMLTextAreaElement).value).toBe('Second draft.');
});

it('says when the school has no documents service yet, and offers nothing that would fail', async () => {
  answers({ workspace_objects_mine: [{ data: null, error: { message: 'function public.workspace_objects_mine() does not exist', code: '42883' } }] });
  await render();
  expect(host.textContent).toContain('Saving to Semester is not set up at your school yet');
  expect(button(/New document/)).toBeUndefined();
});

it('a failed load says so and offers to load again', async () => {
  answers({ workspace_objects_mine: [{ data: null, error: { message: 'Failed to fetch' } }, ok([DOC])] });
  await render();
  expect(host.querySelector('[role="alert"]')!.textContent).toContain('Your documents did not load');
  act(() => button(/Load again/)!.click());
  await flush();
  expect(host.textContent).toContain('Capstone report');
});

it('asks a signed-out student to sign in rather than calling the server', async () => {
  mock.account = null;
  await render();
  expect(host.textContent).toContain('Sign in to keep documents in Semester');
  expect(mock.rpc).not.toHaveBeenCalled();
  act(() => button(/Open Account/)!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'account' });
});
