/**
 * Delete my account, done where it can be done completely.
 *
 * The Privacy page's button used to delete rows from the browser, one table
 * at a time, and could never reach the sign-in itself (SECURITY-GAP-ANALYSIS
 * S-2). This function takes the student's own access token, erases every row
 * naming them in one transaction (`public.erase_account`), then deletes the
 * auth user with the service role. `_shared/deleteaccount.ts` has the order
 * and the answers; `supabase/deletion.check.sql` proves the SQL half.
 *
 * `verify_jwt` is off, as for `claude`, `fetchcal` and `canvas`: the function
 * checks the token itself, and the platform check would reject the CORS
 * preflight, which carries no Authorization header.
 *
 * Reads `ALLOWED_ORIGIN` (see `_shared/cors.ts`) and the service credentials
 * the platform injects. Without the latter it answers 503 and deletes nothing.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { AccountHeldError, serveDeleteAccount } from '../_shared/deleteaccount.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve((req: Request) => {
  const cors = corsHeaders(Deno.env.get('ALLOWED_ORIGIN'), req.headers.get('Origin'), Deno.env.get('CORS_ALLOW_DEV'));
  if (!SUPABASE_URL || !SERVICE_KEY) return serveDeleteAccount(req, null, cors);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serveDeleteAccount(
    req,
    {
      async whoIs(token) {
        const { data, error } = await admin.auth.getUser(token);
        return error ? null : (data.user?.id ?? null);
      },
      async erase(userId) {
        const { data, error } = await admin.rpc('erase_account', { target: userId });
        // 55006 is erase_account refusing an account under a legal hold, before
        // it has touched a row. A hold is not a fault and is not reported as one.
        if (error?.code === '55006') throw new AccountHeldError();
        if (error) throw new Error(error.message);
        return data;
      },
      async deleteUser(userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
      },
    },
    cors,
  );
});
