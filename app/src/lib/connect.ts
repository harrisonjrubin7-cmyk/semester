/**
 * Connecting the app to the accounts a semester actually runs on.
 *
 * Four things a student already has, and what the app can honestly do with
 * each:
 *
 *  · **Brightspace** — D2L publishes a per-user calendar feed (Calendar →
 *    Subscribe). It is an .ics URL with a token in it, readable without any
 *    login, and it carries every due date the course shells hold. There is also
 *    a full Valence API, but it needs an app key issued by Vanderbilt IT, so
 *    the feed is the route that works today. The app never asks for a
 *    Brightspace password, and never should.
 *
 *  · **Microsoft 365** — Graph, over normal browser OAuth with PKCE. Outlook
 *    calendar into the schedule, To Do for tasks, OneDrive files to attach.
 *
 *  · **Google** — the same shape: Calendar for the schedule, Drive for
 *    documents to pull into a course.
 *
 *  · **Zoom** — scheduled meetings and cloud recordings.
 *
 *  · **Apple** — sign-in only. There is no iCloud calendar API; the way in is
 *    to publish a calendar from the Calendar app and give the app the webcal
 *    link, which needs no account here and no key anywhere.
 *
 * Every provider needs a client ID, because an OAuth client is registered by
 * whoever runs the app, not shipped inside it. Set them in `app/.env.local`:
 *
 *     VITE_MS_CLIENT_ID=…
 *     VITE_GOOGLE_CLIENT_ID=…
 *     VITE_ZOOM_CLIENT_ID=…
 *     VITE_APPLE_CLIENT_ID=…           # a Services ID, and see vite.config.ts
 *     VITE_OAUTH_PROXY=/oauth        # optional; see vite.config.ts
 *
 * Without one, the app says so on the Connect screen and offers the file route
 * instead — every one of these systems exports .ics, and that path needs no
 * registration, no key and no server.
 *
 * Nothing leaves the device except the calls to the provider itself. Tokens are
 * held in this browser's storage, and there is no backend to send them to.
 */

import type { Course, CourseId, FeedEvent } from './types';
import { matchCourse } from './ics';

export type ProviderId = 'microsoft' | 'google' | 'zoom' | 'apple';

interface ProviderSpec {
  id: ProviderId;
  name: string;
  blurb: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId: string;
  /** Where to register a client, shown when there is no client ID. */
  console: string;
  /** True when the provider's API refuses browser calls without a proxy. */
  needsProxy: boolean;
  /** False when signing in gets you identity and nothing readable. */
  calendar: boolean;
  /** Anything the person has to know before they try. */
  caveat?: string;
}

