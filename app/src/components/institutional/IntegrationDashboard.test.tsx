// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationDashboard } from './IntegrationDashboard';
import { EMPTY_DASHBOARD, MAP_DOMAINS, buildMap, healthSummary, type DashboardData } from '../../lib/integration/dashboard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const ERROR_DATA: DashboardData = {
  ...DATA,
  connections: [
    ...DATA.connections,
    {
      ...DATA.connections[0],
      id: 'c2',
      public_id: 'conn_abcdef0123456789abcd',
      tenant_id: 'other-school',
      provider_domain: 'erp',
      provider_name: 'Workday',
      provider_product: null,
      connection_name: 'Workday finance',
      owner_account_id: null,
    },
  ],
  mappings: [{
    connection_id: 'c1', external_entity_type: 'assignment', canonical_entity_type: 'coursework',
    external_field: 'workflow_state', canonical_field: 'status', transform_config: {}, required: true,
    mapping_version: 1, active: true, validation_state: 'conflict', conflict_kind: 'enum_mismatch',
  }],
  errors: [
    DATA.errors[0],
    {
      id: 'e2', connection_id: 'c2', sync_run_id: 'raw-run-id', external_entity_type: 'person-record',
      error_category: 'rate_limit', sanitized_message: 'Provider said secret-person-447 exceeded quota',
      severity: 'warning', retryable: true, retry_count: 2, created_at: 'not-a-date',
    },
    {
      id: 'e3', connection_id: 'raw-unknown-connection', sync_run_id: null, external_entity_type: null,
      error_category: 'authentication', sanitized_message: 'Bearer provider-secret',
      severity: 'critical', retryable: false, retry_count: 1, created_at: '2026-09-27T08:00:00Z',
    },
  ],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
const choose = async (label: string, value: string) => {
  const field = [...host.querySelectorAll('label')].find((e) => e.textContent?.includes(label));
  const select = field?.querySelector('select') as HTMLSelectElement | null;
  if (!select) throw new Error(`no select labelled ${label}`);
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

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
    const summary = healthSummary(DATA, NOW);
    const text = JSON.stringify(summary);
    expect(text).not.toContain('u-owner');
    expect(text).not.toContain('workflow_state');
    expect(text).toContain('"openErrors":1');
    expect(summary.conflicts).toEqual([{ kind: 'enum_mismatch', count: 1, connections: 1 }]);
    expect(summary.connections[0]).toEqual({
      connection: 'conn_0123456789abcdef0123', domain: 'lms', provider: 'Canvas', status: 'degraded',
      direction: 'read', ceiling: 'T1', freshness: 'recent', lastSuccessfulSync: '2026-09-27T09:00:00Z',
      approved: true, openErrors: 1, deadLetters: 1,
    });
  });
});

