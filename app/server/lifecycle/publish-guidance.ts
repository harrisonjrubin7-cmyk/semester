import { createClient } from '@supabase/supabase-js';

type Config = { supabaseUrl: string; publicClientKey: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// Adapter draft, not a registered endpoint. Configure platform-level body/rate limits.
// Config MUST use a publishable/anon key, never a service-role or secret key.
export async function publishGuidance(request: Request, config: Config): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return reply(401, { error: 'sign_in_required' });
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return reply(415, { error: 'json_required' });
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 24000) return reply(413, { error: 'payload_too_large' });
    raw = JSON.parse(text);
  } catch { return reply(400, { error: 'invalid_json' }); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reply(400, { error: 'invalid_command' });
  const v = raw as Record<string, unknown>;
  const keys = ['commandId', 'schoolId', 'courseCode', 'term', 'body', 'expectedVersion', 'confirmed'];
  if (Object.keys(v).some(k => !keys.includes(k))
    || typeof v.commandId !== 'string' || !UUID.test(v.commandId)
    || typeof v.schoolId !== 'string' || !v.schoolId.trim() || v.schoolId.length > 200
    || typeof v.courseCode !== 'string' || v.courseCode.length > 100
    || typeof v.term !== 'string' || !/^[0-9]{4}(FA|SP|SU)$/.test(v.term)
    || typeof v.body !== 'string' || [...v.body].length > 4000
    || typeof v.expectedVersion !== 'number' || !Number.isSafeInteger(v.expectedVersion) || v.expectedVersion < 0
    || v.confirmed !== true) return reply(400, { error: 'invalid_command' });
  // confirmed records UI intent only; it is NOT an approval or permission.
  try {
    const db = createClient(config.supabaseUrl, config.publicClientKey, {
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: identityError } = await db.auth.getUser(match[1]);
    if (identityError || !identity.user) return reply(401, { error: 'sign_in_required' });
    const { data, error } = await db.rpc('publish_course_guidance_once', {
      want_command: v.commandId, want_school: v.schoolId, want_course: v.courseCode,
      want_term: v.term, want_body: v.body, want_expected_version: v.expectedVersion,
    });
    if (error) {
      if (error.code === '42501') return reply(403, { error: 'not_permitted' });
      if (error.code === '40001') return reply(409, { error: 'review_current_version' });
      if (['23514', '22001', '22P02'].includes(error.code)) return reply(400, { error: 'invalid_command' });
      return reply(503, { error: 'outcome_unconfirmed', commandId: v.commandId });
    }
    if (!Number.isInteger(data) || data < 1) return reply(503, { error: 'outcome_unconfirmed', commandId: v.commandId });
    return reply(200, { commandId: v.commandId, state: 'published', version: data });
  } catch {
    return reply(503, { error: 'outcome_unconfirmed', commandId: v.commandId });
  }
}
