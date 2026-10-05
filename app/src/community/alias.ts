/**
 * Scoped pseudonyms — built, and switched off.
 *
 * Some communities are easier to speak in without your name on it: a
 * first-generation group, a disability support space. An alias there should
 * protect the student from peers without becoming a second, portable identity
 * that follows them around or that a determined classmate can join up.
 *
 * So an alias belongs to exactly one approved community. It is unique there
 * and meaningless everywhere else; it cannot be searched from outside, has no
 * history, no follower count, no account age, no post list. It never sends a
 * direct message. It rotates on request unless a safety or fraud
 * investigation needs it preserved. And it is never used for official aid,
 * billing, health, disability, housing, conduct, emergency or advising work.
 *
 * Peers cannot see the verified identity behind an alias. Trust & Safety can,
 * under the just-in-time rules in identity.ts — and students are told so.
 */

import { enabled, type CommunityFlags } from './flags';

export const ALIAS_DISCLOSURE =
  'Other members see only this name. Semester still knows it is you, and trained Trust & Safety staff can check during a safety investigation.';

export type CommunityType =
  | 'course'
  | 'study_group'
  | 'student_organization'
  | 'career_alumni'
  | 'peer_mentorship'
  | 'support'
  | 'research'
  | 'campus_bulletin'
  | 'event'
  | 'housing_transport';

/** Community types where an alias may ever be approved. */
export const ALIAS_ELIGIBLE_TYPES: readonly CommunityType[] = ['support', 'study_group'];

export interface AliasCommunity {
  id: string;
  type: CommunityType;
  pseudonymityApproved: boolean;
}

export interface Alias {
  communityId: string;
  accountId: string;
  name: string;
  createdAt: string;
}

export const ALIAS_RATE_LIMIT = { postsPerHour: 3, repliesPerHour: 10 } as const;
export const NAMED_RATE_LIMIT = { postsPerHour: 10, repliesPerHour: 30 } as const;

export class AliasRefused extends Error {}

const NAME = /^[A-Za-z][A-Za-z0-9]{3,23}$/;

export class AliasRegistry {
  private byCommunity = new Map<string, Map<string, Alias>>();
  private readonly flags: CommunityFlags;

  constructor(flags: CommunityFlags) {
    this.flags = flags;
  }

  private allowed(community: AliasCommunity): void {
    if (!enabled(this.flags, 'scopedPseudonymity')) throw new AliasRefused('Pseudonyms are switched off.');
    if (!community.pseudonymityApproved || !ALIAS_ELIGIBLE_TYPES.includes(community.type)) {
      throw new AliasRefused('This community does not allow pseudonyms.');
    }
  }

  private table(communityId: string): Map<string, Alias> {
    let t = this.byCommunity.get(communityId);
    if (!t) this.byCommunity.set(communityId, (t = new Map()));
    return t;
  }

  claim(community: AliasCommunity, accountId: string, name: string, now: Date): Alias {
    this.allowed(community);
    if (!NAME.test(name)) throw new AliasRefused('Use 4–24 letters and numbers, starting with a letter.');
    const table = this.table(community.id);
    const key = name.toLowerCase();
    const taken = [...table.values()].find((a) => a.name.toLowerCase() === key);
    if (taken && taken.accountId !== accountId) throw new AliasRefused('That name is taken in this community.');
    const alias: Alias = { communityId: community.id, accountId, name, createdAt: now.toISOString() };
    table.set(accountId, alias);
    return alias;
  }

  rotate(community: AliasCommunity, accountId: string, name: string, now: Date, preservationHold: boolean): Alias {
    if (preservationHold) throw new AliasRefused('This name cannot be changed right now.');
    if (!this.table(community.id).has(accountId)) throw new AliasRefused('No alias to change.');
    return this.claim(community, accountId, name, now);
  }

  /** The alias to show for an author *in this community*. Never looks elsewhere. */
  aliasIn(communityId: string, accountId: string): string | undefined {
    return this.byCommunity.get(communityId)?.get(accountId)?.name;
  }

  /** Search is scoped to one community and returns names only. */
  search(communityId: string, prefix: string): string[] {
    const p = prefix.toLowerCase();
    return [...(this.byCommunity.get(communityId)?.values() ?? [])]
      .map((a) => a.name)
      .filter((n) => n.toLowerCase().startsWith(p));
  }
}

export function rateLimitFor(sender: { alias?: string }) {
  return sender.alias === undefined ? NAMED_RATE_LIMIT : ALIAS_RATE_LIMIT;
}
