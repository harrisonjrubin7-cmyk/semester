import { useState } from 'react';
import { toast } from 'sonner';
import { admissions } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

type Item = { id: string; applicant: string; program: string; entryTerm: string; status: string; statement: string; documents: { url: string; filename: string }[]; submittedAt: string | null; note: string };
const DECISIONS = ['Under Review', 'Admitted', 'Waitlisted', 'Declined'] as const;

export default function Admissions() {
  const s = useLoad(() => admissions({ action: 'list' }));
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const decide = async (id: string, status: typeof DECISIONS[number]) => {
    try { await admissions({ action: 'decide', id, status, note }); toast(`Recorded: ${status}. The applicant sees it in their portal.`); setNote(''); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <>
      <PageHeader eyebrow="Staff" title="Admissions" sub="Submitted applications to your institution. Every decision is audited; you can’t decide your own." />
      <Loadable state={s}>{(d) => {
        const items: Item[] = d.items; const cur = items.find((i) => i.id === sel) ?? items[0];
        return items.length ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Panel title={`Queue · ${items.length}`}><ul className="divide-y divide-border">{items.map((i) => (
              <li key={i.id}><button onClick={() => { setSel(i.id); setNote(i.note); }} className={`flex w-full justify-between py-2.5 text-left text-sm ${cur?.id === i.id ? 'border-l-[3px] border-primary pl-2 font-medium' : ''}`}>
                <span>{i.applicant}<span className="block text-xs text-muted-foreground">{i.program} · {i.entryTerm}</span></span><Status value={i.status} /></button></li>))}</ul></Panel>
            {cur && <Panel title={cur.applicant}>
              <p className="text-xs text-muted-foreground">{cur.program} · {cur.entryTerm} · Submitted {fmt(cur.submittedAt)}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{cur.statement}</p>
              <div className="mt-3 text-sm">{cur.documents.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="block underline">{f.filename}</a>)}</div>
              <Textarea className="mt-4" placeholder="Decision note shown to the applicant" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">{DECISIONS.map((x) => <Button key={x} size="sm" variant={x === 'Admitted' ? 'default' : 'outline'} onClick={() => decide(cur.id, x)}>{x}</Button>)}</div>
            </Panel>}
          </div>
        ) : <Empty>No submitted applications yet.</Empty>;
      }}</Loadable>
    </>
  );
}
