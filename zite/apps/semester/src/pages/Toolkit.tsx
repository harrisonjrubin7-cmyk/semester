import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { toolkit } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { TOOLS, INTENTS, SUBJECTS, EVERY_SUBJECT, TEMPLATES, emptyDoc, completeness, rubricChecklist, describe, parseCsv, type ToolKey, type Doc, type Section } from '../lib/toolkitRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function ToolCard({ k }: { k: ToolKey }) {
  const t = TOOLS.find((x) => x.key === k)!;
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.blurb}</p>
      <p className="mt-1 text-xs">{t.where === 'toolkit' ? 'In the toolkit' : 'Opens in Semester'}</p>
      {t.route ? <Link className="mt-1 inline-block text-xs underline" to={t.route}>Open {t.name}</Link> : <p className="mt-1 text-xs text-muted-foreground">Not built yet — on the build list.</p>}
    </div>
  );
}

export function ToolkitHub() {
  const [filter, setFilter] = useState<string>('All tools');
  const list: ToolKey[] = filter === 'All tools' ? TOOLS.map((t) => t.key) : filter === 'Tools every subject uses' ? EVERY_SUBJECT
    : INTENTS.find((i) => i.name === filter)?.tools ?? SUBJECTS.find((s) => `${s.group} · ${s.name}` === filter)?.tools ?? [];
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Learn" title="Toolkit" sub="Start from what you are doing or from your subject. Every tool works on your own material; nothing here predicts a grade." />
      <div className="flex flex-wrap gap-2" role="group" aria-label="What are you doing">{INTENTS.map((i) => <Button key={i.name} size="sm" variant={filter === i.name ? 'default' : 'outline'} onClick={() => setFilter(i.name)}>{i.name}</Button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-xs" htmlFor="tk-subject">Subject workbench</label>
        <select id="tk-subject" className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All tools</option><option>Tools every subject uses</option>
          {[...new Set(SUBJECTS.map((s) => s.group))].map((g) => <optgroup key={g} label={g}>{SUBJECTS.filter((s) => s.group === g).map((s) => <option key={s.name} value={`${s.group} · ${s.name}`}>{s.name}</option>)}</optgroup>)}
        </select></div>
      <p className="text-sm font-medium">{filter}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((k) => <ToolCard key={k} k={k} />)}</div>
    </div>
  );
}

function SectionEditor({ s, value, onChange }: { s: Section; value: any; onChange: (v: any) => void }) {
  if (s.type === 'text') return <Textarea aria-label={s.label} rows={s.key === 'csv' ? 6 : 3} className={s.key === 'csv' ? 'font-mono text-xs' : ''} placeholder={s.hint} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  if (s.type === 'list') { const xs: string[] = value ?? [];
    return <div className="space-y-1">{xs.map((x, i) => <div key={i} className="flex gap-1"><Input aria-label={`${s.label} ${i + 1}`} value={x} onChange={(e) => onChange(xs.map((y, j) => (j === i ? e.target.value : y)))} />
      <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => onChange(xs.filter((_, j) => j !== i))}>×</Button></div>)}
      <Button size="sm" variant="outline" onClick={() => onChange([...xs, ''])}>Add</Button></div>; }
  const rows: string[][] = value ?? [];
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{s.columns!.map((c) => <th key={c} className="p-1 text-left font-medium">{c}</th>)}<th /></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{s.columns!.map((c, j) => <td key={c} className="p-1"><Input aria-label={`${c} row ${i + 1}`} className="h-8" value={r[j] ?? ''} onChange={(e) => onChange(rows.map((x, k) => (k === i ? x.map((y, m) => (m === j ? e.target.value : y)) : x)))} /></td>)}
        <td><Button size="sm" variant="ghost" aria-label="Remove row" onClick={() => onChange(rows.filter((_, k) => k !== i))}>×</Button></td></tr>)}</tbody></table>
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, Array(s.columns!.length).fill('')])}>Add row</Button></div>
  );
}

