/**
 * Presentation context is not authorization.
 *
 * A person may ask to see the faculty or administrator reading of the preview;
 * that selection changes wording and navigation only. Capabilities arrive only
 * in grants returned by the authenticated server boundary. The browser never
 * manufactures one from a role name.
 */

export type InstitutionalScopeKind =
  | 'platform'
  | 'institution'
  | 'department'
  | 'course'
  | 'organization';

export interface VerifiedGrant {
  role: string;
  scopeKind: InstitutionalScopeKind;
  scopeId: string;
  capabilities: string[];
  expiresAt: string | null;
}

export interface WorkspaceAccess {
  presentationRole: string;
  authorizedCapabilities: string[];
  scopes: Array<{ kind: InstitutionalScopeKind; id: string }>;
}

export interface WorkspaceAccessInput {
  selectedRole: string;
  grants: VerifiedGrant[];
  now?: string;
}

function live(grant: VerifiedGrant, now: number): boolean {
  if (grant.expiresAt === null) return true;
  const expires = Date.parse(grant.expiresAt);
  return Number.isFinite(expires) && expires > now;
}

export function resolveWorkspaceAccess(input: WorkspaceAccessInput): WorkspaceAccess {
  const parsedNow = input.now === undefined ? Date.now() : Date.parse(input.now);
  const now = Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const grants = input.grants.filter((grant) => live(grant, now));
  const capabilities = new Set<string>();
  const scopes = new Map<string, { kind: InstitutionalScopeKind; id: string }>();

  for (const grant of grants) {
    for (const capability of grant.capabilities) {
      const value = capability.trim();
      if (value) capabilities.add(value);
    }
    const id = grant.scopeId.trim();
    if (id) scopes.set(`${grant.scopeKind}:${id}`, { kind: grant.scopeKind, id });
  }

  return {
    presentationRole: input.selectedRole,
    authorizedCapabilities: [...capabilities].sort(),
    scopes: [...scopes.values()].sort((a, b) =>
      `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`),
    ),
  };
}
