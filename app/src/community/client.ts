/**
 * The account service's Community tables, as the screens use them.
 *
 * Every write is an RPC — members never hold another member's account id, so
 * the server resolves authors, runs triage and checks roles
 * (supabase/migrations/20260928032000_community.sql). Reads name their columns
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
  /** An attached image, as far as this viewer may see it. */
  media: PostMedia | null;
}

export type MediaStatus = 'awaiting_upload' | 'pending' | 'clear' | 'held' | 'rejected' | 'removed';

export interface PostMedia {
  id: string;
  status: MediaStatus;
  reasonCode: string;
  width: number | null;
  height: number | null;
  /** A short-lived signed address, only where the storage policy lets this viewer read it. */
  url: string | null;
  knownAbuseMatch: boolean;
  altText: string;
}

const MEDIA_BUCKET = 'community-media';

/** Media rows for some posts, with signed addresses for the ones this viewer may open. */
async function mediaFor(postIds: string[]): Promise<Map<string, PostMedia>> {
  if (postIds.length === 0) return new Map();
  const db = await cloud();
  const { data, error } = await db
    .from('community_media')
    .select('id, post_id, object_path, alt_text, status, reason_code, width, height, known_abuse_match')
    .in('post_id', postIds);
  if (error) fail(error, 'Could not load images.');
  const rows = (data ?? []) as Row[];
  // Never ask for an address to a known-abuse match; storage would refuse it anyway.
  const paths = rows.filter((r) => !r.known_abuse_match).map((r) => str(r.object_path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 600);
    for (const s of (signed ?? []) as { path: string | null; signedUrl: string | null; error: string | null }[]) {
      if (s.path && s.signedUrl && !s.error) urls.set(s.path, s.signedUrl);
    }
  }
  return new Map(
    rows.map((r) => [
      str(r.post_id),
      {
        id: str(r.id),
        status: str(r.status) as MediaStatus,
        reasonCode: str(r.reason_code),
        width: r.width === null || r.width === undefined ? null : Number(r.width),
        height: r.height === null || r.height === undefined ? null : Number(r.height),
        url: urls.get(str(r.object_path)) ?? null,
        knownAbuseMatch: Boolean(r.known_abuse_match),
        altText: str(r.alt_text),
      },
    ]),
  );
}

/**
 * Reserve an image, upload it, and hand back its id for createPost. The bytes
 * must already have been through stripMetadata (metadata.ts); the server
 * checks again and rejects what still carries any.
 */
export async function uploadImage(
  communityId: string,
  kind: 'jpeg' | 'png' | 'webp',
  bytes: Uint8Array,
  altText: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('begin_community_image', { want_community: communityId, want_kind: kind, want_alt: altText });
  if (error) fail(error, 'Could not start the upload.');
  const row = ((data ?? []) as Row[])[0];
  if (!row) fail(null, 'Could not start the upload.');
  const { error: upError } = await db.storage
    .from(MEDIA_BUCKET)
    .upload(str(row.object_path), new Blob([bytes as BlobPart], { type: `image/${kind}` }), { upsert: false, contentType: `image/${kind}` });
  if (upError) fail({ message: upError.message }, 'Could not upload the image.');
  return str(row.media_id);
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
  const media = await mediaFor((rows ?? []).map((r: Row) => str(r.id)));
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
      media: media.get(str(r.id)) ?? null,
    })),
    muted: (mutes ?? []).map((m: Row) => str(m.author_ref)),
  };
}

