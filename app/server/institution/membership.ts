import { createClient } from '@supabase/supabase-js';
import {
  UNIVERSITY_ROLES,
  type UniversityIdentity,
  type UniversityRole,
} from '../../../packages/institution/src/index.ts';

export interface VerifiedAuthUser {
  id: string;
  providerIdentifier: string;
}

export interface ProviderRecord {
  id: string;
  tenantId: string;
  providerIdentifier: string;
  status: 'pending' | 'authorized' | 'disabled';
}

export interface MembershipRecord {
  userId: string;
  tenantId: string;
  providerId: string;
  status: 'pending' | 'active' | 'suspended' | 'deprovisioned';
  roles: readonly string[];
}

export interface MembershipDirectory {
  providersFor(providerIdentifier: string): Promise<ProviderRecord[]>;
  membershipsFor(userId: string, tenantId: string, providerId: string): Promise<MembershipRecord[]>;
}

export interface AuthorizationAuditRecord {
  userId: string;
  providerIdentifier: string;
  tenantId?: string;
  outcome: 'accepted' | 'denied';
  reason: string;
  occurredAt: string;
}

export type AuthorizationAudit = (record: AuthorizationAuditRecord) => Promise<void> | void;
export type MembershipResolver = (user: VerifiedAuthUser) => Promise<UniversityIdentity | null>;

const auditRecord = (
  user: VerifiedAuthUser,
  outcome: AuthorizationAuditRecord['outcome'],
  reason: string,
  tenantId?: string,
): AuthorizationAuditRecord => ({
  userId: user.id,
  providerIdentifier: user.providerIdentifier,
  ...(tenantId ? { tenantId } : {}),
  outcome,
  reason,
  occurredAt: new Date().toISOString(),
});

export function createMembershipResolver(
  directory: MembershipDirectory,
  audit: AuthorizationAudit = () => undefined,
): MembershipResolver {
  return async (user) => {
    const providers = await directory.providersFor(user.providerIdentifier);
    if (providers.length !== 1) {
      await audit(auditRecord(user, 'denied', providers.length ? 'ambiguous-provider' : 'missing-provider'));
      return null;
    }
    const provider = providers[0];
    if (provider.status !== 'authorized') {
      await audit(auditRecord(user, 'denied', 'provider-not-authorized', provider.tenantId));
      return null;
    }

    const memberships = await directory.membershipsFor(user.id, provider.tenantId, provider.id);
    if (memberships.length !== 1) {
      await audit(auditRecord(user, 'denied', memberships.length ? 'ambiguous-membership' : 'missing-membership', provider.tenantId));
      return null;
    }
    const membership = memberships[0];
    if (membership.status !== 'active') {
      await audit(auditRecord(user, 'denied', 'membership-not-active', provider.tenantId));
      return null;
    }
    const roles = membership.roles.filter((role): role is UniversityRole =>
      UNIVERSITY_ROLES.includes(role as UniversityRole),
    );
    if (!roles.length || roles.length !== membership.roles.length) {
      await audit(auditRecord(user, 'denied', 'invalid-membership-roles', provider.tenantId));
      return null;
    }
    await audit(auditRecord(user, 'accepted', 'current-membership', provider.tenantId));
    return { userId: user.id, institutionId: provider.tenantId, roles: [...new Set(roles)] };
  };
}

/** A service-role directory. The key is server-only and must never use a VITE_ name. */
export function supabaseMembershipDirectory(url: string, serviceKey: string): MembershipDirectory {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    providersFor: async (providerIdentifier) => {
      const { data, error } = await client
        .from('institution_identity_provider')
        .select('id, tenant_id, provider_identifier, status')
        .eq('provider_identifier', providerIdentifier)
        .limit(2);
      if (error) throw new Error('Institution identity provider lookup failed.');
      return (data ?? []).map((row) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        providerIdentifier: row.provider_identifier as string,
        status: row.status as ProviderRecord['status'],
      }));
    },
    membershipsFor: async (userId, tenantId, providerId) => {
      const { data, error } = await client
        .from('institution_membership')
        .select('auth_user_id, tenant_id, identity_provider_id, status, roles')
        .eq('auth_user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('identity_provider_id', providerId)
        .limit(2);
      if (error) throw new Error('Institution membership lookup failed.');
      return (data ?? []).map((row) => ({
        userId: row.auth_user_id as string,
        tenantId: row.tenant_id as string,
        providerId: row.identity_provider_id as string,
        status: row.status as MembershipRecord['status'],
        roles: Array.isArray(row.roles) ? row.roles as string[] : [],
      }));
    },
  };
}
