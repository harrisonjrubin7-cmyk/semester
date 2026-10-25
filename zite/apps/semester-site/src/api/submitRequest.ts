import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, ensureSchema } from '../lib/pg';

const KINDS = ['Pilot request', 'Pricing request', 'Security document request', 'Accessibility feedback', 'Contact'] as const;

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
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input }) => {
    // Inputs are not trusted to match the schema (the platform does not reject them), so check everything here.
    if (input.website) return { ok: true }; // silently drop bots
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
    await ensureSchema();
    const sql = pg();
    // Throttle: at most 3 requests per email per hour.
    const recent = (await sql.query(
      `SELECT count(*)::int AS n FROM site_inbound_requests WHERE lower(email) = $1 AND created_at > now() - interval '1 hour'`,
      [email],
    )) as { n: number }[];
    if (Number(recent[0]?.n ?? 0) >= 3) throw new ZiteError({ code: 'RATE_LIMITED', message: 'throttled', userFacingMessage: 'We already have your recent requests. We’ll reply soon.' });
    // Neon is the system of record for inbound requests.
    const inserted = (await sql.query(
      `INSERT INTO site_inbound_requests (kind, name, email, institution, role, message, consent_to_contact) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [input.kind, name, email, institution, role, message],
    )) as { id: number }[];
    // Mirror into the Zite table that powers the Company OS inbox. A mirror failure must not lose the request.
    try {
      const rec = await zite.inboundRequests.create({
        record: { name, email, institution, role, kind: input.kind, message, consentToContact: true, status: 'New' } as never,
      });
      await sql.query(`UPDATE site_inbound_requests SET zite_record_id = $2 WHERE id = $1`, [inserted[0].id, rec.id]);
    } catch (e) {
      console.error('Inbox mirror failed for request', inserted[0]?.id, e);
    }
    return { ok: true };
  },
});
