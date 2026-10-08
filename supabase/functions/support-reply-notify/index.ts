import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleSupportNotice, normalizeUtcActivationInstant } from '../_shared/supportnotify.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const resendKey = Deno.env.get('RESEND_API_KEY');
const supportSender = Deno.env.get('SUPPORT_NOTIFY_FROM') ?? Deno.env.get('LEAD_NOTIFY_FROM');
// Technical credentials are not vendor approval. Keep student data away from
// Resend until the risk review, executed terms/DPA, owner and activation
// decision are recorded, then enable this explicit deployed-function switch.
const supportVendorApproved = Deno.env.get('SUPPORT_NOTIFY_VENDOR_APPROVED') === 'true';
const supportActivatedAtRaw = Deno.env.get('SUPPORT_NOTIFY_ACTIVATED_AT') ?? '';
const supportActivatedAt = normalizeUtcActivationInstant(supportActivatedAtRaw);
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
  // Releasing a claim after an opt-out activates the database cancellation
  // trigger. Read back the row so the worker reports that boundary truthfully.
  const { data: remaining, error: inspectError } = await admin.from('support_notification_outbox')
    .select('message_id').eq('message_id', messageId).maybeSingle();
  if (inspectError) throw new Error('Could not inspect the support-notification retry state.');
  if (!remaining) return 'cancelled';
  return nextAttempts >= 8 ? 'dead_lettered' : 'retrying';
}

async function target(row: OutboxRow) {
  const { data: ticket, error: ticketError } = await admin.from('support_tickets').select('student_id').eq('id', row.ticket_id).maybeSingle();
  if (ticketError || !ticket?.student_id) {
    const outcome = await retry(row.message_id, row.claim_id, row.attempts, ticketError ? 'student lookup unavailable' : 'student account unavailable');
    return {
      messageId: row.message_id, ticketId: row.ticket_id, claimId: row.claim_id, email: '', attempts: row.attempts,
      resolutionOutcome: outcome,
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

async function claim(messageId: string | null, limit: number): Promise<OutboxRow[]> {
  if (!supportActivatedAt) return [];
  const { data, error } = await admin.rpc('claim_support_notifications', {
    want_message: messageId,
    want_limit: limit,
    want_not_before: supportActivatedAt,
  });
  if (error) throw new Error('Could not claim the support-notification outbox.');
  return (data ?? []) as OutboxRow[];
}

Deno.serve((req) => handleSupportNotice(req, {
  allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
  devOrigin: Deno.env.get('CORS_ALLOW_DEV'),
  // Resend's onboarding sender cannot deliver to arbitrary students. Treat
  // support email as configured only when a verified sender is explicit.
  resendKey: supportVendorApproved && supportActivatedAt && resendKey && supportSender ? resendKey : undefined,
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
  async notice(messageId) {
    const [row] = await claim(messageId, 1);
    return row ? target(row) : null;
  },
  async unavailable(messageId) {
    const { data, error } = await admin.from('support_notification_outbox')
      .select('accepted_at,dead_lettered_at,claim_id').eq('message_id', messageId).maybeSingle();
    if (error) throw new Error('Could not inspect the support-notification state.');
    if (!data) return 'cancelled';
    if (data.accepted_at) return 'accepted';
    if (data.dead_lettered_at) return 'unavailable';
    return data.claim_id ? 'in_progress' : 'queued';
  },
  async pending() {
    return Promise.all((await claim(null, 100)).map(target));
  },
  async eligible(messageId, claimId) {
    const { data: row, error } = await admin.from('support_notification_outbox').select('message_id')
      .eq('message_id', messageId).eq('claim_id', claimId).maybeSingle();
    if (error) throw new Error('Could not recheck the support-notification claim.');
    return Boolean(row);
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
