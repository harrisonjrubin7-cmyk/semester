// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationDashboard } from './IntegrationDashboard';
import { EMPTY_DASHBOARD, MAP_DOMAINS, buildMap, healthSummary, type DashboardData } from '../../lib/integration/dashboard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const downloads = vi.hoisted(() => vi.fn());
vi.mock('../../lib/deliver', () => ({ download: downloads }));

const NOW = new Date('2026-09-27T12:00:00Z');

const DATA: DashboardData = {
  ...EMPTY_DASHBOARD,
  connections: [{
    id: 'c1', public_id: 'conn_0123456789abcdef0123', tenant_id: 'vu', provider_domain: 'lms',
    provider_name: 'Canvas', provider_product: 'LTI 1.3', connection_name: 'Canvas (pilot)',
    status: 'degraded', authentication_type: 'lti_1_3', data_classification_ceiling: 'T1',
    sync_mode: 'webhook', sync_direction: 'read', freshness_target: '1 day',
    last_successful_sync_at: '2026-09-27T09:00:00Z', last_error_at: '2026-09-27T11:00:00Z',
    feature_flag_key: 'integration.lms_lti', owner_account_id: 'u-owner',
    approved_at: '2026-09-20T00:00:00Z', paused_reason: null,
  }],
  scopes: [{ connection_id: 'c1', scope_key: 'scope.lms.assignment_dates_read', approved: true, expires_at: null }],
  errors: [{ id: 'e1', connection_id: 'c1', sync_run_id: null, external_entity_type: 'assignment',
    error_category: 'enum_mismatch', sanitized_message: 'workflow_state has a value outside its enum',
    severity: 'error', retryable: false, retry_count: 0, created_at: '2026-09-27T11:00:00Z' }],
  deadLetters: [{ id: 'd1', connection_id: 'c1', reason: 'provider_unavailable after 5 attempts', attempts: 5,
    replay_requested_at: null, created_at: '2026-09-27T10:00:00Z' }],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  downloads.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(props: Parameters<typeof IntegrationDashboard>[0]) {
  await act(async () => { root.render(<IntegrationDashboard now={NOW} {...props} />); });
}

const click = async (el: Element | null | undefined) => {
  if (!el) throw new Error('nothing to click');
  await act(async () => { (el as HTMLElement).click(); });
};
const byText = (tag: string, text: string) =>
  [...host.querySelectorAll(tag)].find((e) => e.textContent?.includes(text));

describe('the map model', () => {
  it('draws every domain, and an unconnected one as not connected rather than invented', () => {
    const map = buildMap(EMPTY_DASHBOARD, NOW);
    expect(map.map((n) => n.domain)).toEqual(MAP_DOMAINS.map((d) => d.domain));
    for (const n of map) {
      expect(n.status).toBe('none');
      expect(n.description).toMatch(/not connected/);
    }
  });

  it('describes a connected domain in one sentence with everything the node shows', () => {
    const lms = buildMap(DATA, NOW).find((n) => n.domain === 'lms')!;
    expect(lms.description).toBe(
      'LMS: Canvas. Degraded, inbound (read-only), ceiling T1, source of truth LMS, last successful sync 2026-09-27 09:00 UTC, 1 open error.');
  });

  it('exports counts and states, never ids of people or provider messages', () => {
    const text = JSON.stringify(healthSummary(DATA, NOW));
    expect(text).not.toContain('u-owner');
    expect(text).not.toContain('workflow_state');
    expect(text).toContain('"openErrors":1');
  });
});

describe('the dashboard', () => {
  it('shows every domain on the map when nothing is visible, and says why the lists are empty', async () => {
    await mount({ load: async () => EMPTY_DASHBOARD });
    expect(host.querySelectorAll('.integration-node')).toHaveLength(MAP_DOMAINS.length);
    await click(byText('[role="tab"]', 'Connections'));
    expect(host.textContent).toContain('does not hold integration:view');
  });

  it('gives the diagram an equivalent table, row for row', async () => {
    await mount({ load: async () => DATA });
    const nodes = [...host.querySelectorAll('.integration-node-label')].map((n) => n.textContent);
    await click(byText('button', 'Table'));
    const rows = [...host.querySelectorAll('tbody th[scope="row"]')].map((n) => n.textContent);
    expect(rows).toEqual(nodes);
    const lms = host.querySelector('tr[data-domain="lms"]')!;
    expect(lms.textContent).toContain('Degraded');
    expect(lms.textContent).toContain('Inbound (read-only)');
  });

  it('carries status as a word, and describes each node for a screen reader', async () => {
    await mount({ load: async () => DATA });
    const node = byText('.integration-node', 'LMS')!;
    expect(node.textContent).toContain('Degraded');
    const described = document.getElementById(node.getAttribute('aria-describedby')!);
    expect(described?.textContent).toMatch(/source of truth LMS/);
  });

  it('is reachable by keyboard: the view tabs move with the arrow keys', async () => {
    await mount({ load: async () => DATA });
    const list = host.querySelector('[role="tablist"]')!;
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Connections');
  });

  it('never renders a credential, an owner id or the connection row id', async () => {
    const leaky = { ...DATA, connections: [{ ...DATA.connections[0], credentials_reference: 'vault:vu/canvas' } as never] };
    await mount({ load: async () => leaky });
    // Each view is checked while it is on screen: the detail panel unmounts
    // when the tab changes, so one assertion at the end would read only the
    // last view (it did, and missed a row rendered whole into the panel).
    const clean = () => {
      expect(host.innerHTML).not.toContain('vault:');
      expect(host.innerHTML).not.toContain('u-owner');
      expect(host.innerHTML).not.toContain('>c1<');
    };
    await click(byText('.integration-node', 'LMS'));
    expect(host.querySelector('.integration-detail')).not.toBeNull();
    clean();
    await click(byText('button', 'Table'));
    clean();
    for (const tab of ['Connections', 'Mappings', 'Sync history', 'Conflicts']) {
      await click(byText('[role="tab"]', tab));
      clean();
    }
  });

  it('pauses only with a reason and a second press, and reports the outcome', async () => {
    const pause = vi.fn(async () => 'paused');
    await mount({ load: async () => DATA, pause });
    await click(byText('.integration-node', 'LMS'));
    await click(byText('button', 'Pause sync'));
    const confirm = byText('button', 'Confirm pause sync') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input = host.querySelector('.integration-confirm input') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'provider maintenance');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText('button', 'Confirm pause sync'));
    expect(pause).toHaveBeenCalledWith('conn_0123456789abcdef0123', true, 'provider maintenance');
    expect(host.textContent).toContain('Canvas (pilot) is now paused.');
  });

  it('shows a refusal from the database as the answer, not as success', async () => {
    const replay = vi.fn(async () => { throw new Error('Integration sync is stopped by a kill switch.'); });
    await mount({ load: async () => DATA, replay });
    await click(byText('[role="tab"]', 'Conflicts'));
    expect(host.textContent).toContain('enum mismatch');
    await click(byText('button', 'Request replay'));
    const input = host.querySelector('.integration-confirm input') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'provider back');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText('button', 'Confirm request replay'));
    expect(host.textContent).toContain('stopped by a kill switch');
  });

  it('says so when it cannot load, rather than drawing an empty map as fact', async () => {
    await mount({ load: async () => { throw new Error('permission denied'); } });
    expect(host.querySelector('[role="alert"]')?.textContent ?? host.textContent).toContain('permission denied');
  });
});

