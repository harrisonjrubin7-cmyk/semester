import { useState } from 'react';
import { toast } from 'sonner';
import { customerSuccess } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block h-9 w-full rounded-[3px] border border-border bg-background px-2 text-sm';

function useCall(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const call = async (input: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await customerSuccess(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };
  return { call, busy };
}

function Adoption({ a }: { a: any }) {
  return (
    <div className="space-y-2 text-sm">
      <p><strong>{a.activeMembers}</strong> active members · {a.pending} pending</p>
      <ul className="flex flex-wrap gap-2">{a.byRole.map((r: any) => <li key={r.role}><Chip value={`${r.role}: ${r.members}`} /></li>)}</ul>
      <p>Modules on: {a.modulesOn.length ? a.modulesOn.join(', ') : 'none recorded'}</p>
      {a.usage.length > 0 && <table className="w-full text-left text-sm"><thead><tr><th>Module</th><th>Last 30 days</th><th>30 days before</th><th>Trend</th></tr></thead>
        <tbody>{a.usage.map((u: any) => <tr key={u.module}><td>{u.module}</td><td>{u.last30}</td><td>{u.prior30}</td><td>{u.trend}</td></tr>)}</tbody></table>}
      <p className="text-xs text-muted-foreground">Counts only. Groups of 1 to 4 people are shown as "fewer than 5". Usage is metered calls, not people.</p>
    </div>
  );
}

function Link({ d, reload }: { d: any; reload: () => void }) {
  const { call, busy } = useCall(reload);
  const s = d.selected;
  const [tenant, setTenant] = useState(s.link?.tenantId ?? '');
  const [note, setNote] = useState('');
  const go = (step: string, ok: string) => call({ action: 'link', step, accountId: s.id, tenantId: step === 'unlink' ? null : (step === 'confirm' ? s.link.tenantId : tenant || null), note }, ok);
  return (
    <Panel title="Institution link">
      {s.link ? <p className="text-sm">{s.link.state === 'confirmed' ? `Linked to ${s.link.tenant}, confirmed by ${s.link.confirmedBy}.` : `Proposed link to ${s.link.tenant} by ${s.link.proposedBy}, waiting for a platform admin.`}{s.link.note ? ` Basis: ${s.link.note}` : ''}</p>
        : <p className="text-sm">Not linked. Adoption figures appear once a platform admin confirms which institution this account bought for.</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_2fr_auto_auto]">
        {d.cs && s.link?.state !== 'confirmed' && <label className="text-xs">Institution<select className={sel} value={tenant} onChange={(e) => setTenant(e.target.value)}><option value="">Choose…</option>
          {d.institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
        <label className="text-xs">Basis or reason<Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. order form names this campus" /></label>
        {d.cs && s.link?.state !== 'confirmed' && <Button size="sm" className="self-end" disabled={busy || !tenant} onClick={() => go('propose', 'Link proposed.')}>Propose link</Button>}
        {d.pa && s.link?.state === 'proposed' && s.link.proposedById !== d.me && <Button size="sm" className="self-end" disabled={busy} onClick={() => go('confirm', 'Link confirmed.')}>Confirm link to {s.link.tenant}</Button>}
        {s.link && <Button size="sm" variant="outline" className="self-end" disabled={busy || note.trim().length < 5} onClick={() => go('unlink', 'Link removed.')}>Remove link</Button>}
      </div>
    </Panel>
  );
}

function Goals({ d, reload }: { d: any; reload: () => void }) {
  const { call, busy } = useCall(reload);
  const s = d.selected;
  const blank = { goal: '', measure: '', target: '', dueOn: '' };
  const [f, setF] = useState(blank);
  const [ev, setEv] = useState<Record<number, string>>({});
  const close = (g: any, step: string) => call({ action: 'goal', step, accountId: s.id, goalId: g.id, version: g.version, evidence: ev[g.id] ?? '' }, `Goal marked ${step}.`);
  return (
    <Panel title={`Success plan · ${s.goals.filter((g: any) => g.state === 'active').length} active goals`}>
      {!s.goals.length && <p className="text-sm text-muted-foreground">No goals yet.</p>}
      <ul className="space-y-2 text-sm">{s.goals.map((g: any) => (
        <li key={g.id} className="rounded-[3px] border border-border p-2">
          <span className="flex flex-wrap items-center gap-2"><strong>{g.goal}</strong> <Chip value={g.state} /></span>
          <span className="block text-xs text-muted-foreground">Measure: {g.measure} · target {g.target} · due {g.dueOn} · owner {g.owner}</span>
          {g.evidence && <span className="block text-xs">Evidence: {g.evidence}</span>}
          {d.cs && g.state === 'active' && <span className="mt-1 flex flex-wrap gap-2"><Input aria-label="Evidence or reason" className="h-8 max-w-sm" placeholder="Evidence (achieved/missed) or reason (dropped)" value={ev[g.id] ?? ''} onChange={(e) => setEv({ ...ev, [g.id]: e.target.value })} />
            <Button size="sm" disabled={busy} onClick={() => close(g, 'achieved')}>Achieved</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => close(g, 'missed')}>Missed</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => close(g, 'dropped')}>Drop</Button></span>}
        </li>))}</ul>
      {d.cs && <form className="mt-3 grid gap-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (await call({ action: 'goal', step: 'add', accountId: s.id, goalId: null, version: null, ...f }, 'Goal added.')) setF(blank); }}>
        <label className="text-xs">Goal<Input className="mt-1" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></label>
        <label className="text-xs">How it is measured<Input className="mt-1" value={f.measure} onChange={(e) => setF({ ...f, measure: e.target.value })} /></label>
        <label className="text-xs">Target<Input className="mt-1" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></label>
        <label className="text-xs">Due<Input type="date" className="mt-1" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
        <Button size="sm" className="self-end" disabled={busy || f.goal.trim().length < 5 || !f.dueOn}>Add goal</Button>
      </form>}
    </Panel>
  );
}

function Qbr({ q, d, reload }: { q: any; d: any; reload: () => void }) {
  const { call, busy } = useCall(reload);
  const s = d.selected;
  const [f, setF] = useState({ notes: '', attendees: '', title: '', owner: '', dueOn: '' });
  const step = (st: string, extra: Record<string, unknown>, ok: string) => call({ action: 'qbr', step: st, accountId: s.id, qbrId: q.id, version: q.version, ...extra }, ok);
  return (
    <li className="rounded-[3px] border border-border p-2 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong>Review on {q.scheduledFor}</strong> <Chip value={q.state} /> <span className="text-xs text-muted-foreground">owner {q.owner}</span></span>
      {q.snapshot && <details className="mt-1"><summary className="cursor-pointer text-xs">Frozen figures (taken {fmt(q.snapshot.takenAt)})</summary>
        <div className="mt-1">{q.snapshot.adoption ? <Adoption a={q.snapshot.adoption} /> : <p className="text-xs">No adoption figures: the account was not linked when this was prepared.</p>}
          <ul className="mt-1 list-disc pl-5 text-xs">{q.snapshot.goals.map((g: any, i: number) => <li key={i}>{g.goal}: {g.state} (target {g.target})</li>)}</ul></div></details>}
      {q.notes && <p className="mt-1 whitespace-pre-wrap">{q.notes}</p>}{q.attendees && <p className="text-xs">Attendees: {q.attendees}</p>}
      {q.actions.length > 0 && <ul className="mt-1 space-y-1">{q.actions.map((a: any) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2"><span aria-hidden>{a.done ? '✓' : '○'}</span><span className="sr-only">{a.done ? 'Done' : 'Open'}</span>{a.title} · {a.owner} · due {a.dueOn}
          {d.cs && !a.done && <Button size="sm" variant="ghost" disabled={busy} onClick={() => step('done', { actionId: a.id }, 'Marked done.')}>Done</Button>}</li>))}</ul>}
      {d.cs && q.state === 'planned' && <span className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => step('prepare', {}, 'Prepared: figures frozen.')}>Prepare (freeze figures)</Button>
        <Input aria-label="Reason to cancel" className="h-8 max-w-xs" placeholder="Reason to cancel" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <Button size="sm" variant="outline" disabled={busy || f.notes.trim().length < 5} onClick={() => step('cancel', { notes: f.notes }, 'Cancelled.')}>Cancel</Button></span>}
      {d.cs && q.state === 'prepared' && <div className="mt-2 grid gap-2">
        <Textarea aria-label="What was discussed and decided" rows={3} placeholder="What was discussed and decided" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <Input aria-label="Attendees" placeholder="Attendees (roles or names, as agreed with the customer)" value={f.attendees} onChange={(e) => setF({ ...f, attendees: e.target.value })} />
        <Button size="sm" className="justify-self-start" disabled={busy || f.notes.trim().length < 20} onClick={() => step('hold', { notes: f.notes, attendees: f.attendees }, 'Review recorded as held.')}>Record as held</Button></div>}
      {d.cs && q.state === 'held' && <form className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (await step('action', { title: f.title, owner: f.owner, dueOn: f.dueOn }, 'Follow-up added.')) setF({ ...f, title: '', owner: '', dueOn: '' }); }}>
        <label className="text-xs">Follow-up<Input className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-xs">Owner<Input className="mt-1" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="text-xs">Due<Input type="date" className="mt-1" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
        <Button size="sm" className="self-end" disabled={busy || f.title.trim().length < 3 || !f.dueOn}>Add</Button></form>}
    </li>
  );
}

