/**
 * Manually invokes one bounded projection batch. There is deliberately no
 * scheduler entry: deployment alone cannot make this worker run. It also
 * fails closed until OPS_PROJECTOR_SECRET is explicitly provisioned.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { serveOpsProjector } from '../_shared/opsprojector.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const secret = Deno.env.get('OPS_PROJECTOR_SECRET');
const admin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

Deno.serve((req: Request) => serveOpsProjector(req, admin ? {
  secret,
  async run() {
    const { data, error } = await admin.rpc('run_ops_projector', { want_limit: 25 });
    if (error) throw new Error('Projection RPC unavailable.');
    return data;
  },
} : null));