it('keeps all five working downloads disabled and exports only the established health-summary projection', async () => {
  const data: DashboardData = {
    ...DATA,
    mappings: [{ connection_id: 'c1', external_entity_type: 'assignment', canonical_entity_type: 'coursework',
      external_field: 'PRIVATE_MAPPING_TEXT', canonical_field: 'title', transform_config: {}, required: true,
      mapping_version: 1, active: true, validation_state: 'conflict', conflict_kind: 'enum_mismatch' }],
    runs: [{ public_id: 'run_PRIVATE_IDENTIFIER', connection_id: 'c1', trigger_type: 'manual', status: 'partial',
      started_at: '2026-09-27T09:00:00Z', completed_at: null, records_received: 5, records_created: 0,
      records_updated: 2, records_unchanged: 0, records_rejected: 3, errors_count: 1, retry_count: 0,
      reconciliation_state: 'pending', cursor_after: null }],
  };
  await mount({ load: async () => data });
  await click(byText('button', 'Table'));
  const checkDownload = async (id: string) => {
    const table = host.querySelector(`[data-human-table="${id}"]`)!;
    expect(table).not.toBeNull();
    for (const mode of ['Card view', 'Summary view', 'Table view']) {
      await click([...table.querySelectorAll('button')].find((b) => b.textContent === mode));
      const download = [...table.querySelectorAll('button')].find((b) => b.textContent === 'Download visible rows')!;
      expect(download.disabled).toBe(true);
      await click(download);
      expect(downloads).not.toHaveBeenCalled();
      expect(table.textContent).toContain('Use Export health summary');
    }
  };
  await checkDownload('integration-domains');
  for (const [tab, id] of [['Connections', 'connections'], ['Mappings', 'mappings'], ['Sync history', 'runs'], ['Conflicts', 'conflicts']]) {
    await click(byText('[role="tab"]', tab));
    await checkDownload(`integration-${id}`);
  }
  await click(byText('button', 'Export health summary'));
  expect(downloads).toHaveBeenCalledTimes(1);
  const file = downloads.mock.calls[0][0];
  expect(file.mime).toBe('application/json');
  expect(JSON.parse(file.body)).toEqual(healthSummary(data, NOW));
  expect(file.body).not.toMatch(/run_PRIVATE_IDENTIFIER|PRIVATE_MAPPING_TEXT|Canvas \(pilot\)|workflow_state|u-owner/);
  expect(file.body).toContain(DATA.connections[0].public_id);
});
