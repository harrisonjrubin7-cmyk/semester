// @vitest-environment jsdom
/**
 * The school's records reach the screen only when the school turned them on,
 * and the privacy half is there whether it did or not.
 *
 * Faked: `lib/cloud` (no Supabase behind a test; with `cloudConfigured` false
 * every assertion would pass by the first gate closing) and `claimedSchool`.
 * The fake client answers per table and records what was deleted and updated,
 * so the Delete and Revoke buttons are proved to reach the database with the
 * right filters. Everything else — the flag evaluator, the view, the copy — is
 * the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRESH = new Date(Date.now() - 5 * 60_000).toISOString();

interface World {
  featureState: string;
  switches: { switch_key: string; tenant_id: string | null; engaged: boolean }[];
  rows: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  deleted: Record<string, unknown>[];
  updated: { values: Record<string, unknown>; filter: Record<string, unknown> }[];
}
let world: World;

function query(table: string) {
  const filter: Record<string, unknown> = {};
  let mode: 'select' | 'delete' | 'update' = 'select';
  let values: Record<string, unknown> = {};
  const answer = () => {
    if (mode === 'delete') {
      world.deleted.push({ table, ...filter });
      return { data: [{ id: 'x' }, { id: 'y' }], error: null };
    }
    if (mode === 'update') {
      world.updated.push({ values, filter: { table, ...filter } });
      return { data: null, error: null };
    }
    if (table === 'feature_kill_switch') return { data: world.switches, error: null };
    if (table === 'consent_record') return { data: world.consents, error: null };
    return { data: world.rows, error: null };
  };
  const q: Record<string, unknown> = {
    select: () => q, in: () => q, is: () => q, limit: () => q, like: () => q, order: () => q,
    eq: (k: string, v: unknown) => { filter[k] = v; return q; },
    delete: () => { mode = 'delete'; return q; },
    update: (v: Record<string, unknown>) => { mode = 'update'; values = v; return q; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad),
  };
  return q;
}

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    rpc: async (name: string) => (name === 'feature_state' ? { data: world.featureState, error: null }
      : name === 'feature_narrowing' ? { data: [], error: null } : { data: null, error: null }),
    from: (table: string) => query(table),
  }),
}));
vi.mock('../lib/schoolclaim', () => ({ claimedSchool: async () => 'vu' }));

const { SchoolRecords, SchoolDataPanel } = await import('./SchoolRecords');

const hold = { id: 'h1', canonical_entity_type: 'registration_hold', canonical_entity_id: 'h1', subject_user_id: 'me',
  source_system: 'SIS', source_url: null, source_timestamp: null, source_of_truth: 'Registrar / SIS',
  freshness_status: 'live', updated_at: FRESH,
  display: { office: 'Student Accounts', blocks_registration: true, action_url: 'https://accounts.example.edu/holds' } };

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  world = { featureState: 'production', switches: [], rows: [hold], consents: [], deleted: [], updated: [] };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(el: React.ReactElement) {
  await act(async () => { root.render(el); });
  // The load is several awaits deep (session, school, flag, rows).
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const byText = (tag: string, text: string) => [...host.querySelectorAll(tag)].find((e) => e.textContent?.includes(text));
const click = async (el: Element | undefined) => {
  if (!el) throw new Error('nothing to click');
  await act(async () => { (el as HTMLElement).click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

describe('From your school, on Today', () => {
  it('shows a hold with its office, source, freshness and the official link', async () => {
    await mount(<SchoolRecords />);
    expect(host.textContent).toContain('Something needs doing before you can register.');
    expect(host.textContent).toContain('Action required before you can register — Student Accounts');
    expect(host.textContent).toContain('from Registrar / SIS');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://accounts.example.edu/holds');
    expect(host.querySelector('a')?.getAttribute('rel')).toContain('noopener');
  });

  it('puts an official alert first, with the reminder that Semester is not an emergency channel', async () => {
    world.rows = [hold, { id: 'a1', canonical_entity_type: 'notification', canonical_entity_id: 'a1', subject_user_id: null,
      source_system: 'Alerts', source_url: null, source_timestamp: null, source_of_truth: 'Campus alert system',
      freshness_status: 'live', updated_at: FRESH,
      display: { severity: 'emergency', headline: 'Shelter in place', expires_at: new Date(Date.now() + 3_600_000).toISOString() } }];
    await mount(<SchoolRecords />);
    const facts = [...host.querySelectorAll('.school-fact-text')].map((n) => n.textContent);
    expect(facts[0]).toBe('Emergency: Shelter in place');
    expect(host.textContent).toContain('Semester is not an emergency channel');
  });

  it('draws nothing while the school has the cards off', async () => {
    world.featureState = 'off';
    await mount(<SchoolRecords />);
    expect(host.textContent).toBe('');
  });

  it('draws nothing under the integration kill switch', async () => {
    world.switches = [{ switch_key: 'kill.integration_sync', tenant_id: null, engaged: true }];
    await mount(<SchoolRecords />);
    expect(host.textContent).toBe('');
  });

  it('draws nothing when nothing has been shared', async () => {
    world.rows = [];
    await mount(<SchoolRecords />);
    expect(host.textContent).toBe('');
  });
});

describe('What your school shares, on the privacy page', () => {
  it('is there with the cards off, because transparency is not a feature', async () => {
    world.featureState = 'off';
    await mount(<SchoolDataPanel />);
    expect(host.textContent).toContain('Registration holds');
    expect(host.textContent).toContain('never the reason');
  });

  it('deletes only the student’s own records of that kind, after a second press', async () => {
    await mount(<SchoolDataPanel />);
    await click(byText('button', 'Delete these'));
    expect(world.deleted).toEqual([]);
    await click(byText('button', 'Delete 1'));
    expect(world.deleted).toEqual([{ table: 'canonical_entity_references', subject_user_id: 'me',
      canonical_entity_type: 'registration_hold' }]);
    expect(host.textContent).toContain('unless you also revoke consent');
  });

  it('revokes a consent by marking it revoked, not by deleting the record of it', async () => {
    world.consents = [{ id: 'c1', capability: 'integration:conn_x', status: 'consented', recorded_at: '2026-09-20T00:00:00Z' }];
    await mount(<SchoolDataPanel />);
    await click(byText('button', 'Revoke'));
    await click(byText('button', 'Revoke consent'));
    expect(world.updated).toHaveLength(1);
    expect(world.updated[0].values.status).toBe('revoked');
    expect(world.updated[0].filter).toEqual({ table: 'consent_record', id: 'c1' });
    expect(world.deleted).toEqual([]);
  });

  it('is absent when the school has shared nothing and there is no consent', async () => {
    world.rows = [];
    await mount(<SchoolDataPanel />);
    expect(host.textContent).toBe('');
  });
});
