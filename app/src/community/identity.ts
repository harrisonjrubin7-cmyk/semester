/**
 * Three identities, kept apart: who verified, who acts, who peers see.
 *
 * Hyperlocal anonymous apps failed the same way twice. Either nothing tied a
 * post to an accountable account, or the thing that did (a device, a phone
 * number) leaked to the people reading it. Semester separates the layers so
 * both can be true: accountable inside, private outside.
 *
 * 1. **Verification identity** — legal name, institution email, student ID.
 *    Used once to establish eligibility, then held only as a vault reference.
 *    Nothing in Community ever carries it.
 * 2. **Account identity** — an opaque, random, immutable `sem_…` id used for
 *    authorization, moderation and audit. Never a row number, never derived
 *    from an email, never shown to peers.
 * 3. **Presentation identity** — the preferred name (or, where approved, a
 *    community-scoped alias) that peers actually see.
 *
 * The functions here are the only way a Community payload is built, and they
 * build it from an allowlist rather than by deleting known-bad fields: a field
 * added to the account next year is excluded until somebody decides otherwise.
 */

export interface VerificationIdentity {
  legalName: string;
  institutionEmail: string;
  /** Present only when an institution's verification flow requires it. */
  studentId?: string;
}

export interface Account {
  /** Opaque public id, `sem_` + 26 base32 characters. */
  accountId: string;
  tenantId: string;
  verification: {
    state: 'unverified' | 'verified_student' | 'verified_staff' | 'expired' | 'revoked';
    /** ISO date after which the claim must be revalidated. */
    expiresAt?: string;
  };
  /** A pointer into the restricted identity vault, never the identity itself. */
  vaultRef?: string;
}

export interface PresentationProfile {
  accountId: string;
  displayName: string;
  pronouns?: string;
}

/** Everything a peer may learn about the author of a post. */
export interface PublicAuthor {
  /** Community-scoped handle: display name, or an alias inside its community. */
  name: string;
  pronouns?: string;
  /** An opaque per-community reference, so blocks and reports can name them. */
  ref: string;
}

// Crockford base32: no I, L, O or U, so ids survive being read aloud.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A new opaque id. Random, so ids reveal neither order nor count. */
export function opaqueId(prefix = 'sem'): string {
  const bytes = new Uint8Array(26);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b & 31];
  return `${prefix}_${out}`;
}

export function isOpaqueId(id: string, prefix = 'sem'): boolean {
  return new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`).test(id);
}

export function isVerified(account: Account, now: Date): boolean {
  const { state, expiresAt } = account.verification;
  if (state !== 'verified_student' && state !== 'verified_staff') return false;
  return !expiresAt || new Date(expiresAt).getTime() > now.getTime();
}

/**
 * A reference to an account that is stable inside one community and
 * meaningless outside it, so two communities cannot be joined on it. Not a
 * security boundary on its own — the mapping lives server-side — but it keeps
 * the account id out of every peer-facing payload.
 */
export function communityRef(accountId: string, communityId: string): string {
  // FNV-1a over both ids; collisions only matter within one community.
  let h = 0x811c9dc5;
  for (const ch of `${communityId}\u0000${accountId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `m_${h.toString(36)}`;
}

export function publicAuthor(
  profile: PresentationProfile,
  communityId: string,
  alias?: string,
): PublicAuthor {
  const author: PublicAuthor = {
    name: alias ?? profile.displayName,
    ref: communityRef(profile.accountId, communityId),
  };
  // A pseudonymous author shows nothing that could link back to their profile.
  if (!alias && profile.pronouns) author.pronouns = profile.pronouns;
  return author;
}

/**
 * Field names that must never appear in a payload leaving for a peer or a
 * volunteer, at any depth. The allowlists above are the real control; this is
 * the tripwire behind them, run by tests and by `allowlisted` in development.
 */
export const FORBIDDEN_FIELDS = [
  'legalName',
  'institutionEmail',
  'email',
  'studentId',
  'accountId',
  'vaultRef',
  'reporterId',
  'reporter',
  'safetyState',
  'safetyScore',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'gps',
  'residence',
  'address',
  'schedule',
  'enforcementHistory',
  'socialGraph',
] as const;

/** Paths of any forbidden field found in `value`, e.g. `items[2].author.email`. */
export function identityLeaks(value: unknown, path = ''): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...identityLeaks(v, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const at = path ? `${path}.${k}` : k;
      if ((FORBIDDEN_FIELDS as readonly string[]).includes(k)) found.push(at);
      found.push(...identityLeaks(v, at));
    }
  }
  return found;
}

/** Copy only the named keys. The shape every outbound payload is built with. */
export function allowlisted<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k];
  return out;
}

/* ------------------------------------------------------------------ */
/* Who may see what about an account                                   */
/* ------------------------------------------------------------------ */

export type ViewerRole = 'peer' | 'volunteer' | 'professional' | 'liaison' | 'admin';

/**
 * How long an approved just-in-time grant lasts. The database sets the same
 * (`decide_alias_identity`); programs.test.ts holds the two together.
 */
export const JIT_HOURS = 4;

/** Just-in-time access to restricted identity, granted per case. */
export interface JitGrant {
  granteeId: string;
  caseId: string;
  reason: string;
  approvedBy: string;
  expiresAt: string;
}

export interface AccessAudit {
  at: string;
  actorId: string;
  role: ViewerRole;
  caseId?: string;
  outcome: 'granted' | 'refused';
  reason: string;
}

export type IdentityView =
  | { level: 'presentation'; author: PublicAuthor }
  | { level: 'restricted'; author: PublicAuthor; vaultRef: string; verification: Account['verification'] };

/**
 * What a viewer gets when they look at an account in the context of a case.
 *
 * Only a professional holding an unexpired grant for *this* case, approved by
 * somebody else, with a written reason, gets past presentation identity — and
 * even then gets a vault reference, not the identity itself. Admins are not
 * special: platform administration grants no content or identity access.
 * Every call returns an audit record, granted or not.
 */
export function viewIdentity(args: {
  role: ViewerRole;
  actorId: string;
  account: Account;
  profile: PresentationProfile;
  communityId: string;
  caseId?: string;
  grant?: JitGrant;
  now: Date;
}): { view: IdentityView; audit: AccessAudit } {
  const { role, actorId, account, profile, communityId, caseId, grant, now } = args;
  const author = publicAuthor(profile, communityId);
  const base = { at: now.toISOString(), actorId, role, caseId };

  const grantHolds =
    role === 'professional' &&
    grant !== undefined &&
    caseId !== undefined &&
    grant.caseId === caseId &&
    grant.granteeId === actorId &&
    grant.approvedBy !== actorId &&
    grant.reason.trim().length >= 10 &&
    new Date(grant.expiresAt).getTime() > now.getTime();

  if (grantHolds && account.vaultRef) {
    return {
      view: { level: 'restricted', author, vaultRef: account.vaultRef, verification: account.verification },
      audit: { ...base, outcome: 'granted', reason: grant.reason },
    };
  }
  return {
    view: { level: 'presentation', author },
    audit: {
      ...base,
      outcome: role === 'peer' ? 'granted' : 'refused',
      reason: role === 'peer' ? 'presentation identity only' : 'no valid just-in-time grant',
    },
  };
}
