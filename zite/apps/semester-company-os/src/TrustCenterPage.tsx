import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trustCenter, TrustCenterInputType, TrustCenterOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

type D = TrustCenterOutputType;
const STATUS = ['In place', 'Verified in test', 'In progress', 'Not yet in place'] as const;
const SECTIONS = ['security', 'privacy', 'ai', 'accessibility'] as const;

export default function TrustCenterPage() {
  const [d, setD] = useState<D | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (input: TrustCenterInputType, ok?: string) => {
    setBusy(true);
    try { setD(await trustCenter(input)); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  };
  useEffect(() => { run({ action: 'list' }); }, []);
  if (!d) return <div className="space-y-3 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Trust Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Propose a change with evidence. A second person with the privacy officer role approves it before the public Trust page changes. Status, never certifications.</p>
      </header>
      <Published d={d} />
      <Changes d={d} busy={busy} run={run} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProposeControl d={d} busy={busy} run={run} />
        <ProposeSub d={d} busy={busy} run={run} />
      </div>
    </div>
  );
}

type P = { d: D; busy: boolean; run: (i: TrustCenterInputType, ok?: string) => Promise<boolean> };

const STALE_DAYS = 180;
const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 864e5);

/** What the public Trust page shows right now, with review age so stale claims get re-checked. */
function Published({ d }: { d: D }) {
  const stale = d.controls.filter((c) => ageDays(c.reviewedOn) > STALE_DAYS);
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Published now</h2>
        <span className="text-xs text-muted-foreground">{d.controls.length} controls · {d.subprocessors.filter((s) => s.active).length} active subprocessors{stale.length > 0 && ` · ${stale.length} not reviewed in ${STALE_DAYS} days`}</span>
      </div>
      {d.controls.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published yet. The public site seeds its defaults on first view.</p> : (
        <div className="grid gap-4 md:grid-cols-2">{SECTIONS.map((sec) => {
          const rows = d.controls.filter((c) => c.section === sec);
          return (
            <div key={sec}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{sec} · {rows.length}</p>
              {rows.length === 0 ? <p className="text-sm text-muted-foreground">No controls.</p> : (
                <ul className="space-y-1 text-sm">{rows.map((c) => (
                  <li key={c.control} className="flex items-start justify-between gap-2">
                    <span>{c.control}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {ageDays(c.reviewedOn) > STALE_DAYS && <Badge variant="destructive" title={`Last reviewed ${c.reviewedOn}`}>review due</Badge>}
                      <Badge variant={c.status === 'In place' || c.status === 'Verified in test' ? 'default' : 'secondary'}>{c.status}</Badge>
                    </span>
                  </li>))}</ul>)}
            </div>);
        })}</div>)}
    </section>
  );
}

function Changes({ d, busy, run }: P) {
  const [note, setNote] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const list = filter === 'pending' ? d.changes.filter((c) => c.status === 'pending') : d.changes;
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">Changes</h2>
        <div className="flex gap-1">{(['pending', 'all'] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>{f === 'pending' ? `Pending (${d.changes.filter((c) => c.status === 'pending').length})` : 'All'}</Button>)}</div>
      </div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{filter === 'pending' ? 'Nothing waiting for review.' : 'No proposals yet.'}</p> : (
        <ul className="divide-y divide-border text-sm">{list.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={c.status === 'pending' ? 'default' : 'secondary'}>{c.status}</Badge><span className="font-medium">{c.summary}</span></div>
            <p className="mt-1 text-muted-foreground">Evidence: {c.evidence}</p>
            <p className="text-xs text-muted-foreground">{new Date(c.at).toLocaleDateString()} · Proposed by {c.proposedBy}{c.decidedBy ? ` · decided by ${c.decidedBy}` : ''}{c.note ? ` · “${c.note}”` : ''}</p>
            {c.status === 'pending' && d.canDecide && !c.mine && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input className="h-8 max-w-xs" placeholder="Note (required to reject)" value={note[c.id] ?? ''} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} />
                <Button size="sm" disabled={busy} onClick={() => run({ action: 'approve', changeId: c.id, note: note[c.id] }, 'Approved. The public Trust page shows it now.')}>Approve & publish</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'reject', changeId: c.id, note: note[c.id] }, 'Rejected.')}>Reject</Button>
              </div>)}
            {c.status === 'pending' && c.mine && <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">Waiting for another privacy officer.<Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'withdraw', changeId: c.id }, 'Withdrawn.')}>Withdraw</Button></div>}
          </li>))}</ul>)}
    </section>
  );
}

function ProposeControl({ d, busy, run }: P) {
  const [f, setF] = useState({ section: 'security' as (typeof SECTIONS)[number], control: '', status: 'In progress' as (typeof STATUS)[number], detail: '', evidence: '' });
  const existing = d.controls.filter((c) => c.section === f.section);
  const pick = (name: string) => { const c = existing.find((x) => x.control === name); if (c) setF({ ...f, control: c.control, status: c.status as (typeof STATUS)[number], detail: c.detail }); };
  const verified = f.status === 'In place' || f.status === 'Verified in test';
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <h2 className="font-medium">Propose a control status</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={f.section} onValueChange={(v) => setF({ ...f, section: v as (typeof SECTIONS)[number], control: '' })}><SelectTrigger aria-label="Section"><SelectValue /></SelectTrigger><SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select onValueChange={pick}><SelectTrigger aria-label="Existing control"><SelectValue placeholder="Edit an existing control…" /></SelectTrigger><SelectContent>{existing.map((c) => <SelectItem key={c.control} value={c.control}>{c.control}</SelectItem>)}</SelectContent></Select>
      </div>
      <Input placeholder="Control name (new or existing)" value={f.control} onChange={(e) => setF({ ...f, control: e.target.value })} />
      <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as (typeof STATUS)[number] })}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <Textarea rows={2} placeholder="Public detail" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
      <Textarea rows={2} placeholder={verified ? 'Evidence: what was checked, how, and when (required)' : 'Why this change'} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
      <Button disabled={busy || f.control.trim().length < 3} onClick={async () => { if (await run({ action: 'proposeControl', ...f }, 'Proposed. A privacy officer reviews it next.')) setF({ ...f, control: '', detail: '', evidence: '' }); }}>Propose</Button>
    </section>
  );
}

function ProposeSub({ d, busy, run }: P) {
  const [f, setF] = useState({ name: '', purpose: '', evidence: '', active: true });
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <h2 className="font-medium">Subprocessors</h2>
      <ul className="divide-y divide-border text-sm">{d.subprocessors.map((s) => (
        <li key={s.name} className="flex items-start justify-between gap-2 py-2"><span><b>{s.name}</b> <span className="text-muted-foreground">{s.purpose}</span>{!s.active && <Badge variant="secondary" className="ml-2">removed</Badge>}</span>
          {s.active && <Button size="sm" variant="ghost" onClick={() => setF({ name: s.name, purpose: '', evidence: '', active: false })}>Remove…</Button>}</li>))}</ul>
      <Input placeholder="Service name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      {f.active ? <Input placeholder="What it does with data" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /> : <p className="text-sm text-muted-foreground">Proposing removal of {f.name}. <button className="underline" onClick={() => setF({ ...f, active: true })}>Cancel</button></p>}
      <Textarea rows={2} placeholder="Why (contract signed, DPA reference, offboarded…)" value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
      <Button disabled={busy || f.name.trim().length < 2} onClick={async () => { if (await run({ action: 'proposeSubprocessor', ...f }, 'Proposed. A privacy officer reviews it next.')) setF({ name: '', purpose: '', evidence: '', active: true }); }}>Propose</Button>
    </section>
  );
}
