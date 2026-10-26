import { useState } from 'react';
import { toast } from 'sonner';
import { studyAbroad } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { needsReason, agreementBlocker, reconcileBlocker, Step, Line } from '../lib/abroadRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const words = (s: string) => s.replace(/_/g, ' ');
const STATE: Record<string, string> = {
  submitted: 'Submitted — waiting for review', approved: 'Approved — learning agreement needed', agreed: 'Agreement approved — get travel-ready', ready: 'Ready to depart',
  abroad: 'Abroad', returned: 'Returned — credit being reconciled', reconciled: 'Credit reconciled', declined: 'Declined', withdrawn: 'Withdrawn', cancelled: 'Cancelled',
};
const LABEL: Record<Step, string> = {
  approve: 'Approve (takes a place)', decline: 'Decline', propose: 'Send learning agreement', approve_agreement: 'Approve this agreement', return_agreement: 'Send agreement back',
  confirm_ready: 'Confirm travel readiness', depart: 'Record departure', come_back: 'Record return', reconcile: 'Record returned credit', withdraw: 'Withdraw', cancel: 'Cancel application',
};
const blank: Line = { hostCourse: '', hostTitle: '', homeCode: '', credits: 3 };

function Agreement({ x, reload }: { x: any; reload: () => void }) {
  const [lines, setLines] = useState<Line[]>(x.lines.length ? x.lines : [{ ...blank }]);
  const set = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: k === 'credits' ? Number(v) : v } : l)));
  const block = agreementBlocker(lines);
  const send = async () => { try { await studyAbroad({ action: 'step', id: x.id, step: 'propose', expectedVersion: x.version, lines }); toast('Sent to your advisor.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2 text-xs">
      <p className="font-medium">Learning agreement — which host courses count as which home courses</p>
      {lines.map((l, i) => (
        <div key={i} className="grid gap-1 sm:grid-cols-[1fr_1.5fr_1fr_5rem_auto]">
          <Input aria-label="Host course" placeholder="Host course" value={l.hostCourse} onChange={(e) => set(i, 'hostCourse', e.target.value)} />
          <Input aria-label="Host title" placeholder="Title" value={l.hostTitle} onChange={(e) => set(i, 'hostTitle', e.target.value)} />
          <Input aria-label="Counts as" placeholder="Counts as (e.g. ECON 2100)" value={l.homeCode} onChange={(e) => set(i, 'homeCode', e.target.value)} />
          <Input aria-label="Credits" type="number" min={0.5} max={12} step={0.5} value={l.credits} onChange={(e) => set(i, 'credits', e.target.value)} />
          <Button size="sm" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={lines.length >= 12} onClick={() => setLines([...lines, { ...blank }])}>Add course</Button>
        <Button size="sm" disabled={!!block} onClick={send}>{LABEL.propose}</Button>
        {block && <span className="text-muted-foreground">{block}</span>}
      </div>
      {x.state === 'agreed' && <p className="text-muted-foreground">Changing an approved agreement sends it back to your advisor.</p>}
    </div>
  );
}

function Reconcile({ x, reload }: { x: any; reload: () => void }) {
  const [res, setRes] = useState(x.lines.map((l: Line) => ({ credits: l.credits, grade: '' })));
  const block = reconcileBlocker(x.lines, res);
  const send = async () => { try { await studyAbroad({ action: 'step', id: x.id, step: 'reconcile', expectedVersion: x.version, results: res }); toast('Credit recorded for the registrar.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2 text-xs">
      {x.lines.map((l: Line, i: number) => (
        <div key={i} className="grid items-center gap-1 sm:grid-cols-[2fr_6rem_6rem]">
          <span>{l.hostCourse} → {l.homeCode} (agreed {l.credits})</span>
          <Input aria-label={`Host grade line ${i + 1}`} placeholder="Grade" value={res[i].grade} onChange={(e) => setRes(res.map((r: any, j: number) => (j === i ? { ...r, grade: e.target.value } : r)))} />
          <Input aria-label={`Credit granted line ${i + 1}`} type="number" min={0} max={l.credits} step={0.5} value={res[i].credits} onChange={(e) => setRes(res.map((r: any, j: number) => (j === i ? { ...r, credits: Number(e.target.value) } : r)))} />
        </div>
      ))}
      <div className="flex items-center gap-2"><Button size="sm" disabled={!!block} onClick={send}>{LABEL.reconcile}</Button>{block && <span className="text-muted-foreground">{block}</span>}</div>
      <p className="text-muted-foreground">This records the outcome for the registrar. It does not post to the transcript.</p>
    </div>
  );
}

function Simple({ x, step, reload }: { x: any; step: Step; reload: () => void }) {
  const [text, setText] = useState('');
  const need = needsReason(step) ? 10 : 0;
  const go = async () => {
    try { await studyAbroad({ action: 'step', id: x.id, step, expectedVersion: x.version, text: step === 'approve_agreement' ? x.linesHash : text }); toast('Recorded.'); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {need > 0 && <Input aria-label="Reason" className="max-w-md" placeholder="Reason (the student will see it)" value={text} onChange={(e) => setText(e.target.value)} />}
      <Button size="sm" variant={['decline', 'withdraw', 'cancel', 'return_agreement'].includes(step) ? 'outline' : 'default'} disabled={text.trim().length < need} onClick={go}>{LABEL[step]}</Button>
    </div>
  );
}

function AppCard({ x, checklist, reload }: { x: any; checklist: string[]; reload: () => void }) {
  const tick = async (item: string, done: boolean) => { try { await studyAbroad({ action: 'check', id: x.id, item: item as never, done }); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const steps: Step[] = x.steps.filter((s: Step) => !(s === 'approve_agreement' && !x.lines.length));
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{x.mine ? 'My application' : x.student} · {x.program} · {x.term}</span><Status value={STATE[x.state] ?? x.state} /></div>
      <details className="mt-1"><summary className="cursor-pointer text-xs">Statement of purpose</summary><p className="mt-1 whitespace-pre-wrap text-xs">{x.statement}</p></details>
      {x.reason && <p className="mt-1 text-xs">Reason: {x.reason}</p>}
      {x.agreementNote && <p className="mt-1 text-xs">Advisor’s note on the agreement: {x.agreementNote}</p>}
      {x.lines.length > 0 && (
        <table className="mt-2 w-full text-xs"><caption className="text-left font-medium">Learning agreement {x.agreementApproved ? '· approved' : '· waiting for approval'}</caption>
          <thead><tr className="text-left text-muted-foreground"><th>Host course</th><th>Counts as</th><th>Credits</th>{x.results && <><th>Grade</th><th>Granted</th></>}</tr></thead>
          <tbody>{x.lines.map((l: any, i: number) => <tr key={i}><td>{l.hostCourse} {l.hostTitle}</td><td>{l.homeCode}</td><td>{l.credits}</td>{x.results && <><td>{x.results[i]?.grade}</td><td>{x.results[i]?.credits}</td></>}</tr>)}</tbody></table>
      )}
      {['approved', 'agreed', 'ready'].includes(x.state) && (
        <fieldset className="mt-2 text-xs"><legend className="font-medium">Travel readiness</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">{checklist.map((k) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!x.checklist[k]} disabled={!x.mine || x.state === 'ready'} onChange={(e) => tick(k, e.target.checked)} />{x.checklist[k] ? '✓' : '○'} {words(k)}</label>))}</div>
        </fieldset>
      )}
      {x.mine && x.steps.includes('propose') && <Agreement x={x} reload={reload} />}
      {steps.filter((s) => s !== 'propose' && s !== 'reconcile').map((s) => <Simple key={s} x={x} step={s} reload={reload} />)}
      {x.steps.includes('reconcile') && <Reconcile x={x} reload={reload} />}
      <p className="mt-1 text-xs text-muted-foreground">Updated {fmt(x.updatedAt)}</p>
    </li>
  );
}

function Apply({ p, reload }: { p: any; reload: () => void }) {
  const [text, setText] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const go = async () => { try { const r: any = await studyAbroad({ action: 'apply', requestKey: key, programId: p.id, statement: text }); toast(r.result?.replayed ? 'Already sent.' : 'Application sent.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Statement of purpose" placeholder="Why this program, and how it fits your degree (50+ characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" disabled={text.trim().length < 50} onClick={go}>Apply</Button>
    </div>
  );
}

function ProgramForm({ p, reload, done }: { p?: any; reload: () => void; done?: () => void }) {
  const [f, setF] = useState({ name: p?.name ?? '', host: p?.host ?? '', country: p?.country ?? '', term: p?.term ?? '', capacity: p?.capacity ?? 10, deadline: p?.deadline ?? '', description: p?.description ?? '', active: p?.active ?? true });
  const save = async () => { try { await studyAbroad({ action: 'program', id: p?.id ?? null, ...f }); toast('Program saved.'); reload(); done?.(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const field = (k: 'name' | 'host' | 'country' | 'term', label: string) => <label className="text-xs">{label}<Input className="mt-1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {field('name', 'Program')}{field('host', 'Host institution')}{field('country', 'Country')}{field('term', 'Term')}
      <label className="text-xs">Places<Input className="mt-1" type="number" min={1} max={500} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></label>
      <label className="text-xs">Application deadline<Input className="mt-1" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label>
      <label className="text-xs sm:col-span-3">Description<Textarea className="mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Open for applications</label>
      <div className="sm:col-span-3"><Button size="sm" disabled={f.name.trim().length < 3 || f.host.trim().length < 2 || f.country.trim().length < 2 || f.term.trim().length < 2 || !f.deadline} onClick={save}>Save program</Button></div>
    </div>
  );
}

function Programs({ d, reload }: { d: any; reload: () => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const live = d.applications.find((x: any) => x.mine && ['submitted', 'approved', 'agreed', 'ready', 'abroad', 'returned'].includes(x.state));
  return (
    <Panel title={`Programs · ${d.programs.length}`}>
      {d.programs.length ? <ul className="space-y-2">{d.programs.map((p: any) => (
        <li key={p.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.name} · {p.host}, {p.country} · {p.term}</span>
            <Status value={p.open ? `Open until ${p.deadline}` : 'Closed'} /></div>
          {p.description && <p className="mt-1 whitespace-pre-wrap text-xs">{p.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{p.held}/{p.capacity} places taken{d.isAdvisor ? ` · ${p.waiting} waiting for review` : ''}</p>
          {!d.isAdvisor && p.open && !live && <Apply p={p} reload={reload} />}
          {d.isAdvisor && (editing === p.id ? <ProgramForm p={p} reload={reload} done={() => setEditing(null)} /> : <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditing(p.id)}>Edit</Button>)}
        </li>))}</ul> : <Empty>No programs are open right now.</Empty>}
      {live && !d.isAdvisor && <p className="mt-2 text-xs text-muted-foreground">You have a live application for {live.term}; withdraw it to apply elsewhere.</p>}
      {d.isAdvisor && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Add a program</summary><div className="mt-2"><ProgramForm reload={reload} /></div></details>}
    </Panel>
  );
}

function Access({ d, reload }: { d: any; reload: () => void }) {
  const [email, setEmail] = useState('');
  const set = async (on: boolean) => { try { await studyAbroad({ action: 'setAdvisor', email, on }); toast('Saved.'); setEmail(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Study-abroad advisors">
      {d.advisors.length ? <ul className="mb-2 space-y-1 text-sm">{d.advisors.map((s: any, i: number) => <li key={i}>{s.name}</li>)}</ul> : <Empty>No advisors yet.</Empty>}
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={!email.includes('@')} onClick={() => set(true)}>Add</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => set(false)}>Remove</Button></div>
    </Panel>
  );
}

export default function StudyAbroad() {
  const s = useLoad(() => studyAbroad({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Study abroad" title="Study abroad" sub="Find a program, agree which courses count before you go, get travel-ready, and have your credit reconciled when you return." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.applications.filter((x: any) => x.mine);
        const queue = d.applications.filter((x: any) => !x.mine);
        return (
          <div className="space-y-4">
            {mine.length > 0 && <Panel title="My applications"><ul className="space-y-2">{mine.map((x: any) => <AppCard key={x.id} x={x} checklist={d.checklist} reload={s.reload} />)}</ul></Panel>}
            <Programs d={d} reload={s.reload} />
            {d.isAdvisor && <Panel title={`Applications · ${queue.filter((x: any) => !['reconciled', 'declined', 'withdrawn', 'cancelled'].includes(x.state)).length} active`}>
              {queue.length ? <ul className="space-y-2">{queue.map((x: any) => <AppCard key={x.id} x={x} checklist={d.checklist} reload={s.reload} />)}</ul> : <Empty>No applications yet.</Empty>}</Panel>}
            {d.isAdmin && <Access d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
