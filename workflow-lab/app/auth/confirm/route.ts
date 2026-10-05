import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withBasePath } from "@/lib/base-path";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const token = z.string().min(1).max(2048);

/** Token-hash links (custom email template; work across browsers). */
const otpParams = z.object({
  token_hash: token,
  type: z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]),
});

/**
 * Completes email sign-in. Supports both link styles:
 *   ?token_hash=...&type=email   (custom email template, works across browsers)
 *   ?code=...                    (PKCE, same browser that requested the link)
 *
 * The query values are parsed into a typed shape first. They are only ever
 * handed to Supabase, which is what actually verifies them; nothing here
 * decides whether someone is authenticated.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const failure = NextResponse.redirect(new URL(withBasePath("/auth/sign-in?error=confirm"), origin));

  const supabase = await createClient();
  if (!supabase) return failure;

  const otp = otpParams.safeParse({ token_hash: searchParams.get("token_hash"), type: searchParams.get("type") });
  const code = token.safeParse(searchParams.get("code"));

  const { error } = otp.success
    ? await supabase.auth.verifyOtp(otp.data)
    : code.success
      ? await supabase.auth.exchangeCodeForSession(code.data)
      : { error: new Error("missing credentials") };

  return error ? failure : NextResponse.redirect(new URL(withBasePath(next), origin));
}
