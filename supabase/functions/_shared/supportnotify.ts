import { allowOrigin, corsHeaders } from './cors.ts';

export interface SupportNoticeDeps {
  allowedOrigin: string | undefined;
  devOrigin?: string;
  resendKey: string | undefined;
  cronSecret?: string;
  appUrl: string;
  userFromToken(token: string): Promise<string | null>;
  mayAnswer(userId: string): Promise<boolean>;
  notice(messageId: string): Promise<SupportNoticeTarget | null>;
  pending(): Promise<SupportNoticeTarget[]>;
  eligible(messageId: string, claimId: string): Promise<boolean>;
  send(input: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<boolean>;
  accepted(messageId: string, claimId: string): Promise<boolean>;
  failed(messageId: string, claimId: string, attempts: number, reason: string): Promise<'retrying' | 'dead_lettered' | 'cancelled'>;
}

export interface SupportNoticeTarget {
  messageId: string;
  ticketId: string;
  claimId: string;
  email: string;
  attempts: number;
  /** Recipient lookup already advanced this row without calling the provider. */
  resolutionOutcome?: 'retrying' | 'dead_lettered' | 'cancelled';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reference(ticketId: string): string {
  const token = ticketId.replace(/[^a-f0-9]/gi, '').slice(0, 16).toUpperCase();
  return `SUP-${token.match(/.{1,4}/g)?.join('-')}`;
}

/**
 * Notify a student that support replied without exposing their identity or the
 * reply body to the staff browser. The message is deliberately generic: email
 * is a delivery hint, while the authenticated in-app thread remains the
 * source of truth.
 */
export async function handleSupportNotice(req: Request, deps: SupportNoticeDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  // Support is a first-party app flow. Keep the production Pages origin from
  // the shared built-in allowlist, while ALLOWED_ORIGIN may add deployments.
  const allowed = allowOrigin(deps.allowedOrigin, origin, deps.devOrigin);
  const cors = corsHeaders(deps.allowedOrigin, origin, deps.devOrigin);
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim();
  if (req.method === 'POST' && deps.cronSecret && bearer === deps.cronSecret) {
    if (!deps.resendKey) return reply(503, { error: 'Support email is not configured.' });
    const pending = await deps.pending();
    let accepted = 0;
    let retrying = 0;
    let deadLettered = 0;
    let cancelled = 0;
    for (const target of pending) {
      const outcome = await sendTarget(deps, target);
      if (outcome === 'accepted') accepted += 1;
      else if (outcome === 'dead_lettered') deadLettered += 1;
      else if (outcome === 'cancelled') cancelled += 1;
      else retrying += 1;
    }
    return reply(deadLettered > 0 ? 503 : 200, {
      processed: pending.length,
      accepted,
      retrying,
      dead_lettered: deadLettered,
      cancelled,
    });
  }

  if (req.method === 'OPTIONS') return allowed ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  if (!allowed) return reply(403, { error: 'This page is not allowed to send support notices.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  if (!deps.resendKey) return reply(503, { error: 'Support email is not configured.' });

  const token = bearer;
  if (!token) return reply(401, { error: 'Sign in as support.' });
  const user = await deps.userFromToken(token);
  if (!user || !(await deps.mayAnswer(user))) return reply(403, { error: 'Support access is required.' });

  let messageId = '';
  try {
    const body = await req.json() as { message_id?: unknown };
    if (typeof body.message_id === 'string') messageId = body.message_id;
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }
  if (!UUID.test(messageId)) return reply(400, { error: 'Choose a support reply.' });

  const target = await deps.notice(messageId);
  if (!target) return reply(409, { error: 'No support reply is ready to notify.' });
  const outcome = await sendTarget(deps, target);
  return outcome === 'accepted' ? reply(200, { ok: true }) : reply(502, { error: 'The email provider did not accept the notice.' });
}

async function sendTarget(deps: SupportNoticeDeps, target: SupportNoticeTarget): Promise<'accepted' | 'retrying' | 'dead_lettered' | 'cancelled'> {
  if (target.resolutionOutcome) return target.resolutionOutcome;
  // Recipient resolution can take long enough for a student to opt out. Check
  // the claimed row and preference again immediately before provider I/O.
  if (!(await deps.eligible(target.messageId, target.claimId))) return 'cancelled';
  const ticketReference = reference(target.ticketId);
  let sent = false;
  try {
    sent = await deps.send({
      to: target.email,
      subject: `[Semester] Support replied to ${ticketReference}`,
      text: `Semester support replied to ${ticketReference}.\n\nOpen Semester and go to Help to read the reply: ${deps.appUrl}\n\nThe reply is not included in email to keep your support conversation private.`,
      idempotencyKey: `support-${target.messageId}`,
    });
  } catch {
    // One network failure must advance this row's retry state without
    // preventing the scheduler from attempting the rest of the batch.
    return deps.failed(target.messageId, target.claimId, target.attempts, 'provider transport unavailable');
  }
  if (sent) {
    return (await deps.accepted(target.messageId, target.claimId)) ? 'accepted' : 'cancelled';
  }
  return deps.failed(target.messageId, target.claimId, target.attempts, 'provider rejected notice');
}
