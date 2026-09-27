/**
 * The account service's Community tables, as the screens use them.
 *
 * Every write is an RPC — members never hold another member's account id, so
 * the server resolves authors, runs triage and checks roles
 * (supabase/migrations/20260927170000_community.sql). Reads name their columns
 * rather than `*`: several columns on these tables (author_id, reporter_id,
 * ref_salt, host_id) are granted to nobody, and `select=*` would ask for them
 * and be refused.
 */

import { cloud } from '../lib/cloud';
import type { CommunityType } from './alias';
import type { SourceLabel } from './feed';
import type { DecisionAction, ReportCategory, Severity } from './moderation';

export type CommunityRole = 'member' | 'host' | 'moderator' | 'owner';
export type PostStatus = 'pending' | 'published' | 'reduced' | 'held' | 'removed' | 'withdrawn';

export interface CommunityRow {
  id: string;
  kind: CommunityType;
  name: string;
  purpose: string;
  verification: 'institution_verified' | 'organization_verified' | 'faculty_approved' | 'student_created';
  integrityPolicy: string;
  role: CommunityRole | null;
}

export interface PostRow {
  id: string;
  communityId: string;
  authorRef: string;
  authorName: string;
  body: string;
  label: SourceLabel;
  status: PostStatus;
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
}

export interface Notice {
  postId: string;
  action: DecisionAction;
  reasonCode: string;
  decidedAt: string;
  appealable: boolean;
  appealStatus: 'none' | 'pending' | 'granted' | 'upheld';
}

export interface Venue {
  id: string;
  name: string;
  kind: 'library' | 'academic_building' | 'student_center' | 'virtual';
}

export interface SessionRow {
  id: string;
  venueId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  taken: number;
  joined: boolean;
}

type Row = Record<string, unknown>;

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message?.trim() || fallback);
}

const str = (v: unknown) => String(v ?? '');

/* ------------------------------------------------------------------ */
/* Communities                                                         */
/* ------------------------------------------------------------------ */

export async function loadCommunities(): Promise<CommunityRow[]> {
  const db = await cloud();
  const [{ data: rows, error }, { data: mine, error: mineError }] = await Promise.all([
    db.from('communities').select('id, kind, name, purpose, verification, integrity_policy').order('name'),
    db.from('community_members').select('community_id, role'),
  ]);
  if (error) fail(error, 'Could not load communities.');
  if (mineError) fail(mineError, 'Could not load your memberships.');
  const roles = new Map<string, CommunityRole>((mine ?? []).map((m: Row) => [str(m.community_id), str(m.role) as CommunityRole]));
  return (rows ?? []).map((r: Row) => ({
    id: str(r.id),
    kind: str(r.kind) as CommunityType,
    name: str(r.name),
    purpose: str(r.purpose),
    verification: str(r.verification) as CommunityRow['verification'],
    integrityPolicy: str(r.integrity_policy),
    role: roles.get(str(r.id)) ?? null,
  }));
}

export async function createStudyGroup(name: string, purpose: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_community', {
    want_kind: 'study_group',
    want_name: name,
    want_purpose: purpose,
    want_integrity_policy: '',
  });
  if (error) fail(error, 'Could not create the study group.');
  return str(data);
}

export async function joinCommunity(id: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('join_community', { want_community: id });
  if (error) fail(error, 'Could not join.');
}

export async function leaveCommunity(id: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('community_members').delete().eq('community_id', id);
  if (error) fail(error, 'Could not leave.');
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

/** The newest fifty. The feed on top of this is finite; so is the fetch. */
export async function loadPosts(communityId: string): Promise<{ posts: PostRow[]; muted: string[] }> {
  const db = await cloud();
  const [{ data: rows, error }, { data: refs, error: refError }, { data: mutes, error: muteError }] =
    await Promise.all([
      db
        .from('community_posts')
        .select('id, community_id, author_ref, author_name, body, label, status, created_at, edited_at')
        .eq('community_id', communityId)
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: false })
        .limit(50),
      db.rpc('my_community_refs'),
      db.from('community_mutes').select('author_ref').eq('community_id', communityId),
    ]);
  if (error) fail(error, 'Could not load posts.');
  if (refError) fail(refError, 'Could not load posts.');
  if (muteError) fail(muteError, 'Could not load your mutes.');
  const mine = (refs ?? []).find((r: Row) => str(r.community_id) === communityId);
  const myRef = mine ? str(mine.author_ref) : null;
  return {
    posts: (rows ?? []).map((r: Row) => ({
      id: str(r.id),
      communityId: str(r.community_id),
      authorRef: str(r.author_ref),
      authorName: str(r.author_name),
      body: str(r.body),
      label: str(r.label) as SourceLabel,
      status: str(r.status) as PostStatus,
      createdAt: str(r.created_at),
      editedAt: r.edited_at ? str(r.edited_at) : null,
      mine: myRef !== null && str(r.author_ref) === myRef,
    })),
    muted: (mutes ?? []).map((m: Row) => str(m.author_ref)),
  };
}

