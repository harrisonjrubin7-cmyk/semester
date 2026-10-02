import { allowOrigin, corsHeaders } from './cors.ts';

export interface SupportNoticeDeps {
  allowedOrigin: string | undefined;
  devOrigin?: string;
  resendKey: string | undefined;
  cronSecret?: string;
  appUrl: string;
  userFromToken(token: string): Promise<string | null>;
  mayAnswer(userId: string): Promise<boolean>;
  notice(ticketId: string): Promise<SupportNoticeTarget | null>;
  pending(): Promise<SupportNoticeTarget[]>;
  send(input: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<boolean>;
  accepted(messageId: string): Promise<void>;
  failed(messageId: string, attempts: number): Promise<void>;
}

export interface SupportNoticeTarget {
  messageId: string;
  ticketId: string;
  email: string;
  attempts: number;
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
    for (const target of pending) {
      const sent = await sendTarget(deps, target);
      if (sent) accepted += 1;
    }
    return reply(200, { processed: pending.length, accepted });
  }

  if (req.method === 'OPTIONS') return allowed ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  if (!allowed) return reply(403, { error: 'This page is not allowed to send support notices.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  if (!deps.resendKey) return reply(503, { error: 'Support email is not configured.' });

  const token = bearer;
  if (!token) return reply(401, { error: 'Sign in as support.' });
  const user = await deps.userFromToken(token);
  if (!user || !(await deps.mayAnswer(user))) return reply(403, { error: 'Support access is required.' });

  let ticketId = '';
  try {
    const body = await req.json() as { ticket_id?: unknown };
    if (typeof body.ticket_id === 'string') ticketId = body.ticket_id;
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }
  if (!UUID.test(ticketId)) return reply(400, { error: 'Choose a support ticket.' });

  const target = await deps.notice(ticketId);
  if (!target) return reply(409, { error: 'No support reply is ready to notify.' });
  const sent = await sendTarget(deps, target);
  return sent ? reply(200, { ok: true }) : reply(502, { error: 'The email provider did not accept the notice.' });
}

async function sendTarget(deps: SupportNoticeDeps, target: SupportNoticeTarget): Promise<boolean> {
  const ticketReference = reference(target.ticketId);
  const sent = await deps.send({
    to: target.email,
    subject: `[Semester] Support replied to ${ticketReference}`,
    text: `Semester support replied to ${ticketReference}.\n\nOpen Semester and go to Help to read the reply: ${deps.appUrl}\n\nThe reply is not included in email to keep your support conversation private.`,
    idempotencyKey: `support-${target.messageId}`,
  });
  if (sent) await deps.accepted(target.messageId);
  else await deps.failed(target.messageId, target.attempts);
  return sent;
}