function Qbrs({ d, reload }: { d: any; reload: () => void }) {
  const { call, busy } = useCall(reload);
  const s = d.selected;
  const [when, setWhen] = useState('');
  const open = s.qbrs.some((q: any) => ['planned', 'prepared'].includes(q.state));
  return (
    <Panel title={`Business reviews · ${s.qbrs.length}`}>
      <p className="mb-2 text-xs text-muted-foreground">Preparing a review freezes the adoption figures and goals so the meeting discusses fixed numbers. Nothing is sent to the customer from here.</p>
      <ul className="space-y-2">{s.qbrs.map((q: any) => <Qbr key={`${q.id}:${q.version}`} q={q} d={d} reload={reload} />)}</ul>
      {d.cs && !open && <span className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs">Date<Input type="date" className="mt-1" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        <Button size="sm" disabled={busy || !when} onClick={() => call({ action: 'qbr', step: 'plan', accountId: s.id, qbrId: null, version: null, scheduledFor: when }, 'Review planned.')}>Plan a review</Button></span>}
    </Panel>
  );
}

export default function CustomerSuccessPage() {
  const [acc, setAcc] = useState<string | null>(null);
  const s = useLoad(() => customerSuccess({ action: 'get', accountId: acc }) as Promise<any>, [acc]);
  return (
    <div className="mx-auto max-w-6xl">
      <Header eyebrow="Customers" title="Customer success" sub="Adoption (counts only), success plans and business reviews for customer accounts. Nothing here contacts a customer or reads a person's record." />
      <Loadable state={s}>{(d: any) => !d.accounts.length ? <Panel><p className="text-sm text-muted-foreground">No customer accounts yet. Accounts at the Customer stage in the pipeline appear here.</p></Panel> : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Accounts" className="space-y-1">{d.accounts.map((a: any) => (
            <button key={a.id} onClick={() => setAcc(a.id)} className={`block w-full rounded-[3px] border p-2 text-left text-sm ${a.id === d.selected?.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
              {a.name}<span className="mt-1 flex"><Chip value={a.linked === 'confirmed' ? 'linked' : a.linked === 'proposed' ? 'link proposed' : 'not linked'} /></span></button>))}</nav>
          {d.selected && <div className="space-y-4" key={d.selected.id}>
            <Link d={d} reload={s.reload} />
            <Panel title="Adoption">{d.selected.adoption ? <Adoption a={d.selected.adoption} /> : <p className="text-sm text-muted-foreground">Not shown until the institution link is confirmed.</p>}</Panel>
            <Goals d={d} reload={s.reload} />
            <Qbrs d={d} reload={s.reload} />
            {d.selected.history.length > 0 && <Panel title="History"><ol className="space-y-1 text-sm">{d.selected.history.map((h: any, i: number) => <li key={i}><span className="text-xs text-muted-foreground">{fmt(h.at)} · {h.actor}</span> — {h.subject} {h.step}{h.note ? ` · ${h.note}` : ''}</li>)}</ol></Panel>}
          </div>}
        </div>)}</Loadable>
    </div>
  );
}