const env = import.meta.env as unknown as Record<string, string | undefined>;

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft 365',
    blurb: 'Outlook calendar and mail, To Do, OneDrive — the Vanderbilt account.',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    // Read the calendar and mail, write the calendar and To Do. Files.ReadWrite
    // is what lets an export be saved back to OneDrive; nothing here deletes
    // anything, and Mail stays read-only — the app never sends mail as you.
    scopes:
      'openid profile offline_access User.Read Calendars.ReadWrite Mail.Read ' +
      'Tasks.ReadWrite Files.ReadWrite',
    clientId: env.VITE_MS_CLIENT_ID ?? '',
    console: 'portal.azure.com → App registrations → single-page application',
    needsProxy: false,
    calendar: true,
  },
  google: {
    id: 'google',
    name: 'Google',
    blurb: 'Google Calendar, Gmail, Tasks, and Drive documents to pull into a course.',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // Gmail is read-only and Google treats it as a restricted scope: an
    // unverified app is limited to the test users you list in the console
    // until it passes review. The Connect screen says so rather than letting
    // the button fail mysteriously.
    scopes:
      'openid https://www.googleapis.com/auth/calendar.events ' +
      'https://www.googleapis.com/auth/drive.readonly ' +
      // drive.file is the narrow one: it grants access only to files this app
      // itself creates, so an export can be saved to Drive without the app
      // gaining any right to read what is already there.
      'https://www.googleapis.com/auth/drive.file ' +
      'https://www.googleapis.com/auth/gmail.readonly ' +
      'https://www.googleapis.com/auth/tasks',
    clientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
    console: 'console.cloud.google.com → Credentials → OAuth client → Web application',
    needsProxy: false,
    calendar: true,
  },
  zoom: {
    id: 'zoom',
    name: 'Zoom',
    blurb: 'Scheduled meetings on the day rail, cloud recordings by course.',
    authorizeUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scopes: 'user:read meeting:read recording:read',
    clientId: env.VITE_ZOOM_CLIENT_ID ?? '',
    console: 'marketplace.zoom.us → Develop → Build App → General App (PKCE)',
    // Zoom's API sends no CORS headers, so browser calls have to go through
    // the dev proxy. Saying so beats a silent network error.
    needsProxy: true,
    calendar: true,
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    blurb: 'Sign in with Apple, for who you are. Your calendar comes the other way — see below.',
    authorizeUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    // Asking for name or email forces response_mode=form_post, which POSTs to
    // the redirect and a single-page app cannot receive. Identity alone comes
    // back on the query string, which is all this needs.
    scopes: '',
    clientId: env.VITE_APPLE_CLIENT_ID ?? '',
    console: 'developer.apple.com → Identifiers → Services ID (a paid account)',
    // Apple's client secret is a JWT signed with a private key. That signing
    // cannot happen in a browser, so this one always goes through the proxy.
    needsProxy: true,
    calendar: false,
    caveat:
      'Apple gives no calendar API. To bring an iCloud calendar in, publish it — ' +
      'Calendar → share a calendar → Public Calendar — and paste the webcal link above. ' +
      'That route needs no account here at all. Signing in with Apple is only worth it ' +
      'if you want the app to know who you are, and it needs a paid developer account, ' +
      'a Services ID whose redirect is https (Apple rejects localhost), and the proxy ' +
      'to sign the client secret.',
  },
};

/** Optional path that forwards to the providers — see vite.config.ts. */
const PROXY = env.VITE_OAUTH_PROXY ?? '';

const TOKEN_KEY = 'semester.tokens.v1';
const PENDING_KEY = 'semester.oauth.pending';

export interface Token {
  provider: ProviderId;
  access: string;
  refresh: string;
  /** Epoch ms. */
  expires: number;
  account: string;
}

type TokenStore = Partial<Record<ProviderId, Token>>;

export function tokens(): TokenStore {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}') as TokenStore;
  } catch {
    return {};
  }
}

function saveToken(token: Token): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokens(), [token.provider]: token }));
  } catch {
    // Storage unavailable — the connection lasts this session only.
  }
}

export function forget(provider: ProviderId): void {
  const all = tokens();
  delete all[provider];
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(all));
  } catch {
    /* nothing to do */
  }
}

// ── PKCE ──────────────────────────────────────────────────────────────────

