/**
 * The company site's forms, as a pure request handler.
 *
 * ## The contract (the site is built against it; keep it exactly)
 *
 *     POST /functions/v1/lead-intake
 *     { route: string, name: string, email: string, organization?: string,
 *       role?: string, message?: string, fields?: Record<string, string>,
 *       page?: string, website?: string }            // website: honeypot, empty
 *
 *     200 { ok: true, reference: string }
 *     400 { ok: false, error: "<plain message>" }
 *     429 when rate limited · 503 when not configured
 *
 * `route` is a `cta_routes` key. The database decides where it goes and how
 * fast someone answers (`submit_site_lead`); this decides only whether the
 * request is well-formed and from the site.
 *
 * ## What it refuses to do
 *
 * - **Answer a page it does not know.** The site's own origins are built in
 *   (`SITE_PRODUCTION_ORIGINS`), and `SITE_ORIGINS` only adds to them. Both are
 *   read strictly (`strictOrigin` in `cors.ts`): an origin not on the list — or
 *   no `Origin` at all — answers 403 with no `Access-Control-Allow-Origin`, so
 *   the browser refuses it too, and `*` is never an entry.
 * - **Tell a bot it was caught.** A filled honeypot gets the same 200 and a
 *   reference in the same shape, and nothing is stored or sent.
 * - **Keep an IP address.** The caller's address is HMAC-hashed with a secret
 *   salt here, and only the hash reaches the database, for a one-hour rate
 *   limit; the hashes are dropped after a day.
 * - **Log what someone wrote.** Not the message, not the email. The one log
 *   line on failure says only that the submission failed.
 */
import { strictCorsHeaders, strictOrigin } from './cors.ts';
import { hmacSha256Hex } from './stripe.ts';

export interface LeadInput {
  route: string;
  name: string;
  email: string;
  organization: string;
  role: string;
  message: string;
  fields: Record<string, string>;
  page: string;
}

export interface SubmitRow {
  outcome: 'ok' | 'rate_limited' | 'unknown_route' | 'organization_required';
  reference: string | null;
  destination: string | null;
  label: string | null;
  owner_team: string | null;
  respond_by: string | null;
}

/**
 * The company site's own origins, built in.
 *
 * The same rule `PRODUCTION_ORIGINS` in `cors.ts` already follows for the
 * app, and for the same reason. This list used to live only in the
 * `SITE_ORIGINS` secret, and unset meant off: on 29 September the site was
 * live on www.semester.website with every form answering 503, because the
 * secret named nothing, and then only the old vercel.app address. An unset
 * or stale secret no longer takes the forms out; it can still add an origin,
 * never remove one of these, and never open the endpoint to everyone.
 *
 * The apex redirects to www, so a form only ever posts from www; the apex is
 * listed for the day that redirect changes. The vercel.app address is the
 * project's own and stays until nothing links to it.
 */
export const SITE_PRODUCTION_ORIGINS: readonly string[] = [
  'https://www.semester.website',
  'https://semester.website',
  'https://semester-company-site.vercel.app',
];

/** The origin list this handler reads: the built-in origins, then the secret's. */
export function siteOriginList(configured: string | undefined): string {
  return [...SITE_PRODUCTION_ORIGINS, configured ?? ''].join(',');
}

export interface LeadDeps {
  /** `SITE_ORIGINS`, comma-separated. Adds to `SITE_PRODUCTION_ORIGINS`; unset adds nothing. */
  siteOrigins: string | undefined;
  /** The key the IP hash is salted with. Unset turns intake off. */
  ipSalt: string | undefined;
  submit(lead: LeadInput, committeeRole: CommitteeRole, ipHash: string): Promise<SubmitRow>;
  /** Tell the owner, if email is configured. A failure here never fails the submission. */
  notify?: (lead: LeadInput, row: SubmitRow) => Promise<void>;
}

