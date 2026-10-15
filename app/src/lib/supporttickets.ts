/**
 * The student's half of support tickets.
 *
 * Every call is an RPC; the tables have no grant
 * (`supabase/migrations/20260928210000_support_tickets.sql`). The rule this
 * module exists to keep is the one that migration opens with: the student
 * decides what context goes with a ticket, sees it before it is sent, and
 * none of it is about them rather than about the app.
 *
 * `supporttickets.test.ts` reads the migration and fails if the categories, the six
 * context keys or the first-response hours here drift from the ones the
 * database enforces.
 */
import { cloud } from './cloud';

export const CATEGORIES = ['account', 'sync', 'bug', 'accessibility', 'privacy', 'how_to', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  account: 'My account or signing in',
  sync: 'My work is not the same on my devices',
  bug: 'Something is broken',
  accessibility: 'An accessibility barrier',
  privacy: 'A privacy question or concern',
  how_to: 'How do I…',
  other: 'Something else',
};

/** Hours to a first reply, as the database computes it. */
export function firstResponseHours(category: Category): number {
  return category === 'accessibility' || category === 'privacy' ? 24 : 72;
}

/** The six context keys the database accepts. All about the app, none about the person. */
export const CONTEXT_KEYS = ['app_version', 'device_class', 'screen', 'signed_in', 'sync_state', 'offline'] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];

export const CONTEXT_LABELS: Record<ContextKey, string> = {
  app_version: 'App version',
  device_class: 'Kind of device',
  screen: 'The screen, without anything after its name',
  signed_in: 'Whether I am signed in',
  sync_state: 'Whether my work has synced',
  offline: 'Whether I am offline',
};

/**
 * Only the ticked keys, each trimmed to what the database accepts. A key the
 * student did not tick is never in the result, whatever `available` holds.
 */
export function contextToSend(available: Partial<Record<ContextKey, string>>, ticked: ReadonlySet<ContextKey>): Partial<Record<ContextKey, string>> {
  const out: Partial<Record<ContextKey, string>> = {};
  for (const key of CONTEXT_KEYS) {
    const value = available[key]?.trim();
    if (ticked.has(key) && value) out[key] = value.slice(0, 80);
  }
  return out;
}

/** `#/work/abc?x=1` → `#/work`. An id after the screen name can name a course or a person. */
export function screenShape(hash: string): string {
  return /^#\/[a-z0-9_-]{1,40}/i.exec(hash)?.[0].toLowerCase() ?? '';
}

/**
 * What the app could offer to send, read from the app and nothing else. The
 * student sees each value next to its box before anything is ticked, so none
 * of it is sent unseen — and `contextToSend` sends only what they tick.
 */
export function availableContext(app: {
  build: string;
  width: number;
  hash: string;
  signedIn: boolean;
  sync: string;
  online: boolean;
}): Record<ContextKey, string> {
  return {
    app_version: app.build || 'dev',
    device_class: app.width < 640 ? 'phone' : app.width < 1024 ? 'tablet' : 'desktop',
    screen: screenShape(app.hash) || 'unknown',
    signed_in: app.signedIn ? 'yes' : 'no',
    sync_state: app.sync || 'unknown',
    offline: app.online ? 'no' : 'yes',
  };
}

export const STATUS_LABELS: Record<Ticket['status'], string> = {
  open: 'Waiting for Semester support',
  waiting_on_student: 'Support replied — waiting for you',
  resolved: 'Support thinks this is solved',
  closed: 'Closed',
};

/** A stable, speakable reference. It identifies the ticket, never the student. */
export function ticketReference(id: string): string {
  const token = id.replace(/[^a-f0-9]/gi, '').slice(0, 16).toUpperCase();
  return token ? `SUP-${token.match(/.{1,4}/g)?.join('-')}` : 'SUP-UNKNOWN';
}

export interface Ticket {
  id: string;
  category: Category;
  subject: string;
  status: 'open' | 'waiting_on_student' | 'resolved' | 'closed';
  priority: 'high' | 'normal';
  createdAt: string;
  firstResponseDue: string;
  firstRespondedAt: string | null;
  emailNoticeEnabled: boolean;
}

export interface Message {
  from: 'student' | 'support';
  body: string;
  at: string;
}

/** The identity-free row shown to a support agent. */
export interface SupportQueueTicket extends Ticket {
  overdue: boolean;
}

