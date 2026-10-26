import { useState } from 'react';
import { toast } from 'sonner';
import { programs } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { pathwayBlocker, CREDENTIALS, Catalog, Outcome } from '../lib/programRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE: Record<string, string> = { submitted: 'With the curriculum committee', committee_approved: 'With the registrar', published: 'Published', returned: 'Returned for changes', withdrawn: 'Withdrawn', superseded: 'Superseded' };
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';

function Pathway({ p, credits }: { p: any; credits: Record<string, number> }) {
  return (
    <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {p.terms.map((t: string[], i: number) => (
        <li key={i} className="rounded border border-border p-2 text-xs">
          <p className="font-medium">Term {i + 1} · {t.reduce((n, c) => n + (credits[c.replace(/\s+/g, '').toUpperCase()] ?? 0), 0)} cr</p>
          <ul className="mt-1 space-y-0.5">{t.map((c) => <li key={c}>{c}</li>)}</ul>
        </li>))}
    </ol>
  );
}

function Card({ p, credits, reload }: { p: any; credits: Record<string, number>; reload: () => void }) {
  const [note, setNote] = useState('');
  const act = async (step: 'approve' | 'publish' | 'return' | 'withdraw') => { try { await programs({ action: 'step', id: p.id, step, expectedVersion: p.rowVersion, note }); toast('Recorded.'); setNote(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const label = { approve: 'Approve for the committee', publish: 'Publish', return: 'Return for changes', withdraw: 'Withdraw' } as const;
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.name} · {p.code} v{p.version} · {p.credential} · {p.totalCredits} cr</span><Status value={STATE[p.state] ?? p.state} /></div>
      <p className="text-xs text-muted-foreground">{p.dept} · takes effect {p.effectiveTerm} · up to {p.termCap} credits a term · updated {fmt(p.updatedAt)}</p>
      <Pathway p={p} credits={credits} />
      <details className="mt-2"><summary className="cursor-pointer text-xs">Program outcomes and rationale</summary>
        <ol className="mt-1 list-decimal pl-5 text-xs">{p.outcomes.map((o: any, i: number) => <li key={i}>{o.text} <span className="text-muted-foreground">({o.courses.join(', ')})</span></li>)}</ol>
        <p className="mt-1 text-xs">{p.rationale}</p></details>
      {p.note && <p className="mt-1 text-xs">Reviewer note: {p.note}</p>}
      {p.steps.length > 0 && <div className="mt-2 space-y-2">
        {p.steps.includes('return') && <Input aria-label="Note to the chair" placeholder="Note to the chair (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} />}
        <div className="flex flex-wrap gap-2">{p.steps.map((s: keyof typeof label) => <Button key={s} size="sm" variant={s === 'return' || s === 'withdraw' ? 'outline' : 'default'} disabled={s === 'return' && note.trim().length < 10} onClick={() => act(s)}>{label[s]}</Button>)}</div>
      </div>}
    </li>
  );
}

function Propose({ d, reload }: { d: any; reload: () => void }) {
  const cat: Catalog = Object.fromEntries(d.catalog.map((c: any) => [c.code, { credits: c.credits, prereqs: [] }]));
  const [f, setF] = useState({ departmentId: d.departments[0]?.id ?? 0, code: '', name: '', credential: 'bachelor' as (typeof CREDENTIALS)[number], totalCredits: 120, termCap: 18, effectiveTerm: '', rationale: '' });
  const [terms, setTerms] = useState<string[][]>([[], []]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([{ text: '', courses: [] }]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const inPath = terms.flat();
  // Prerequisite order is checked by the server against the catalog; this preview checks everything else.
  const block = !/^[A-Z0-9-]{2,24}$/.test(f.code.trim().toUpperCase()) ? 'Use a program code like BA-ECON.' : f.name.trim().length < 3 ? 'Add a name.' : f.effectiveTerm.trim().length < 3 ? 'Say which term it takes effect.'
    : f.rationale.trim().length < 20 ? 'Explain the change (20+ characters).' : pathwayBlocker({ terms: terms.filter((t) => t.length), totalCredits: f.totalCredits, termCap: f.termCap, outcomes }, cat);
  const send = async () => {
    try { const r: any = await programs({ action: 'submit', requestKey: key, ...f, code: f.code.trim().toUpperCase(), terms: terms.filter((t) => t.length), outcomes }); toast(r.result?.replayed ? 'Already sent.' : 'Sent to the curriculum committee.'); setKey(crypto.randomUUID()); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs">Department<select className={sel} value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: Number(e.target.value) })}>{d.departments.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="text-xs">Program code<Input className="mt-1" placeholder="BA-ECON" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">Name<Input className="mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="text-xs">Credential<select className={sel} value={f.credential} onChange={(e) => setF({ ...f, credential: e.target.value as never })}>{CREDENTIALS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs">Total credits<Input className="mt-1" type="number" min={1} max={300} value={f.totalCredits} onChange={(e) => setF({ ...f, totalCredits: Number(e.target.value) })} /></label>
        <label className="text-xs">Credit cap per term<Input className="mt-1" type="number" min={1} max={30} value={f.termCap} onChange={(e) => setF({ ...f, termCap: Number(e.target.value) })} /></label>
        <label className="text-xs">Takes effect<Input className="mt-1" placeholder="Fall 2027" value={f.effectiveTerm} onChange={(e) => setF({ ...f, effectiveTerm: e.target.value })} /></label>
      </div>
      <fieldset><legend className="text-xs font-medium">Pathway (published courses, term by term)</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{terms.map((t, i) => (
          <div key={i} className="rounded border border-border p-2 text-xs">
            <p className="font-medium">Term {i + 1} · {t.reduce((n, c) => n + (cat[c]?.credits ?? 0), 0)} cr</p>
            <ul className="mt-1 space-y-1">{t.map((c) => <li key={c} className="flex items-center justify-between">{c}<Button size="sm" variant="ghost" aria-label={`Remove ${c} from term ${i + 1}`} onClick={() => setTerms(terms.map((x, j) => (j === i ? x.filter((y) => y !== c) : x)))}>×</Button></li>)}</ul>
            <select aria-label={`Add a course to term ${i + 1}`} className="mt-1 w-full rounded border border-border bg-background p-1" value="" onChange={(e) => e.target.value && setTerms(terms.map((x, j) => (j === i ? [...x, e.target.value] : x)))}>
              <option value="">Add course…</option>{d.catalog.filter((c: any) => !inPath.includes(c.code)).map((c: any) => <option key={c.code} value={c.code}>{c.code} ({c.credits})</option>)}</select>
          </div>))}</div>
        <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" disabled={terms.length >= 16} onClick={() => setTerms([...terms, []])}>Add term</Button>
          <Button size="sm" variant="ghost" disabled={terms.length <= 1} onClick={() => setTerms(terms.slice(0, -1))}>Remove last term</Button></div></fieldset>
      <fieldset><legend className="text-xs font-medium">Program outcomes and the courses that teach them</legend>
        {outcomes.map((o, i) => (
          <div key={i} className="mt-1 space-y-1 rounded border border-border p-2">
            <Input aria-label={`Program outcome ${i + 1}`} placeholder="Graduates will be able to…" value={o.text} onChange={(e) => setOutcomes(outcomes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <div className="flex flex-wrap gap-1 text-xs">{inPath.map((c) => (
              <label key={c} className="flex items-center gap-1 rounded border border-border px-1"><input type="checkbox" checked={o.courses.includes(c)}
                onChange={(e) => setOutcomes(outcomes.map((x, j) => (j === i ? { ...x, courses: e.target.checked ? [...x.courses, c] : x.courses.filter((y) => y !== c) } : x)))} />{c}</label>))}
              {!inPath.length && <span className="text-muted-foreground">Add courses to the pathway first.</span>}</div>
          </div>))}
        <Button size="sm" variant="outline" className="mt-1" disabled={outcomes.length >= 12} onClick={() => setOutcomes([...outcomes, { text: '', courses: [] }])}>Add outcome</Button></fieldset>
      <label className="block text-xs">Rationale<Textarea className="mt-1" value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={!!block} onClick={send}>Send to the committee</Button>{block && <span className="text-xs text-muted-foreground">{block}</span>}</div>
    </div>
  );
}

export default function Programs() {
  const s = useLoad(() => programs({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Institution" title="Programs" sub="Published programs and their term-by-term pathways. Chairs propose versions; the curriculum committee approves; a registrar publishes." />
      <Loadable state={s}>{(d: any) => {
        const credits = Object.fromEntries(d.catalog.map((c: any) => [c.code, c.credits]));
        const published = d.programs.filter((p: any) => p.state === 'published');
        const work = d.programs.filter((p: any) => p.state !== 'published' && p.state !== 'superseded');
        return (
          <div className="space-y-4">
            {work.length > 0 && <Panel title={`In review · ${work.length}`}><ul className="space-y-2">{work.map((p: any) => <Card key={p.id} p={p} credits={credits} reload={s.reload} />)}</ul></Panel>}
            <Panel title={`Published programs · ${published.length}`}>{published.length ? <ul className="space-y-2">{published.map((p: any) => <Card key={p.id} p={p} credits={credits} reload={s.reload} />)}</ul> : <Empty>No programs are published yet.</Empty>}</Panel>
            {d.departments.length > 0 && <Panel title="Propose a program or a new version"><Propose d={d} reload={s.reload} /></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
