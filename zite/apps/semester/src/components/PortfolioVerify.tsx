// Verified portfolio evidence (C16). Student side: ask an instructor of a section you took. Instructor side: answer.
// Both apps call their own `portfolioVerify` endpoint (Faculty's is a front door to the same implementation).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { portfolioVerify } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';

const msg = (e: unknown) => (e instanceof Error ? (e as { userFacingMessage?: string }).userFacingMessage ?? e.message : 'That didn’t go through');
type Mine = { items: { id: string; title: string }[]; sections: { id: string; label: string }[]; claims: { id: number; itemId: string; state: string; statement: string; instructor: string }[] };

export function StudentVerify() {
  const [d, setD] = useState<Mine | null>(null);
  const [item, setItem] = useState(''); const [sec, setSec] = useState('');
  const load = () => { (portfolioVerify({ action: 'mine' }) as Promise<Mine>).then(setD).catch((e) => toast.error(msg(e))); };
  useEffect(load, []);
  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); toast.success(ok); load(); } catch (e) { toast.error(msg(e)); } };
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const title = (id: string) => d.items.find((i) => i.id === id)?.title ?? 'Item';
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">An instructor can confirm what a portfolio item shows. Employers see the confirmation only if you share that item.</p>
      {d.items.length === 0 ? <p>Add a portfolio item in Study first.</p> : d.sections.length === 0 ? <p>Verification is available for sections you have taken.</p> : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">Item<select className="rounded border border-border bg-background px-2 py-1.5" value={item} onChange={(e) => setItem(e.target.value)}><option value="">Choose…</option>{d.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
          <label className="grid gap-1">Section<select className="rounded border border-border bg-background px-2 py-1.5" value={sec} onChange={(e) => setSec(e.target.value)}><option value="">Choose…</option>{d.sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <Button size="sm" disabled={!item || !sec} onClick={() => run(() => portfolioVerify({ action: 'request', itemId: item, sectionId: sec }), 'Asked. The instructor will answer in Semester Faculty.')}>Ask instructor</Button>
        </div>
      )}
      {d.claims.length > 0 && <ul className="divide-y divide-border">{d.claims.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><span className="font-medium">{title(c.itemId)}</span> · {c.instructor} · {c.state}{c.statement && <span className="block text-muted-foreground">“{c.statement}”</span>}</span>
          {(c.state === 'Requested' || c.state === 'Verified') && <Button size="sm" variant="outline" onClick={() => run(() => portfolioVerify({ action: 'withdraw', id: c.id }), 'Withdrawn.')}>Withdraw</Button>}
        </li>))}</ul>}
    </div>
  );
}

type Req = { id: number; student: string; section: string; item: { title: string; body: string } };
export function InstructorVerify() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [text, setText] = useState<Record<number, string>>({});
  const load = () => { (portfolioVerify({ action: 'queue' }) as Promise<{ requests: Req[] }>).then((r) => setRows(r.requests)).catch(() => setRows([])); };
  useEffect(load, []);
  const decide = async (id: number, verify: boolean) => { try { await portfolioVerify({ action: 'decide', id, verify, statement: text[id] ?? '' }); toast.success(verify ? 'Verified.' : 'Declined.'); load(); } catch (e) { toast.error(msg(e)); } };
  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">No verification requests.</p>;
  return (
    <ul className="space-y-3 text-sm">{rows.map((r) => (
      <li key={r.id} className="rounded-md border border-border p-3">
        <p><span className="font-medium">{r.student}</span> · {r.section} · {r.item.title}</p>
        {r.item.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.item.body}</p>}
        <label className="mt-2 grid gap-1">What you can verify (shown with the item if the student shares it)
          <Textarea value={text[r.id] ?? ''} maxLength={300} onChange={(e) => setText({ ...text, [r.id]: e.target.value })} /></label>
        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Verify</Button><Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Decline</Button></div>
      </li>))}</ul>
  );
}