function random(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = '';
  view.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Send the browser to the provider's consent screen. */
export async function beginAuth(id: ProviderId): Promise<void> {
  const spec = PROVIDERS[id];
  const verifier = random();
  const state = random(16);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id, verifier, state }));

  const url = new URL(spec.authorizeUrl);
  url.searchParams.set('client_id', spec.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  // Apple takes no scope here on purpose: asking for name or email switches it
  // to a form POST that a single-page app never receives.
  if (spec.scopes) url.searchParams.set('scope', spec.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await challenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  if (id === 'google') {
    // Without these Google returns no refresh token on a repeat consent, and
    // the connection silently dies an hour later.
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }
  window.location.assign(url.toString());
}

function tokenEndpoint(spec: ProviderSpec): string {
  return PROXY ? `${PROXY}/${spec.id}/token` : spec.tokenUrl;
}

/**
 * Finish a redirect, if this load is one. Returns the provider that connected.
 *
 * Called once when the app starts. It clears the code out of the address bar
 * either way, so a refresh does not try to redeem a spent code.
 */
export async function completeAuth(): Promise<{ id: ProviderId; error?: string } | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  if ((!code && !error) || !pendingRaw) return null;

  sessionStorage.removeItem(PENDING_KEY);
  window.history.replaceState({}, '', redirectUri());

  const pending = JSON.parse(pendingRaw) as { id: ProviderId; verifier: string; state: string };
  if (error) return { id: pending.id, error: params.get('error_description') ?? error };
  if (params.get('state') !== pending.state) {
    return { id: pending.id, error: 'The reply did not match the request. Nothing was connected.' };
  }

  const spec = PROVIDERS[pending.id];
  const body = new URLSearchParams({
    client_id: spec.clientId,
    grant_type: 'authorization_code',
    code: code as string,
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
  });

  try {
    const res = await fetch(tokenEndpoint(spec), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return { id: pending.id, error: `${spec.name} refused the exchange (${res.status}).` };
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    saveToken({
      provider: pending.id,
      access: json.access_token,
      refresh: json.refresh_token ?? '',
      expires: Date.now() + (json.expires_in ?? 3600) * 1000,
      account: '',
    });
    return { id: pending.id };
  } catch (e) {
    return { id: pending.id, error: describe(e) };
  }
}

/** A live access token, refreshed if it has run out. */
async function accessToken(id: ProviderId): Promise<string> {
  const token = tokens()[id];
  if (!token) throw new Error(`${PROVIDERS[id].name} is not connected.`);
  if (token.expires > Date.now() + 30_000) return token.access;
  if (!token.refresh) throw new Error(`${PROVIDERS[id].name} needs signing in again.`);

  const spec = PROVIDERS[id];
  const res = await fetch(tokenEndpoint(spec), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: spec.clientId,
      grant_type: 'refresh_token',
      refresh_token: token.refresh,
    }),
  });
  if (!res.ok) throw new Error(`${spec.name} would not refresh the session.`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const next: Token = {
    ...token,
    access: json.access_token,
    refresh: json.refresh_token ?? token.refresh,
    expires: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  saveToken(next);
  return next.access;
}

export function describe(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror/i.test(message)) {
    return 'The browser blocked the call. This provider needs the proxy — see VITE_OAUTH_PROXY.';
  }
  return message;
}

// ── Pulling ───────────────────────────────────────────────────────────────

function apiBase(id: ProviderId, url: string): string {
  return PROVIDERS[id].needsProxy && PROXY ? url.replace(/^https:\/\/[^/]+/, `${PROXY}/${id}/api`) : url;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function clock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

function toFeedEvent(
  courses: Course[],
  id: string,
  title: string,
  start: Date,
  allDay: boolean,
  where: string,
  note: string,
): FeedEvent {
  return {
    id,
    sourceId: '',
    title,
    date: isoDate(start),
    at: allDay ? null : start.getHours() * 60 + start.getMinutes(),
    time: allDay ? 'All day' : clock(start),
    where,
    note: note.slice(0, 400),
    courseId: matchCourse(courses, `${title} ${where} ${note}`),
  };
}

async function get<T>(id: ProviderId, url: string): Promise<T> {
  const token = await accessToken(id);
  const res = await fetch(apiBase(id, url), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${PROVIDERS[id].name} said ${res.status}.`);
  return (await res.json()) as T;
}

/**
 * Upload a file the app made.
 *
 * Google wants a multipart body with a metadata part and a media part; Graph
 * wants a plain PUT to a path. Both are small enough that a library would be
 * more code than this. Neither is given anything to read: Drive is asked for
 * `drive.file`, which reaches only files this app created.
 */
export async function upload(
  id: ProviderId,
  name: string,
  blob: Blob,
  folder = 'Semester',
): Promise<{ name: string; link: string }> {
  const token = await accessToken(id);

  if (id === 'google') {
    const boundary = `semester${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({ name, mimeType: blob.type || 'application/octet-stream' });
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
      `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--\r\n`,
    ]);
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) throw new Error(await explainUpload(res, 'Google Drive'));
    const json = (await res.json()) as { name?: string; webViewLink?: string; id?: string };
    return {
      name: json.name ?? name,
      link: json.webViewLink ?? `https://drive.google.com/file/d/${json.id ?? ''}/view`,
    };
  }

  if (id === 'microsoft') {
    const path = `${encodeURIComponent(folder)}/${encodeURIComponent(name)}`;
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': blob.type || 'application/octet-stream',
        },
        body: blob,
      },
    );
    if (!res.ok) throw new Error(await explainUpload(res, 'OneDrive'));
    const json = (await res.json()) as { name?: string; webUrl?: string };
    return { name: json.name ?? name, link: json.webUrl ?? '' };
  }

  throw new Error(`${PROVIDERS[id].name} has nowhere to put a file.`);
}

