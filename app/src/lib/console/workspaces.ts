import type { Grant } from '../capabilities';
import { EXPERIENCE_FLAGS } from '../experience-flags';
import type { Classification } from '../ops/console';

export type ConsoleWorkspaceId =
  | 'command'
  | 'support'
  | 'approvals'
  | 'breakglass'
  | 'audit'
  | 'tenant-operations'
  | 'inbox'
  | 'integration-health'
  | 'release-incidents'
  | 'privacy'
  | 'customers'
  | 'figures'
  | 'finance'
  | 'releases'
  | 'launch'
  | 'controls'
  | 'evidence'
  | 'views';

export interface ConsoleWorkspace {
  id: ConsoleWorkspaceId;
  label: string;
  capability: string;
  scopeKind: string;
  /** Null means any one exact, non-empty scope of `scopeKind`; the server still derives the allowed rows. */
  scopeId: string | null;
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
  {
    id: 'tenant-operations',
    label: 'Tenant operations',
    capability: 'tenant:implement',
    scopeKind: 'school',
    scopeId: null,
    classification: 'restricted',
  },
  {
    id: 'inbox',
    label: 'Operations inbox',
    capability: 'tenant:implement',
    scopeKind: 'school',
    scopeId: null,
    classification: 'restricted',
  },
  {
    id: 'privacy',
    label: 'Privacy requests',
    capability: 'data_request:handle',
    scopeKind: 'school',
    scopeId: null,
    classification: 'restricted',
  },
  {
    id: 'integration-health',
    label: 'Integration health',
    capability: 'integration:view',
    scopeKind: 'school',
    scopeId: null,
    classification: 'restricted',
  },
  {
    id: 'release-incidents',
    label: 'Release & incidents',
    capability: 'incident:communicate',
    scopeKind: 'platform',
    scopeId: '',
    classification: 'restricted',
  },
  shell('customers', 'Customers'),
  shell('figures', 'Figures'),
  shell('finance', 'Finance model'),
  shell('releases', 'Releases and flags'),
  shell('launch', 'Launch readiness'),
  shell('controls', 'Trust controls'),
  shell('evidence', 'Evidence'),
  shell('views', 'Views'),
];

export function canDiscoverWorkspace(workspace: ConsoleWorkspace, grants: readonly Grant[]): boolean {
  return grants.some((grant) =>
    grant.capability === workspace.capability
    && (
      (grant.scopeKind === workspace.scopeKind
        && (workspace.scopeId === null ? grant.scopeId.length > 0 : grant.scopeId === workspace.scopeId))
      || (workspace.id === 'privacy' && grant.scopeKind === 'platform' && grant.scopeId === '')
    ),
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
