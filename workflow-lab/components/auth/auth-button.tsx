import Link from "next/link";
import { withBasePath } from "@/lib/base-path";
import { getUser } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

/** Server component: shows the validated session (getUser), or prototype mode when Supabase is not configured. */
export async function AuthButton() {
  const { supabase, user } = await getUser();
  if (!supabase) {
    return (
      <Badge tone="warn" title="Supabase environment variables are not set. Saving is disabled; everything else works on local sample data.">
        Prototype mode
      </Badge>
    );
  }
  if (!user) {
    return (
      <Link href="/auth/sign-in" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:opacity-90">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[16rem] truncate text-sm text-muted sm:inline" title={user.email ?? undefined}>
        <span className="sr-only">Signed in as </span>
        {user.email}
      </span>
      <form action={withBasePath("/auth/sign-out")} method="post">
        <button type="submit" className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
          Sign out
        </button>
      </form>
    </div>
  );
}
