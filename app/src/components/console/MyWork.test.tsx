// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalRequest, CommandItem, IntegrationHealth } from '../../lib/console/client';
import { MyWork, type MyWorkReaders } from './MyWork';

vi.mock('../../lib/experience-flags', () => ({ EXPERIENCE_FLAGS: { supportTickets: 'production' } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-26T12:00:00Z');
const PLATFORM = [{ capability: 'console:operate', scopeKind: 'platform', scopeId: '' }];
const WITH_INTEGRATIONS = [...PLATFORM, { capability: 'integration:view', scopeKind: 'school', scopeId: 'vu' }];

const command: CommandItem = {
  id: 'c1', severity: 'critical', category: 'release', title: 'Release gate open', tenantId: 'vu', tenantName: 'Vanderbilt',
  isDemo: false, owner: 'ops', dueAt: null, status: 'open', nextStep: 'Hold the release', route: '/console',
  source: 'release_gate', evidence: 'gate row 12', limitation: 'staging only', observedAt: NOW.toISOString(),
};
const approval: ApprovalRequest = {
  id: 'a1', dutyId: 'role.grant', requester: 'op-2', tenantId: null, tenantName: null, isDemo: false, target: 'user-9',
  detail: {}, evidence: 'Access review', ticket: 'OPS-1', status: 'pending', correlationId: null, createdAt: NOW.toISOString(),
  expiresAt: '2026-10-29T12:00:00Z', decidedAt: null, executedAt: null, approvals: 0, rejections: 0, mine: false,
  decidedByMe: false, canDecide: true,
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

const readers = (over: Partial<MyWorkReaders> = {}): MyWorkReaders => ({
  command: vi.fn(async () => [command]),
  approvals: vi.fn(async () => [approval]),
  integrations: vi.fn(async (): Promise<IntegrationHealth[]> => []),
  ...over,
});

async function render(props: { readers: MyWorkReaders; grants?: typeof PLATFORM; scope?: string; filter?: string; onOpen?: (id: string) => void }) {
  await act(async () => {
    root.render(
      <MyWork
        env="Staging"
        scope={props.scope ?? 'All'}
        filter={props.filter ?? ''}
        onStatus={() => {}}
        privileged={() => {}}
        grants={props.grants ?? PLATFORM}
        onOpen={props.onOpen ?? (() => {})}
        readers={props.readers}
        now={() => NOW}
      />,
    );
  });
  await act(async () => { await Promise.resolve(); });
}

const text = () => host.textContent ?? '';
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

describe('My work', () => {
  it('does not call a reader the operator holds no grant for', async () => {
    const r = readers();
    await render({ readers: r });
    expect(r.integrations).not.toHaveBeenCalled();
    expect(text()).toContain('Not in your grants — not read');
  });

  it('calls the integration reader only with an integration grant', async () => {
    const r = readers();
    await render({ readers: r, grants: WITH_INTEGRATIONS });
    expect(r.integrations).toHaveBeenCalledTimes(1);
  });

  it('counts across sources and orders critical work first', async () => {
    await render({ readers: readers() });
    expect(text()).toContain('2 open: 1 critical · 1 high');
    const rows = [...host.querySelectorAll('[aria-label="My work queue"] li')].map((li) => li.textContent);
    expect(rows[0]).toContain('Critical · Release gate open');
    expect(rows[1]).toContain('Awaiting your decision');
  });

  it('says the total is a floor, not a count, when a source fails', async () => {
    await render({ readers: readers({ approvals: vi.fn(async () => { throw new Error('permission denied'); }) }) });
    expect(text()).toContain('At least 1 open');
    expect(text()).toContain('1 of 2 sources read');
    expect(text()).toContain('Unavailable — permission denied');
    expect(text()).not.toMatch(/\b0 open\b/);
  });

  it('keeps work outside the selected tenant out of the count', async () => {
    await render({ readers: readers(), scope: 'other-school' });
    expect(text()).toContain('0 open');
    expect(text()).toContain('Nothing open for you in this scope');
  });

  it('opens record details with provenance and hands the action to the owning workspace', async () => {
    const onOpen = vi.fn();
    await render({ readers: readers(), onOpen });
    await act(async () => { button(/Release gate open/)!.click(); });
    const details = host.querySelector('[aria-label="Record details: Release gate open"]');
    expect(details?.textContent).toContain('gate row 12');
    expect(details?.textContent).toContain('staging only');
    expect(details?.textContent).toContain('console_command_center');
    await act(async () => { button(/^Open in Command center$/)!.click(); });
    expect(onOpen).toHaveBeenCalledWith('command');
  });

  it('filters by text without changing the open count', async () => {
    await render({ readers: readers(), filter: 'role.grant' });
    expect(text()).toContain('2 open');
    expect(host.querySelectorAll('[aria-label="My work queue"] li')).toHaveLength(1);
  });
});
