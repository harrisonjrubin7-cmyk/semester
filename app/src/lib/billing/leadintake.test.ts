/// <reference types="node" />
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SITE_PRODUCTION_ORIGINS, committeeRole, handleLeadIntake, notificationEmail, validateLead, type LeadDeps, type SubmitRow,
} from '../../../../supabase/functions/_shared/leadintake';

const SITE = 'https://semester.example';
const SALT = 'test-salt';
const IP = '203.0.113.7';

const OK: SubmitRow = {
  outcome: 'ok', reference: 'SL-0A1B2C3D4E', destination: 'support', label: 'Contact Semester',
  owner_team: 'Founder', respond_by: '2026-09-30T12:00:00Z',
};

function deps(over: Partial<LeadDeps> = {}) {
  const d = {
    siteOrigins: `${SITE}, http://localhost:4321`,
    ipSalt: SALT,
    submit: vi.fn(async () => OK),
    notify: vi.fn(async () => {}),
    ...over,
  };
  return d as LeadDeps & typeof d;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://project.supabase.co/functions/v1/lead-intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, 'x-forwarded-for': `${IP}, 10.0.0.1`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const GOOD = {
  route: 'general_contact', name: '  Dana Visitor ', email: 'dana@example.org', message: 'Hello.',
  fields: { topic: 'press' }, page: '/contact', website: '',
};

afterEach(() => vi.restoreAllMocks());

