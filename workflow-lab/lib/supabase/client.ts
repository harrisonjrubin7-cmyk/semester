import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Browser client for Client Components. Uses the publishable key only. */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return createBrowserClient(env.url, env.key);
}
