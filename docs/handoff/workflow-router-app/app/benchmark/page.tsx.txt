import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
export default async function Page() {
  const { supabase, user } = await requireUser();
  if (!user) return (<div className="grid gap-3"><h1 className="text-2xl font-semibold">Benchmark lab</h1><p>Sign in to create suites, record runs and grade them. Benchmark data is private to you or your organization.</p><Link className="w-fit rounded bg-slate-800 px-4 py-2 text-white" href="/auth/sign-in">Sign in</Link></div>);
  const { data: suites, error } = await supabase.from('benchmark_suites').select('id, name, description, created_at').order('created_at', { ascending: false });
  return (<div className="grid gap-4"><h1 className="text-2xl font-semibold">Benchmark suites</h1>{error && <p role="alert">Could not load suites: {error.message}</p>}
    {!suites?.length ? <p className="rounded border border-dashed p-6">No suites yet. Run <code>supabase/seed.sql</code> to create the canonical 12.</p> : <ul className="grid gap-2">{suites.map((s) => <li key={s.id}><Link href={'/benchmark/' + s.id} className="block rounded border bg-white p-4 hover:bg-neutral-50"><strong>{s.name}</strong><p className="text-sm text-neutral-600">{s.description}</p></Link></li>)}</ul>}</div>);
}