export async function createPost(
  communityId: string,
  body: string,
  confirmedOwn: boolean,
  asAlias = false,
  mediaId: string | null = null,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_community_post', {
    want_community: communityId,
    want_body: body,
    want_confirmed_own: confirmedOwn,
    want_as_alias: asAlias,
    want_media: mediaId,
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
  /** The school the case belongs to; escalation and safety state are switched on per school. */
  tenantId: string;
  category: ReportCategory;
  severity: Severity;
  protection: 'queue' | 'monitor' | 'reduce_distribution' | 'temporary_hold';
  route: 'professional_urgent' | 'professional' | 'standard' | 'integrity_review';
  status: 'open' | 'decided' | 'appealed' | 'closed';
  createdAt: string;
  post: { body: string; authorName: string; status: PostStatus; communityName: string; asAlias: boolean } | null;
  media: PostMedia | null;
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
    .select('id, post_id, tenant_id, category, severity, protection, route, status, created_at')
    .in('status', ['open', 'appealed'])
    .order('created_at')
    .limit(100);
  if (error) fail(error, 'Could not load the queue.');
  const postIds = [...new Set((cases ?? []).map((c: Row) => str(c.post_id)))];
  const caseIds = (cases ?? []).map((c: Row) => str(c.id));
  const [posts, reports, communities, signals] = await Promise.all([
    postIds.length
      ? db.from('community_posts').select('id, community_id, author_name, body, status, as_alias').in('id', postIds)
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
  const media = await mediaFor(postIds);
  const names = new Map<string, string>((communities.data ?? []).map((c: Row) => [str(c.id), str(c.name)]));
  const byPost = new Map<string, Row>((posts.data ?? []).map((p: Row) => [str(p.id), p]));
  return (cases ?? [])
    .map((c: Row): CaseRow => {
      const p = byPost.get(str(c.post_id));
      return {
        id: str(c.id),
        postId: str(c.post_id),
        tenantId: str(c.tenant_id),
        category: str(c.category) as ReportCategory,
        severity: str(c.severity) as Severity,
        protection: str(c.protection) as CaseRow['protection'],
        route: str(c.route) as CaseRow['route'],
        status: str(c.status) as CaseRow['status'],
        createdAt: str(c.created_at),
        media: media.get(str(c.post_id)) ?? null,
        post: p
          ? {
              body: str(p.body),
              authorName: str(p.author_name),
              status: str(p.status) as PostStatus,
              communityName: names.get(str(p.community_id)) ?? 'Community',
              asAlias: Boolean(p.as_alias),
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
  institutionEscalation: boolean;
  accountSafetyState: boolean;
  imagePosts: boolean;
}

export const NO_PROGRAMS: Programs = {
  scopedPseudonymity: false,
  volunteerModeration: false,
  institutionEscalation: false,
  accountSafetyState: false,
  imagePosts: false,
};

const PROGRAM_KEYS: [keyof Programs, string][] = [
  ['scopedPseudonymity', 'scoped_pseudonymity'],
  ['volunteerModeration', 'volunteer_moderation'],
  ['institutionEscalation', 'institution_escalation'],
  ['accountSafetyState', 'account_safety_state'],
  ['imagePosts', 'image_posts'],
];

function programsFrom(rows: Row[]): Programs {
  const out = { ...NO_PROGRAMS };
  for (const [key, name] of PROGRAM_KEYS) out[key] = rows.some((r) => str(r.program) === name && Boolean(r.enabled));
  return out;
}

/**
 * Which programmes this student's school has switched on. Absent means off.
 * The database answers kill.sharing on top of these; this is only whether to
 * show the door.
 */
export async function loadPrograms(): Promise<Programs> {
  const db = await cloud();
  const { data, error } = await db.from('community_programs').select('program, enabled');
  if (error) fail(error, 'Could not check which Community programmes are on.');
  return programsFrom((data ?? []) as Row[]);
}

/** For a reviewer, who works across schools: each school's switches. */
export async function loadProgramsBySchool(): Promise<Map<string, Programs>> {
  const db = await cloud();
  const { data, error } = await db.from('community_programs').select('tenant_id, program, enabled');
  if (error) fail(error, 'Could not check which Community programmes are on.');
  const bySchool = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) bySchool.set(str(r.tenant_id), [...(bySchool.get(str(r.tenant_id)) ?? []), r]);
  return new Map([...bySchool].map(([school, rows]) => [school, programsFrom(rows)]));
}

/* ------------------------------------------------------------------ */
/* Institution escalation                                              */
/* ------------------------------------------------------------------ */

export interface EscalationPolicy {
  tenantId: string;
  enabled: boolean;
  agreementRef: string;
  categories: string[];
  identityRequired: boolean;
  /** Whether a channel is named. Where it goes is the service role's business. */
  hasChannel: boolean;
}

export interface Escalation {
  id: string;
  caseId: string;
  tenantId: string;
  /** From the case, when it is still kept. */
  category: ReportCategory | null;
  severity: Severity | null;
  status: 'requested' | 'approved' | 'refused';
  requestedReason: string;
  requestedAt: string;
  /** SHA-256 of the requester's account id, so a reviewer can tell it was them. */
  requestedBy: string;
  decidedReason: string | null;
  decidedAt: string | null;
  delivery: {
    queuedAt: string;
    attempts: number;
    deliveredAt: string | null;
    /** One of the adapter's fixed codes (`http_502`, `timeout`, …), never text from the receiver. */
    lastError: string | null;
    nextAttemptAt: string | null;
  } | null;
}

/** Every school's agreement, as reviewers may read it. */
export async function loadEscalationPolicies(): Promise<Map<string, EscalationPolicy>> {
  const db = await cloud();
  const { data, error } = await db
    .from('community_escalation_policies')
    .select('tenant_id, enabled, agreement_ref, categories, identity_required, channel');
  if (error) fail(error, 'Could not read the escalation agreements.');
  return new Map(
    ((data ?? []) as Row[]).map((r) => [
      str(r.tenant_id),
      {
        tenantId: str(r.tenant_id),
        enabled: Boolean(r.enabled),
        agreementRef: str(r.agreement_ref),
        categories: Array.isArray(r.categories) ? (r.categories as unknown[]).map(String) : [],
        identityRequired: Boolean(r.identity_required),
        hasChannel: str(r.channel) !== '',
      },
    ]),
  );
}

/** Escalations from the last 30 days, newest first, with whether each went. */
export async function loadEscalations(): Promise<Escalation[]> {
  const db = await cloud();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('community_escalations')
    .select('id, case_id, tenant_id, status, requested_reason, requested_at, requested_by_sha256, decided_reason, decided_at')
    .gte('requested_at', since)
    .order('requested_at', { ascending: false })
    .limit(100);
  if (error) fail(error, 'Could not load escalations.');
  const ids = ((data ?? []) as Row[]).map((r) => str(r.id));
  const caseIds = [...new Set(((data ?? []) as Row[]).map((r) => str(r.case_id)))];
  const [deliveries, cases] = await Promise.all([
    ids.length
      ? db
          .from('community_escalation_deliveries')
          .select('escalation_id, queued_at, attempts, delivered_at, last_error, next_attempt_at')
          .in('escalation_id', ids)
      : Promise.resolve({ data: [] as Row[], error: null }),
    caseIds.length
      ? db.from('community_cases').select('id, category, severity').in('id', caseIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  for (const r of [deliveries, cases]) if (r.error) fail(r.error, 'Could not load escalations.');
  const sent = new Map(((deliveries.data ?? []) as Row[]).map((d) => [str(d.escalation_id), d]));
  const kases = new Map(((cases.data ?? []) as Row[]).map((k) => [str(k.id), k]));
  return ((data ?? []) as Row[]).map((r) => {
    const d = sent.get(str(r.id));
    const k = kases.get(str(r.case_id));
    return {
      id: str(r.id),
      caseId: str(r.case_id),
      tenantId: str(r.tenant_id),
      category: k ? (str(k.category) as ReportCategory) : null,
      severity: k ? (str(k.severity) as Severity) : null,
      status: str(r.status) as Escalation['status'],
      requestedReason: str(r.requested_reason),
      requestedAt: str(r.requested_at),
      requestedBy: str(r.requested_by_sha256),
      decidedReason: r.decided_reason ? str(r.decided_reason) : null,
      decidedAt: r.decided_at ? str(r.decided_at) : null,
      delivery: d
        ? {
            queuedAt: str(d.queued_at),
            attempts: Number(d.attempts ?? 0),
            deliveredAt: d.delivered_at ? str(d.delivered_at) : null,
            lastError: d.last_error ? str(d.last_error) : null,
            nextAttemptAt: d.next_attempt_at ? str(d.next_attempt_at) : null,
          }
        : null,
    };
  });
}

export async function requestEscalation(caseId: string, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('request_community_escalation', { want_case: caseId, want_reason: reason });
  if (error) fail(error, 'Could not request the escalation.');
}

export async function decideEscalation(escalationId: string, approve: boolean, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('decide_community_escalation', {
    want_escalation: escalationId,
    want_approve: approve,
    want_reason: reason,
  });
  if (error) fail(error, 'Could not record the escalation decision.');
}

/** The same hash the database stores for a reviewer, so the console can say "you asked". */
export async function accountHash(accountId: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accountId));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Who is behind an alias (just-in-time, per case)                     */
/* ------------------------------------------------------------------ */

export interface IdentityGrant {
  id: string;
  caseId: string;
  status: 'requested' | 'approved' | 'refused';
  /** SHA-256 of the reviewer it is for, compared with accountHash() to say "yours". */
  grantee: string;
  requestedReason: string;
  requestedAt: string;
  decidedReason: string | null;
  expiresAt: string | null;
}

export interface RevealedIdentity {
  handle: string;
  vaultRef: string;
  otherCases: { caseId: string; category: ReportCategory; severity: Severity; status: string; asAlias: boolean }[];
  expiresAt: string;
}

export async function loadIdentityGrants(caseIds: string[]): Promise<IdentityGrant[]> {
  if (caseIds.length === 0) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('community_identity_grants')
    .select('id, case_id, status, grantee_sha256, requested_reason, requested_at, decided_reason, expires_at')
    .in('case_id', caseIds)
    .order('requested_at', { ascending: false });
  if (error) fail(error, 'Could not load identity requests.');
  return ((data ?? []) as Row[]).map((r) => ({
    id: str(r.id),
    caseId: str(r.case_id),
    status: str(r.status) as IdentityGrant['status'],
    grantee: str(r.grantee_sha256),
    requestedReason: str(r.requested_reason),
    requestedAt: str(r.requested_at),
    decidedReason: r.decided_reason ? str(r.decided_reason) : null,
    expiresAt: r.expires_at ? str(r.expires_at) : null,
  }));
}

export async function requestIdentity(caseId: string, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('request_alias_identity', { want_case: caseId, want_reason: reason });
  if (error) fail(error, 'Could not ask.');
}

export async function decideIdentity(grantId: string, approve: boolean, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('decide_alias_identity', { want_grant: grantId, want_approve: approve, want_reason: reason });
  if (error) fail(error, 'Could not record the decision.');
}

/** The look itself. The server writes it into the case history every time. */
export async function revealIdentity(grantId: string): Promise<RevealedIdentity> {
  const db = await cloud();
  const { data, error } = await db.rpc('reveal_alias_identity', { want_grant: grantId });
  if (error) fail(error, 'Could not show who posted this.');
  const r = ((data ?? []) as Row[])[0];
  if (!r) fail(null, 'Could not show who posted this.');
  const others = Array.isArray(r.other_cases) ? (r.other_cases as Row[]) : [];
  return {
    handle: str(r.handle),
    vaultRef: str(r.vault_ref),
    otherCases: others.map((o) => ({
      caseId: str(o.case_id),
      category: str(o.category) as ReportCategory,
      severity: str(o.severity) as Severity,
      status: str(o.status),
      asAlias: Boolean(o.as_alias),
    })),
    expiresAt: str(r.expires_at),
  };
}

/* ------------------------------------------------------------------ */
/* Escalation agreements (senior Trust & Safety only)                  */
/* ------------------------------------------------------------------ */

export interface Agreement {
  tenantId: string;
  enabled: boolean;
  agreementRef: string;
  categories: string[];
  identityRequired: boolean;
  channel: string;
  contact: string;
  expiresOn: string | null;
  /** SHA-256 of who drafted this version, so the screen can say "you drafted this". */
  draftedBy: string | null;
  draftedAt: string | null;
  activatedAt: string | null;
}

export interface AgreementEvent {
  tenantId: string;
  event: 'drafted' | 'activated' | 'retired';
  actor: string;
  reason: string;
  agreementRef: string;
  occurredAt: string;
}

export interface AgreementDraft {
  tenantId: string;
  agreementRef: string;
  categories: string[];
  identityRequired: boolean;
  channel: string;
  contact: string;
  expiresOn: string;
}

export async function canManageAgreements(): Promise<boolean> {
  const db = await cloud();
  const { data, error } = await db.rpc('can_manage_escalation_agreements');
  if (error) fail(error, 'Could not check your role.');
  return data === true;
}

/** Every school, every agreement, and the history — for the agreements screen. */
export async function loadAgreements(): Promise<{
  schools: { id: string; name: string }[];
  agreements: Agreement[];
  events: AgreementEvent[];
}> {
  const db = await cloud();
  const [schools, policies, events] = await Promise.all([
    db.from('schools').select('id, name').order('name'),
    db
      .from('community_escalation_policies')
      .select('tenant_id, enabled, agreement_ref, categories, identity_required, channel, contact, expires_on, drafted_by_sha256, drafted_at, activated_at'),
    db
      .from('community_escalation_agreement_events')
      .select('tenant_id, event, actor_sha256, reason, agreement_ref, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);
  for (const r of [schools, policies, events]) if (r.error) fail(r.error, 'Could not load the agreements.');
  return {
    schools: ((schools.data ?? []) as Row[]).map((r) => ({ id: str(r.id), name: str(r.name) })),
    agreements: ((policies.data ?? []) as Row[]).map((r) => ({
      tenantId: str(r.tenant_id),
      enabled: Boolean(r.enabled),
      agreementRef: str(r.agreement_ref),
      categories: Array.isArray(r.categories) ? (r.categories as unknown[]).map(String) : [],
      identityRequired: Boolean(r.identity_required),
      channel: str(r.channel),
      contact: str(r.contact),
      expiresOn: r.expires_on ? str(r.expires_on) : null,
      draftedBy: r.drafted_by_sha256 ? str(r.drafted_by_sha256) : null,
      draftedAt: r.drafted_at ? str(r.drafted_at) : null,
      activatedAt: r.activated_at ? str(r.activated_at) : null,
    })),
    events: ((events.data ?? []) as Row[]).map((r) => ({
      tenantId: str(r.tenant_id),
      event: str(r.event) as AgreementEvent['event'],
      actor: str(r.actor_sha256),
      reason: str(r.reason),
      agreementRef: str(r.agreement_ref),
      occurredAt: str(r.occurred_at),
    })),
  };
}

export async function saveAgreement(d: AgreementDraft): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('save_escalation_agreement', {
    want_tenant: d.tenantId,
    want_agreement_ref: d.agreementRef,
    want_categories: d.categories,
    want_identity_required: d.identityRequired,
    want_channel: d.channel,
    want_contact: d.contact,
    want_expires_on: d.expiresOn,
  });
  if (error) fail(error, 'Could not save the agreement.');
}

export async function activateAgreement(tenantId: string, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('activate_escalation_agreement', { want_tenant: tenantId, want_reason: reason });
  if (error) fail(error, 'Could not activate the agreement.');
}

export async function retireAgreement(tenantId: string, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('retire_escalation_agreement', { want_tenant: tenantId, want_reason: reason });
  if (error) fail(error, 'Could not retire the agreement.');
}

/* ------------------------------------------------------------------ */
/* The private safety state                                            */
/* ------------------------------------------------------------------ */

/** One case author's 0–100, for a reviewer, with a reason the case history keeps. */
export async function readAuthorSafety(caseId: string, reason: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('case_author_safety', { want_case: caseId, want_reason: reason });
  if (error) fail(error, 'Could not read the safety state.');
  return Number(data);
}

/** What the student is told: a sentence, never a number. */
export async function myStanding(): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_community_standing');
  if (error) fail(error, 'Could not check your Community standing.');
  return str(data);
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
  if (error) fail(error, 'Could not load cases to review.');
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

/* ------------------------------------------------------------------ */
/* Managing the volunteer programme (senior reviewers)                 */
/* ------------------------------------------------------------------ */

export interface RosterEntry {
  userId: string;
  handle: string;
  tenantId: string;
  status: VolunteerStatus;
  appliedAt: string;
  trainedAt: string | null;
  confidentialityAt: string | null;
  recusalAt: string | null;
  calibrationStartedAt: string;
  revokedAt: string | null;
  revokedReason: string;
  onboardingAnswered: number;
  onboardingRight: number;
  quality: number | null;
  reviewsToday: number;
  lastAnsweredAt: string | null;
}

export interface VolunteerEvent {
  volunteer: string;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string;
  occurredAt: string;
}

export interface CalibrationItem {
  id: string;
  tenantId: string;
  kind: 'onboarding' | 'control';
  category: 'spam_scam_or_phishing' | 'other';
  severity: 'P2' | 'P3';
  communityKind: string;
  body: string;
  expectedAction: 'allow' | 'remove';
  retiredAt: string | null;
}

export type ManageAction = 'record_training' | 'recalibrate' | 'revoke';

const orNull = (v: unknown) => (v === null || v === undefined ? null : str(v));

export async function loadRoster(): Promise<RosterEntry[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('volunteer_roster');
  if (error) fail(error, 'Could not load the volunteers.');
  return ((data ?? []) as Row[]).map((r) => ({
    userId: str(r.user_id),
    handle: str(r.handle),
    tenantId: str(r.tenant_id),
    status: str(r.status) as VolunteerStatus,
    appliedAt: str(r.applied_at),
    trainedAt: orNull(r.training_completed_at),
    confidentialityAt: orNull(r.confidentiality_signed_at),
    recusalAt: orNull(r.recusal_acknowledged_at),
    calibrationStartedAt: str(r.calibration_started_at),
    revokedAt: orNull(r.revoked_at),
    revokedReason: str(r.revoked_reason),
    onboardingAnswered: Number(r.onboarding_answered ?? 0),
    onboardingRight: Number(r.onboarding_right ?? 0),
    quality: r.quality === null || r.quality === undefined ? null : Number(r.quality),
    reviewsToday: Number(r.reviews_today ?? 0),
    lastAnsweredAt: orNull(r.last_answered_at),
  }));
}

export async function manageVolunteer(userId: string, action: ManageAction, reason: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('manage_volunteer', { want_volunteer: userId, want_action: action, want_reason: reason });
  if (error) fail(error, 'Could not record that.');
}

/** The programme's history, newest first. Volunteers are named by hash; see accountHash. */
export async function loadVolunteerEvents(): Promise<VolunteerEvent[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('community_volunteer_events')
    .select('volunteer_sha256, event, from_status, to_status, reason, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(300);
  if (error) fail(error, 'Could not load the volunteer history.');
  return ((data ?? []) as Row[]).map((r) => ({
    volunteer: str(r.volunteer_sha256),
    event: str(r.event),
    fromStatus: orNull(r.from_status),
    toStatus: orNull(r.to_status),
    reason: str(r.reason),
    occurredAt: str(r.occurred_at),
  }));
}

export async function loadCalibrationItems(): Promise<CalibrationItem[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('community_calibration_items')
    .select('id, tenant_id, kind, category, severity, community_kind, body, expected_action, retired_at')
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load the calibration items.');
  return ((data ?? []) as Row[]).map((r) => ({
    id: str(r.id),
    tenantId: str(r.tenant_id),
    kind: str(r.kind) as CalibrationItem['kind'],
    category: str(r.category) as CalibrationItem['category'],
    severity: str(r.severity) as CalibrationItem['severity'],
    communityKind: str(r.community_kind),
    body: str(r.body),
    expectedAction: str(r.expected_action) as CalibrationItem['expectedAction'],
    retiredAt: orNull(r.retired_at),
  }));
}

export async function addCalibrationItem(item: Omit<CalibrationItem, 'id' | 'retiredAt'>): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('community_calibration_items').insert({
    tenant_id: item.tenantId,
    kind: item.kind,
    category: item.category,
    severity: item.severity,
    community_kind: item.communityKind,
    body: item.body,
    expected_action: item.expectedAction,
  });
  if (error) fail(error, 'Could not add the item.');
}

export async function retireCalibrationItem(id: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('community_calibration_items').update({ retired_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error, 'Could not retire the item.');
}

