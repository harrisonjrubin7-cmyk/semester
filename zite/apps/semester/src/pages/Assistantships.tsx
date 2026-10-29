import { useState } from 'react';
import { toast } from 'sonner';
import { assistantships } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared by the Student app (/progress/assistantships) and the Faculty app (/assistantships).
const sel = 'mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const usd = (m: number) => `$${(m / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const KIND: Record<string, string> = { teaching: 'Teaching assistant', research: 'Research assistant', graduate: 'Graduate assistant' };

function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const act = async (input: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await assistantships(input as never); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } finally { setBusy(false); }
  };
  return { act, busy };
}

function Post({ reload }: { reload: () => void }) {
  const { act, busy } = useAct(reload);
  const blank = { kind: 'teaching', title: '', unit: '', term: '', hours: '10', stipend: '', tuitionRemission: false, duties: '', openings: '1' };
  const [f, setF] = useState(blank);
  return (
    <Panel title="Post an assistantship">
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault();
        if (await act({ action: 'post', kind: f.kind, title: f.title, unit: f.unit, term: f.term, hours: Number(f.hours), stipendMinor: Math.round(Number(f.stipend || 0) * 100), tuitionRemission: f.tuitionRemission, duties: f.duties, openings: Number(f.openings) }, 'Posted.')) setF(blank); }}>
        <label className="text-xs">Type<select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs">Title<Input className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-xs">Department or lab<Input className="mt-1" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
        <label className="text-xs">Term<Input className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Spring 2027" /></label>
        <label className="text-xs">Hours a week (5–20)<Input className="mt-1" inputMode="numeric" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
        <label className="text-xs">Stipend for the term (USD)<Input className="mt-1" inputMode="decimal" value={f.stipend} onChange={(e) => setF({ ...f, stipend: e.target.value })} /></label>
        <label className="text-xs">Openings<Input className="mt-1" inputMode="numeric" value={f.openings} onChange={(e) => setF({ ...f, openings: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.tuitionRemission} onChange={(e) => setF({ ...f, tuitionRemission: e.target.checked })} />Tuition is remitted</label>
        <label className="text-xs sm:col-span-3">Duties<Textarea className="mt-1" rows={2} value={f.duties} onChange={(e) => setF({ ...f, duties: e.target.value })} /></label>
        <Button size="sm" className="justify-self-start" disabled={busy || f.title.trim().length < 4 || f.duties.trim().length < 20}>Post</Button>
      </form>
    </Panel>
  );
}

function AppRow({ x, reload, as }: { x: any; reload: () => void; as: 'student' | 'poster' | 'officer' }) {
  const { act, busy } = useAct(reload);
  const [note, setNote] = useState('');
  const go = (step: string, ok: string) => act({ action: 'step', step, id: x.id, version: x.version, note }, ok);
  return (
    <li className="rounded-md border border-border p-2 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong>{x.title}</strong> · {x.term} · {x.student} <Status value={x.state.replace('_', ' ')} /></span>
      {x.statement && <span className="mt-1 block text-xs">“{x.statement}”</span>}
      {x.offer && <span className="mt-1 block text-xs">Offer: {KIND[x.offer.kind]}, {x.offer.hours} h/week, {usd(Number(x.offer.stipendMinor))} for the term{x.offer.tuitionRemission ? ', tuition remitted' : ''}.</span>}
      {x.endReason && <span className="block text-xs">Ended: {x.endReason}</span>}
      <span className="mt-1 flex flex-wrap gap-2">
        {as === 'poster' && x.state === 'applied' && <><Button size="sm" disabled={busy} onClick={() => go('offer', 'Offer sent.')}>Offer</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => go('pass', 'Marked not selected.')}>Not selected</Button></>}
        {as === 'student' && x.state === 'offered' && <><Button size="sm" disabled={busy} onClick={() => go('accept', 'Accepted. The graduate office confirms it next.')}>Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => go('decline', 'Declined.')}>Decline</Button></>}
        {as === 'student' && x.state === 'applied' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => go('withdraw', 'Withdrawn.')}>Withdraw</Button>}
        {as === 'officer' && x.state === 'accepted' && !x.mineAsPoster && !x.mineAsStudent && <Button size="sm" disabled={busy} onClick={() => go('confirm', 'Confirmed.')}>Confirm appointment</Button>}
        {as === 'officer' && x.state === 'confirmed' && !x.mineAsPoster && !x.mineAsStudent && <><Input aria-label="Reason to end early" className="h-8 max-w-xs" placeholder="Reason to end early" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || note.trim().length < 10} onClick={() => go('end', 'Ended.')}>End early</Button></>}
      </span>
    </li>
  );
}

