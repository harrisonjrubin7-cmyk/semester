import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in · Semester Workflow Lab" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, "/");
  const { supabase, user } = await getUser();
  if (user) redirect(next);

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Sign in to save recommendations and record benchmark runs and grades.</p>

      {!supabase && (
        <div role="status" className="mt-6 rounded-lg border border-line bg-warn-soft p-4 text-sm text-warn">
          <strong>Prototype mode.</strong> Supabase is not configured, so sign-in is unavailable. The router, matrices and benchmark definitions still work.
          See the README to set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
        </div>
      )}
      {sp.error && (
        <p role="alert" className="mt-6 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          That sign-in link was invalid or has expired. Request a new one.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <SignInForm next={next} />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/" className="underline">Continue without signing in</Link>
      </p>
    </div>
  );
}
