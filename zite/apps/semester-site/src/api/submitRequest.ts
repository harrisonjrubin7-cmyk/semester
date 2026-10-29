import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { createHash, randomBytes } from 'node:crypto';
import { pg, ensureSchema } from '../lib/pg';

const KINDS = ['Pilot request', 'Pricing request', 'Security document request', 'Accessibility feedback', 'Contact', 'Demo request'] as const;

const refuse = (message: string) => { throw new ZiteError({ code: 'BAD_REQUEST', message, userFacingMessage: message }); };

export default createEndpoint({
  description: 'Public site: records a pilot, pricing, security-document, accessibility or contact request (write-only; returns nothing back)',
  inputSchema: z.object({
    kind: z.enum(KINDS),
    name: z.string(),
    email: z.string(),
    institution: z.string().optional(),
    role: z.string().optional(),
    message: z.string(),
    consent: z.boolean(),
    website: z.string().optional(), // honeypot: real people never see this field
    requestKey: z.string().optional(), // one per filled-in form; a retry sends the same key
    source: z.object({ source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional() }).optional(), // utm_* tags from the arrival link
  }),
  outputSchema: z.object({ ok: z.boolean(), reference: z.string(), routing: z.enum(['routed', 'pending']), replay: z.boolean() }),
  execute: async ({ input }) => {
    // Inputs are not trusted to match the schema (the platform does not reject them), so check everything here.
    if (input.website) return { ok: true, reference: 'SR-' + randomBytes(4).toString('hex').toUpperCase(), routing: 'routed' as const, replay: false }; // silently drop bots; nothing is stored
    const name = (input.name ?? '').trim();
    const email = (input.email ?? '').trim().toLowerCase();
    const institution = (input.institution ?? '').trim();
    const message = (input.message ?? '').trim();
    if (!(KINDS as readonly string[]).includes(input.kind)) refuse('Choose what you are asking about.');
    if (name.length < 2 || name.length > 120) refuse('Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) refuse('Enter a valid email address.');
    if (input.kind === 'Pilot request' && institution.length < 2) refuse('Enter your institution.');
    if (message.length < 10 || message.length > 4000) refuse('Tell us a little more (at least 10 characters).');
    if (input.consent !== true) refuse('Tick the box so we may reply to you.');
    const role = (input.role ?? '').trim().slice(0, 120);
    const key = (input.requestKey ?? '').trim();
    if (key && (key.length < 16 || key.length > 80)) refuse('Reload the page and try again.');
    // Attribution tags: kept only when they look like tags (letters, digits, . _ -), never free text.
    const tag = (v: unknown) => { const t = String(v ?? '').trim().toLowerCase(); return /^[a-z0-9._-]{1,60}$/.test(t) ? t : null; };
    const utm = { source: tag(input.source?.source), medium: tag(input.source?.medium), campaign: tag(input.source?.campaign) };
    const sha = createHash('sha256').update(JSON.stringify([input.kind, name, email, institution, role, message])).digest('hex');
    await ensureSchema();
    const sql = pg();
    // A retry of the same form returns the same saved request, never a second one.
    if (key) {
      const prior = ((await sql.query(`SELECT reference, routing, payload_sha FROM site_inbound_requests WHERE request_key = $1`, [key])) as { reference: string; routing: string; payload_sha: string }[])[0];
      if (prior) {
        if (prior.payload_sha !== sha) refuse('This form was already sent with different details. Reload the page to send a new request.');
        return { ok: true, reference: prior.reference, routing: prior.routing === 'routed' ? 'routed' as const : 'pending' as const, replay: true };
      }
    }
    // Throttle: at most 3 requests per email per hour.
    const recent = (await sql.query(
      `SELECT count(*)::int AS n FROM site_inbound_requests WHERE lower(email) = $1 AND created_at > now() - interval '1 hour'`,
      [email],
    )) as { n: number }[];
    if (Number(recent[0]?.n ?? 0) >= 3) throw new ZiteError({ code: 'RATE_LIMITED', message: 'throttled', userFacingMessage: 'We already have your recent requests. We’ll reply soon.' });
    // Neon is the system of record for inbound requests.
    const reference = 'SR-' + randomBytes(4).toString('hex').toUpperCase();
    const inserted = (await sql.query(
      `INSERT INTO site_inbound_requests (kind, name, email, institution, role, message, consent_to_contact, request_key, reference, payload_sha, utm_source, utm_medium, utm_campaign) VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [input.kind, name, email, institution, role, message, key || null, reference, sha, utm.source, utm.medium, utm.campaign],
    )) as { id: number }[];
    let routing: 'routed' | 'pending' = 'pending';
    // Mirror into the Zite table that powers the Company OS inbox. A mirror failure must not lose the request.
    try {
      const rec = await zite.inboundRequests.create({
        record: { name, email, institution, role, kind: input.kind, message, consentToContact: true, status: 'New' } as never,
      });
      await sql.query(`UPDATE site_inbound_requests SET zite_record_id = $2, routing = 'routed' WHERE id = $1`, [inserted[0].id, rec.id]);
      routing = 'routed';
    } catch (e) {
      console.error('Inbox mirror failed for request', inserted[0]?.id, e);
    }
    // The reference is returned only now, after the request is saved.
    return { ok: true, reference, routing, replay: false };
  },
});
