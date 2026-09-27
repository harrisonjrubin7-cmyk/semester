import { cloud, cloudConfigured } from './cloud';
import type { Mentor } from './launchpad';

/**
 * Mentor rosters and requests, as `20260928021700_mentor_rosters.sql` shapes
 * them. The rules live in the database — only the recipient accepts, capacity
 * is checked at acceptance, nobody writes the request table directly — and
 * this file only reads and calls. What it adds is the reading: an offer's
 * topics become the interests `matchMentors` compares against what the
 * student ticked, and nothing else about a person is used.
 */

export type MentorKind = 'peer' | 'alumni';

export interface Offer {
  kind: MentorKind;
  userId: string;
  cohort: string;
  name: string;
  topics: string[];
}

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface MentorRequest {
  id: string;
  kind: MentorKind;
  requester: string;
  recipient: string;
  requesterName: string;
  topics: string[];
  note: string;
  status: RequestStatus;
  createdAt: string;
}

const STATUSES: readonly RequestStatus[] = ['pending', 'accepted', 'declined', 'withdrawn'];

const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function readOffer(kind: MentorKind, v: unknown): Offer | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.user_id !== 'string') return null;
  const name = typeof o.display_name === 'string' ? o.display_name.trim() : '';
  // An offer with no name to show is not shown: the account id is not a name.
  if (!name) return null;
  return { kind, userId: o.user_id, cohort: typeof o.cohort_scope === 'string' ? o.cohort_scope : '', name, topics: strs(o.topics) };
}

export function readRequest(v: unknown): MentorRequest | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || (o.kind !== 'peer' && o.kind !== 'alumni')) return null;
  if (typeof o.status !== 'string' || !(STATUSES as readonly string[]).includes(o.status)) return null;
  return {
    id: o.id, kind: o.kind,
    requester: String(o.requester ?? ''), recipient: String(o.recipient ?? ''),
    requesterName: String(o.requester_name ?? ''), topics: strs(o.topics), note: String(o.note ?? ''),
    status: o.status as RequestStatus, createdAt: String(o.created_at ?? ''),
  };
}

/** Offers as the shape `matchMentors` ranks: interests are the offer's topics, nothing more. */
export function asMentors(offers: readonly Offer[]): (Mentor & { offer: Offer })[] {
  return offers.map((o) => ({ id: `${o.kind}:${o.userId}:${o.cohort}`, name: o.name, interests: o.topics, supports: [], offer: o }));
}

export interface Rosters {
  me: string | null;
  offers: Offer[];
  requests: MentorRequest[];
}

export const NO_ROSTERS: Rosters = { me: null, offers: [], requests: [] };

export async function loadRosters(kind: MentorKind): Promise<Rosters> {
  if (!cloudConfigured) return NO_ROSTERS;
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  const me = user.user?.id ?? null;
  if (!me) return NO_ROSTERS;
  const table = kind === 'peer' ? 'peer_mentor_offers' : 'alumni_mentor_offers';
  const cols = kind === 'peer' ? 'user_id, cohort_scope, display_name, topics' : 'user_id, display_name, topics';
  const [offers, requests] = await Promise.all([
    db.from(table).select(cols).eq('active', true).neq('user_id', me).limit(200),
    db.from('mentor_requests').select('id, kind, requester, recipient, requester_name, topics, note, status, created_at')
      .eq('kind', kind).order('created_at', { ascending: false }).limit(100),
  ]);
  return {
    me,
    offers: (offers.data ?? []).map((o) => readOffer(kind, o)).filter((o): o is Offer => o !== null),
    requests: (requests.data ?? []).map(readRequest).filter((r): r is MentorRequest => r !== null),
  };
}

export async function askMentor(o: Offer, name: string, topics: string[], note: string): Promise<void> {
  const { error } = await (await cloud()).rpc('request_mentor', {
    want_kind: o.kind, want_recipient: o.userId, want_cohort: o.kind === 'peer' ? o.cohort : null,
    want_name: name.trim(), want_topics: topics, want_note: note.slice(0, 500),
  });
  if (error) throw new Error(error.message);
}

export async function answerRequest(id: string, status: 'accepted' | 'declined' | 'withdrawn'): Promise<void> {
  const { error } = await (await cloud()).rpc('answer_mentor_request', { want: id, want_status: status });
  if (error) throw new Error(error.message);
}

export async function forgetMyRequests(): Promise<number> {
  const { data, error } = await (await cloud()).rpc('forget_my_mentor_requests');
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}

/** The requests this person sent, and the ones waiting on them. */
export function split(requests: readonly MentorRequest[], me: string) {
  return {
    sent: requests.filter((r) => r.requester === me),
    waiting: requests.filter((r) => r.recipient === me && r.status === 'pending'),
    mentoring: requests.filter((r) => r.recipient === me && r.status === 'accepted'),
  };
}
