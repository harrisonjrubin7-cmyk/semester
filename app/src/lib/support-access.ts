import { cloud } from './cloud';

export interface SupporterChoice {
  supporterId: string;
  label: string;
}

export interface SupportWindow {
  grantId: string;
  side: 'student' | 'supporter';
  counterpartLabel: string;
  reason: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  ticketId: string | null;
  scopes: string[];
  consentState: 'active' | 'expired' | 'revoked';
}

export interface SupportTicketChoice {
  ticketId: string;
  subject: string;
}

export interface SupportSignal {
  courseId: string;
  evidenceCount: number;
  averageScore: number | null;
  mistakeCount: number;
  lastObservedAt: string | null;
}

const message = (error: { message?: string } | null, fallback: string) =>
  error?.message?.trim() || fallback;

export async function loadSupportAccess(): Promise<{
  supporters: SupporterChoice[];
  windows: SupportWindow[];
  tickets: SupportTicketChoice[];
  ticketLoadError: string | null;
}> {
  const db = await cloud();
  const [
    { data: supporterRows, error: supporterError },
    { data: windowRows, error: windowError },
    { data: ticketRows, error: ticketError },
  ] = await Promise.all([
    db.rpc('available_case_supporters'),
    db.rpc('support_access_windows'),
    db.rpc('my_support_tickets'),
  ]);
  if (supporterError) throw new Error(message(supporterError, 'Could not load verified supporters.'));
  if (windowError) throw new Error(message(windowError, 'Could not load support access.'));
  return {
    supporters: (supporterRows ?? []).map((row: Record<string, unknown>) => ({
      supporterId: String(row.supporter_id),
      label: String(row.label),
    })),
    windows: (windowRows ?? []).map((row: Record<string, unknown>) => ({
      grantId: String(row.grant_id),
      side: row.side === 'supporter' ? 'supporter' : 'student',
      counterpartLabel: String(row.counterpart_label),
      reason: String(row.reason),
      expiresAt: String(row.expires_at),
      revokedAt: row.revoked_at ? String(row.revoked_at) : null,
      createdAt: String(row.created_at),
      ticketId: row.ticket_id ? String(row.ticket_id) : null,
      scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
      consentState: row.consent_state === 'expired'
        ? 'expired'
        : row.consent_state === 'revoked' ? 'revoked' : 'active',
    })),
    tickets: ticketError ? [] : (ticketRows ?? [])
      .filter((row: Record<string, unknown>) => row.status === 'open' || row.status === 'waiting_on_student')
      .map((row: Record<string, unknown>) => ({
        ticketId: String(row.id),
        subject: String(row.subject),
      })),
    ticketLoadError: ticketError ? message(ticketError, 'Could not load support questions.') : null,
  };
}

export async function createSupportAccess(
  supporterId: string,
  reason: string,
  days: number,
  ticketId: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_support_access', {
    want_supporter: supporterId,
    want_reason: reason,
    want_days: days,
    want_ticket: ticketId,
  });
  if (error) throw new Error(message(error, 'Could not create support access.'));
  return String(data);
}

export async function revokeSupportAccess(grantId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('revoke_support_access', { want_grant: grantId });
  if (error) throw new Error(message(error, 'Could not revoke support access.'));
}

export async function readSupportSignals(grantId: string): Promise<SupportSignal[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('read_support_signals', { want_grant: grantId });
  if (error) throw new Error(message(error, 'Could not read support signals.'));
  return (data ?? []).map((row: Record<string, unknown>) => ({
    courseId: String(row.course_id),
    evidenceCount: Number(row.evidence_count),
    averageScore: row.average_score == null ? null : Number(row.average_score),
    mistakeCount: Number(row.mistake_count),
    lastObservedAt: row.last_observed_at ? String(row.last_observed_at) : null,
  }));
}
