/**
 * The entitlement order lives with the LTI launch that evaluates it, in
 * `supabase/functions/_shared/entitlement.ts`: a Deno edge function deploys
 * only what is under `supabase/functions/`, and one copy is the point.
 * Re-exported here so the gateway and the app import it as before.
 */
export * from '../../../supabase/functions/_shared/entitlement.ts';