export async function createPost(communityId: string, body: string, confirmedOwn: boolean): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_community_post', {
    want_community: communityId,
    want_body: body,
    want_confirmed_own: confirmedOwn,
  });
  if (error) fail(error, 'Could not post.');
  return str(data);
}

export async function editPost(postId: string, body: string, confirmedOwn: boolean): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('edit_community_post', {
    want_post: postId,
    want_body: body,
    want_confirmed_own: confirmedOwn,
  });
  if (error) fail(error, 'Could not save the edit.');
}

export async function deletePost(postId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('delete_community_post', { want_post: postId });
  if (error) fail(error, 'Could not delete the post.');
}

export async function reportPost(
  postId: string,
  category: ReportCategory,
  imminent: boolean,
  details: string,
): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('report_community_post', {
    want_post: postId,
    want_category: category,
    want_imminent: imminent,
    want_details: details,
  });
  if (error) fail(error, 'Could not send the report.');
}

export async function blockAuthor(postId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('block_community_author', { want_post: postId });
  if (error) fail(error, 'Could not block.');
}

export async function muteAuthor(accountId: string, communityId: string, authorRef: string): Promise<void> {
  const db = await cloud();
  const { error } = await db
    .from('community_mutes')
    .insert({ user_id: accountId, community_id: communityId, author_ref: authorRef });
  if (error) fail(error, 'Could not mute.');
}

export async function unmuteAuthor(communityId: string, authorRef: string): Promise<void> {
  const db = await cloud();
  const { error } = await db
    .from('community_mutes')
    .delete()
    .eq('community_id', communityId)
    .eq('author_ref', authorRef);
  if (error) fail(error, 'Could not unmute.');
}

/* ------------------------------------------------------------------ */
/* Notices and appeals                                                 */
/* ------------------------------------------------------------------ */

export async function loadNotices(): Promise<Notice[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_community_notices');
  if (error) fail(error, 'Could not load decisions about your posts.');
  return (data ?? []).map((r: Row) => ({
    postId: str(r.post_id),
    action: str(r.action) as DecisionAction,
    reasonCode: str(r.reason_code),
    decidedAt: str(r.decided_at),
    appealable: Boolean(r.appealable),
    appealStatus: str(r.appeal_status) as Notice['appealStatus'],
  }));
}

export async function appeal(postId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('appeal_community_decision', { want_post: postId });
  if (error) fail(error, 'Could not file the appeal.');
}

/* ------------------------------------------------------------------ */
/* Study sessions                                                      */
/* ------------------------------------------------------------------ */

export async function loadSessions(communityId: string): Promise<{ sessions: SessionRow[]; venues: Venue[] }> {
  const db = await cloud();
  const [s, counts, mine, venues] = await Promise.all([
    db
      .from('community_sessions')
      .select('id, venue_id, title, starts_at, ends_at, capacity')
      .eq('community_id', communityId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(20),
    db.rpc('community_session_counts', { want_community: communityId }),
    db.from('community_session_participants').select('session_id'),
    db.from('community_venues').select('id, name, kind').order('name'),
  ]);
  for (const r of [s, counts, mine, venues]) if (r.error) fail(r.error, 'Could not load study sessions.');
  const taken = new Map<string, number>((counts.data ?? []).map((c: Row) => [str(c.session_id), Number(c.taken)]));
  const joined = new Set((mine.data ?? []).map((m: Row) => str(m.session_id)));
  return {
    sessions: (s.data ?? []).map((r: Row) => ({
      id: str(r.id),
      venueId: str(r.venue_id),
      title: str(r.title),
      startsAt: str(r.starts_at),
      endsAt: str(r.ends_at),
      capacity: Number(r.capacity),
      taken: taken.get(str(r.id)) ?? 0,
      joined: joined.has(str(r.id)),
    })),
    venues: (venues.data ?? []).map((v: Row) => ({ id: str(v.id), name: str(v.name), kind: str(v.kind) as Venue['kind'] })),
  };
}

export async function createSession(args: {
  communityId: string;
  venueId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
}): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('create_study_session', {
    want_community: args.communityId,
    want_venue: args.venueId,
    want_title: args.title,
    want_starts: args.startsAt,
    want_ends: args.endsAt,
    want_capacity: args.capacity,
  });
  if (error) fail(error, 'Could not create the session.');
}

