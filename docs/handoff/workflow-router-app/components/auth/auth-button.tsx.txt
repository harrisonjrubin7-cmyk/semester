import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
export async function AuthButton() {
  const { user } = await requireUser();
  return user ? (<form action="/auth/sign-out" method="post" className="flex items-center gap-3 text-sm"><span>{user.email}</span><button className="min-h-9 rounded border px-3">Sign out</button></form>)
    : (<div className="flex items-center gap-3 text-sm"><span className="rounded border border-dashed px-2 py-1">Prototype mode — nothing is saved</span><Link href="/auth/sign-in" className="min-h-9 rounded bg-slate-800 px-3 py-2 text-white">Sign in</Link></div>);
}
