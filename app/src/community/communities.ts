/**
 * Communities, membership, study sessions, and the controls a member has.
 *
 * Every community has a purpose and a type, and the type decides what it
 * allows. Nothing here is found by location: a student finds a community from
 * their courses, their path, their organizations and what they chose to
 * follow. Membership in a support community is never shown to anyone else.
 *
 * Direct messages are not part of v1. A career or mentorship community has a
 * *structured request* instead — a fixed-purpose note the recipient accepts or
 * declines — and "no" closes it.
 */

import type { CommunityType } from './alias';

export type { CommunityType } from './alias';

export type CommunityRole = 'member' | 'host' | 'moderator' | 'owner';

export interface Community {
  id: string;
  tenantId: string;
  type: CommunityType;
  name: string;
  purpose: string;
  verification: 'institution_verified' | 'organization_verified' | 'faculty_approved' | 'student_created';
  /** Course policy on sharing assessment answers, shown as a banner. */
  integrityPolicy?: string;
  pseudonymityApproved: boolean;
}

/** Per-type rules. Stricter types trade reach for safety. */
export interface TypeRules {
  membershipVisible: boolean;
  openPosting: boolean;
  /** Posts wait in a queue until a host or professional approves them. */
  premoderated: boolean;
  structuredRequests: boolean;
  postsPerHour: number;
}

export const TYPE_RULES: Record<CommunityType, TypeRules> = {
  course: { membershipVisible: true, openPosting: true, premoderated: false, structuredRequests: false, postsPerHour: 10 },
  study_group: { membershipVisible: true, openPosting: true, premoderated: false, structuredRequests: false, postsPerHour: 10 },
  student_organization: { membershipVisible: false, openPosting: false, premoderated: false, structuredRequests: false, postsPerHour: 10 },
  career_alumni: { membershipVisible: false, openPosting: false, premoderated: false, structuredRequests: true, postsPerHour: 5 },
  peer_mentorship: { membershipVisible: false, openPosting: false, premoderated: false, structuredRequests: true, postsPerHour: 5 },
  support: { membershipVisible: false, openPosting: true, premoderated: false, structuredRequests: false, postsPerHour: 3 },
  research: { membershipVisible: false, openPosting: false, premoderated: false, structuredRequests: true, postsPerHour: 5 },
  campus_bulletin: { membershipVisible: false, openPosting: false, premoderated: true, structuredRequests: false, postsPerHour: 5 },
  event: { membershipVisible: true, openPosting: false, premoderated: false, structuredRequests: false, postsPerHour: 5 },
  housing_transport: { membershipVisible: false, openPosting: false, premoderated: true, structuredRequests: false, postsPerHour: 2 },
};

export interface Membership {
  communityId: string;
  accountId: string;
  role: CommunityRole;
  joinedAt: string;
}

export class CommunityRefused extends Error {}

/** Who may post: open types let any member, closed ones only hosts and above. */
export function mayPost(community: Community, membership: Membership | undefined, restricted: boolean): boolean {
  if (!membership || restricted) return false;
  if (TYPE_RULES[community.type].openPosting) return true;
  return membership.role !== 'member';
}

/** Whether another viewer may see that this account belongs to this community. */
export function membershipVisibleTo(community: Community, viewerIsMember: boolean): boolean {
  return TYPE_RULES[community.type].membershipVisible && viewerIsMember;
}

export function withinPostingLimit(community: Community, postTimes: string[], now: Date, aliasLimit?: number): boolean {
  const limit = Math.min(TYPE_RULES[community.type].postsPerHour, aliasLimit ?? Infinity);
  return postTimes.filter((t) => now.getTime() - new Date(t).getTime() < 3_600_000).length < limit;
}

export type MessagingMode = 'none' | 'structured_request';

/** v1: no open DMs anywhere; structured requests only where the type allows. */
export function messagingMode(community: Community, sender: { alias?: string }): MessagingMode {
  if (sender.alias !== undefined) return 'none';
  return TYPE_RULES[community.type].structuredRequests ? 'structured_request' : 'none';
}

/* ------------------------------------------------------------------ */
/* Study sessions                                                      */
/* ------------------------------------------------------------------ */

export interface Venue {
  id: string;
  name: string;
  /** Only campus or virtual venues from the tenant's approved list. */
  kind: 'library' | 'academic_building' | 'student_center' | 'virtual';
}

export interface StudySession {
  id: string;
  communityId: string;
  hostId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  participants: string[];
}

export const MAX_SESSION_CAPACITY = 12;

export function createSession(args: {
  id: string;
  community: Community;
  host: Membership;
  venue: Venue | undefined;
  approvedVenues: Venue[];
  startsAt: string;
  endsAt: string;
  capacity: number;
}): StudySession {
  const { community, host, venue, approvedVenues } = args;
  if (community.type !== 'course' && community.type !== 'study_group') {
    throw new CommunityRefused('Study sessions belong to course and study-group communities.');
  }
  if (host.communityId !== community.id) throw new CommunityRefused('Only members can host.');
  // No home addresses or free-text places: the venue must be on the approved list.
  if (!venue || !approvedVenues.some((v) => v.id === venue.id)) {
    throw new CommunityRefused('Choose a venue from the approved campus list.');
  }
  if (args.capacity < 2 || args.capacity > MAX_SESSION_CAPACITY) {
    throw new CommunityRefused(`Capacity must be between 2 and ${MAX_SESSION_CAPACITY}.`);
  }
  if (new Date(args.endsAt).getTime() <= new Date(args.startsAt).getTime()) {
    throw new CommunityRefused('A session must end after it starts.');
  }
  return {
    id: args.id,
    communityId: community.id,
    hostId: host.accountId,
    venueId: venue.id,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    capacity: args.capacity,
    participants: [host.accountId],
  };
}

export function joinSession(s: StudySession, accountId: string, blockedEitherWay: (a: string, b: string) => boolean): StudySession {
  if (s.participants.includes(accountId)) return s;
  if (s.participants.length >= s.capacity) throw new CommunityRefused('This session is full.');
  if (s.participants.some((p) => blockedEitherWay(p, accountId))) {
    // Deliberately vague: saying who blocked whom would disclose it.
    throw new CommunityRefused('You can’t join this session.');
  }
  return { ...s, participants: [...s.participants, accountId] };
}

export function leaveSession(s: StudySession, accountId: string): StudySession {
  return { ...s, participants: s.participants.filter((p) => p !== accountId) };
}

/**
 * Study matching uses availability the student typed in, never their official
 * timetable. Slots are coarse (weekday + part of day) so they cannot be read
 * back as "where this person is at 2:10 on Tuesday".
 */
export type AvailabilitySlot = `${'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'}-${'morning' | 'afternoon' | 'evening'}`;

export function overlap(a: AvailabilitySlot[], b: AvailabilitySlot[]): AvailabilitySlot[] {
  const set = new Set(b);
  return a.filter((s) => set.has(s));
}
