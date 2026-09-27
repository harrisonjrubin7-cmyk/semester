/**
 * The account service's Community tables, as the screens use them.
 *
 * Every write is an RPC — members never hold another member's account id, so
 * the server resolves authors, runs triage and checks roles
 * (supabase/migrations/20260927210000_community.sql). Reads name their columns
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
  /** Approved for scoped pseudonyms by a community manager. */
  pseudonymityApproved: boolean;
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
  /** Posted under a community alias. */
  asAlias: boolean;
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
    db.from('communities').select('id, kind, name, purpose, verification, integrity_policy, pseudonymity_approved').order('name'),
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
    pseudonymityApproved: Boolean(r.pseudonymity_approved),
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
        .select('id, community_id, author_ref, author_name, body, label, status, as_alias, created_at, edited_at')
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
      asAlias: Boolean(r.as_alias),
      createdAt: str(r.created_at),
      editedAt: r.edited_at ? str(r.edited_at) : null,
      mine: myRef !== null && str(r.author_ref) === myRef,
    })),
    muted: (mutes ?? []).map((m: Row) => str(m.author_ref)),
  };
}

export async function createPost(
  communityId: string,
  body: string,
  confirmedOwn: boolean,
  asAlias = false,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_community_post', {
    want_community: communityId,
    want_body: body,
    want_confirmed_own: confirmedOwn,
    want_as_alias: asAlias,
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
  route: 'professional_urgent' | 'professional' | 'standard' | 'integrity_review';
  status: 'open' | 'decided' | 'appealed' | 'closed';
  createdAt: string;
  post: { body: string; authorName: string; status: PostStatus; communityName: string } | null;
  reports: { category: ReportCategory; imminent: boolean; details: string; createdAt: string }[];
  /** What the detectors recorded. Never a reporter; brigading shows up here. */
  signals: { detector: string; ruleId: string; confidence: number; version: string; createdAt: string }[];
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
  const [posts, reports, communities, signals] = await Promise.all([
    postIds.length
      ? db.from('community_posts').select('id, community_id, author_name, body, status').in('id', postIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
    caseIds.length
      ? db.from('community_reports').select('case_id, category, imminent, details, created_at').in('case_id', caseIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
    db.from('communities').select('id, name'),
    caseIds.length
      ? db.from('community_signals').select('case_id, detector, rule_id, confidence, version, created_at').in('case_id', caseIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  for (const r of [posts, reports, communities, signals]) if (r.error) fail(r.error, 'Could not load the queue.');
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
        signals: (signals.data ?? [])
          .filter((x: Row) => str(x.case_id) === str(c.id))
          .map((x: Row) => ({
            detector: str(x.detector),
            ruleId: str(x.rule_id),
            confidence: Number(x.confidence),
            version: str(x.version),
            createdAt: str(x.created_at),
          })),
      };
    })
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.createdAt.localeCompare(b.createdAt));
}

/** When the retention sweep last ran, so a stalled job shows on the console. */
export async function lastSweep(): Promise<{ ranAt: string; removed: number } | null> {
  const db = await cloud();
  const { data, error } = await db
    .from('community_retention_runs')
    .select('ran_at, cases_removed, posts_removed, reports_removed, restrictions_removed, sessions_removed')
    .order('ran_at', { ascending: false })
    .limit(1);
  if (error) fail(error, 'Could not read the retention log.');
  const r = (data ?? [])[0] as Row | undefined;
  if (!r) return null;
  const removed = ['cases_removed', 'posts_removed', 'reports_removed', 'restrictions_removed', 'sessions_removed']
    .reduce((n, k) => n + Number(r[k] ?? 0), 0);
  return { ranAt: str(r.ran_at), removed };
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

/* ------------------------------------------------------------------ */
/* Programmes that stay off until a school switches them on            */
/* ------------------------------------------------------------------ */

export interface Programs {
  scopedPseudonymity: boolean;
  volunteerModeration: boolean;
}

/** Which programmes this student's school has switched on. Absent means off. */
export async function loadPrograms(): Promise<Programs> {
  const db = await cloud();
  const { data, error } = await db.from('community_programs').select('program, enabled');
  if (error) fail(error, 'Could not check which Community programmes are on.');
  const on = (name: string) => (data ?? []).some((r: Row) => str(r.program) === name && Boolean(r.enabled));
  return { scopedPseudonymity: on('scoped_pseudonymity'), volunteerModeration: on('volunteer_moderation') };
}

/* ------------------------------------------------------------------ */
/* Scoped aliases                                                      */
/* ------------------------------------------------------------------ */

/** This student's alias in one community, if any. Only ever their own. */
export async function loadAlias(communityId: string): Promise<{ name: string; rotatedAt: string | null } | null> {
  const db = await cloud();
  const { data, error } = await db
    .from('community_aliases')
    .select('name, rotated_at')
    .eq('community_id', communityId)
    .maybeSingle();
  if (error) fail(error, 'Could not load your name in this community.');
  if (!data) return null;
  const r = data as Row;
  return { name: str(r.name), rotatedAt: r.rotated_at ? str(r.rotated_at) : null };
}

/** Take a name, or change the one you have. The server enforces every rule. */
export async function claimAlias(communityId: string, name: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('claim_community_alias', { want_community: communityId, want_name: name });
  if (error) fail(error, 'Could not use that name.');
}

export async function dropAlias(communityId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('community_aliases').delete().eq('community_id', communityId);
  if (error) fail(error, 'Could not stop using that name.');
}

/* ------------------------------------------------------------------ */
/* Volunteer moderation                                                */
/* ------------------------------------------------------------------ */

export type VolunteerStatus = 'onboarding' | 'active' | 'probation' | 'paused' | 'revoked';

export interface VolunteerRecord {
  status: VolunteerStatus;
  trained: boolean;
  confidentialitySigned: boolean;
  recusalAcknowledged: boolean;
}

export interface VolunteerStanding {
  onboardingAnswered: number;
  quality: number | null;
  reviewsLastHour: number;
  reviewsToday: number;
}

/** A task as a volunteer sees it: no name, no author, no reporter, no votes. */
export interface VolunteerTask {
  taskId: string;
  category: ReportCategory;
  severity: Severity;
  communityKind: CommunityType;
  body: string;
}

export type VolunteerAction = 'allow' | 'label' | 'remove' | 'close_no_action';

export async function loadVolunteer(): Promise<{ record: VolunteerRecord | null; standing: VolunteerStanding | null }> {
  const db = await cloud();
  const [rec, standing] = await Promise.all([
    db
      .from('community_volunteers')
      .select('status, training_completed_at, confidentiality_signed_at, recusal_acknowledged_at')
      .maybeSingle(),
    db.rpc('my_volunteer_standing'),
  ]);
  if (rec.error) fail(rec.error, 'Could not load your volunteer record.');
  if (standing.error) fail(standing.error, 'Could not load your volunteer standing.');
  const r = rec.data as Row | null;
  const st = ((standing.data ?? []) as Row[])[0];
  return {
    record: r
      ? {
          status: str(r.status) as VolunteerStatus,
          trained: Boolean(r.training_completed_at),
          confidentialitySigned: Boolean(r.confidentiality_signed_at),
          recusalAcknowledged: Boolean(r.recusal_acknowledged_at),
        }
      : null,
    standing: st
      ? {
          onboardingAnswered: Number(st.onboarding_answered ?? 0),
          quality: st.quality == null ? null : Number(st.quality),
          reviewsLastHour: Number(st.reviews_last_hour ?? 0),
          reviewsToday: Number(st.reviews_today ?? 0),
        }
      : null,
  };
}

export async function applyToVolunteer(): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('apply_to_volunteer');
  if (error) fail(error, 'Could not apply.');
}

export async function attest(kind: 'confidentiality' | 'recusal'): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('volunteer_attest', { want_kind: kind });
  if (error) fail(error, 'Could not record that.');
}

export async function nextTasks(): Promise<VolunteerTask[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('volunteer_next_tasks');
  if (error) fail(error, 'Could not load tasks.');
  return ((data ?? []) as Row[]).map((r) => ({
    taskId: str(r.task_id),
    category: str(r.category) as ReportCategory,
    severity: str(r.severity) as Severity,
    communityKind: str(r.community_kind) as CommunityType,
    body: str(r.body),
  }));
}

export async function decideTask(taskId: string, action: VolunteerAction, reasonCode: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('volunteer_decide', { want_task: taskId, want_action: action, want_reason: reasonCode });
  if (error) fail(error, 'Could not record your decision.');
}
