/**
 * The deliberately selected workspace for a multi-membership person.
 *
 * A client may ask to use a membership and workspace, but it cannot submit the
 * tenant, institution, person, grants, or expiry that the resulting context
 * carries. Those values are derived from a server-verified directory entry.
 * Switching to a different membership or workspace requires an explicit
 * confirmation so a user cannot silently cross an institutional boundary.
 */

import { PlatformError } from '../gateway/errors.ts';
import { isId } from './organization.ts';

export const WORKSPACES = ['student', 'staff', 'institution', 'external', 'company', 'operations', 'developer'] as const;
export type Workspace = (typeof WORKSPACES)[number];

export const CONTEXT_MEMBERSHIP_STATUSES = ['active', 'suspended', 'revoked', 'ended'] as const;
export type ContextMembershipStatus = (typeof CONTEXT_MEMBERSHIP_STATUSES)[number];

export interface ContextMembership {
  id: string;
  tenantId: string;
  institutionId?: string;
  personId: string;
  status: ContextMembershipStatus;
  expiresAt?: string;
  workspaces: readonly Workspace[];
  roleGrantIds: readonly string[];
}

export interface ContextDirectory {
  personId: string;
  /** Expiry of the authenticated server-side session. */
  sessionExpiresAt: string;
  /** Memberships reloaded from the authoritative server-side directory. */
  memberships: readonly ContextMembership[];
}

export interface ContextSelection {
  membershipId: string;
  workspace: Workspace;
}

export interface ActiveContext {
  readonly tenantId: string;
  readonly institutionId?: string;
  readonly personId: string;
  readonly membershipId: string;
  readonly roleGrantIds: readonly string[];
  readonly workspace: Workspace;
  readonly expiresAt: string;
}

const liveExpiry = (directory: ContextDirectory, membership: ContextMembership, nowMs: number): number => {
  const sessionExpiry = Date.parse(directory.sessionExpiresAt);
  const membershipExpiry = membership.expiresAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(membership.expiresAt);
  if (!Number.isFinite(sessionExpiry) || sessionExpiry <= nowMs) {
    throw new PlatformError('expired', 'Your session expired. Sign in again to choose a workspace.');
  }
  if (membership.status !== 'active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= nowMs || membership.personId !== directory.personId) {
    throw new PlatformError('expired', 'That membership is no longer available. Choose another workspace.');
  }
  return Math.min(sessionExpiry, membershipExpiry);
};

export function activateContext(directory: ContextDirectory, selection: ContextSelection, nowMs: number): ActiveContext {
  if (!isId(directory.personId) || !isId(selection.membershipId) || !Number.isFinite(nowMs)) {
    throw new PlatformError('invalid_request', 'A valid person, membership, and time are required.');
  }
  const membership = directory.memberships.find((candidate) => candidate.id === selection.membershipId);
  if (!membership) {
    throw new PlatformError('forbidden', 'That membership is not available to this account.');
  }
  if (!isId(membership.tenantId) || !isId(membership.personId) || (membership.institutionId !== undefined && !isId(membership.institutionId))) {
    throw new PlatformError('forbidden', 'That membership is not available to this account.');
  }
  if (!membership.workspaces.includes(selection.workspace)) {
    throw new PlatformError('forbidden', 'That workspace is not available under this membership.');
  }
  if (membership.roleGrantIds.some((id) => !isId(id))) {
    throw new PlatformError('forbidden', 'That membership has an invalid role grant.');
  }

  const expiresAt = new Date(liveExpiry(directory, membership, nowMs)).toISOString();
  return Object.freeze({
    tenantId: membership.tenantId,
    ...(membership.institutionId === undefined ? {} : { institutionId: membership.institutionId }),
    personId: directory.personId,
    membershipId: membership.id,
    roleGrantIds: Object.freeze([...new Set(membership.roleGrantIds)]),
    workspace: selection.workspace,
    expiresAt,
  });
}

export function switchActiveContext(
  current: ActiveContext,
  directory: ContextDirectory,
  selection: ContextSelection & { confirmed: boolean },
  nowMs: number,
): ActiveContext {
  const changesSelection = current.membershipId !== selection.membershipId || current.workspace !== selection.workspace;
  if (changesSelection && !selection.confirmed) {
    throw new PlatformError('conflict', 'Confirm the membership and workspace before switching context.');
  }
  return activateContext(directory, selection, nowMs);
}
