import { describe, expect, it, vi } from 'vitest';
import type { Grant } from '../capabilities';
import {
  CONSOLE_WORKSPACES,
  canDiscoverWorkspace,
  isConsoleWorkspaceId,
  visibleConsoleWorkspaces,
  type ConsoleWorkspace,
} from './workspaces';

vi.mock('../experience-flags', () => ({ EXPERIENCE_FLAGS: { supportTickets: 'production' } }));

const grant = (capability: string, scopeKind = 'platform', scopeId = ''): Grant => ({
  capability,
  scopeKind,
  scopeId,
});

describe('console workspace registry', () => {
  it('preserves the current view order and declares a classification for every view', () => {
    expect(CONSOLE_WORKSPACES.map(({ id }) => id)).toEqual([
      'command', 'support', 'approvals', 'breakglass', 'audit', 'tenant-operations', 'privacy', 'integration-health', 'release-incidents', 'customers', 'figures', 'finance', 'evidence', 'views',
    ]);
    expect(CONSOLE_WORKSPACES.every(({ classification }) => classification.length > 0)).toBe(true);
  });

  it('requires an exact capability and scope match for discoverability', () => {
    const billing: ConsoleWorkspace = {
      id: 'figures',
      label: 'Billing operations',
      capability: 'billing:operate',
      scopeKind: 'platform',
      scopeId: '',
      classification: 'internal',
    };

    expect(canDiscoverWorkspace(billing, [grant('console:operate')])).toBe(false);
    expect(canDiscoverWorkspace(billing, [grant('billing:operate', 'school', 'vu')])).toBe(false);
    expect(canDiscoverWorkspace(billing, [grant('billing:operate')])).toBe(true);
  });

  it('shows the existing shell views only to a platform console operator', () => {
    expect(visibleConsoleWorkspaces([grant('console:operate')]).map(({ id }) => id)).not.toContain('support');
    expect(visibleConsoleWorkspaces([grant('console:operate'), grant('support:ticket')]).map(({ id }) => id)).not.toContain('tenant-operations');
    expect(visibleConsoleWorkspaces([
      grant('console:operate'), grant('support:ticket'), grant('tenant:implement', 'school', 'vu'), grant('data_request:handle', 'school', 'vu'), grant('integration:view', 'school', 'vu'), grant('incident:communicate'),
    ])).toEqual(CONSOLE_WORKSPACES);
    expect(visibleConsoleWorkspaces([grant('console:operate', 'school', 'vu')])).toEqual([]);
  });

  it('discovers tenant operations from a non-empty exact-school implementation grant', () => {
    const operations = CONSOLE_WORKSPACES.find(({ id }) => id === 'tenant-operations')!;
    expect(canDiscoverWorkspace(operations, [grant('tenant:implement', 'school', 'vu')])).toBe(true);
    expect(canDiscoverWorkspace(operations, [grant('tenant:implement', 'platform')])).toBe(false);
    expect(canDiscoverWorkspace(operations, [grant('tenant:implement', 'school', '')])).toBe(false);
  });

  it('discovers privacy requests from an exact-school or platform data-rights grant', () => {
    const privacy = CONSOLE_WORKSPACES.find(({ id }) => id === 'privacy')!;
    expect(canDiscoverWorkspace(privacy, [grant('data_request:handle', 'school', 'vu')])).toBe(true);
    expect(canDiscoverWorkspace(privacy, [grant('data_request:handle', 'platform')])).toBe(true);
    expect(canDiscoverWorkspace(privacy, [grant('data_request:handle', 'school', '')])).toBe(false);
  });

  it('discovers integration health only from a non-empty exact-school integration grant', () => {
    const health = CONSOLE_WORKSPACES.find(({ id }) => id === 'integration-health')!;
    expect(canDiscoverWorkspace(health, [grant('integration:view', 'school', 'vu')])).toBe(true);
    expect(canDiscoverWorkspace(health, [grant('integration:view', 'platform')])).toBe(false);
    expect(canDiscoverWorkspace(health, [grant('integration:view', 'school', '')])).toBe(false);
  });

  it('discovers release and incidents only from the platform incident grant', () => {
    const releases = CONSOLE_WORKSPACES.find(({ id }) => id === 'release-incidents')!;
    expect(canDiscoverWorkspace(releases, [grant('incident:communicate')])).toBe(true);
    expect(canDiscoverWorkspace(releases, [grant('incident:communicate', 'school', 'vu')])).toBe(false);
    expect(canDiscoverWorkspace(releases, [grant('console:operate')])).toBe(false);
  });

  it('validates saved workspace ids against the visible registry', () => {
    const visible = CONSOLE_WORKSPACES.filter(({ id }) => id === 'command' || id === 'approvals');
    expect(isConsoleWorkspaceId('approvals', visible)).toBe(true);
    expect(isConsoleWorkspaceId('audit', visible)).toBe(false);
    expect(isConsoleWorkspaceId({ id: 'command' }, visible)).toBe(false);
  });
});