export async function joinSession(sessionId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('join_study_session', { want_session: sessionId });
  if (error) fail(error, 'Could not join the session.');
}

export async function leaveSession(sessionId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('community_session_participants').delete().eq('session_id', sessionId);
  if (error) fail(error, 'Could not leave the session.');
}

/* ------------------------------------------------------------------ */
/* Moderation console                                                  */
/* ------------------------------------------------------------------ */

export type Standing = 'none' | 'reviewer' | 'senior';

export interface CaseRow {
  id: string;
  postId: string;
  category: ReportCategory;
  severity: Severity;
  protection: 'queue' | 'monitor' | 'reduce_distribution' | 'temporary_hold';
  route: 'professional_urgent' | 'professional' | 'standard';
  status: 'open' | 'decided' | 'appealed' | 'closed';
  createdAt: string;
  post: { body: string; authorName: string; status: PostStatus; communityName: string } | null;
  reports: { category: ReportCategory; imminent: boolean; details: string; createdAt: string }[];
}

export async function reviewerStanding(): Promise<Standing> {
  const db = await cloud();
  const { data, error } = await db.rpc('community_reviewer_standing');
  if (error) fail(error, 'Could not check your Trust & Safety role.');
  return data === 'senior' || data === 'reviewer' ? data : 'none';
}

const SEVERITY_ORDER: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Open cases and open appeals, most severe first, then oldest first. */
export async function loadQueue(): Promise<CaseRow[]> {
  const db = await cloud();
  const { data: cases, error } = await db
    .from('community_cases')
    .select('id, post_id, category, severity, protection, route, status, created_at')
    .in('status', ['open', 'appealed'])
    .order('created_at')
    .limit(100);
  if (error) fail(error, 'Could not load the queue.');
  const postIds = [...new Set((cases ?? []).map((c: Row) => str(c.post_id)))];
  const caseIds = (cases ?? []).map((c: Row) => str(c.id));
  const [posts, reports, communities] = await Promise.all([
    postIds.length
      ? db.from('community_posts').select('id, community_id, author_name, body, status').in('id', postIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
    caseIds.length
      ? db.from('community_reports').select('case_id, category, imminent, details, created_at').in('case_id', caseIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
    db.from('communities').select('id, name'),
  ]);
  for (const r of [posts, reports, communities]) if (r.error) fail(r.error, 'Could not load the queue.');
  const names = new Map<string, string>((communities.data ?? []).map((c: Row) => [str(c.id), str(c.name)]));
  const byPost = new Map<string, Row>((posts.data ?? []).map((p: Row) => [str(p.id), p]));
  return (cases ?? [])
    .map((c: Row): CaseRow => {
      const p = byPost.get(str(c.post_id));
      return {
        id: str(c.id),
        postId: str(c.post_id),
        category: str(c.category) as ReportCategory,
        severity: str(c.severity) as Severity,
        protection: str(c.protection) as CaseRow['protection'],
        route: str(c.route) as CaseRow['route'],
        status: str(c.status) as CaseRow['status'],
        createdAt: str(c.created_at),
        post: p
          ? {
              body: str(p.body),
              authorName: str(p.author_name),
              status: str(p.status) as PostStatus,
              communityName: names.get(str(p.community_id)) ?? 'Community',
            }
          : null,
        reports: (reports.data ?? [])
          .filter((r: Row) => str(r.case_id) === str(c.id))
          .map((r: Row) => ({
            category: str(r.category) as ReportCategory,
            imminent: Boolean(r.imminent),
            details: str(r.details),
            createdAt: str(r.created_at),
          })),
      };
    })
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.createdAt.localeCompare(b.createdAt));
}

export async function decideCase(caseId: string, action: DecisionAction, reasonCode: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('decide_community_case', {
    want_case: caseId,
    want_action: action,
    want_reason: reasonCode,
  });
  if (error) fail(error, 'Could not record the decision.');
}

export async function decideAppeal(caseId: string, uphold: boolean, reasonCode: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('decide_community_appeal', {
    want_case: caseId,
    want_uphold: uphold,
    want_reason: reasonCode,
  });
  if (error) fail(error, 'Could not record the appeal decision.');
}
