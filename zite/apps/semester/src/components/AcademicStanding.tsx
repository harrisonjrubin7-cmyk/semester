import { useState } from 'react';
import { toast } from 'sonner';
import { academicStanding as api } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, useLoad, Status, fmt, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const denied = (e: string | null) => !!e && /access|role|allow|registrar|Only/i.test(e);
const mark = (s: string) => (s === 'Good standing' ? '✓ ' : '! ');

/** Registrar: calculated standing next to the recorded decision; record decisions with a notice; decide appeals. */
export function RegistrarStanding() {
  const s = useLoad(() => api({ action: 'review' } as never) as Promise<any>, []);
  const [open, setOpen] = useState<{ key: string; decision: string; rationale: string; notice: string } | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const run = async (body: object, done: (r: any) => string) => { setBusy(true); try { const r: any = await api(body as never); toast(done(r)); setOpen(null); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); } };
  if (s.error) return denied(s.error) ? null : <Panel title="Academic standing"><p className="text-sm">! {s.error}</p></Panel>;
  if (!s.data) return null;
  const d: any = s.data;
  const rows = d.rows.filter((r: any) => all || r.standing !== 'Good standing' || r.decision);
  return (
    <Panel title="Academic standing" action={<Button size="sm" variant="ghost" onClick={() => setAll(!all)}>{all ? 'Only those needing review' : 'Show everyone'}</Button>}>
      <p className="text-xs text-muted-foreground">The calculation comes from official grades and the grading policy. It is not a decision: you record the decision, a reason, and the notice the student reads. {d.holdsLive ? 'A suspension places a registration hold.' : `Records are in ${d.mode} mode: a suspension is recorded, but no registration hold is placed.`}</p>
      {d.appeals.length > 0 && <div className="mt-3"><p className="text-sm font-medium">Open appeals ({d.appeals.length})</p>
        <ul className="mt-1 space-y-2">{d.appeals.map((p: any) => (
          <li key={p.id} className="rounded-md border border-border p-2 text-sm"><p className="font-medium">{p.student} · {p.term} · {p.decision}</p>
            <p className="text-xs text-muted-foreground">Submitted {fmt(p.submittedAt)} · decision by {p.decidedBy}</p><p className="mt-1 whitespace-pre-wrap text-xs">{p.statement}</p>
            {p.mineToDecide ? <div className="mt-2 space-y-2"><Input aria-label="Reason for the outcome" placeholder="Reason for the outcome (the student reads it)" value={note[p.id] ?? ''} onChange={(e) => setNote({ ...note, [p.id]: e.target.value })} />
              <div className="flex gap-2"><Button size="sm" disabled={busy || (note[p.id] ?? '').trim().length < 10} onClick={() => run({ action: 'decideAppeal', appealId: p.id, grant: true, note: note[p.id] }, (r) => `Appeal granted${r.holdReleased ? '; registration hold released' : ''}.`)}>Grant</Button>
                <Button size="sm" variant="outline" disabled={busy || (note[p.id] ?? '').trim().length < 10} onClick={() => run({ action: 'decideAppeal', appealId: p.id, grant: false, note: note[p.id] }, () => 'Appeal denied.')}>Deny</Button></div></div>
              : <p className="mt-1 text-xs">You made this decision; another registrar decides the appeal.</p>}
          </li>))}</ul></div>}
      <p className="mt-3 text-sm font-medium">Students</p>
      {!rows.length ? <Empty>{d.rows.length ? 'Everyone is in good standing with nothing recorded.' : 'No official grades yet.'}</Empty> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Calculated and recorded academic standing</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Student</th><th className="p-1">Term</th><th className="p-1">Term / cumulative GPA</th><th className="p-1">Calculated</th><th className="p-1">Recorded decision</th><th className="p-1"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map((r: any) => { const key = `${r.studentId}:${r.term}`; return [
            <tr key={key} className="border-t border-border align-top"><td className="p-1">{r.student}</td><td className="p-1">{r.term}</td><td className="p-1 tabular-nums">{r.gpa ?? '—'} / {r.cumulativeGpa ?? '—'}{r.honors && ' ★'}</td>
              <td className="p-1">{mark(r.standing)}{r.standing}</td>
              <td className="p-1">{r.decision ? <>{r.decision.decision} <span className="block text-xs text-muted-foreground">v{r.decision.version} · {r.decision.by} · {fmt(r.decision.at)}{r.decision.hold ? ' · hold placed' : ''}</span></> : <span className="text-xs text-muted-foreground">None yet</span>}</td>
              <td className="p-1"><Button size="sm" variant="outline" onClick={() => setOpen(open?.key === key ? null : { key, decision: r.decision?.decision ?? (r.standing === 'Refer to standing committee' ? 'Academic probation' : r.standing), rationale: '', notice: '' })}>{r.decision ? 'Change' : 'Record'}</Button></td></tr>,
            open?.key === key && <tr key={key + ':f'}><td colSpan={6} className="p-2"><div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <label className="text-xs">Decision<select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm" value={open.decision} onChange={(e) => setOpen({ ...open, decision: e.target.value })}>
                {d.decisions.map((x: string) => <option key={x} value={x} disabled={x === 'Academic suspension' && !['Academic probation', 'Refer to standing committee'].includes(r.standing)}>{x}</option>)}</select></label>
              <label className="text-xs">Reason (kept with the record)<Input value={open.rationale} onChange={(e) => setOpen({ ...open, rationale: e.target.value })} /></label>
              <label className="text-xs sm:col-span-2">Notice the student reads<Textarea rows={3} value={open.notice} onChange={(e) => setOpen({ ...open, notice: e.target.value })} placeholder="What this means, what happens next, and how to appeal" /></label>
              <div className="sm:col-span-2"><Button size="sm" disabled={busy || open.rationale.trim().length < 10 || open.notice.trim().length < 10} onClick={() => run({ action: 'record', studentId: r.studentId, term: r.term, decision: open.decision, rationale: open.rationale, notice: open.notice, expectedVersion: r.decision?.version ?? 0 },
                (x) => `Recorded${x.hold === 'placed' ? '; registration hold placed' : x.hold ? '; hold not placed (sandbox mode)' : ''}.`)}>Record decision</Button></div>
            </div></td></tr>]; })}</tbody></table></div>)}
    </Panel>
  );
}

