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
 * `plan_institution_launch` accepts only the bounded setup-request keys below.
 * These are discovery metadata, not domain ownership, provider support,
 * connection state, tenant authority or approval. Empty fields remain valid
 * for the older contact form; adding a value makes its closed vocabulary and
 * length checks mandatory.
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
  // The owned GitHub Pages app hosts the University > Package intake form.
  // Exact origin only: this does not admit arbitrary github.io projects.
  'https://harrisonjrubin7-cmyk.github.io',
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

export const INSTITUTION_SETUP_FIELDS = [
  // `topic` is the existing company-site contact form's selected label. Keep
  // its current institutional value compatible while refusing arbitrary text.
  'topic', 'requested_domain', 'requested_system', 'requested_provider', 'requested_product', 'data_mode', 'desired_launch_window',
] as const;
export const INSTITUTION_TOPICS = ['An institutional pilot'] as const;
export const REQUESTED_SYSTEMS = ['identity', 'lms', 'sis', 'catalog', 'degree_audit', 'other'] as const;
export const REQUESTED_PRODUCTS = ['semester_institutional'] as const;
export const DATA_MODES = ['manual', 'connected'] as const;
export const LAUNCH_WINDOWS = ['this_term', 'next_term', 'within_12_months', 'exploring'] as const;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function requestedDomain(value: string): string | null {
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || raw.length > 253 || /[\s%\\/:?#@]/.test(raw)) return null;
  let domain: string;
  try {
    domain = new URL(`https://${raw}`).hostname;
  } catch {
    return null;
  }
  const labels = domain.split('.');
  if (domain.length > 253 || /^\d+(?:\.\d+){3}$/.test(domain)) return null;
  if (labels.length < 2 || !/[a-z]/.test(labels.at(-1) ?? '') || labels.some((label) => !DOMAIN_LABEL.test(label))) return null;
  return domain;
}

type InstitutionalFieldsCheck = { fields: Record<string, string> } | { error: string };

function institutionalFields(route: string, fields: Record<string, string>): InstitutionalFieldsCheck {
  if (route !== 'plan_institution_launch') return { fields };
  for (const key of Object.keys(fields)) {
    if (!(INSTITUTION_SETUP_FIELDS as readonly string[]).includes(key)) {
      return { error: 'An institutional setup field is not supported.' };
    }
  }
  const normalized = { ...fields };
  if (fields.topic && !(INSTITUTION_TOPICS as readonly string[]).includes(fields.topic)) {
    return { error: 'Choose a supported institutional topic.' };
  }
  if (fields.requested_domain) {
    const domain = requestedDomain(fields.requested_domain);
    if (!domain) return { error: 'Please enter an institution domain, not a URL.' };
    normalized.requested_domain = domain;
  }
  if (fields.requested_system && !(REQUESTED_SYSTEMS as readonly string[]).includes(fields.requested_system)) {
    return { error: 'Choose a supported system category.' };
  }
  const providerHasControl = [...(fields.requested_provider ?? '')]
    .some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
  if (fields.requested_provider && (fields.requested_provider.length > 120 || providerHasControl)) {
    return { error: 'The requested provider must be 120 characters or fewer.' };
  }
  if (fields.requested_product && !(REQUESTED_PRODUCTS as readonly string[]).includes(fields.requested_product)) {
    return { error: 'Choose a supported product request.' };
  }
  if (fields.data_mode && !(DATA_MODES as readonly string[]).includes(fields.data_mode)) {
    return { error: 'Choose manual or connected data mode.' };
  }
  if (fields.desired_launch_window && !(LAUNCH_WINDOWS as readonly string[]).includes(fields.desired_launch_window)) {
    return { error: 'Choose a supported launch window.' };
  }
  return { fields: normalized };
}

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
  const checkedFields = institutionalFields(route, fields);
  if ('error' in checkedFields) return { ok: false, error: checkedFields.error };

  return {
    ok: true,
    lead: {
      route, name: name.trim(), email: email.trim(),
      organization: organization as string, role: role as string, message: message as string, page: page as string,
      fields: checkedFields.fields,
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
