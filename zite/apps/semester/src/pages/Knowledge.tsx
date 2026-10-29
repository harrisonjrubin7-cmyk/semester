import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { officeService } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Status, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';
import { searchArticles } from '../lib/officeRules';

type Art = { id: number; officeId: number; office: string; title: string; body: string; state: string; version: number; mine: boolean; author: string; reviewNote: string; seenHash: string; supersedes: number | null; publishedAt: string | null; staff: boolean; lead: boolean };
type Office = { id: number; name: string; staff: boolean };
type Data = { articles: Art[]; offices: Office[] };

function StaffArticle({ a, reload }: { a: Art; reload: () => Promise<void> }) {
  const [t, setT] = useState(a.title); const [b, setB] = useState(a.body); const [note, setNote] = useState('');
  const step = async (s: 'edit' | 'submit' | 'publish' | 'return' | 'revise' | 'retire') => {
    try { await officeService({ action: 'article', step: s, id: a.id, expectedVersion: a.version, title: t, body: b, seenHash: a.seenHash, note }); toast.success('Saved'); setNote(''); await reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const editable = a.state === 'draft' && a.mine;
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex items-start justify-between gap-2"><p className="font-medium">{a.title}</p><Status value={a.state.replace('_', ' ')} /></div>
      <p className="text-xs text-muted-foreground">{a.office} · by {a.mine ? 'you' : a.author}{a.supersedes ? ` · revision of #${a.supersedes}` : ''}</p>
      {a.reviewNote && a.state === 'draft' && <p className="mt-1 text-xs">Returned: {a.reviewNote}</p>}
      {editable ? <div className="mt-2 space-y-2">
        <Input aria-label="Title" value={t} onChange={(e) => setT(e.target.value)} /><Textarea aria-label="Answer" rows={6} value={b} onChange={(e) => setB(e.target.value)} />
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => step('edit')}>Save draft</Button><Button size="sm" disabled={t !== a.title || b !== a.body} onClick={() => step('submit')}>Send for review</Button></div>
        {(t !== a.title || b !== a.body) && <p className="text-xs text-muted-foreground">Save first, then send for review.</p>}
      </div> : <p className="mt-2 whitespace-pre-wrap">{a.body}</p>}
      {a.state === 'in_review' && !a.mine && <div className="mt-2 space-y-2">
        <Label htmlFor={`rv-${a.id}`}>Review note</Label><Input id={`rv-${a.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2"><Button size="sm" onClick={() => step('publish')}>Publish this exact text</Button><Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => step('return')}>Return to author</Button></div>
      </div>}
      {a.state === 'in_review' && a.mine && <p className="mt-2 text-xs text-muted-foreground">Waiting for another staff member of {a.office} to review.</p>}
      {a.state === 'published' && <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => step('revise')}>Start a revision</Button>
        {a.lead && <><Input aria-label="Reason to retire" className="h-8 w-48" placeholder="Reason to retire" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => step('retire')}>Retire</Button></>}
      </div>}
    </div>
  );
}

export default function Knowledge() {
  const state = useLoad(() => officeService({ action: 'get' }) as Promise<Data>);
  const [q, setQ] = useState(''); const [open, setOpen] = useState<number | null>(null);
  const [n, setN] = useState({ officeId: '', title: '', body: '' });
  return (
    <>
      <PageHeader eyebrow="Help" title="Answers from campus offices" sub="Reviewed answers written by the office that owns each topic." actions={<Link to="/help/offices" className="text-sm underline">Ask an office</Link>} />
      <Loadable state={state}>{(d: Data) => {
        const live = searchArticles(d.articles.filter((a) => a.state === 'published'), q);
        const mineOffices = d.offices.filter((o) => o.staff);
        const work = d.articles.filter((a) => a.staff && a.state !== 'published' && a.state !== 'retired');
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel>
                <Label htmlFor="kb-q">Search</Label><Input id="kb-q" className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. enrollment letter" />
                <div className="mt-3">{live.length === 0 ? <Empty>{q ? 'No answer matches. Ask the office directly.' : 'No answers published yet.'}</Empty> : live.map((a) => (
                  <div key={a.id} className="border-b border-border py-2 last:border-0">
                    <button className="w-full text-left font-sans text-sm font-medium" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>{a.title}</button>
                    <p className="text-xs text-muted-foreground">{a.office} · reviewed {fmtDay(a.publishedAt)}</p>
                    {open === a.id && <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>}
                    {open === a.id && a.staff && <StaffArticle a={a} reload={state.reload} />}
                  </div>))}</div>
              </Panel>
              {mineOffices.length > 0 && <Panel title="Drafts and reviews for your offices">{work.length === 0 ? <Empty>✓ Nothing in progress.</Empty> : work.map((a) => <StaffArticle key={a.id} a={a} reload={state.reload} />)}</Panel>}
            </div>
            {mineOffices.length > 0 && <div><Panel title="Write an answer">
              <Label htmlFor="kb-o">Office</Label><Select value={n.officeId} onValueChange={(v) => setN({ ...n, officeId: v })}><SelectTrigger id="kb-o" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{mineOffices.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent></Select>
              <Label htmlFor="kb-t" className="mt-3 block">Question</Label><Input id="kb-t" className="mt-1" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} />
              <Label htmlFor="kb-b" className="mt-3 block">Answer</Label><Textarea id="kb-b" className="mt-1" rows={6} value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} />
              <Button className="mt-3 w-full" disabled={!n.officeId || n.title.trim().length < 5 || n.body.trim().length < 40} onClick={async () => { try { await officeService({ action: 'article', step: 'draft', id: null, expectedVersion: null, officeId: Number(n.officeId), title: n.title, body: n.body }); toast.success('Draft saved'); setN({ ...n, title: '', body: '' }); await state.reload(); } catch (e) { toast.error(errMsg(e)); } }}>Save draft</Button>
              <p className="mt-2 text-xs text-muted-foreground">Another staff member of the office reviews it before students see it.</p>
            </Panel></div>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
