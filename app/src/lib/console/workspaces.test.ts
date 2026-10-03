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
      'command', 'support', 'approvals', 'breakglass', 'audit', 'customers', 'figures', 'evidence', 'views',
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
    expect(visibleConsoleWorkspaces([grant('console:operate'), grant('support:ticket')])).toEqual(CONSOLE_WORKSPACES);
    expect(visibleConsoleWorkspaces([grant('console:operate', 'school', 'vu')])).toEqual([]);
  });

  it('validates saved workspace ids against the visible registry', () => {
    const visible = CONSOLE_WORKSPACES.filter(({ id }) => id === 'command' || id === 'approvals');
    expect(isConsoleWorkspaceId('approvals', visible)).toBe(true);
    expect(isConsoleWorkspaceId('audit', visible)).toBe(false);
    expect(isConsoleWorkspaceId({ id: 'command' }, visible)).toBe(false);
  });
});