function DataViews({ csv }: { csv: string }) {
  const stats = useMemo(() => describe(csv || ''), [csv]);
  const { header, rows } = useMemo(() => parseCsv(csv || ''), [csv]);
  const [col, setCol] = useState('');
  if (!header.length) return <Empty>Paste CSV above to describe and chart it.</Empty>;
  const ci = header.indexOf(col);
  const counts = new Map<string, number>();
  if (ci >= 0) for (const r of rows) { const v = (r[ci] ?? '').trim() || '(blank)'; counts.set(v, (counts.get(v) ?? 0) + 1); }
  const bars = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const max = Math.max(1, ...bars.map((b) => b[1]));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto"><table className="w-full text-xs"><caption className="text-left font-medium">Describe ({rows.length} rows)</caption>
        <thead><tr>{['Column', 'Type', 'n', 'Missing', 'Mean', 'Median', 'SD', 'Min', 'Max', 'Most common'].map((h) => <th key={h} className="p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>{stats.map((s) => <tr key={s.column}><td className="p-1">{s.column}</td><td>{s.numeric ? 'number' : 'text'}</td><td>{s.n}</td><td>{s.missing}</td><td>{s.mean ?? '—'}</td><td>{s.median ?? '—'}</td><td>{s.sd ?? '—'}</td><td>{s.min ?? '—'}</td><td>{s.max ?? '—'}</td><td>{s.top?.map((t) => `${t.value} (${t.count})`).join(', ') ?? '—'}</td></tr>)}</tbody></table></div>
      <div><label className="text-xs" htmlFor="dv-col">Chart counts of</label> <select id="dv-col" className={sel} value={col} onChange={(e) => setCol(e.target.value)}><option value="">Choose a column…</option>{header.map((h) => <option key={h}>{h}</option>)}</select></div>
      {ci >= 0 && <><div role="img" aria-label={`Counts of ${col}: ${bars.map(([k, v]) => `${k} ${v}`).join(', ')}`} className="space-y-1">{bars.map(([k, v]) => <div key={k} className="flex items-center gap-2 text-xs"><span className="w-28 shrink-0 truncate">{k}</span><div className="h-3 rounded-sm bg-primary" style={{ width: `${(v / max) * 100}%` }} /><span>{v}</span></div>)}</div>
        <details><summary className="cursor-pointer text-xs">Same chart as a table</summary><table className="text-xs"><thead><tr><th className="p-1 text-left">{col}</th><th className="p-1 text-left">Count</th></tr></thead><tbody>{bars.map(([k, v]) => <tr key={k}><td className="p-1">{k}</td><td className="p-1">{v}</td></tr>)}</tbody></table></details></>}
    </div>
  );
}

function RubricTool({ doc, setDoc }: { doc: Doc; setDoc: (d: Doc) => void }) {
  const items = rubricChecklist(String(doc.criterion ?? ''));
  const checked = (doc.checked as string[] | undefined) ?? [];
  return (
    <div className="space-y-2 text-sm">
      <Textarea aria-label="Rubric criterion" rows={3} placeholder="Paste one rubric criterion" value={String(doc.criterion ?? '')} onChange={(e) => setDoc({ ...doc, criterion: e.target.value, checked: [] })} />
      {!items.length ? <Empty>Paste a criterion to turn it into a checklist.</Empty> : items.map((q) => <label key={q} className="flex gap-2"><input type="checkbox" checked={checked.includes(q)} onChange={(e) => setDoc({ ...doc, checked: e.target.checked ? [...checked, q] : checked.filter((x) => x !== q) })} /> {q}</label>)}
      <p className="text-xs text-muted-foreground">A checklist for looking at your own work. It does not predict a grade; your instructor marks against the rubric.</p>
    </div>
  );
}

export function ToolkitTool() {
  const { kind = 'case' } = useParams();
  const k = (['case', 'research', 'data', 'assignment', 'rubric'].includes(kind) ? kind : 'case') as 'case' | 'research' | 'data' | 'assignment' | 'rubric';
  const tool = TOOLS.find((t) => t.key === k)!;
  const state = useLoad(() => toolkit({ action: 'list', kind: k } as never) as Promise<any>, [k]);
  const [open, setOpen] = useState<any>(null);
  const [doc, setDoc] = useState<Doc>({});
  const [title, setTitle] = useState('');
  const start = (d: any | null) => { setOpen(d ?? { id: null, version: 0 }); setDoc(d ? d.data : k === 'rubric' ? { criterion: '', checked: [] } : emptyDoc(k)); setTitle(d ? d.title : ''); };
  const save = async () => {
    try { const r: any = await toolkit({ action: 'save', id: open.id, kind: k, title: title || tool.name, data: doc, expectedVersion: open.version } as never); setOpen({ id: r.result.id, version: r.result.version }); toast('Saved.'); state.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title={tool.name} sub={tool.blurb} actions={<Link className="text-sm underline" to="/learn/toolkit">All tools</Link>} />
      <Loadable state={state}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Yours"><Button size="sm" onClick={() => start(null)}>New</Button>
            {!d.docs.length ? <Empty>Nothing saved yet.</Empty> : d.docs.map((x: any) => <button type="button" key={x.id} onClick={() => start(x)} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${open?.id === x.id ? 'border-primary' : 'border-border'}`}>{x.title}
              {k !== 'rubric' && (() => { const c = completeness(k, x.data); return <span className="block text-xs text-muted-foreground">{c.done}/{c.total} sections</span>; })()}</button>)}</Panel>
          <div className="lg:col-span-2">{!open ? <Panel><Empty>Start a new {tool.name.toLowerCase()} or open one of yours.</Empty></Panel> : (
            <Panel title={open.id ? 'Edit' : 'New'} action={<div className="flex gap-2"><Button size="sm" onClick={save}>Save</Button>
              {open.id && <Button size="sm" variant="ghost" onClick={async () => { try { await toolkit({ action: 'delete', id: open.id, kind: k } as never); setOpen(null); state.reload(); toast('Deleted.'); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Delete</Button>}</div>}>
              <Input aria-label="Title" placeholder="Title" className="mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />
              {k === 'rubric' ? <RubricTool doc={doc} setDoc={setDoc} /> : <div className="space-y-4">{TEMPLATES[k].map((s) => <section key={s.key}><p className="text-sm font-medium">{s.label} <span className="text-xs font-normal text-muted-foreground">— {s.hint}</span></p>
                <SectionEditor s={s} value={doc[s.key]} onChange={(v) => setDoc({ ...doc, [s.key]: v })} />
                {k === 'data' && s.key === 'csv' && <div className="mt-2"><DataViews csv={String(doc.csv ?? '')} /></div>}</section>)}
                {k === 'assignment' && <p className="text-xs">Use <Link className="underline" to="/learn/toolkit/rubric">Rubric self-check</Link> for each criterion. <Status value={`${completeness(k, doc).done}/${completeness(k, doc).total} sections`} /></p>}</div>}
            </Panel>)}</div>
        </div>)}</Loadable>
    </div>
  );
}
