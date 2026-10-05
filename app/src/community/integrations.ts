/**
 * Social-media and calendar integrations for organizations: distribution and
 * import/export tools, never hidden data collection.
 *
 * Seven providers, each with what a student sees, what the organization or
 * institution controls, and the privacy boundary. The requirements under
 * them are the blueprint's, as refusals: `connect` will not take a password,
 * a personal account for an organization connection, a scope the provider's
 * minimal set does not include, or a connection with no owner and no
 * purpose; `publish` will not post what nobody previewed; `disconnect`
 * always works. `NEVER_INGESTED` is what no connection reads whatever its
 * scopes say.
 *
 * `integration_connections.provider_domain` is a closed list with no social
 * domain in it, so a live connection needs a migration; this is the rule it
 * will be held to. Anything shown from a provider carries `EXTERNAL_NOTICE`,
 * which is the `external` trust kind from `lib/source.ts` in a sentence.
 */
import { TRUST_TEXT } from '../lib/source';

export const PROVIDERS = [
  { id: 'instagram', name: 'Instagram', student: 'Display approved public club posts; share a public event card', control: 'A club officer connects an organization-owned account and can disconnect at any time', boundary: 'No private messages, follower lists or personal browsing data', scopes: ['public_posts.read'] },
  { id: 'tiktok', name: 'TikTok', student: 'Link to approved public campaign or video content', control: 'Organization-owned account only', boundary: 'No tracking pixel tied to student records; external-content warning shown', scopes: ['public_video.read'] },
  { id: 'youtube', name: 'YouTube', student: 'Embed approved club, department, orientation or event videos', control: 'Owner, captions, transcript and expiry review required', boundary: 'Captions or a transcript required; external-service context shown', scopes: ['public_video.read'] },
  { id: 'linkedin', name: 'LinkedIn', student: 'Export a student-approved portfolio summary; promote verified career events', control: 'The student controls the export; employer visibility is opt-in', boundary: 'No grades, academic data, private interests or hidden profile data', scopes: ['profile.write_summary'] },
  { id: 'calendar', name: 'Google or Microsoft Calendar', student: 'Subscribe to selected events; add an approved event to a calendar', control: 'The student chooses the calendar and the event', boundary: 'The write scope is explained; disconnect is one tap; nothing is added silently', scopes: ['calendar.events.write'] },
  { id: 'meetings', name: 'Zoom or Teams', student: 'Join an official online event or study session', control: 'The event host controls access and the waiting-room policy', boundary: 'No chat, transcript or recording is imported without explicit disclosure and policy', scopes: ['meeting.join'] },
  { id: 'notifications', name: 'Email, SMS and push', student: 'Event reminders and operational notifications', control: 'Consent, quiet hours, frequency controls and a named sender', boundary: 'SMS only with explicit opt-in; no manufactured urgency; no hidden unsubscribe', scopes: ['reminders.send'] },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['id'];

export const REQUIREMENTS = [
  'OAuth only; never ask for a social-media password',
  'Scopes are minimal, shown before connection, and logged',
  'A club account is organization-owned or approved by an authorized officer',
  'Every connection has an owner, a purpose, a scope, a last sync and a disconnect action',
  'External content is labelled as hosted outside Semester',
  'No automatic posting: a preview and an explicit publish confirmation first',
  'No scraping of student social graphs, direct messages, contacts or behavioural data',
  'No ad targeting from academic records, mentoring, accessibility or safety reports',
] as const;

/** What no connection reads, whatever scope a provider would grant. */
export const NEVER_INGESTED = ['direct messages', 'follower lists', 'contacts', 'browsing data', 'social graph', 'behavioural data'] as const;

export const EXTERNAL_NOTICE = `Hosted outside Semester. ${TRUST_TEXT.external}: its content, captions and privacy are the provider's.`;

export type AccountType = 'organization_owned' | 'officer_approved' | 'personal';
export type Credential = { kind: 'oauth'; token: string } | { kind: 'password'; secret: string };

export interface ConnectRequest {
  provider: ProviderId;
  /** The organization, or the student for a calendar or LinkedIn connection. */
  owner: string;
  ownerKind: 'organization' | 'student';
  accountType: AccountType;
  purpose: string;
  scopes: readonly string[];
  credential: Credential;
  today: string;
}

export interface Connection {
  provider: ProviderId;
  owner: string;
  ownerKind: 'organization' | 'student';
  accountType: AccountType;
  purpose: string;
  scopes: readonly string[];
  connectedOn: string;
  lastSyncOn: string | null;
  disconnectedOn: string | null;
  postingEnabled: boolean;
}

export type ConnectVerdict = { ok: true; connection: Connection } | { ok: false; reasons: string[] };

export function connect(r: ConnectRequest): ConnectVerdict {
  const reasons: string[] = [];
  const provider = PROVIDERS.find((p) => p.id === r.provider);
  if (!provider) reasons.push('not a provider Semester connects to');
  if (r.credential.kind !== 'oauth') reasons.push('OAuth only; Semester never holds a social-media password');
  if (r.ownerKind === 'organization' && r.accountType === 'personal') reasons.push('an organization connection uses an organization-owned or officer-approved account');
  if (!r.owner.trim()) reasons.push('a connection has an owner');
  if (r.purpose.trim().length < 12) reasons.push('a connection says what it is for');
  if (!r.scopes.length) reasons.push('a connection names its scopes');
  const allowed = new Set<string>(provider?.scopes ?? []);
  const extra = r.scopes.filter((s) => !allowed.has(s));
  if (extra.length) reasons.push(`scopes beyond the minimal set: ${extra.join(', ')}`);
  if (reasons.length) return { ok: false, reasons };
  return {
    ok: true,
    connection: { provider: r.provider, owner: r.owner.trim(), ownerKind: r.ownerKind, accountType: r.accountType, purpose: r.purpose.trim(), scopes: [...r.scopes], connectedOn: r.today, lastSyncOn: null, disconnectedOn: null, postingEnabled: false },
  };
}

/** Always allowed, by anyone who owns the connection, with no condition. */
export function disconnect(c: Connection, today: string): Connection {
  return { ...c, disconnectedOn: today, postingEnabled: false };
}

export interface Draft {
  connection: Connection;
  body: string;
  /** Set by the person who looked at the preview, when they looked. */
  previewedOn: string | null;
  confirmedBy: string | null;
}

export type PublishVerdict = { ok: true; publishedOn: string } | { ok: false; reason: string };

/** Nothing leaves without a preview and a named yes. */
export function publish(d: Draft, today: string): PublishVerdict {
  if (d.connection.disconnectedOn) return { ok: false, reason: 'this connection was disconnected' };
  if (!d.connection.postingEnabled) return { ok: false, reason: 'posting is not enabled on this connection' };
  if (!d.previewedOn) return { ok: false, reason: 'nobody has previewed this' };
  if (!d.confirmedBy) return { ok: false, reason: 'publishing needs a named confirmation' };
  if (!d.body.trim()) return { ok: false, reason: 'nothing to publish' };
  return { ok: true, publishedOn: today };
}

/** The never-ingested list as the keys a provider payload would carry them under. */
const NEVER_KEYS = ['directmessage', 'dm', 'follower', 'contact', 'browsing', 'socialgraph', 'friend', 'behaviour', 'behavior'] as const;

/** A connection can carry no field from the never-ingested list, whatever a provider returned. */
export function assertNothingIngested(payload: Record<string, unknown>): void {
  const keys = Object.keys(payload).map((k) => k.toLowerCase().replace(/[_\s-]/g, ''));
  const hit = NEVER_KEYS.filter((n) => keys.some((k) => k === n || k.startsWith(n) || k.endsWith(n)));
  if (hit.length) throw new Error(`a connection never ingests: ${hit.join(', ')}`);
}
