/**
 * Student organizations, as the screens need them.
 *
 * `supabase/migrations/20260921230000_organizations.sql` is the enforcement and
 * this module is the way in and the words, the same division `schoolclaim.ts`
 * describes one table over. Nothing here decides anything: every write is an
 * `rpc` to a `security definer` function that asks what the caller is to that
 * organization before it does anything, and both API roles are off INSERT,
 * UPDATE and DELETE on `organization_members` outright.
 *
 * That is the property worth having, and it is worth stating in the same shape
 * `schoolclaim.ts` states its own: if this file were replaced wholesale by
 * something that returned "yes" to everything, no row would change.
 *
 * ## `can()` is for drawing panels and is not a permission check
 *
 * Item 257 of `docs/ROLE_REQUIREMENTS.md` describes the organization dashboard
 * as "a view of permissions rather than a separate thing to secure: an officer
 * with three capabilities sees three panels, and nothing else needs to know
 * why." `can()` is what draws those three panels. The server asks the same
 * question again, of `private.org_can()`, against the row rather than against
 * whatever this client last read — so a screen that showed a panel it should
 * not have shows a panel whose every button is refused.
 *
 * ## The messages are the server's
 *
 * "you are not a membership officer of this organization", "that is the only
 * administrator — appoint another one first". Postgres raises them written for
 * a person and they are passed through as they are, for the reason
 * `schoolclaim.ts` gives: rewriting them here would mean two places that have
 * to agree about what the server decided, which is the shape of every stale
 * message bug in this repository.
 */
import { cloud, cloudConfigured } from './cloud';

/**
 * Item 258's lifecycle, minus `DISCOVERED`.
 *
 * Deliberately not ordered, and `orgs.test.ts` holds this array against the
 * check constraint in the migration rather than against a copy of it.
 * `WAITLISTED` can precede `ACCEPTED` or terminate, and `ALUMNI_MEMBER`
 * follows `MEMBER` without being a demotion — so there is no index arithmetic
 * anywhere in this file and nothing compares two of these with `<`.
 *
 * `DISCOVERED` is absent because it is the absence of a row. Storing it would
 * mean recording that somebody looked at an organization.
 */
export const STANDINGS = [
  'FOLLOWER',
  'APPLICANT',
  'WAITLISTED',
  'ACCEPTED',
  'MEMBER',
  'ALUMNI_MEMBER',
  'DECLINED',
  'REMOVED',
] as const;
export type Standing = (typeof STANDINGS)[number];

/** The two a person says about themselves. Everything else is the organization's. */
export const SELF_DECLARED: readonly Standing[] = ['FOLLOWER', 'APPLICANT'];

/**
 * Item 256's officer capabilities, as a set rather than a rank.
 *
 * Tiers cannot express a treasurer who sees finances and cannot admit members,
 * so these are not positions in an order and the named officer roles are
 * presets over them. `ADMIN` is the one that implies the rest, and it implies
 * them in `private.org_can()` — `can()` below mirrors that one implication and
 * adds none.
 */
export const CAPABILITIES = [
  'ADMIN',
  'MEMBERSHIP',
  'EVENTS',
  'TREASURY',
  'COMMUNICATIONS',
  'SECRETARY',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** What each one lets somebody do, in the words a screen shows beside it. */
export const CAPABILITY_MEANS: Record<Capability, string> = {
  ADMIN: 'Everything, including appointing and removing officers',
  MEMBERSHIP: 'Decide applications, and remove members',
  EVENTS: 'Create, publish and cancel events',
  TREASURY: 'See and record money',
  COMMUNICATIONS: 'Post announcements',
  SECRETARY: 'Keep minutes and meeting records',
};

export interface Organization {
  id: string;
  schoolId: string;
  slug: string;
  name: string;
  about: string;
  listed: boolean;
}

export interface Member {
  orgId: string;
  userId: string;
  standing: Standing;
  capabilities: Capability[];
  since: string;
}

/** What came back from an attempt to change something. */
export type Done<T> = { ok: true; got: T } | { ok: false; because: string };

const NO_SERVER = 'This build has no account server, so there is nobody to ask.';

/**
 * Whether somebody holds a capability, for deciding what to draw.
 *
 * Mirrors `private.org_can()` and mirrors all of it: the standing test is here
 * too. A row with capabilities and a standing that is not `MEMBER` cannot
 * exist — the table has a constraint refusing it — and this checks anyway, for
 * the reason the function does: the constraint stops the row existing, and
 * this stops a row that somehow exists from being obeyed.
 */
export function can(member: Member | null | undefined, cap: Capability): boolean {
  if (!member || member.standing !== 'MEMBER') return false;
  return member.capabilities.includes(cap) || member.capabilities.includes('ADMIN');
}

/** Whether somebody is *in* an organization, which is narrower than having a row. */
export function inside(member: Member | null | undefined): boolean {
  return member?.standing === 'MEMBER' || member?.standing === 'ALUMNI_MEMBER';
}

/**
 * A slug from a name, as a suggestion the person can overwrite.
 *
 * It has to satisfy the same pattern `public.organizations.id` does — lower
 * case, digits and hyphens, 2 to 40, starting with a letter or digit — because
 * a name that produced an unacceptable one would be refused by the server
 * after somebody had typed everything else. Returns '' when it cannot make one
 * at all, which is a form that asks rather than a form that fails on submit.
 */
export function slugFor(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return /^[a-z0-9][a-z0-9-]{1,39}$/.test(s) ? s : '';
}

function reading(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    schoolId: String(row.school_id ?? ''),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    about: String(row.about ?? ''),
    listed: row.listed !== false,
  };
}