function Open({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [st, setSt] = useState<Record<number, string>>({});
  const open = d.postings.filter((p: any) => p.state === 'open' && !p.mine);
  return (
    <Panel title={`Open assistantships · ${open.length}`}>
      {!open.length ? <Empty>No open assistantships right now.</Empty> : <ul className="space-y-2">{open.map((p: any) => (
        <li key={p.id} className="rounded-md border border-border p-2 text-sm">
          <span className="flex flex-wrap items-center gap-2"><strong>{p.title}</strong> · {p.unit} <Status value={KIND[p.kind]} /></span>
          <span className="block text-xs text-muted-foreground">{p.term} · {p.hours} h/week · {usd(p.stipendMinor)} for the term{p.tuitionRemission ? ' · tuition remitted' : ''} · {p.openings} opening{p.openings === 1 ? '' : 's'} · posted by {p.poster}</span>
          <span className="mt-1 block whitespace-pre-wrap">{p.duties}</span>
          {d.student && (p.applied ? <span className="mt-1 block text-xs">You applied.</span> : <span className="mt-1 flex flex-wrap gap-2">
            <Input aria-label={`Statement for ${p.title}`} className="h-8 max-w-md" placeholder="Why you are a good fit (20+ characters)" value={st[p.id] ?? ''} onChange={(e) => setSt({ ...st, [p.id]: e.target.value })} />
            <Button size="sm" variant="outline" disabled={busy || (st[p.id] ?? '').trim().length < 20} onClick={() => act({ action: 'apply', postingId: p.id, statement: st[p.id] }, 'Application sent.')}>Apply</Button></span>)}
        </li>))}</ul>}
    </Panel>
  );
}

export default function Assistantships() {
  const s = useLoad(() => assistantships({ action: 'get' }) as Promise<any>);
  return (
    <>
      <PageHeader eyebrow="Funding" title="Graduate assistantships" sub="Teaching, research and graduate assistant positions. At most 20 hours a week per term; the graduate office confirms each appointment. No money moves here." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.applications.filter((x: any) => x.mineAsStudent);
        const asPoster = d.applications.filter((x: any) => x.mineAsPoster);
        const queue = d.applications.filter((x: any) => d.officer && ['accepted', 'confirmed'].includes(x.state) && !x.mineAsPoster && !x.mineAsStudent);
        return (
          <div className="space-y-4">
            {d.student && <Panel title="Your official funding">
              <p className="text-sm"><strong>{d.funding.appointments}</strong> confirmed appointment{d.funding.appointments === 1 ? '' : 's'} · {usd(d.funding.stipendMinor)} in stipends{d.funding.tuitionRemitted ? ' · tuition remitted' : ''}</p>
              {d.funding.byTerm.map((t: any) => <p key={t.term} className="text-xs">{t.term}: {t.hours} of 20 hours a week</p>)}
              <p className="mt-1 text-xs text-muted-foreground">Only appointments the graduate office confirmed count here. Your own funding notes are on Graduate milestones.</p></Panel>}
            {d.student && mine.length > 0 && <Panel title="Your applications"><ul className="space-y-2">{mine.map((x: any) => <AppRow key={`${x.id}:${x.version}`} x={x} reload={s.reload} as="student" />)}</ul></Panel>}
            <Open d={d} reload={s.reload} />
            {d.staff && <Post reload={s.reload} />}
            {asPoster.length > 0 && <Panel title="Applicants to your postings"><ul className="space-y-2">{asPoster.map((x: any) => <AppRow key={`${x.id}:${x.version}`} x={x} reload={s.reload} as="poster" />)}</ul>
              <ul className="mt-2 text-xs">{d.postings.filter((p: any) => p.mine && p.state === 'open').map((p: any) => <li key={p.id}>{p.title} · {p.term} <Button size="sm" variant="ghost" onClick={async () => { try { await assistantships({ action: 'close', postingId: p.id } as never); toast('Closed.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Close posting</Button></li>)}</ul></Panel>}
            {d.officer && <Panel title={`Graduate office · ${queue.filter((x: any) => x.state === 'accepted').length} to confirm`}>{!queue.length ? <Empty>Nothing waiting.</Empty> : <ul className="space-y-2">{queue.map((x: any) => <AppRow key={`${x.id}:${x.version}`} x={x} reload={s.reload} as="officer" />)}</ul>}</Panel>}
            {d.isAdmin && <Officers d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}

function Officers({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [email, setEmail] = useState('');
  return (
    <Panel title="Graduate-office officers">
      <p className="text-sm">{d.officers.length ? d.officers.join(', ') : 'None appointed yet. Appointments cannot be confirmed until one is.'}</p>
      <span className="mt-2 flex flex-wrap gap-2"><Input aria-label="Email" className="h-8 max-w-xs" placeholder="Member email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={busy} onClick={() => act({ action: 'officer', email, on: true }, 'Appointed.')}>Appoint</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: 'officer', email, on: false }, 'Removed.')}>Remove</Button></span>
      <p className="mt-1 text-xs text-muted-foreground">Last updated {fmt(new Date().toISOString())}.</p>
    </Panel>
  );
}