/** A support-side thread row. Only the opening row can carry student-approved app context. */
export interface SupportMessage extends Message {
  context: Partial<Record<ContextKey, string>> | null;
}

export interface SupportCaseAccess {
  ticketId: string;
  grantId: string | null;
  scope: string | null;
  reason: string | null;
  expiresAt: string | null;
  consentState: 'not_granted' | 'active' | 'expired' | 'revoked' | 'wrong_scope' | 'role_missing';
  active: boolean;
  lastSensitiveReadAt: string | null;
}

export interface SupportCaseSignal {
  courseId: string;
  evidenceCount: number;
  averageScore: number | null;
  mistakeCount: number;
  lastObservedAt: string | null;
}

type Row = Record<string, unknown>;
const STATUSES = ['open', 'waiting_on_student', 'resolved', 'closed'] as const;

export function toTicket(row: Row, emailNoticeEnabled = false): Ticket {
  const category = (CATEGORIES as readonly string[]).includes(String(row.category)) ? (row.category as Category) : 'other';
  const status = (STATUSES as readonly string[]).includes(String(row.status)) ? (row.status as Ticket['status']) : 'open';
  return {
    id: String(row.id),
    category,
    subject: String(row.subject),
    status,
    priority: row.priority === 'high' ? 'high' : 'normal',
    createdAt: String(row.created_at),
    firstResponseDue: String(row.first_response_due),
    firstRespondedAt: row.first_responded_at ? String(row.first_responded_at) : null,
    emailNoticeEnabled,
  };
}

const fail = (error: { message?: string } | null, fallback: string) => new Error(error?.message?.trim() || fallback);

export async function openTicket(
  category: Category,
  subject: string,
  body: string,
  context: Partial<Record<ContextKey, string>>,
  emailNoticeEnabled: boolean,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('open_support_ticket', {
    want_category: category,
    want_subject: subject.trim(),
    want_body: body.trim(),
    want_context: context,
    want_email_notice: emailNoticeEnabled,
  });
  if (error) throw fail(error, 'Could not send your question.');
  return String(data);
}

export async function setSupportEmailNotice(ticketId: string, enabled: boolean): Promise<'on' | 'off' | 'off_with_in_flight'> {
  const db = await cloud();
  const { data, error } = await db.rpc('set_support_email_notice', { want_ticket: ticketId, want_enabled: enabled });
  if (error) throw fail(error, 'Could not change the email notice choice.');
  if (data === 'on' || data === 'off' || data === 'off_with_in_flight') return data;
  throw new Error('The email notice choice was saved, but its delivery state is unavailable. Refresh this question.');
}

export async function myTickets(): Promise<Ticket[]> {
  const db = await cloud();
  const [{ data, error }, { data: notices, error: noticesError }] = await Promise.all([
    db.rpc('my_support_tickets'),
    db.rpc('my_support_email_notices'),
  ]);
  if (error || noticesError) throw fail(error ?? noticesError, 'Could not load your questions.');
  const enabled = new Map(((notices ?? []) as Row[]).map((row) => [String(row.ticket_id), row.enabled === true]));
  return ((data ?? []) as Row[]).map((row) => toTicket(row, enabled.get(String(row.id)) ?? false));
}

export async function myThread(ticketId: string): Promise<Message[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_support_thread', { want_ticket: ticketId });
  if (error) throw fail(error, 'Could not load the conversation.');
  return ((data ?? []) as Row[]).map((r) => ({
    from: r.from_side === 'support' ? 'support' : 'student', body: String(r.body), at: String(r.created_at),
  }));
}

export async function replyToTicket(ticketId: string, body: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('reply_to_my_ticket', { want_ticket: ticketId, want_body: body.trim() });
  if (error) throw fail(error, 'Could not send your reply.');
}

export async function closeTicket(ticketId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('close_my_ticket', { want_ticket: ticketId });
  if (error) throw fail(error, 'Could not close the question.');
}

/**
 * The staff queue deliberately returns no student, account, email, handle or
 * tenant field. The database capability-gates this RPC with `support:ticket`.
 */
export async function supportQueue(): Promise<SupportQueueTicket[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('support_ticket_queue');
  if (error) throw fail(error, 'Could not load the support queue.');
  return ((data ?? []) as Row[]).map((row) => ({ ...toTicket(row), overdue: row.overdue === true }));
}

