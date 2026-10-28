// Recommendations (owner source S-90 §5F). Applicants see verified status only; recommenders answer and submit here.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { recommendations } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';

const msg = (e: unknown) => (e instanceof Error ? (e as { userFacingMessage?: string }).userFacingMessage ?? e.message : 'That didn’t work');
const toB64 = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => bad(r.error); r.readAsDataURL(f); });
const LABEL: Record<string, string> = { Requested: 'Request sent', Accepted: 'Accepted by recommender', Declined: 'Declined', Submitted: 'Letter submitted', Withdrawn: 'Withdrawn' };

type Mine = { id: number; name: string; email: string; state: string; waived: boolean; requestedAt: string; submittedAt: string | null };
export function ApplicantRecommendations({ applicationId, open }: { applicationId: string; open: boolean }) {
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [f, setF] = useState({ name: '', email: '', waived: true });
  const [busy, setBusy] = useState(false);
  const load = () => { (recommendations({ action: 'mine', applicationId }) as Promise<{ requests: Mine[] }>).then((r) => setRows(r.requests)).catch(() => setRows([])); };
  useEffect(load, [applicationId]);
  const ask = async () => {
    setBusy(true);
    try { const r = await recommendations({ action: 'request', applicationId, ...f }) as { notified: boolean }; toast(r.notified ? 'Request sent in Semester.' : 'Request saved. They have no Semester account yet: ask them to sign in to Semester Applicants with this email.'); setF({ name: '', email: '', waived: true }); load(); }
    catch (e) { toast(`! ${msg(e)}`); } finally { setBusy(false); }
  };
  const withdraw = async (id: number) => { try { await recommendations({ action: 'withdraw', id }); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <div className="mt-3 border-t border-border pt-3 text-sm">
      <p className="font-medium">Recommendations</p>
      <p className="text-xs text-muted-foreground">You see only whether a letter arrived, never what it says.</p>
      {!rows ? <Skeleton className="mt-2 h-8" /> : rows.length > 0 && <ul className="mt-2 space-y-1">{rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.name} · {LABEL[r.state] ?? r.state}{r.submittedAt ? ` · ${format(new Date(r.submittedAt), 'd MMM')}` : ''}{r.waived ? ' · access waived' : ''}</span>
          {(r.state === 'Requested' || r.state === 'Accepted') && open && <button className="text-xs text-muted-foreground underline" onClick={() => withdraw(r.id)}>Withdraw</button>}</li>))}</ul>}
      {open && <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input aria-label="Recommender name" placeholder="Recommender name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input aria-label="Recommender email" type="email" placeholder="Their email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Button size="sm" disabled={busy || f.name.trim().length < 2 || !f.email.includes('@')} onClick={ask}>Ask</Button>
        <label className="flex items-center gap-2 text-xs sm:col-span-3"><input type="checkbox" checked={f.waived} onChange={(e) => setF({ ...f, waived: e.target.checked })} />I waive my right to read this letter (institutions often weigh confidential letters more).</label>
      </div>}
    </div>
  );
}

type Req = { id: number; state: string; waived: boolean; requestedAt: string; applicant: string; program: string; institution: string };
export default function RecommendationsToWrite() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = () => { (recommendations({ action: 'inbox' }) as Promise<{ requests: Req[] }>).then((r) => setRows(r.requests)).catch(() => setRows([])); };
  useEffect(load, []);
  const act = async (id: number, f: () => Promise<unknown>, done: string) => { setBusy(id); try { await f(); toast(done); load(); } catch (e) { toast(`! ${msg(e)}`); } finally { setBusy(null); } };
  return (
    <>
      <p className="eyebrow">Apply</p><h1 className="mt-1 text-3xl">Recommendations to write</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Requests sent to the email you signed in with. Your letter is stored privately; only the institution’s admissions reviewers can read it, and the applicant never can.</p>
      {!rows ? <div className="mt-6"><Skeleton className="h-24" /></div> : !rows.length ? <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No one has asked you for a recommendation.</p> : (
        <ul className="mt-6 space-y-3">{rows.map((r) => (
          <li key={r.id} className="rounded-md border border-border bg-card p-4 text-sm">
            <p className="eyebrow">{r.institution}</p><p className="text-lg">{r.applicant} · {r.program}</p>
            <p className="text-xs text-muted-foreground">Asked {format(new Date(r.requestedAt), 'd MMM yyyy')} · {r.waived ? 'Applicant waived access: confidential' : 'Applicant did not waive access'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.state === 'Requested' && <><Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, () => recommendations({ action: 'respond', id: r.id, accept: true }), 'Accepted.')}>Accept</Button>
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, () => recommendations({ action: 'respond', id: r.id, accept: false }), 'Declined.')}>Decline</Button></>}
              {r.state === 'Accepted' && <label className="cursor-pointer rounded-sm border border-dashed border-border px-3 py-2 text-xs">{busy === r.id ? 'Uploading…' : '+ Upload and submit letter (PDF)'}
                <input type="file" accept="application/pdf" className="hidden" disabled={busy === r.id} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) act(r.id, async () => recommendations({ action: 'submitLetter', id: r.id, name: file.name, mime: file.type || 'application/pdf', base64: await toB64(file) }), 'Letter submitted.'); }} /></label>}
              {r.state === 'Submitted' && <span>✓ Letter submitted</span>}
            </div>
          </li>))}</ul>
      )}
    </>
  );
}
