import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 * Returns null in prototype mode (no Supabase environment).
 * Create a new client per request; never cache it at module scope.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, which cannot set cookies.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * The authenticated user, validated by the Supabase Auth server.
 * Always use this (getUser) for authorization decisions - never getSession(),
 * whose cookie contents are not verified.
 */
export async function getUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null } as const;
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user } as const;
}
