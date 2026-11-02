import { mapScimGroupsToRoles, type UniversityRole } from '../../../packages/institution/src/index.ts';
import type {
  MembershipDirectory,
  MembershipRecord,
  ProviderRecord,
  VerifiedAuthUser,
} from './membership.ts';

/**
 * A stand-in for a university's identity provider, for tests only.
 *
 * Stream 02's gate is "a test login per pilot role in staging", and staging needs the university's
 * IdP metadata and test accounts, which are human inputs. This is the part that does not: what the
 * gateway does *after* the IdP has vouched for somebody. It does not speak SAML. Verifying a signed
 * assertion is Supabase Auth's job and is not reimplemented here; what Supabase Auth hands the
 * gateway is a `VerifiedAuthUser`, and that is what a login produces.
 *
 * It does run the real code from there on: `mapScimGroupsToRoles` turns the IdP's groups into
 * institutional roles exactly as provisioning would, and the membership directory it builds is
 * what `createMembershipResolver` reads. A login here is therefore the same decision the gateway
 * makes for a real one.
 *
 * ## What an assertion can carry, and what that changes
 *
 * `attributes` is whatever the IdP puts in an assertion beyond groups: affiliation, entitlement,
 * and anything hostile a misconfigured or malicious IdP would add. It is accepted and ignored,
 * because the gateway authorizes from the membership record and nothing else. A test that sets
 * `attributes.semester_roles` to `['admin']` and watches nothing change is the proof.
 */
export interface MockIdpUser {
  /** The IdP's name for the person, which becomes the SSO user name. */
  nameId: string;
  /** The groups the IdP asserts. These are the only input that reaches a role. */
  groups: readonly string[];
  /** Everything else in the assertion. Never authorizes anything. */
  attributes?: Readonly<Record<string, unknown>>;
}

export interface MockIdpOptions {
  tenantId?: string;
  providerIdentifier?: string;
  providerStatus?: ProviderRecord['status'];
  /** IdP group name to institutional roles: the contents of `scim_group_mapping`. */
  mapping: Readonly<Record<string, readonly UniversityRole[]>>;
}

export interface MockIdp {
  provider: ProviderRecord;
  directory: MembershipDirectory;
  /** The user as Supabase Auth would report them after a successful SSO sign-in. */
  signIn(user: MockIdpUser): VerifiedAuthUser;
  /** Change a person's standing after they were provisioned: suspension, deprovisioning. */
  setStatus(nameId: string, status: MembershipRecord['status']): void;
}

export function createMockIdp(options: MockIdpOptions): MockIdp {
  const tenantId = options.tenantId ?? 'vanderbilt';
  const providerIdentifier = options.providerIdentifier ?? `sso:${tenantId}`;
  const provider: ProviderRecord = {
    id: `provider-${tenantId}`,
    tenantId,
    providerIdentifier,
    status: options.providerStatus ?? 'authorized',
  };
  const members = new Map<string, MembershipRecord & { userName: string }>();

  return {
    provider,
    signIn(user) {
      const id = `auth-${user.nameId}`;
      if (!members.has(user.nameId)) {
        members.set(user.nameId, {
          id: `membership-${id.replace(/[^A-Za-z0-9._:-]/g, '_')}`,
          userId: id,
          tenantId,
          providerId: provider.id,
          status: 'active',
          roles: mapScimGroupsToRoles(user.groups, options.mapping),
          userName: user.nameId,
        });
      }
      return { id, providerIdentifier, userName: user.nameId, sessionExpiresAt: '2099-01-01T00:00:00.000Z' };
    },
    setStatus(nameId, status) {
      const member = members.get(nameId);
      if (!member) throw new Error(`mock IdP: ${nameId} was never provisioned`);
      member.status = status;
    },
    directory: {
      providersFor: async (identifier) => (identifier === providerIdentifier ? [provider] : []),
      membershipsFor: async (userId, wantTenant, providerId, userName) =>
        [...members.values()].filter(
          (m) => m.userId === userId && m.tenantId === wantTenant && m.providerId === providerId && m.userName === userName,
        ),
    },
  };
}