/** Student: standing decisions on my record, their notices, and an appeal within the window. */
export function MyStanding() {
  const s = useLoad(() => api({ action: 'mine' } as never) as Promise<any>, []);
  const [text, setText] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  if (s.error || !s.data || !s.data.decisions.length) return null;
  const d: any = s.data;
  const appeal = async (id: number) => { setBusy(true); try { await api({ action: 'appeal', decisionId: id, statement: text[id] } as never); toast('Appeal submitted. A registrar other than the one who decided will review it.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); } };
  return (
    <Panel title="Your academic standing">
      <ul className="space-y-2">{d.decisions.filter((x: any) => x.current).map((x: any) => (
        <li key={x.id} className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{x.term}: {mark(x.decision)}{x.decision}{x.viaAppeal && <span className="text-xs text-muted-foreground"> (after appeal)</span>}</p>
          <p className="text-xs text-muted-foreground">Recorded {fmt(x.decidedAt)}</p>
          <p className="mt-1 whitespace-pre-wrap">{x.notice}</p>
          {x.appeal && <p className="mt-2 text-xs"><Status value={x.appeal.status === 'Open' ? 'Appeal under review' : `Appeal ${x.appeal.status.toLowerCase()}`} />{x.appeal.outcome && ` ${x.appeal.outcome}`}</p>}
          {x.appealable && <div className="mt-2 space-y-2">
            <label className="text-xs" htmlFor={`ap-${x.id}`}>Appeal (by {fmt(x.appealCloses)})</label>
            <Textarea id={`ap-${x.id}`} rows={3} value={text[x.id] ?? ''} onChange={(e) => setText({ ...text, [x.id]: e.target.value })} placeholder="What happened, and what you would like the registrar to consider" />
            <Button size="sm" disabled={busy || (text[x.id] ?? '').trim().length < 20} onClick={() => appeal(x.id)}>Submit appeal</Button></div>}
        </li>))}</ul>
    </Panel>
  );
}