describe('lead intake: the contract the site is built against', () => {
  it('answers 200 { ok, reference } for a good submission', async () => {
    const d = deps();
    const res = await handleLeadIntake(post(GOOD), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reference: 'SL-0A1B2C3D4E' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(d.submit).toHaveBeenCalledWith(
      { route: 'general_contact', name: 'Dana Visitor', email: 'dana@example.org', organization: '', role: '',
        message: 'Hello.', fields: { topic: 'press' }, page: '/contact' },
      'champion',
      createHmac('sha256', SALT).update(IP).digest('hex'),
    );
    expect(d.notify).toHaveBeenCalledOnce();
  });

  it('passes the database only a salted hash of the address, never the address', async () => {
    const d = deps();
    await handleLeadIntake(post(GOOD), d);
    const args = JSON.stringify(vi.mocked(d.submit!).mock.calls[0]);
    expect(args).not.toContain(IP);
    expect(vi.mocked(d.submit!).mock.calls[0][2]).toMatch(/^[0-9a-f]{64}$/);
    // The same address under another salt is another hash: the salt is doing work.
    const other = deps({ ipSalt: 'salt' });
    await handleLeadIntake(post(GOOD), other);
    // A known vector for that salt, computed outside this code (Python's hmac).
    expect(vi.mocked(other.submit!).mock.calls[0][2]).toBe('549fe5bec61ee86fc9e958ee261c8c0515ef82b928d42f8e03519788722ead62');
    expect(vi.mocked(other.submit!).mock.calls[0][2]).not.toBe(vi.mocked(d.submit!).mock.calls[0][2]);
  });

  it('answers a filled honeypot with the same 200 and a reference of the same shape, storing and sending nothing', async () => {
    const d = deps();
    const res = await handleLeadIntake(post({ ...GOOD, website: 'http://spam.example' }), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reference).toMatch(/^SL-[0-9A-F]{10}$/);
    expect(d.submit).not.toHaveBeenCalled();
    expect(d.notify).not.toHaveBeenCalled();
  });

  it('is 503 when the salt is missing', async () => {
    const d = deps({ ipSalt: undefined });
    const res = await handleLeadIntake(post(GOOD), d);
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
    expect(d.submit).not.toHaveBeenCalled();
  });

  /*
   * The site's own origins are built in, so an unset or stale `SITE_ORIGINS`
   * no longer takes the forms out. On 29 September the site was live on
   * www.semester.website and every form answered 503: the secret was unset.
   */
  it("takes the site's own origins with no secret set, and still nobody else", async () => {
    expect(SITE_PRODUCTION_ORIGINS).toEqual([
      'https://www.semester.website', 'https://semester.website', 'https://semester-company-site.vercel.app',
    ]);
    for (const siteOrigins of [undefined, '', ' ']) {
      for (const origin of SITE_PRODUCTION_ORIGINS) {
        const d = deps({ siteOrigins });
        const res = await handleLeadIntake(post(GOOD, { Origin: origin }), d);
        expect(res.status, `${JSON.stringify(siteOrigins)} / ${origin}`).toBe(200);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
        expect(d.submit).toHaveBeenCalledOnce();
      }
      // The secret adds; it does not open. Another origin is still refused.
      const other = deps({ siteOrigins });
      const res = await handleLeadIntake(post(GOOD, { Origin: 'https://evil.example' }), other);
      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(other.submit).not.toHaveBeenCalled();
    }
    // A preflight from the live site, with nothing configured, is answered.
    const pre = await handleLeadIntake(
      new Request('https://x', { method: 'OPTIONS', headers: { Origin: 'https://www.semester.website' } }),
      deps({ siteOrigins: undefined }),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://www.semester.website');
  });

  it('fails closed on CORS: another origin, no origin, or * gets 403 and no Allow-Origin', async () => {
    for (const [origins, origin] of [[SITE, 'https://evil.example'], [SITE, ''], ['*', SITE]] as const) {
      const d = deps({ siteOrigins: origins });
      const headers: Record<string, string> = origin ? { Origin: origin } : {};
      const req = new Request('https://x/functions/v1/lead-intake', { method: 'POST', headers, body: JSON.stringify(GOOD) });
      const res = await handleLeadIntake(req, d);
      expect(res.status, `${origins} / ${origin}`).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(d.submit).not.toHaveBeenCalled();
    }
    const pre = await handleLeadIntake(new Request('https://x', { method: 'OPTIONS', headers: { Origin: SITE } }), deps());
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });

  it('is 429 when the database says the network is over its limit', async () => {
    const res = await handleLeadIntake(post(GOOD), deps({ submit: vi.fn(async () => ({ ...OK, outcome: 'rate_limited' as const, reference: null })) }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect((await res.json()).ok).toBe(false);
  });

  it('is 400 with a plain message for an unknown route, or an institutional one with no organization', async () => {
    const unknown = await handleLeadIntake(post(GOOD), deps({ submit: vi.fn(async () => ({ ...OK, outcome: 'unknown_route' as const })) }));
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ ok: false, error: 'Unknown form.' });
    const org = await handleLeadIntake(post(GOOD), deps({ submit: vi.fn(async () => ({ ...OK, outcome: 'organization_required' as const })) }));
    expect(org.status).toBe(400);
  });

  it('still succeeds when the notification fails, and logs nothing anyone wrote', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLeadIntake(post({ ...GOOD, message: 'my secret plan' }), deps({ notify: vi.fn(async () => { throw new Error('dana@example.org'); }) }));
    expect(res.status).toBe(200);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('dana@example.org');
    expect(logged).not.toContain('my secret plan');
  });

  it('answers 500 without echoing the submission when the database fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLeadIntake(post(GOOD), deps({ submit: vi.fn(async () => { throw new Error('boom'); }) }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain('dana@example.org');
  });
});