export async function supportThread(ticketId: string): Promise<SupportMessage[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('support_ticket_thread', { want_ticket: ticketId });
  if (error) throw fail(error, 'Could not load the support conversation.');
  return ((data ?? []) as Row[]).map((row) => ({
    from: row.from_side === 'support' ? 'support' : 'student',
    body: String(row.body),
    at: String(row.created_at),
    context: row.context && typeof row.context === 'object' && !Array.isArray(row.context)
      ? contextToSend(row.context as Partial<Record<ContextKey, string>>, new Set(CONTEXT_KEYS))
      : null,
  }));
}

/** Identity-free metadata only. This call never returns student content or identity. */
export async function supportCaseAccess(ticketId: string): Promise<SupportCaseAccess> {
  const db = await cloud();
  const { data, error } = await db.rpc('support_case_access', { want_ticket: ticketId });
  if (error) throw fail(error, 'Could not load case access metadata.');
  const row = ((data ?? []) as Row[])[0];
  if (!row) throw new Error('Case access metadata is unavailable.');
  const consentState = String(row.consent_state);
  const known = ['not_granted', 'active', 'expired', 'revoked', 'wrong_scope', 'role_missing'];
  return {
    ticketId: String(row.ticket_id),
    grantId: row.grant_id ? String(row.grant_id) : null,
    scope: row.scope ? String(row.scope) : null,
    reason: row.reason ? String(row.reason) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    consentState: known.includes(consentState)
      ? consentState as SupportCaseAccess['consentState']
      : 'not_granted',
    active: row.active === true,
    lastSensitiveReadAt: row.last_sensitive_read_at ? String(row.last_sensitive_read_at) : null,
  };
}

/** Separate MFA-gated route for the case's consented aggregate learning signals. */
export async function readSupportCaseSignals(ticketId: string): Promise<SupportCaseSignal[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('read_support_case_signals', { want_ticket: ticketId });
  if (error) throw fail(error, 'Could not read consented aggregate signals.');
  return ((data ?? []) as Row[]).map((row) => ({
    courseId: String(row.course_id),
    evidenceCount: Number(row.evidence_count),
    averageScore: row.average_score == null ? null : Number(row.average_score),
    mistakeCount: Number(row.mistake_count),
    lastObservedAt: row.last_observed_at ? String(row.last_observed_at) : null,
  }));
}

export async function supportReply(
  ticketId: string,
  body: string,
  status: 'open' | 'waiting_on_student' | 'resolved',
  operationId: string,
): Promise<'accepted' | 'in_progress' | 'queued' | 'cancelled' | 'preference_off' | 'capped'> {
  const db = await cloud();
  const { data: notification, error } = await db.rpc('support_reply', {
    want_ticket: ticketId,
    want_body: body.trim(),
    want_status: status,
    want_operation: operationId,
  });
  if (error) throw fail(error, 'Could not send the support reply.');
  const result = notification && typeof notification === 'object' && !Array.isArray(notification)
    ? notification as { outcome?: unknown; message_id?: unknown }
    : null;
  const notificationOutcome = result?.outcome;
  if (notificationOutcome === 'preference_off' || notificationOutcome === 'capped') return notificationOutcome;
  if (!result || notificationOutcome !== 'queued' || typeof result.message_id !== 'string') {
    throw new Error('The support reply was recorded, but its notification outcome is unavailable. Refresh before replying again.');
  }
  const messageId = result.message_id;
  const { data: noticeResult, error: noticeError } = await db.functions.invoke('support-reply-notify', {
    body: { message_id: messageId },
  });
  // A 2xx response proves provider acceptance, not inbox delivery. Delivery
  // is established separately by provider events or an end-to-end receipt.
  return supportNoticeResult(noticeResult, noticeError);
}

export function supportNoticeResult(data: unknown, error: unknown): 'accepted' | 'in_progress' | 'queued' | 'cancelled' {
  if (!error && data && typeof data === 'object' && 'outcome' in data) {
    const outcome = (data as { outcome?: unknown }).outcome;
    if (outcome === 'in_progress' || outcome === 'queued' || outcome === 'accepted') return outcome;
  }
  return error ? supportNoticeFailure(error) : 'accepted';
}

/** The function reserves 409 for a notice cancelled before any worker claimed it. */
export function supportNoticeFailure(error: unknown): 'queued' | 'cancelled' {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null;
  const status = context && typeof context === 'object' && 'status' in context
    ? (context as { status?: unknown }).status
    : null;
  return status === 409 ? 'cancelled' : 'queued';
}
