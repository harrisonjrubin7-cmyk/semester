import type { Grant } from '../capabilities';
import { EXPERIENCE_FLAGS } from '../experience-flags';
import type { Classification } from '../ops/console';

export type ConsoleWorkspaceId =
  | 'command'
  | 'support'
  | 'approvals'
  | 'breakglass'
  | 'audit'
  | 'customers'
  | 'figures'
  | 'evidence'
  | 'views';

export interface ConsoleWorkspace {
  id: ConsoleWorkspaceId;
  label: string;
  capability: string;
  scopeKind: string;
  scopeId: string;
  classification: Classification;
}

const shell = (
  id: ConsoleWorkspaceId,
  label: string,
  classification: Classification = 'internal',
): ConsoleWorkspace => ({
  id,
  label,
  capability: 'console:operate',
  scopeKind: 'platform',
  scopeId: '',
  classification,
});

/**
 * The console navigation contract. This controls discoverability only; every
 * reader and action still authorizes independently at the server boundary.
 * A domain workspace belongs here only after it has its own capability.
 */
export const CONSOLE_WORKSPACES: readonly ConsoleWorkspace[] = [
  shell('command', 'Command center'),
  {
    id: 'support',
    label: 'Support',
    capability: 'support:ticket',
    scopeKind: 'platform',
    scopeId: '',
    classification: 'restricted',
  },
  shell('approvals', 'Approvals', 'restricted'),
  shell('breakglass', 'Break-glass', 'restricted'),
  shell('audit', 'Audit', 'restricted'),
  shell('customers', 'Customers'),
  shell('figures', 'Figures'),
  shell('evidence', 'Evidence'),
  shell('views', 'Views'),
];

export function canDiscoverWorkspace(workspace: ConsoleWorkspace, grants: readonly Grant[]): boolean {
  return grants.some((grant) =>
    grant.capability === workspace.capability
    && grant.scopeKind === workspace.scopeKind
    && grant.scopeId === workspace.scopeId,
  );
}

export function visibleConsoleWorkspaces(grants: readonly Grant[]): readonly ConsoleWorkspace[] {
  return CONSOLE_WORKSPACES.filter((workspace) =>
    (workspace.id !== 'support' || EXPERIENCE_FLAGS.supportTickets !== 'off')
    && canDiscoverWorkspace(workspace, grants),
  );
}

export function isConsoleWorkspaceId(value: unknown, workspaces = CONSOLE_WORKSPACES): value is ConsoleWorkspaceId {
  return typeof value === 'string' && workspaces.some((workspace) => workspace.id === value);
}