describe('lead intake: validation', () => {
  const bad = (body: Record<string, unknown>) => {
    const r = validateLead(body);
    return r.ok ? null : r.error;
  };

  it('accepts the minimal body', () => {
    expect(bad({ route: 'general_contact', name: 'A', email: 'a@b.co' })).toBeNull();
  });

  it('refuses each malformed field with a plain sentence', () => {
    expect(bad({ ...GOOD, route: 'Not A Route' })).toBe('Unknown form.');
    expect(bad({ ...GOOD, name: '   ' })).toBe('Please enter your name.');
    expect(bad({ ...GOOD, name: 'x'.repeat(201) })).toMatch(/too long/);
    for (const email of ['nope', 'a@b', 'a b@c.de', 'x'.repeat(320) + '@a.co', 7]) {
      expect(bad({ ...GOOD, email })).toBe('Please enter a valid email address.');
    }
    expect(bad({ ...GOOD, message: 'x'.repeat(5001) })).toMatch(/too long/);
    expect(bad({ ...GOOD, organization: 'x'.repeat(201) })).toMatch(/too long/);
    expect(bad({ ...GOOD, role: 5 })).toMatch(/text/);
    expect(bad({ ...GOOD, fields: ['a'] })).toMatch(/pairs/);
    expect(bad({ ...GOOD, fields: { 'Bad Key': 'x' } })).toMatch(/name/);
    expect(bad({ ...GOOD, fields: { a: 1 } })).toMatch(/text/);
    expect(bad({ ...GOOD, fields: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`f${i}`, 'x'])) })).toMatch(/Too many/);
  });

  it('refuses a body that is not a JSON object, or too large', async () => {
    expect((await handleLeadIntake(post('not json'), deps())).status).toBe(400);
    expect((await handleLeadIntake(post('[]'), deps())).status).toBe(400);
    expect((await handleLeadIntake(post({ ...GOOD, message: 'x'.repeat(20_000) }), deps())).status).toBe(413);
  });

  it('files a free-text role under a buying-committee seat, correctably', () => {
    expect(committeeRole('Chief Information Security Officer', 'request_procurement')).toBe('ciso_privacy');
    expect(committeeRole('Procurement Specialist', 'plan_institution_launch')).toBe('procurement');
    expect(committeeRole('Provost', 'plan_institution_launch')).toBe('executive_sponsor');
    expect(committeeRole('registrar', 'plan_department_launch')).toBe('registrar_data_governance');
    expect(committeeRole('', 'request_procurement')).toBe('procurement');
    expect(committeeRole('Student', 'general_contact')).toBe('champion');
    expect(committeeRole('executive sponsor', 'x')).toBe('executive_sponsor');
  });

  it('writes the owner a notification with a reply-able summary', () => {
    const { subject, text } = notificationEmail(
      { route: 'plan_institution_launch', name: 'Pat', email: 'pat@state.edu', organization: 'State', role: 'Provost', message: 'Fall?', fields: {}, page: '/institutions' },
      { ...OK, label: 'Plan an institutional launch', destination: 'crm_lead', owner_team: 'Sales' },
    );
    expect(subject).toBe('[Semester] Plan an institutional launch: Pat, State');
    expect(text).toContain('Reference: SL-0A1B2C3D4E');
    expect(text).toContain('Organization: State');
    expect(text).not.toContain('Role: \n');
  });
});

describe('lead intake: what the repository says about it', () => {
  const root = join(process.cwd(), '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('hardcodes no personal inbox: the owner’s address is configuration', () => {
    for (const f of ['supabase/functions/lead-intake/index.ts', 'supabase/functions/_shared/leadintake.ts']) {
      expect(read(f), f).not.toMatch(/[a-z0-9._%+-]+@gmail\.com/i);
    }
    expect(read('supabase/functions/lead-intake/index.ts')).toContain("Deno.env.get('LEAD_NOTIFY_EMAIL')");
  });

  it('has every route the site posts to in the migrations', () => {
    const sql = read('supabase/migrations/20260929070000_commercial_core.sql') + read('supabase/migrations/20260929080000_commercial_automation.sql');
    for (const key of [
      'start_planning_free', 'build_my_semester', 'plan_department_launch', 'plan_institution_launch', 'request_procurement',
      'request_enterprise', 'apply_role', 'explore_partnership', 'customer_help',
      'request_invite', 'accessibility_barrier', 'site_feedback', 'general_contact',
    ]) expect(sql, key).toMatch(new RegExp(`\\('${key}',`));
  });

  it('schedules the dunning worker and the nightly health job, active', () => {
    const scheduler = read('supabase/scheduler.sql');
    expect(scheduler).toMatch(/cron\.schedule\(\s*'commercial-dunning',\s*'23 \* \* \* \*',\s*\$job\$select public\.run_dunning\(\)\$job\$/);
    expect(scheduler).toMatch(/cron\.schedule\(\s*'account-health',\s*'41 5 \* \* \*',\s*\$job\$select public\.compute_account_health\(\)\$job\$/);
    expect(scheduler).not.toMatch(/jobname = '(commercial-dunning|account-health)'\),\s*active := false/);
  });
});
