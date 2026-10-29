import { useState } from 'react';
import { toast } from 'sonner';
import { overrides, registration } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const KIND: Record<string, string> = { prerequisite: 'Prerequisite override', credit_overload: 'Credit overload', late_registration: 'Late registration' };
const sel = 'mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

function Row({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (step: string, ok: string) => {
    setBusy(true);
    try { await overrides({ action: 'step', step, id: r.id, version: r.version, note } as never); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const canEndorse = d.advisor && !r.mine && r.kind !== 'prerequisite' && r.state === 'requested';
  const canDecide = d.registrar && !r.mine && !r.endorsedByMe && ((r.kind === 'prerequisite' && r.state === 'requested') || (r.kind !== 'prerequisite' && r.state === 'endorsed'));
  return (
    <li className="rounded-md border border-border p-2 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong>{KIND[r.kind]}</strong> · {r.term}{r.section ? ` · ${r.section}` : ''}{r.credits ? ` · up to ${r.credits} credits` : ''} · {r.student} <Status value={r.state.replace('_', ' ')} /></span>
      <span className="mt-1 block">{r.reason}</span>
      {r.endorsedBy && <span className="block text-xs">Advisor {r.endorsedBy}: {r.endorseNote}</span>}
      {r.decidedBy && <span className="block text-xs">Registrar {r.decidedBy}: {r.decisionNote}{r.state === 'approved' && r.expiresAt ? ` · valid until ${fmt(r.expiresAt)}, once` : ''}{r.usedAt ? ` · used ${fmt(r.usedAt)}` : ''}</span>}
      {(canEndorse || canDecide) && <span className="mt-2 flex flex-wrap gap-2">
        <Input aria-label="Note" className="h-8 max-w-md" placeholder={canEndorse ? 'Note for the registrar (10+ characters)' : 'Reason for the decision'} value={note} onChange={(e) => setNote(e.target.value)} />
        {canEndorse && <><Button size="sm" disabled={busy} onClick={() => go('endorse', 'Endorsed and sent to the registrar.')}>Endorse</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => go('not_endorse', 'Not endorsed.')}>Do not endorse</Button></>}
        {canDecide && <><Button size="sm" disabled={busy} onClick={() => go('approve', 'Approved for 30 days, single use.')}>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => go('deny', 'Denied.')}>Deny</Button></>}
      </span>}
      {r.mine && ['requested', 'endorsed', 'approved'].includes(r.state) && <Button size="sm" variant="ghost" className="mt-1" disabled={busy} onClick={() => go('withdraw', 'Withdrawn.')}>Withdraw</Button>}
    </li>
  );
}

function Ask({ reload }: { reload: () => void }) {
  const [f, setF] = useState({ kind: 'credit_overload', term: '', credits: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await registration({ action: 'requestException', kind: f.kind, term: f.term, credits: f.kind === 'credit_overload' ? Number(f.credits) : undefined, reason: f.reason } as never); toast('Sent to your advisor.'); setF({ ...f, reason: '' }); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Panel title="Ask for a credit overload">
      <p className="mb-2 text-xs text-muted-foreground">Prerequisite overrides and late registration are asked from the section itself on Registration, so they name the right section.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">Term<Input className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Spring 2027" /></label>
        <label className="text-xs">Total credits you want<Input className="mt-1" inputMode="numeric" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} /></label>
        <label className="text-xs">Kind<select className={sel} value={f.kind} disabled><option value="credit_overload">Credit overload</option></select></label>
        <label className="text-xs sm:col-span-3">Why<Textarea className="mt-1" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      </div>
      <Button size="sm" className="mt-2" disabled={busy || f.term.trim().length < 3 || !Number(f.credits) || f.reason.trim().length < 10} onClick={send}>Send request</Button>
    </Panel>
  );
}

export default function Overrides() {
  const s = useLoad(() => overrides({ action: 'get' }) as Promise<any>);
  return (
    <>
      <PageHeader eyebrow="Registration" title="Overrides and exceptions" sub="Prerequisite overrides, credit overloads and late registration. Advisors endorse overloads and late registration; a registrar decides. An approval works once and expires in 30 days." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.requests.filter((r: any) => r.mine);
        const desk = d.requests.filter((r: any) => !r.mine);
        return (
          <div className="space-y-4">
            {!d.registrar && !d.advisor && <Ask reload={s.reload} />}
            {(d.registrar || d.advisor) && <Panel title={`Desk · ${desk.filter((r: any) => ['requested', 'endorsed'].includes(r.state)).length} waiting`}>
              {!desk.length ? <Empty>No requests.</Empty> : <ul className="space-y-2">{desk.map((r: any) => <Row key={`${r.id}:${r.version}`} r={r} d={d} reload={s.reload} />)}</ul>}</Panel>}
            {mine.length > 0 && <Panel title="Your requests"><ul className="space-y-2">{mine.map((r: any) => <Row key={`${r.id}:${r.version}`} r={r} d={d} reload={s.reload} />)}</ul></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
