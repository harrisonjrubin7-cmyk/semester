'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function SignIn() {
  const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle'); const [msg, setMsg] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault(); setState('sending');
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/auth/confirm?next=/workflow-router' } });
    if (error) { setState('error'); setMsg(error.message); } else setState('sent');
  }
  return (<main className="mx-auto max-w-sm p-8"><h1 className="text-2xl font-semibold">Sign in</h1>
    <p className="mt-2 text-sm text-neutral-600">We’ll email you a sign-in link. Without signing in, the router works in prototype mode and nothing is saved.</p>
    <form onSubmit={send} className="mt-6 grid gap-3"><label className="grid gap-1 text-sm">School or work email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 rounded border px-3" /></label>
      <button disabled={state === 'sending'} className="min-h-11 rounded bg-slate-800 px-4 font-medium text-white disabled:opacity-50">{state === 'sending' ? 'Sending…' : 'Email me a link'}</button></form>
    <p role="status" className="mt-4 text-sm">{state === 'sent' ? 'Check your inbox — the link signs you in on this device.' : state === 'error' ? msg : ''}</p></main>);
}
