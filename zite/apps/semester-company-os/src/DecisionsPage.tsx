import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { decisions, DecisionsInputType, DecisionsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';

type D = DecisionsOutputType;
type Item = D['items'][number];
type Run = (i: DecisionsInputType, ok?: string) => Promise<boolean>;
const LABEL: Record<string, string> = { open: 'Open', proposed: 'Awaiting confirmation', decided: 'Decided' };

export default function DecisionsPage() {
  const [d, setD] = useState<D | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'proposed' | 'decided'>('all');
  const run: Run = async (input, ok) => {
    setBusy(true);
    try { setD(await decisions(input)); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  };
  useEffect(() => { run({ action: 'list' }); }, []);
  if (!d) return <div className="space-y-3 p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  const count = (s: string) => d.items.filter((i) => i.status === s).length;
  const list = filter === 'all' ? d.items : d.items.filter((i) => i.status === filter);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Decision register</h1>
        <p className="mt-1 text-sm text-muted-foreground">Inputs the build must not guess. Propose an answer with its source; a different person confirms it before it counts. {count('decided')} of {d.items.length} decided.</p>
      </header>
      <div className="flex flex-wrap gap-1">
        {(['all', 'open', 'proposed', 'decided'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>{f === 'all' ? `All (${d.items.length})` : `${LABEL[f]} (${count(f)})`}</Button>))}
      </div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this view.</p> : (
        <ul className="space-y-3">{list.map((i) => <DecisionCard key={i.key} i={i} busy={busy} run={run} />)}</ul>)}
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="mb-2 font-medium">History</h2>
        {d.events.length === 0 ? <p className="text-sm text-muted-foreground">No changes yet.</p> : (
          <ul className="divide-y divide-border text-sm">{d.events.map((e, n) => (
            <li key={n} className="py-2"><span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()} · {e.actor} · {e.kind}</span><p>{d.items.find((x) => x.key === e.key)?.input}: {e.detail}</p></li>))}</ul>)}
      </section>
    </div>
  );
}

function DecisionCard({ i, busy, run }: { i: Item; busy: boolean; run: Run }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ answer: i.answer, evidence: i.evidence, reason: '' });
  return (
    <li className="rounded-md border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-medium">{i.input}</p><p className="text-xs text-muted-foreground">Controls: {i.controls}</p></div>
        <Badge variant={i.status === 'decided' ? 'default' : i.status === 'proposed' ? 'secondary' : 'outline'}>{LABEL[i.status]}</Badge>
      </div>
      {i.answer && <div className="mt-2"><p>{i.answer}</p><p className="text-xs text-muted-foreground">Source: {i.evidence} · Proposed by {i.proposedBy}{i.decidedBy && ` · confirmed by ${i.decidedBy}`}</p></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {i.status !== 'decided' && !edit && <Button size="sm" variant="outline" onClick={() => setEdit(true)}>{i.answer ? 'Propose a different answer' : 'Propose an answer'}</Button>}
        {i.status === 'proposed' && !i.mine && <Button size="sm" disabled={busy} onClick={() => run({ action: 'confirm', key: i.key }, 'Confirmed. This is now decided.')}>Confirm</Button>}
        {i.status === 'proposed' && i.mine && <span className="self-center text-xs text-muted-foreground">Waiting for someone else to confirm.</span>}
      </div>
      {edit && (
        <div className="mt-3 space-y-2">
          <Textarea rows={2} placeholder="The answer" value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} />
          <Input placeholder="Source: document, person, date" value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || f.answer.trim().length < 5 || f.evidence.trim().length < 10} onClick={async () => { if (await run({ action: 'propose', key: i.key, answer: f.answer, evidence: f.evidence }, 'Proposed. Someone else confirms it next.')) setEdit(false); }}>Propose</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
          </div>
        </div>)}
      {i.status === 'decided' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="h-8 max-w-sm" placeholder="Reason to reopen" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Button size="sm" variant="outline" disabled={busy || f.reason.trim().length < 5} onClick={() => run({ action: 'reopen', key: i.key, reason: f.reason }, 'Reopened.')}>Reopen</Button>
        </div>)}
    </li>
  );
}
