import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleSupportNotice } from '../_shared/supportnotify.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const resendKey = Deno.env.get('RESEND_API_KEY');
const supportSender = Deno.env.get('SUPPORT_NOTIFY_FROM') ?? Deno.env.get('LEAD_NOTIFY_FROM');
const cronSecret = Deno.env.get('CRON_SECRET');

interface OutboxRow { message_id: string; ticket_id: string; attempts: number }

async function target(row: OutboxRow) {
  const { data: ticket } = await admin.from('support_tickets').select('student_id').eq('id', row.ticket_id).maybeSingle();
  if (!ticket?.student_id) return null;
  const { data: user, error } = await admin.auth.admin.getUserById(ticket.student_id);
  return error || !user.user.email ? null : {
    messageId: row.message_id, ticketId: row.ticket_id, email: user.user.email, attempts: row.attempts,
  };
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
    const { data } = await admin.from('role_capabilities').select('role').eq('capability', 'support:ticket').in('role', roles).limit(1);
    return Boolean(data?.length);
  },
  async notice(ticketId) {
    const { data } = await admin.from('support_notification_outbox').select('message_id,ticket_id,attempts')
      .eq('ticket_id', ticketId).is('accepted_at', null).is('dead_lettered_at', null)
      .lte('next_attempt_at', new Date().toISOString()).order('queued_at', { ascending: true }).limit(1).maybeSingle();
    return data ? target(data as OutboxRow) : null;
  },
  async pending() {
    const { data } = await admin.from('support_notification_outbox').select('message_id,ticket_id,attempts')
      .is('accepted_at', null).is('dead_lettered_at', null).lte('next_attempt_at', new Date().toISOString())
      .order('queued_at', { ascending: true }).limit(100);
    const rows = await Promise.all(((data ?? []) as OutboxRow[]).map(target));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null);
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
  async accepted(messageId) {
    await admin.from('support_notification_outbox').update({ accepted_at: new Date().toISOString(), last_error: null }).eq('message_id', messageId);
  },
  async failed(messageId, attempts) {
    const nextAttempts = Math.min(8, attempts + 1);
    const patch = nextAttempts >= 8
      ? { attempts: nextAttempts, dead_lettered_at: new Date().toISOString(), last_error: 'provider rejected notice' }
      : { attempts: nextAttempts, next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** nextAttempts) * 60_000).toISOString(), last_error: 'provider rejected notice' };
    await admin.from('support_notification_outbox').update(patch).eq('message_id', messageId);
  },
}));