/**
 * Why an upload failed, in words.
 *
 * 403 here almost always means the account was connected before the app asked
 * for a write scope, and the fix is to disconnect and connect again — which is
 * not something anyone guesses from "403".
 */
async function explainUpload(res: Response, where: string): Promise<string> {
  const detail = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) {
    return (
      `${where} refused the upload (${res.status}). The account was probably connected before ` +
      'the app asked for permission to write. Disconnect it and connect it again.'
    );
  }
  if (res.status === 507 || /quota/i.test(detail)) return `${where} is out of space.`;
  return `${where} said ${res.status}.`;
}

const HORIZON_DAYS = 120;

/** Everything on the connected calendar between today and the end of term. */
export async function pullCalendar(courses: Course[], id: ProviderId): Promise<FeedEvent[]> {
  if (!PROVIDERS[id].calendar) {
    throw new Error(
      `${PROVIDERS[id].name} has no calendar API. Publish the calendar and add its webcal link instead.`,
    );
  }
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + HORIZON_DAYS * 24 * 3600 * 1000);

  if (id === 'microsoft') {
    type GraphEvent = {
      id: string;
      subject: string;
      isAllDay: boolean;
      start: { dateTime: string };
      location?: { displayName?: string };
      bodyPreview?: string;
    };
    const json = await get<{ value: GraphEvent[] }>(
      'microsoft',
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${from.toISOString()}` +
        `&endDateTime=${to.toISOString()}&$top=200&$orderby=start/dateTime`,
    );
    return json.value.map((e) =>
      toFeedEvent(
        courses,
        e.id,
        e.subject || 'Untitled',
        new Date(`${e.start.dateTime}${e.start.dateTime.endsWith('Z') ? '' : 'Z'}`),
        e.isAllDay,
        e.location?.displayName ?? '',
        e.bodyPreview ?? '',
      ),
    );
  }

  if (id === 'google') {
    type GEvent = {
      id: string;
      summary?: string;
      location?: string;
      description?: string;
      start: { dateTime?: string; date?: string };
    };
    const json = await get<{ items: GEvent[] }>(
      'google',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
        `?timeMin=${from.toISOString()}&timeMax=${to.toISOString()}` +
        '&singleEvents=true&orderBy=startTime&maxResults=250',
    );
    return json.items.map((e) =>
      toFeedEvent(
        courses,
        e.id,
        e.summary ?? 'Untitled',
        e.start.dateTime ? new Date(e.start.dateTime) : new Date(`${e.start.date}T00:00:00`),
        !e.start.dateTime,
        e.location ?? '',
        e.description ?? '',
      ),
    );
  }

  type ZoomMeeting = { id: number; topic: string; start_time?: string; join_url?: string; agenda?: string };
  const json = await get<{ meetings: ZoomMeeting[] }>(
    'zoom',
    'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=100',
  );
  return json.meetings
    .filter((m) => m.start_time)
    .map((m) =>
      toFeedEvent(
        courses,
        String(m.id),
        m.topic || 'Zoom meeting',
        new Date(m.start_time as string),
        false,
        m.join_url ?? 'Zoom',
        m.agenda ?? '',
      ),
    );
}

export interface RemoteFile {
  id: string;
  name: string;
  /** Where to open it — the provider's own viewer. */
  link: string;
  /** Bytes to fetch it directly, when the provider allows it. */
  download: string;
  modified: string;
}

/** Recent documents, for pulling a posted reading into a course. */
export async function listRemoteFiles(id: ProviderId): Promise<RemoteFile[]> {
  if (id === 'apple') throw new Error('Apple exposes no file API to a web app.');

  if (id === 'microsoft') {
    type Item = {
      id: string;
      name: string;
      webUrl: string;
      lastModifiedDateTime: string;
      '@microsoft.graph.downloadUrl'?: string;
    };
    const json = await get<{ value: Item[] }>('microsoft', 'https://graph.microsoft.com/v1.0/me/drive/recent');
    return json.value.map((f) => ({
      id: f.id,
      name: f.name,
      link: f.webUrl,
      download: f['@microsoft.graph.downloadUrl'] ?? '',
      modified: f.lastModifiedDateTime?.slice(0, 10) ?? '',
    }));
  }

  if (id === 'google') {
    type Item = { id: string; name: string; webViewLink: string; modifiedTime: string; mimeType: string };
    const json = await get<{ files: Item[] }>(
      'google',
      'https://www.googleapis.com/drive/v3/files?pageSize=50&orderBy=modifiedTime desc' +
        '&fields=files(id,name,webViewLink,modifiedTime,mimeType)',
    );
    return json.files.map((f) => ({
      id: f.id,
      name: f.name,
      link: f.webViewLink,
      // A Google Doc has to be exported rather than downloaded; plain text is
      // what the card parser wants anyway.
      download: f.mimeType.startsWith('application/vnd.google-apps')
        ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`
        : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
      modified: f.modifiedTime?.slice(0, 10) ?? '',
    }));
  }

  type Recording = { uuid: string; topic: string; start_time: string; share_url: string };
  const json = await get<{ meetings: Recording[] }>(
    'zoom',
    'https://api.zoom.us/v2/users/me/recordings?page_size=30',
  );
  return json.meetings.map((r) => ({
    id: r.uuid,
    name: r.topic,
    link: r.share_url,
    download: '',
    modified: r.start_time?.slice(0, 10) ?? '',
  }));
}

