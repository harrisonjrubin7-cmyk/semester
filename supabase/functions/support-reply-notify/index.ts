import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleSupportNotice } from '../_shared/supportnotify.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const resendKey = Deno.env.get('RESEND_API_KEY');
const supportSender = Deno.env.get('SUPPORT_NOTIFY_FROM') ?? Deno.env.get('LEAD_NOTIFY_FROM');
const cronSecret = Deno.env.get('CRON_SECRET');

interface OutboxRow { message_id: string; ticket_id: string; attempts: number; claim_id: string }

async function retry(messageId: string, claimId: string, attempts: number, reason: string): Promise<'retrying' | 'dead_lettered' | 'cancelled'> {
  const nextAttempts = Math.min(8, attempts + 1);
  const patch = nextAttempts >= 8
    ? { attempts: nextAttempts, dead_lettered_at: new Date().toISOString(), claim_id: null, claimed_at: null, last_error: reason }
    : { attempts: nextAttempts, next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** nextAttempts) * 60_000).toISOString(), claim_id: null, claimed_at: null, last_error: reason };
  const { data, error } = await admin.from('support_notification_outbox').update(patch)
    .eq('message_id', messageId).eq('claim_id', claimId).select('message_id').maybeSingle();
  if (error) throw new Error('Could not persist the support-notification retry state.');
  if (!data) return 'cancelled';
  return nextAttempts >= 8 ? 'dead_lettered' : 'retrying';
}

async function target(row: OutboxRow) {
  const { data: ticket, error: ticketError } = await admin.from('support_tickets').select('student_id,email_notice_enabled').eq('id', row.ticket_id).maybeSingle();
  if (ticketError || !ticket?.student_id) {
    const outcome = await retry(row.message_id, row.claim_id, row.attempts, ticketError ? 'student lookup unavailable' : 'student account unavailable');
    return {
      messageId: row.message_id, ticketId: row.ticket_id, claimId: row.claim_id, email: '', attempts: row.attempts,
      resolutionOutcome: outcome,
    };
  }
  if (!ticket.email_notice_enabled) {
    const { error: deleteError } = await admin.from('support_notification_outbox').delete()
      .eq('message_id', row.message_id).eq('claim_id', row.claim_id);
    if (deleteError) throw new Error('Could not cancel the opted-out support notification.');
    return {
      messageId: row.message_id, ticketId: row.ticket_id, claimId: row.claim_id, email: '', attempts: row.attempts,
      resolutionOutcome: 'cancelled' as const,
    };
  }
  const { data: user, error } = await admin.auth.admin.getUserById(ticket.student_id);
  if (error || !user.user.email) {
    const outcome = await retry(row.message_id, row.claim_id, row.attempts, error ? 'student email lookup unavailable' : 'student email unavailable');
    return {
      messageId: row.message_id, ticketId: row.ticket_id, claimId: row.claim_id, email: '', attempts: row.attempts,
      resolutionOutcome: outcome,
    };
  }
  return {
    messageId: row.message_id, ticketId: row.ticket_id, claimId: row.claim_id, email: user.user.email, attempts: row.attempts,
  };
}

async function claim(ticketId: string | null, limit: number): Promise<OutboxRow[]> {
  const { data, error } = await admin.rpc('claim_support_notifications', { want_ticket: ticketId, want_limit: limit });
  if (error) throw new Error('Could not claim the support-notification outbox.');
  return (data ?? []) as OutboxRow[];
}

Deno.serve((req) => handleSupportNotice(req, {
  allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
  devOrigin: Deno.env.get('CORS_ALLOW_DEV'),
  // Resend's onboarding sender cannot deliver to arbitrary students. Treat
  // support email as configured only when a verified sender is explicit.
  resendKey: resendKey && supportSender ? resendKey : undefined,
  cronSecret,
  // An origin has no path and ALLOWED_ORIGIN may contain several entries, so
  // it cannot be used as the application link in an email.
  appUrl: Deno.env.get('SUPPORT_RETURN_URL') ?? 'https://harrisonjrubin7-cmyk.github.io/semester/',
  async userFromToken(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  async mayAnswer(userId) {
    const now = new Date().toISOString();
    const { data: grants, error } = await admin.from('role_grants').select('role,expires_at')
      .eq('subject', userId).eq('scope_kind', 'platform').eq('scope_id', '').is('revoked_at', null);
    if (error) return false;
    const roles = (grants ?? []).filter((grant) => !grant.expires_at || grant.expires_at > now).map((grant) => grant.role);
    if (!roles.length) return false;
    const { data, error: capabilityError } = await admin.from('role_capabilities').select('role').eq('capability', 'support:ticket').in('role', roles).limit(1);
    return !capabilityError && Boolean(data?.length);
  },
  async notice(ticketId) {
    const [row] = await claim(ticketId, 1);
    return row ? target(row) : null;
  },
  async pending() {
    return Promise.all((await claim(null, 100)).map(target));
  },
  async eligible(messageId, claimId) {
    const { data: row, error } = await admin.from('support_notification_outbox').select('ticket_id')
      .eq('message_id', messageId).eq('claim_id', claimId).maybeSingle();
    if (error) throw new Error('Could not recheck the support-notification claim.');
    if (!row) return false;
    const { data: ticket, error: ticketError } = await admin.from('support_tickets').select('email_notice_enabled')
      .eq('id', row.ticket_id).maybeSingle();
    if (ticketError) throw new Error('Could not recheck the support-notification preference.');
    if (ticket?.email_notice_enabled) return true;
    const { error: deleteError } = await admin.from('support_notification_outbox').delete()
      .eq('message_id', messageId).eq('claim_id', claimId);
    if (deleteError) throw new Error('Could not cancel the opted-out support notification.');
    return false;
  },
  async send(input) {
    if (!supportSender) return false;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({ from: supportSender, to: [input.to], subject: input.subject, text: input.text }),
    });
    return res.ok;
  },
  async accepted(messageId, claimId) {
    const { data, error } = await admin.from('support_notification_outbox')
      .update({ accepted_at: new Date().toISOString(), claim_id: null, claimed_at: null, last_error: null })
      .eq('message_id', messageId).eq('claim_id', claimId).select('message_id').maybeSingle();
    if (error) throw new Error('Could not persist the accepted support notification.');
    return Boolean(data);
  },
  async failed(messageId, claimId, attempts, reason) {
    return retry(messageId, claimId, attempts, reason);
  },
}));
