import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleSupportNotice } from '../_shared/supportnotify.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const resendKey = Deno.env.get('RESEND_API_KEY');
const supportSender = Deno.env.get('SUPPORT_NOTIFY_FROM') ?? Deno.env.get('LEAD_NOTIFY_FROM');

Deno.serve((req) => handleSupportNotice(req, {
  allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
  devOrigin: Deno.env.get('CORS_ALLOW_DEV'),
  // Resend's onboarding sender cannot deliver to arbitrary students. Treat
  // support email as configured only when a verified sender is explicit.
  resendKey: resendKey && supportSender ? resendKey : undefined,
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
    const [{ data: ticket }, { data: messages }] = await Promise.all([
      admin.from('support_tickets').select('student_id').eq('id', ticketId).maybeSingle(),
      admin.from('support_ticket_messages').select('id,from_side').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(1),
    ]);
    const message = messages?.[0];
    if (!ticket?.student_id || !message || message.from_side !== 'support') return null;
    const { data: user, error } = await admin.auth.admin.getUserById(ticket.student_id);
    return error || !user.user.email ? null : { messageId: message.id, email: user.user.email };
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
}));