/** Fetch a remote document's text, for pasting into a course as material. */
export async function fetchRemoteText(id: ProviderId, file: RemoteFile): Promise<string> {
  if (!file.download) throw new Error('That one has no direct download.');
  const token = await accessToken(id);
  const res = await fetch(apiBase(id, file.download), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not read it (${res.status}).`);
  return res.text();
}

// ── Mail ──────────────────────────────────────────────────────────────────
// Course announcements arrive as email — a class cancelled, a reading swapped,
// a deadline moved — and then get lost in an inbox. The app looks for the ones
// that name a course it knows about, and offers to turn them into material, a
// task, or an appointment. It reads; it never sends.

export interface Message {
  id: string;
  from: string;
  subject: string;
  /** First few lines, enough to see what it is. */
  preview: string;
  /** ISO date. */
  date: string;
  link: string;
  courseId: CourseId | null;
}

function shortDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Recent mail that mentions one of your courses.
 *
 * The search is done on the provider's side — Graph and Gmail both take a
 * query — so an inbox of forty thousand messages does not have to come down the
 * wire to find six.
 */
export async function listMail(
  courses: Course[],
  id: ProviderId,
  days = 45,
): Promise<Message[]> {
  if (courses.length === 0) return [];
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  // Codes as the professor writes them, and as the registrar writes them.
  const terms = courses.flatMap((c) => [c.code, c.code.replace(/\s+/g, '')]);

  if (id === 'microsoft') {
    type Mail = {
      id: string;
      subject?: string;
      bodyPreview?: string;
      receivedDateTime: string;
      webLink?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
    };
    const search = terms.map((t) => `"${t}"`).join(' OR ');
    const json = await get<{ value: Mail[] }>(
      'microsoft',
      `https://graph.microsoft.com/v1.0/me/messages?$search=${encodeURIComponent(search)}&$top=40`,
    );
    return json.value
      .filter((m) => new Date(m.receivedDateTime) >= since)
      .map((m) => ({
        id: m.id,
        from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || '',
        subject: m.subject ?? '(no subject)',
        preview: (m.bodyPreview ?? '').slice(0, 400),
        date: shortDate(new Date(m.receivedDateTime)),
        link: m.webLink ?? '',
        courseId: matchCourse(courses, `${m.subject ?? ''} ${m.bodyPreview ?? ''}`),
      }));
  }

  if (id === 'google') {
    type Ref = { id: string };
    const query = `newer_than:${days}d (${terms.map((t) => `"${t}"`).join(' OR ')})`;
    const list = await get<{ messages?: Ref[] }>(
      'google',
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(query)}`,
    );
    const out: Message[] = [];
    for (const ref of list.messages ?? []) {
      type Full = {
        id: string;
        snippet?: string;
        internalDate?: string;
        payload?: { headers?: { name: string; value: string }[] };
      };
      const full = await get<Full>(
        'google',
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}` +
          '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date',
      );
      const header = (name: string) =>
        full.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';
      out.push({
        id: full.id,
        from: header('from'),
        subject: header('subject') || '(no subject)',
        preview: (full.snippet ?? '').slice(0, 400),
        date: shortDate(new Date(Number(full.internalDate ?? Date.now()))),
        link: `https://mail.google.com/mail/u/0/#inbox/${full.id}`,
        courseId: matchCourse(courses, `${header('subject')} ${full.snippet ?? ''}`),
      });
    }
    return out;
  }

  throw new Error(`${PROVIDERS[id].name} has no mail this app can read.`);
}