export const MAX_LEAD_BODY_BYTES = 16 * 1024;
export const LIMITS = { name: 200, email: 320, organization: 200, role: 120, message: 5000, page: 500, fields: 20, fieldKey: 40, fieldValue: 1000 } as const;
const ROUTE = /^[a-z][a-z0-9_]{1,59}$/;
/** The shape the database's own check constraints use. */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export type CommitteeRole =
  | 'executive_sponsor' | 'operational_owner' | 'cio' | 'ciso_privacy' | 'accessibility'
  | 'registrar_data_governance' | 'procurement' | 'legal' | 'finance' | 'champion';

const COMMITTEE: readonly CommitteeRole[] = [
  'executive_sponsor', 'operational_owner', 'cio', 'ciso_privacy', 'accessibility',
  'registrar_data_governance', 'procurement', 'legal', 'finance', 'champion',
];

/**
 * Which buying-committee seat a free-text role most plausibly is, for
 * `gtm_stakeholders.committee_role`. A guess the account team can correct; a
 * procurement request with no recognisable role is filed under procurement,
 * and anything else under champion.
 */
export function committeeRole(role: string, route: string): CommitteeRole {
  const r = role.trim().toLowerCase();
  const exact = r.replace(/[\s-]+/g, '_');
  if ((COMMITTEE as readonly string[]).includes(exact)) return exact as CommitteeRole;
  if (/procure|purchas|sourcing|contracts? (officer|manager)/.test(r)) return 'procurement';
  if (/\bciso\b|security|privacy/.test(r)) return 'ciso_privacy';
  if (/\bcio\b|chief information|\bit director|information technology/.test(r)) return 'cio';
  if (/accessib|disabilit|\bada\b/.test(r)) return 'accessibility';
  if (/registrar|institutional research|data governance/.test(r)) return 'registrar_data_governance';
  if (/legal|counsel|attorney/.test(r)) return 'legal';
  if (/financ|\bcfo\b|budget|controller|bursar/.test(r)) return 'finance';
  if (/provost|president|chancellor|\bvp\b|vice president|\bdean\b/.test(r)) return 'executive_sponsor';
  if (/director|manager|coordinator|head of/.test(r)) return 'operational_owner';
  return route === 'request_procurement' ? 'procurement' : 'champion';
}

type Check = { ok: true; lead: LeadInput } | { ok: false; error: string };

const optional = (v: unknown, max: number, what: string): string | { error: string } => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return { error: `${what} must be text.` };
  const t = v.trim();
  return t.length > max ? { error: `${what} is too long (at most ${max} characters).` } : t;
};

/** The body, checked field by field. Unknown top-level keys are ignored. */
export function validateLead(body: Record<string, unknown>): Check {
  const { route, name, email } = body;
  if (typeof route !== 'string' || !ROUTE.test(route)) return { ok: false, error: 'Unknown form.' };
  if (typeof name !== 'string' || name.trim().length === 0) return { ok: false, error: 'Please enter your name.' };
  if (name.trim().length > LIMITS.name) return { ok: false, error: `Your name is too long (at most ${LIMITS.name} characters).` };
  if (typeof email !== 'string' || email.trim().length > LIMITS.email || !EMAIL.test(email.trim())) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  const organization = optional(body.organization, LIMITS.organization, 'Organization');
  const role = optional(body.role, LIMITS.role, 'Role');
  const message = optional(body.message, LIMITS.message, 'Your message');
  const page = optional(body.page, LIMITS.page, 'Page');
  for (const v of [organization, role, message, page]) if (typeof v !== 'string') return { ok: false, error: v.error };

  const fields: Record<string, string> = {};
  if (body.fields !== undefined && body.fields !== null) {
    const f = body.fields;
    if (typeof f !== 'object' || Array.isArray(f)) return { ok: false, error: 'Extra fields must be name and value pairs.' };
    const entries = Object.entries(f as Record<string, unknown>);
    if (entries.length > LIMITS.fields) return { ok: false, error: `Too many extra fields (at most ${LIMITS.fields}).` };
    for (const [k, v] of entries) {
      if (!FIELD_KEY.test(k)) return { ok: false, error: 'An extra field has an unusable name.' };
      if (typeof v !== 'string') return { ok: false, error: 'Extra fields must be text.' };
      if (v.length > LIMITS.fieldValue) return { ok: false, error: `An extra field is too long (at most ${LIMITS.fieldValue} characters).` };
      fields[k] = v.trim();
    }
  }

  return {
    ok: true,
    lead: {
      route, name: name.trim(), email: email.trim(),
      organization: organization as string, role: role as string, message: message as string, page: page as string, fields,
    },
  };
}

