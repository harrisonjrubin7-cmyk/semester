import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { handleProductivitySourceCheck } from '../_shared/productivitysourcecheck.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const APPROVED_HOSTS = (Deno.env.get('PRODUCTIVITY_SOURCE_HOSTS') ?? '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

Deno.serve((req: Request) => {
  const cors = corsHeaders(
    Deno.env.get('ALLOWED_ORIGIN'),
    req.headers.get('origin'),
    Deno.env.get('CORS_ALLOW_DEV'),
  );
  if (!SUPABASE_URL || !ANON_KEY) return handleProductivitySourceCheck(req, null, cors);

  return handleProductivitySourceCheck(req, {
    authenticated: async (auth) => {
      const client = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.getUser();
      return !error && Boolean(data.user);
    },
    approvedHosts: APPROVED_HOSTS,
    resolve: (host, record) => Deno.resolveDns(host, record),
    fetch: (url, init) => fetch(url, init),
    now: () => new Date().toISOString(),
  }, cors);
});