// ── Writing back ──────────────────────────────────────────────────────────
// Reading a calendar is half of it. A deadline that only exists in this app is
// a deadline your phone's own alarms know nothing about, so it can be pushed
// out to the calendar and the task list you already live in.

async function post<T>(id: ProviderId, url: string, body: unknown): Promise<T> {
  const token = await accessToken(id);
  const res = await fetch(apiBase(id, url), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${PROVIDERS[id].name} said ${res.status}. ${detail.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

export interface OutgoingEvent {
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Minutes past midnight, or null for an all-day entry. */
  at: number | null;
  minutes: number;
  note: string;
}

function localIso(date: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Put one thing on the calendar you actually use. */
export async function addEvent(id: ProviderId, event: OutgoingEvent): Promise<void> {
  const allDay = event.at === null;
  const start = allDay ? event.date : localIso(event.date, event.at as number);
  const end = allDay ? event.date : localIso(event.date, (event.at as number) + event.minutes);

  if (id === 'microsoft') {
    await post('microsoft', 'https://graph.microsoft.com/v1.0/me/events', {
      subject: event.title,
      body: { contentType: 'text', content: event.note },
      isAllDay: allDay,
      start: { dateTime: allDay ? `${start}T00:00:00` : start, timeZone: TZ },
      end: { dateTime: allDay ? `${end}T23:59:00` : end, timeZone: TZ },
    });
    return;
  }
  if (id === 'google') {
    await post('google', 'https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      summary: event.title,
      description: event.note,
      start: allDay ? { date: start } : { dateTime: `${start}`, timeZone: TZ },
      end: allDay ? { date: end } : { dateTime: `${end}`, timeZone: TZ },
    });
    return;
  }
  throw new Error(`${PROVIDERS[id].name} has no calendar to write to.`);
}

/** Put one thing on the task list you actually use. */
export async function addTask(
  id: ProviderId,
  task: { title: string; date: string | null; note: string },
): Promise<void> {
  if (id === 'microsoft') {
    type List = { id: string; wellknownListName?: string; displayName: string };
    const lists = await get<{ value: List[] }>(
      'microsoft',
      'https://graph.microsoft.com/v1.0/me/todo/lists',
    );
    const target =
      lists.value.find((l) => l.wellknownListName === 'defaultList') ?? lists.value[0];
    if (!target) throw new Error('That account has no To Do list to add to.');
    await post('microsoft', `https://graph.microsoft.com/v1.0/me/todo/lists/${target.id}/tasks`, {
      title: task.title,
      body: { content: task.note, contentType: 'text' },
      ...(task.date
        ? { dueDateTime: { dateTime: `${task.date}T12:00:00`, timeZone: TZ } }
        : {}),
    });
    return;
  }
  if (id === 'google') {
    await post('google', 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
      title: task.title,
      notes: task.note,
      ...(task.date ? { due: `${task.date}T00:00:00.000Z` } : {}),
    });
    return;
  }
  throw new Error(`${PROVIDERS[id].name} has no task list to write to.`);
}
