import { useState } from 'react';
import { toast } from 'sonner';
import { helpArticles } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

type A = { id: string; number: number; title: string; body: string; audience: string; claimTypes: string[]; claimSources: string; state: string; version: number; hash: string; mine: boolean; author: string; reviewer: string; reviewNote: string; supersedes: string | null; publishedAt: string | null; history: { actor: string; action: string; detail: string; at: string | null }[] };
const CLAIMS = ['price', 'customer', 'outcome', 'certification', 'security'] as const;

function useRun(reload: () => void) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = (await helpArticles({ op: 'run', commandKey: key, ...input } as never)) as { resultCode: string; message: string; replay: boolean };
      (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
      if (r.resultCode === 'OK') { setKey(crypto.randomUUID()); reload(); return true; }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    return false;
  };
  return { run, busy };
}

function Claims({ value, onChange, id }: { value: string[]; onChange: (v: string[]) => void; id: string }) {
  return <fieldset className="mt-2 text-xs"><legend className="mb-1">Does it state a…</legend><div className="flex flex-wrap gap-3">{CLAIMS.map((c) => (
    <label key={c} htmlFor={`${id}-${c}`} className="flex items-center gap-1"><input id={`${id}-${c}`} type="checkbox" checked={value.includes(c)} onChange={(e) => onChange(e.target.checked ? [...value, c] : value.filter((x) => x !== c))} />{c}</label>))}</div></fieldset>;
}

function Article({ a, reload }: { a: A; reload: () => void }) {
  const { run, busy } = useRun(reload);
  const [f, setF] = useState({ title: a.title, body: a.body, claimTypes: a.claimTypes, claimSources: a.claimSources });
  const [note, setNote] = useState('');
  const dirty = f.title !== a.title || f.body !== a.body || f.claimSources !== a.claimSources || f.claimTypes.join() !== a.claimTypes.join();
  const step = (s: string, extra: Record<string, unknown> = {}) => run({ step: s, articleId: a.id, version: a.version, ...extra });
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-medium">#{a.number} {a.title}</p><p className="text-xs text-muted-foreground">{a.audience === 'customer' ? 'Customer-facing (delivery disabled)' : 'Internal'} · by {a.author}{a.reviewer ? ` · reviewed by ${a.reviewer}` : ''}{a.supersedes ? ' · revision' : ''}{a.publishedAt ? ` · ${fmt(a.publishedAt)}` : ''}</p></div>
        <Chip value={a.state.replace('_', ' ')} />
      </div>
      {a.state === 'draft' && a.mine ? <div className="mt-2 space-y-2">
        <Input aria-label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea aria-label="Article" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <Claims id={a.id} value={f.claimTypes} onChange={(v) => setF({ ...f, claimTypes: v })} />
        {f.claimTypes.length > 0 && <Input aria-label="Approved source for the claim" placeholder="Approved source (e.g. Trust Center control, signed contract)" value={f.claimSources} onChange={(e) => setF({ ...f, claimSources: e.target.value })} />}
        {a.reviewNote && <p className="text-xs">Returned: {a.reviewNote}</p>}
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || !dirty} onClick={() => step('edit', f)}>Save</Button><Button size="sm" disabled={busy || dirty} onClick={() => step('submit')}>Send for review</Button></div>
      </div> : <p className="mt-2 whitespace-pre-wrap">{a.body}</p>}
      {a.claimTypes.length > 0 && a.state !== 'draft' && <p className="mt-1 text-xs">Claims: {a.claimTypes.join(', ')} · source: {a.claimSources}</p>}
      {a.state === 'in_review' && (a.mine ? <p className="mt-2 text-xs text-muted-foreground">Waiting for another support agent.</p> : <div className="mt-2 space-y-2">
        <Input aria-label="Review note" placeholder="Review note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => step('publish', { seenHash: a.hash, note })}>{a.audience === 'customer' ? 'Approve this exact text' : 'Publish this exact text'}</Button><Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => step('return', { seenHash: a.hash, note })}>Return to author</Button></div>
      </div>)}
      {a.state === 'published' && <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => step('revise')}>Start a revision</Button>
        <Input aria-label="Reason to retire" className="h-8 w-52" placeholder="Reason to retire" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => step('retire', { note })}>Retire</Button>
      </div>}
      {a.history.length > 0 && <details className="mt-2 text-xs"><summary>History</summary><ul>{a.history.map((h, i) => <li key={i}>{fmt(h.at)} · {h.actor} · {h.action}{h.detail ? ` · ${h.detail}` : ''}</li>)}</ul></details>}
    </div>
  );
}

export default function HelpArticlesPage() {
  const state = useLoad(() => helpArticles({ op: 'list' }) as Promise<{ articles: A[] }>);
  const { run, busy } = useRun(state.reload);
  const [f, setF] = useState({ title: '', body: '', audience: 'internal', claimTypes: [] as string[], claimSources: '' });
  const [q, setQ] = useState('');
  return (
    <>
      <Header eyebrow="Support" title="Help articles" sub="Support agents write; a second agent reviews the exact text before it is published. Customer-facing articles are approved but not delivered until customer publishing is approved." />
      <Loadable state={state}>{(d) => {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        const match = (a: A) => words.every((w) => `${a.title} ${a.body}`.toLowerCase().includes(w));
        const live = d.articles.filter((a) => a.state === 'published' && match(a));
        const work = d.articles.filter((a) => a.state === 'draft' || a.state === 'in_review');
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel title={`Review and drafts (${work.length})`}>{work.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in progress.</p> : work.map((a) => <Article key={a.id} a={a} reload={state.reload} />)}</Panel>
              <Panel title="Published">
                <Input aria-label="Search articles" placeholder="Search" className="mb-2 max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
                {live.length === 0 ? <p className="text-sm text-muted-foreground">{q ? 'No article matches.' : 'Nothing published yet.'}</p> : live.map((a) => <Article key={a.id} a={a} reload={state.reload} />)}
              </Panel>
            </div>
            <Panel title="New article">
              <label htmlFor="ha-a" className="text-xs">Audience</label>
              <select id="ha-a" className="mt-1 w-full rounded-sm border border-border bg-transparent p-2 text-sm" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="internal">Internal (support agents)</option><option value="customer">Customer-facing (delivery disabled)</option></select>
              <label htmlFor="ha-t" className="mt-3 block text-xs">Title</label><Input id="ha-t" className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <label htmlFor="ha-b" className="mt-3 block text-xs">Article</label><Textarea id="ha-b" className="mt-1" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              <Claims id="new" value={f.claimTypes} onChange={(v) => setF({ ...f, claimTypes: v })} />
              {f.claimTypes.length > 0 && <Input aria-label="Approved source for the claim" className="mt-2" placeholder="Approved source" value={f.claimSources} onChange={(e) => setF({ ...f, claimSources: e.target.value })} />}
              <Button className="mt-3 w-full" disabled={busy || f.title.trim().length < 5 || f.body.trim().length < 40 || (f.claimTypes.length > 0 && f.claimSources.trim().length < 10)} onClick={async () => { if (await run({ step: 'draft', ...f })) setF({ title: '', body: '', audience: f.audience, claimTypes: [], claimSources: '' }); }}>Save draft</Button>
              <p className="mt-2 text-xs text-muted-foreground">Prices, customer names, outcomes, certifications and security claims need an approved source.</p>
            </Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}
