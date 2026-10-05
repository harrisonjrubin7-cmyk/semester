import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies on every request.
 * Called from proxy.ts (Next.js 16; named middleware.ts before Next.js 16).
 *
 * Rules that make this safe:
 *  - getUser() must run before anything else touches the response: it validates
 *    the token with the Auth server and triggers the refresh.
 *  - The response returned here carries the refreshed cookies and must be the one returned.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  let response = NextResponse.next({ request });
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        if (headers) for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