describe('the error drill-down at narrow widths', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `${selector} exists`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('}', start));
  };

  it('wraps filters, keeps disclosures finger-sized, and stacks detail terms', () => {
    expect(rule('.integration-error-filters')).toMatch(/grid-template-columns:\s*repeat\(auto-fit/);
    expect(rule('.integration-error-filters label')).toMatch(/min-width:\s*0/);
    expect(rule('.integration-error-filters select')).toMatch(/min-height:\s*var\(--target-primary\)/);
    expect(rule('.integration-error-list summary')).toMatch(/min-height:\s*var\(--target-primary\)/);
    expect(rule('.integration-error-list summary')).toMatch(/display:\s*list-item/);
    expect(css).toMatch(
      /@media \(max-width: 560px\) \{\s*\.integration-detail dl,\s*\.integration-error-list dl \{\s*grid-template-columns:\s*1fr/,
    );
  });
});

describe('the dashboard', () => {
  it('shows an explicit loading state instead of an empty dashboard as fact', async () => {
    let finish!: (data: DashboardData) => void;
    const pending = new Promise<DashboardData>((resolve) => { finish = resolve; });
    await mount({ load: async () => pending });

    expect(host.querySelector('.state-loading')).toBeTruthy();
    expect(host.textContent).toContain('Loading integration status');
    expect(host.querySelector('.integration-node')).toBeNull();

    await act(async () => { finish(ERROR_DATA); await pending; });
    expect(host.querySelector('.state-loading')).toBeNull();
    expect(host.querySelectorAll('.integration-node')).toHaveLength(MAP_DOMAINS.length);
  });

  it('shows a recoverable error state and retries the same scoped reader', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce(ERROR_DATA);
    await mount({ load });

    expect(host.querySelector('.state-error')).toBeTruthy();
    expect(host.textContent).toContain('permission denied');
    expect(host.querySelector('.integration-node')).toBeNull();
    await click(byText('button', 'Retry'));
    expect(load).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.state-error')).toBeNull();
    expect(host.querySelectorAll('.integration-node')).toHaveLength(MAP_DOMAINS.length);
  });

  it('lists each loaded sync error with bounded metadata from multiple connections', async () => {
    await mount({ load: async () => ERROR_DATA });
    await click(byText('[role="tab"]', 'Conflicts'));

    const rows = [...host.querySelectorAll('.integration-error-list details')];
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('summary')?.textContent).toContain('Canvas (pilot)');
    expect(rows[0].textContent).toMatch(/enum mismatch/i);
    expect(rows[0].textContent).toMatch(/severity.*error/i);
    expect(rows[0].textContent).toMatch(/not retryable/i);
    expect(rows[1].querySelector('summary')?.textContent).toContain('Workday finance');
    expect(rows[1].textContent).toMatch(/rate limit/i);
    expect(rows[1].textContent).toMatch(/2 retries/i);
    expect(rows[2].querySelector('summary')?.textContent).toContain('Unknown');
    expect(rows[2].textContent).toMatch(/not retryable · 1 retry/i);
    const mappingTable = host.querySelector('[aria-label="Mapping conflicts"]');
    expect(mappingTable?.textContent).toMatch(/enum mismatch.*1/i);
    expect(mappingTable?.textContent).not.toMatch(/enum mismatch.*2/i);
  });

  it('filters loaded errors with labelled controls and keeps native keyboard disclosure', async () => {
    await mount({ load: async () => ERROR_DATA });
    await click(byText('[role="tab"]', 'Conflicts'));

    expect(byText('legend', 'Filter sync errors')).toBeTruthy();
    expect([...host.querySelectorAll('.integration-error-filters label')].map((label) => label.querySelector('span')?.textContent)).toEqual([
      'Connection', 'Category', 'Severity', 'Retry status',
    ]);
    const first = host.querySelector('.integration-error-list summary') as HTMLElement;
    expect(first.tabIndex).toBe(0);
    await click(first);
    expect(first.closest('details')?.open).toBe(true);

    await choose('Severity', 'warning');
    let shown = [...host.querySelectorAll('.integration-error-list summary')].map((row) => row.textContent);
    expect(shown).toEqual(['Workday finance · rate limit']);
    await choose('Severity', 'all');
    await choose('Retry status', 'not-retryable');
    shown = [...host.querySelectorAll('.integration-error-list summary')].map((row) => row.textContent);
    expect(shown).toEqual(['Canvas (pilot) · enum mismatch', 'Unknown · authentication']);
  });

  it('falls back safely for invalid dates and never exposes raw error values', async () => {
    const leaky: DashboardData = {
      ...ERROR_DATA,
      connections: ERROR_DATA.connections.map((connection, index) => index === 1
        ? { ...connection, credentials_reference: 'vault:raw-credential' } as never
        : connection),
      errors: ERROR_DATA.errors.map((error, index) => index === 1
        ? { ...error, provider_payload: 'raw-payload', cursor: 'raw-cursor' } as never
        : error),
    };
    await mount({ load: async () => leaky });
    await click(byText('[role="tab"]', 'Conflicts'));

    const text = host.textContent ?? '';
    const html = host.innerHTML;
    expect(text).toContain('Date unavailable');
    for (const raw of [
      'raw-run-id', 'person-record', 'Provider said secret-person-447 exceeded quota',
      'Bearer provider-secret', 'raw-unknown-connection', 'other-school', 'vault:raw-credential',
      'raw-payload', 'raw-cursor', 'provider_unavailable after 5 attempts',
    ]) expect(html).not.toContain(raw);
  });

  it('keeps mapping-only conflicts separate from the loaded sync-error window', async () => {
    const mappingOnly: DashboardData = {
      ...EMPTY_DASHBOARD,
      mappings: [{
        connection_id: 'missing-connection', external_entity_type: 'course', canonical_entity_type: 'course',
        external_field: 'state', canonical_field: 'status', transform_config: {}, required: true,
        mapping_version: 2, active: true, validation_state: 'conflict', conflict_kind: 'type_mismatch',
      }],
    };
    await mount({ load: async () => mappingOnly });
    await click(byText('[role="tab"]', 'Conflicts'));

    expect(host.textContent).toContain('Sync errors and mapping conflicts are separate');
    expect(host.textContent).toContain('No unresolved sync error rows are available in this loaded window');
    expect(host.textContent).toContain('That does not prove prior syncs succeeded');
    expect(byText('.section-label', 'Mapping conflicts')).toBeTruthy();
    const mappingTable = host.querySelector('[aria-label="Mapping conflicts"]');
    expect(mappingTable?.textContent).toMatch(/type mismatch.*1/i);
    expect(host.querySelector('.integration-error-list')).toBeNull();
    expect(host.textContent).toContain('No dead letters in this loaded window');

    await click(byText('[aria-label="Error investigation"] button', 'Sync history'));
    expect(host.textContent).toContain('No sync runs are available in this loaded window');
    expect(host.textContent).toContain('That does not prove no prior sync occurred');
    expect(host.textContent).not.toContain('Nothing has synced');
  });

  it('states the 200-row boundary without implying complete error history', async () => {
    const capped: DashboardData = {
      ...DATA,
      errors: Array.from({ length: 200 }, (_, index) => ({
        ...DATA.errors[0],
        id: `error-${index}`,
        error_category: index % 2 === 0 ? 'enum_mismatch' : 'rate_limit',
        retryable: index % 2 === 1,
        retry_count: index % 3,
      })),
    };
    await mount({ load: async () => capped });
    await click(byText('[role="tab"]', 'Conflicts'));

    expect(host.querySelectorAll('.integration-error-list details')).toHaveLength(200);
    expect(host.textContent).toContain('Showing 200 of the newest 200 unresolved sync errors available to your account');
    expect(host.textContent).toContain('Earlier unresolved errors may exist');
    expect(host.textContent).not.toContain('All unresolved errors');

    await choose('Category', 'rate_limit');
    expect(host.querySelectorAll('.integration-error-list details')).toHaveLength(100);
    expect(host.textContent).toContain('Showing 100 of the newest 200 unresolved sync errors available to your account');
  });

  it('filters duplicate and reserved connection names without exposing their ids', async () => {
    const duplicateNames: DashboardData = {
      ...ERROR_DATA,
      connections: ERROR_DATA.connections.map((connection) => ({ ...connection, connection_name: 'all' })),
      errors: ERROR_DATA.errors.slice(0, 2),
    };
    await mount({ load: async () => duplicateNames });
    await click(byText('[role="tab"]', 'Conflicts'));

    const select = [...host.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Connection'))
      ?.querySelector('select') as HTMLSelectElement;
    const named = [...select.options].filter((option) => option.textContent?.startsWith('all ·'));
    expect(named.map((option) => option.textContent)).toEqual(['all · 1 of 2', 'all · 2 of 2']);
    expect(named[0].value).not.toContain('c1');
    expect(named[1].value).not.toContain('c2');

    await choose('Connection', named[1].value);
    expect([...host.querySelectorAll('.integration-error-list summary')].map((row) => row.textContent)).toEqual([
      'all · rate limit',
    ]);
    expect(host.innerHTML).not.toContain('value="c1"');
    expect(host.innerHTML).not.toContain('value="c2"');
  });

  it('clears filters after an action refresh replaces the loaded window', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(ERROR_DATA)
      .mockResolvedValueOnce({ ...ERROR_DATA, errors: [ERROR_DATA.errors[0]] });
    const replay = vi.fn(async () => undefined);
    await mount({ load, replay });
    await click(byText('[role="tab"]', 'Conflicts'));
    await choose('Severity', 'warning');
    expect(host.querySelectorAll('.integration-error-list details')).toHaveLength(1);

    await click(byText('button', 'Request replay'));
    const reason = host.querySelector('.integration-confirm input') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(reason, 'retry after maintenance');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText('button', 'Confirm request replay'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const severity = [...host.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Severity'))
      ?.querySelector('select') as HTMLSelectElement;
    expect(load).toHaveBeenCalledTimes(2);
    expect(severity.value).toBe('all');
    expect(host.querySelectorAll('.integration-error-list details')).toHaveLength(1);
  });

  it('navigates to loaded sync history and the existing dead-letter section without raw ids', async () => {
    const withHistory: DashboardData = {
      ...ERROR_DATA,
      runs: [{
        public_id: 'sync_0123456789abcdef0123', connection_id: 'c1', trigger_type: 'scheduled', status: 'failed',
        started_at: '2026-09-27T10:00:00Z', completed_at: '2026-09-27T10:01:00Z', records_received: 3,
        records_created: 0, records_updated: 0, records_unchanged: 0, records_rejected: 3, errors_count: 3,
        retry_count: 2, reconciliation_state: 'not_reconciled', cursor_after: { cursor: 'raw-provider-cursor' },
      }],
    };
    await mount({ load: async () => withHistory });
    await click(byText('[role="tab"]', 'Conflicts'));

    const navigation = host.querySelector('[aria-label="Error investigation"]')!;
    const deadLetters = byText('[aria-label="Error investigation"] a', 'Dead letters') as HTMLAnchorElement;
    expect(deadLetters.getAttribute('href')).toBe('#integration-dead-letters');
    expect(document.getElementById('integration-dead-letters')).toBeTruthy();
    expect(navigation.innerHTML).not.toContain('raw-run-id');
    expect(navigation.innerHTML).not.toContain('raw-unknown-connection');

    await click(byText('[aria-label="Error investigation"] button', 'Sync history'));
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Sync history');
    expect(host.textContent).toContain('sync_0123456789abcdef0123');
    expect(host.innerHTML).not.toContain('raw-provider-cursor');
  });

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
    expect(replay).not.toHaveBeenCalled();
    await click(byText('button', 'Request replay'));
    expect(replay).not.toHaveBeenCalled();
    const input = host.querySelector('.integration-confirm input') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'provider back');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText('button', 'Confirm request replay'));
    expect(replay).toHaveBeenCalledWith('d1', 'provider back');
    expect(host.textContent).toContain('stopped by a kill switch');
  });

  it('says so when it cannot load, rather than drawing an empty map as fact', async () => {
    await mount({ load: async () => { throw new Error('permission denied'); } });
    expect(host.querySelector('[role="alert"]')?.textContent ?? host.textContent).toContain('permission denied');
  });
});
