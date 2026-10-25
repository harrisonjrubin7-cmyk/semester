import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Checkbox } from '@project/components/ui/checkbox';
import { Skeleton } from '@project/components/ui/skeleton';
import { publications, PublicationsInputType, PublicationsOutputType } from 'zitejs/api';

type Pub = PublicationsOutputType['items'][0];
const CLAIMS = ['Price', 'Customer name', 'Outcome', 'Certification', 'Compliance'];
const ORDER = ['In review', 'Approved', 'Changes requested', 'Draft', 'Published', 'Withdrawn'];
const blank = { title: '', slug: '', summary: '', body: '', claimTypes: [] as string[], claimSources: '' };

export default function PublicationsPage() {
  const [items, setItems] = useState<Pub[] | null>(null);
  const [sel, setSel] = useState<string | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (input: PublicationsInputType, ok?: string) => {
    setBusy(true);
    try { const r = await publications(input); setItems(r.items); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  };
  useEffect(() => { run({ action: 'list' }); }, []);
  const cur = items?.find((i) => i.id === sel);
  const sorted = [...(items ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Site publications</h1>
          <p className="text-sm text-muted-foreground">Draft → review by someone else → approval → publish to semester-site /updates. Nothing is emailed or posted anywhere else.</p></div>
        <Button onClick={() => setSel('new')}>New draft</Button>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <ul className="space-y-1">
          {!items ? <Skeleton className="h-32" /> : sorted.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> :
            sorted.map((p) => (
              <li key={p.id}><button onClick={() => setSel(p.id)} className={`w-full rounded-[3px] border px-3 py-2 text-left text-sm ${sel === p.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
                <span className="block font-medium">{p.title || 'Untitled'}</span>
                <span className="mt-1 flex gap-2"><Badge variant="outline">{p.status}</Badge>{p.mine && <span className="text-xs text-muted-foreground">yours</span>}</span>
              </button></li>))}
        </ul>
        {sel === 'new' ? <Editor key="new" initial={blank} busy={busy} onSave={async (d) => { if (await run({ action: 'save', ...d }, 'Draft saved')) setSel(null); }} />
          : cur ? <Detail key={cur.id} p={cur} busy={busy} run={run} />
          : <p className="text-sm text-muted-foreground">Pick a post or start a new draft.</p>}
      </div>
    </div>
  );
}

function Editor({ initial, busy, onSave }: { initial: typeof blank; busy: boolean; onSave: (d: typeof blank) => void }) {
  const [d, setD] = useState(initial);
  const claim = d.claimTypes.length > 0;
  const valid = d.title.trim().length >= 3 && (!claim || d.claimSources.trim().length >= 10);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
      <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
      <Input placeholder="Web address (optional, from title)" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} />
      <Textarea placeholder="One-line summary" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
      <Textarea rows={10} placeholder="Body" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
      <fieldset className="rounded-[3px] border border-border p-3"><legend className="px-1 text-sm font-medium">Does this post claim any of these?</legend>
        <div className="flex flex-wrap gap-4">{CLAIMS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm"><Checkbox checked={d.claimTypes.includes(c)} onCheckedChange={(v) => setD({ ...d, claimTypes: v ? [...d.claimTypes, c] : d.claimTypes.filter((x) => x !== c) })} />{c}</label>))}</div>
        {claim && <Textarea className="mt-3" placeholder="Approved source for each claim (Source Register entry, signed reference, audit report…)" value={d.claimSources} onChange={(e) => setD({ ...d, claimSources: e.target.value })} />}
        {claim && d.claimSources.trim().length < 10 && <p className="mt-1 text-xs text-destructive">Claims need a cited approved source.</p>}
      </fieldset>
      <Button type="submit" disabled={!valid || busy}>Save draft</Button>
    </form>
  );
}

function Detail({ p, busy, run }: { p: Pub; busy: boolean; run: (i: PublicationsInputType, ok?: string) => Promise<boolean> }) {
  const [note, setNote] = useState('');
  const editable = p.status === 'Draft' || p.status === 'Changes requested';
  if (editable && p.mine) return (
    <div className="space-y-4">
      {p.reviewNote && <p className="rounded-[3px] border border-border bg-muted p-3 text-sm"><b>Reviewer:</b> {p.reviewNote}</p>}
      <Editor initial={{ title: p.title, slug: p.slug, summary: p.summary, body: p.body, claimTypes: p.claimTypes, claimSources: p.claimSources }} busy={busy} onSave={(d) => run({ action: 'save', id: p.id, ...d }, 'Draft saved')} />
      <Button variant="outline" disabled={busy} onClick={() => run({ action: 'submit', id: p.id }, 'Sent for review')}>Submit for review</Button>
      <History h={p.history} />
    </div>
  );
  return (
    <div className="space-y-4">
      <div><Badge variant="outline">{p.status}</Badge><h2 className="mt-2 text-xl font-semibold">{p.title}</h2><p className="text-sm text-muted-foreground">/updates/{p.slug}</p></div>
      {p.summary && <p className="text-muted-foreground">{p.summary}</p>}
      <div className="whitespace-pre-wrap rounded-[3px] border border-border p-4 text-sm">{p.body}</div>
      {p.claimTypes.length > 0 && <p className="text-sm"><b>Claims:</b> {p.claimTypes.join(', ')} — <b>Sources:</b> {p.claimSources}</p>}
      {p.status === 'In review' && (p.mine ? <p className="text-sm text-muted-foreground">Waiting for another teammate to review.</p> : (
        <div className="space-y-2"><Textarea placeholder="Review note (required to request changes)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2"><Button disabled={busy} onClick={() => run({ action: 'approve', id: p.id, note }, 'Approved')}>Approve</Button>
            <Button variant="outline" disabled={busy || note.trim().length < 5} onClick={() => run({ action: 'requestChanges', id: p.id, note }, 'Changes requested')}>Request changes</Button></div></div>))}
      {p.status === 'Approved' && (p.mine ? <p className="text-sm text-muted-foreground">Approved. Someone other than the author publishes it.</p>
        : <Button disabled={busy} onClick={() => run({ action: 'publish', id: p.id }, 'Published to /updates')}>Publish to public site</Button>)}
      {(p.status === 'Published' || p.status === 'Approved') && <Button variant="outline" disabled={busy} onClick={() => run({ action: 'withdraw', id: p.id }, 'Withdrawn')}>Withdraw</Button>}
      <History h={p.history} />
    </div>
  );
}

function History({ h }: { h: string }) {
  return h ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">History</summary><pre className="mt-2 whitespace-pre-wrap font-mono">{h}</pre></details> : null;
}
