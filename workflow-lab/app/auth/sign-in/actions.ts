"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { NOT_CONFIGURED, type ActionState } from "@/lib/actions/types";
import { withBasePath } from "@/lib/base-path";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formToObject } from "@/lib/validation/common";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address"));
const magicSchema = z.object({ email });
const passwordSchema = z.object({ email, password: z.string().min(8, "Use at least 8 characters").max(200) });

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const raw = formToObject(formData);
  const parsed = magicSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check your email address.", errors: fieldErrors(parsed.error) };

  const next = safeNextPath(String(raw.next ?? ""), "/");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}${withBasePath("/auth/confirm")}?next=${encodeURIComponent(next)}` },
  });
  // Do not reveal whether an address has an account: report only transport-level failures.
  if (error && error.status && error.status >= 500) return { ok: false, message: "Could not send the link right now. Try again shortly." };
  if (error && error.status === 429) return { ok: false, message: "Too many requests. Wait a minute and try again." };
  return { ok: true, message: "Check your inbox for a sign-in link." };
}

export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const raw = formToObject(formData);
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Email or password is incorrect." };
  redirect(safeNextPath(String(raw.next ?? ""), "/"));
}

export async function signUpWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const raw = formToObject(formData);
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };

  const next = safeNextPath(String(raw.next ?? ""), "/");
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}${withBasePath("/auth/confirm")}?next=${encodeURIComponent(next)}` },
  });
  if (error && error.status && error.status >= 500) return { ok: false, message: "Could not create the account right now." };
  return { ok: true, message: "If that address can be registered, a confirmation email is on its way." };
}