/**
 * One row of `organization_members`, as this build understands it.
 *
 * Exported for `orgs.test.ts`, which is not a concession: the filter below is
 * a decision about what a screen is allowed to believe, and it cannot be
 * reached through any of the reading functions without a mocked PostgREST.
 */
export function readMember(row: Record<string, unknown>): Member {
  const caps = Array.isArray(row.capabilities) ? row.capabilities.map(String) : [];
  return {
    orgId: String(row.org_id),
    userId: String(row.user_id),
    standing: String(row.standing) as Standing,
    // Filtered against the vocabulary rather than cast to it. A capability this
    // build has never heard of is one it cannot draw a panel for, and treating
    // it as held would be a screen offering something no button behind it does.
    capabilities: caps.filter((c): c is Capability =>
      (CAPABILITIES as readonly string[]).includes(c),
    ),
    since: String(row.since ?? ''),
  };
}

/**
 * Every organization this account may see.
 *
 * Which is the read policy's answer, not this function's: a member sees one
 * whatever its state, and everybody else sees the listed ones on their own
 * campus. An account that has not claimed a university sees none, and that is
 * the intended reading rather than an empty state to apologise for — it is
 * what `claim_school()` is finally for.
 */
export async function campusOrganizations(): Promise<Organization[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('organizations')
    .select('id, school_id, slug, name, about, listed')
    .order('name');
  if (error || !data) return [];
  return data.map(reading);
}

/** This account's own standing in every organization it has one in. */
export async function myStandings(): Promise<Member[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data: who } = await db.auth.getUser();
  const me = who.user?.id;
  if (!me) return [];
  const { data, error } = await db
    .from('organization_members')
    .select('org_id, user_id, standing, capabilities, since')
    .eq('user_id', me);
  if (error || !data) return [];
  return data.map(readMember);
}

/**
 * The rows of one organization this account may see.
 *
 * Three different answers depending on who is asking, and this function does
 * not know which it got: a member sees the roster, a membership officer sees
 * the applicants too, and somebody with only their own row sees only that. The
 * screen reads what came back rather than deciding in advance what should
 * have.
 */
export async function roster(orgId: string): Promise<Member[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('organization_members')
    .select('org_id, user_id, standing, capabilities, since')
    .eq('org_id', orgId);
  if (error || !data) return [];
  return data.map(readMember);
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Done<T>> {
  if (!cloudConfigured) return { ok: false, because: NO_SERVER };
  const db = await cloud();
  const { data, error } = await db.rpc(fn, args);
  if (error) return { ok: false, because: error.message };
  return { ok: true, got: data as T };
}

/** Start one on your own campus, and be its first administrator. */
export function startOrganization(
  slug: string,
  name: string,
  about = '',
): Promise<Done<string>> {
  return call<string>('start_organization', {
    want_slug: slug,
    want_name: name,
    want_about: about,
  });
}

/** Follow, or stop following. */
export function follow(orgId: string, want = true): Promise<Done<string>> {
  return call<string>('follow_organization', { org: orgId, want });
}

export function applyTo(orgId: string): Promise<Done<string>> {
  return call<string>('apply_to_organization', { org: orgId });
}

/**
 * Leave.
 *
 * Refused for the only administrator, and for a standing the organization set
 * against you — both with the server's own sentence, because both are things
 * somebody needs the reason for rather than a disabled button.
 */
export function leave(orgId: string): Promise<Done<string>> {
  return call<string>('leave_organization', { org: orgId });
}

/** Decide somebody's standing, as an officer who may. Never your own. */
export function setStanding(
  orgId: string,
  who: string,
  standing: Standing,
): Promise<Done<string>> {
  return call<string>('set_member_standing', { org: orgId, who, want: standing });
}

/** Appoint officers, as an administrator. */
export function setCapabilities(
  orgId: string,
  who: string,
  caps: readonly Capability[],
): Promise<Done<Capability[]>> {
  return call<Capability[]>('set_member_capabilities', { org: orgId, who, want: [...caps] });
}

/**
 * Take on an organization that has no administrator.
 *
 * The state an account deletion leaves — see
 * `20260921234500_organization_succession.sql` for why that is left honest
 * rather than fixed by promoting somebody who never agreed to it.
 */
export function claimAbandoned(orgId: string): Promise<Done<Capability[]>> {
  return call<Capability[]>('claim_abandoned_organization', { org: orgId });
}