/** A reference in the same shape the database issues, for the honeypot's answer. */
export function decoyReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return 'SL-' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The caller's address, as the platform's proxy reports it. Never stored. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** The subject and text of the owner's notification. */
export function notificationEmail(lead: LeadInput, row: SubmitRow): { subject: string; text: string } {
  const optionalLines = [
    lead.organization ? `Organization: ${lead.organization}` : null,
    lead.role ? `Role: ${lead.role}` : null,
    lead.page ? `Page: ${lead.page}` : null,
  ].filter((l): l is string => l !== null);
  const lines = [
    `Reference: ${row.reference}`,
    `Form: ${row.label} (${lead.route}) → ${row.destination}, owner ${row.owner_team}`,
    `Respond by: ${row.respond_by ?? 'no SLA'}`,
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    ...optionalLines,
    ...Object.entries(lead.fields).map(([k, v]) => `${k}: ${v}`),
    '',
    lead.message || '(no message)',
  ];
  return {
    subject: `[Semester] ${row.label}: ${lead.name}${lead.organization ? `, ${lead.organization}` : ''}`.slice(0, 200),
    text: lines.join('\n'),
  };
}

export async function handleLeadIntake(req: Request, deps: LeadDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  const origins = siteOriginList(deps.siteOrigins);
  const cors = strictCorsHeaders(origins, origin);
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, 'Cache-Control': 'no-store', ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...extra },
    });

  if (!deps.ipSalt) {
    return reply(503, { ok: false, error: 'This form is not accepting submissions yet. Please email us instead.' });
  }
  if (!strictOrigin(origins, origin)) return reply(403, { ok: false, error: 'This page may not send this form.' });
  if (req.method === 'OPTIONS') return reply(204, null);
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });

  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_LEAD_BODY_BYTES) return reply(413, { ok: false, error: 'That is too long to send.' });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_LEAD_BODY_BYTES) return reply(413, { ok: false, error: 'That is too long to send.' });

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { ok: false, error: 'The form could not be read.' });
  }

  // The honeypot, before anything else is judged: a bot learns nothing.
  if (body.website !== undefined && body.website !== null && body.website !== '') {
    return reply(200, { ok: true, reference: decoyReference() });
  }

  const checked = validateLead(body);
  if (!checked.ok) return reply(400, { ok: false, error: checked.error });
  const lead = checked.lead;

  try {
    const ipHash = await hmacSha256Hex(deps.ipSalt, clientIp(req));
    const row = await deps.submit(lead, committeeRole(lead.role, lead.route), ipHash);
    if (row.outcome === 'rate_limited') {
      return reply(429, { ok: false, error: 'Too many submissions from this network. Please try again in an hour.' }, { 'Retry-After': '3600' });
    }
    if (row.outcome === 'unknown_route') return reply(400, { ok: false, error: 'Unknown form.' });
    if (row.outcome === 'organization_required') {
      return reply(400, { ok: false, error: 'Please tell us which institution or organization you are with.' });
    }
    if (row.outcome !== 'ok' || !row.reference) throw new Error('unexpected outcome');

    if (deps.notify) {
      try {
        await deps.notify(lead, row);
      } catch {
        console.error('lead-intake: the notification could not be sent');
      }
    }
    return reply(200, { ok: true, reference: row.reference });
  } catch {
    console.error('lead-intake: a submission could not be recorded');
    return reply(500, { ok: false, error: 'Something went wrong on our side. Please email us instead.' });
  }
}
