import { useState } from 'react';
import { toast } from 'sonner';
import { grants } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { money } from '../lib/procureRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const cents = (s: string) => Math.round(Number(s || 0) * 100);

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function GrantCard({ g, d, reload }: { g: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [note, setNote] = useState('');
  const [rep, setRep] = useState({ period: '', spent: '', note: '' });
  const pct = g.amountCents ? Math.min(100, Math.round((g.spentCents / g.amountCents) * 100)) : 0;
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{g.title} <span className="text-xs font-normal text-muted-foreground">· {g.sponsor}{g.sponsorOrg ? ` (${g.sponsorOrg})` : ''}{g.projectCode ? ` · project ${g.projectCode}` : ''} · PI {g.pi}</span></p>
        <Status value={g.state} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Award {money(g.amountCents)} · reported spent {money(g.spentCents)} ({pct}%){g.startsOn ? ` · ${g.startsOn}` : ''}{g.endsOn ? ` → ${g.endsOn}` : ''}</p>
      <div className="mt-1 h-1.5 w-full rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
      {g.state !== 'proposed' && g.verifiedBy && <p className="mt-1 text-xs text-muted-foreground">Sponsor verified by {g.verifiedBy}: “{g.verificationNote}”</p>}
      {d.isOfficer && g.state === 'proposed' && <div className="mt-2 flex flex-wrap gap-2">
        <Input aria-label="Note" placeholder="Verification note, or reason to decline" className="max-w-sm flex-1" value={note} onChange={(e) => setNote(e.target.value)} />
        {g.createdByMe
          ? <span className="text-xs text-muted-foreground self-center">You recorded this grant — another officer verifies its sponsor.</span>
          : <Button size="sm" disabled={note.trim().length < 5} onClick={() => act(() => grants({ action: 'verify', id: g.id, note }), 'Sponsor verified.')}>Verify sponsor</Button>}
        <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => act(() => grants({ action: 'decline', id: g.id, note }), 'Grant declined.')}>Decline</Button>
      </div>}
      {d.isOfficer && g.state === 'verified' && <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => act(() => grants({ action: 'activate', id: g.id }), 'Grant active.')}>Activate grant</Button>
        <Input aria-label="Decline reason" placeholder="Reason to decline" className="max-w-xs" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => act(() => grants({ action: 'decline', id: g.id, note }), 'Grant declined.')}>Decline</Button>
      </div>}
      {g.state === 'active' && (g.piMe || d.isOfficer) && <div className="mt-2 flex flex-wrap gap-2">
        <Input aria-label="Report period" placeholder="Period (e.g. 2027 Q1)" className="w-44" value={rep.period} onChange={(e) => setRep({ ...rep, period: e.target.value })} />
        <Input aria-label="Cumulative spent in dollars" type="number" min={0} step={0.01} placeholder="Spent to date ($)" className="w-44" value={rep.spent} onChange={(e) => setRep({ ...rep, spent: e.target.value })} />
        <Button size="sm" disabled={rep.period.trim().length < 3 || rep.spent === ''} onClick={async () => { if (await act(() => grants({ action: 'report', id: g.id, period: rep.period, spentCents: cents(rep.spent), note: rep.note }), 'Spend report filed.')) setRep({ period: '', spent: '', note: '' }); }}>File spend report</Button>
        {d.isOfficer && <Button size="sm" variant="outline" onClick={() => act(() => grants({ action: 'close', id: g.id }), 'Grant closed.')}>Close grant</Button>}
      </div>}
      {g.reports.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{g.reports.map((r: any, i: number) => <li key={i}>{r.period}: {money(r.spentCents)} cumulative — {r.by}</li>)}</ul>}
    </li>
  );
}

export default function Grants() {
  const s = useLoad(() => grants({ action: 'get' }));
  const act = useAct(s.reload);
  const [f, setF] = useState({ projectCode: '', sponsorOrgId: '', sponsorName: '', title: '', amount: '', piEmail: '', startsOn: '', endsOn: '' });
  const [st, setSt] = useState({ email: '', on: true });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Grants & sponsored projects" sub="The grant register for registered research projects. A second officer verifies each sponsor before a grant can go active. Spend reports are records of the project's own reporting — grant money itself never moves through Semester." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.isOfficer && <Panel title="Record a grant">
            <div className="grid gap-2 sm:grid-cols-3">
              <select aria-label="Project" className={sel} value={f.projectCode} onChange={(e) => setF({ ...f, projectCode: e.target.value })}><option value="">Project (optional)…</option>{d.projects.map((p: any) => <option key={p.code} value={p.code}>{p.code} — {p.title}</option>)}</select>
              <select aria-label="Sponsor organization" className={sel} value={f.sponsorOrgId} onChange={(e) => { const o = d.orgs.find((x: any) => String(x.id) === e.target.value); setF({ ...f, sponsorOrgId: e.target.value, sponsorName: o ? o.name : f.sponsorName }); }}><option value="">Sponsor org (optional)…</option>{d.orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <Input aria-label="Sponsor name" placeholder="Sponsor name" value={f.sponsorName} onChange={(e) => setF({ ...f, sponsorName: e.target.value })} />
              <Input aria-label="Grant title" placeholder="Grant title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <Input aria-label="Award in dollars" type="number" min={0} step={0.01} placeholder="Award ($)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              <Input aria-label="Principal investigator email" placeholder="PI email" value={f.piEmail} onChange={(e) => setF({ ...f, piEmail: e.target.value })} />
              <Input aria-label="Starts on" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />
              <Input aria-label="Ends on" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
            </div>
            <div className="mt-2"><Button size="sm" disabled={f.sponsorName.trim().length < 2 || f.title.trim().length < 5 || !f.amount || !f.piEmail.includes('@')} onClick={async () => { if (await act(() => grants({ action: 'create', projectCode: f.projectCode, sponsorOrgId: f.sponsorOrgId ? Number(f.sponsorOrgId) : null, sponsorName: f.sponsorName, title: f.title, amountCents: cents(f.amount), piEmail: f.piEmail, startsOn: f.startsOn || null, endsOn: f.endsOn || null }), 'Grant recorded as proposed.')) setF({ projectCode: '', sponsorOrgId: '', sponsorName: '', title: '', amount: '', piEmail: '', startsOn: '', endsOn: '' }); }}>Record grant</Button></div>
          </Panel>}
          <Panel title={d.isOfficer ? 'All grants' : 'Grants you lead'}>{d.grants.length ? <ul className="space-y-2">{d.grants.map((g: any) => <GrantCard key={g.id} g={g} d={d} reload={s.reload} />)}</ul> : <Empty>No grants yet.</Empty>}</Panel>
          {d.isAdmin && <Panel title="Grants officers">
            <p className="text-xs">{d.officers.map((m: any) => m.name).join(', ') || 'No grants officers yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Officer email" placeholder="Email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={async () => { if (await act(() => grants({ action: 'setStaff', email: st.email, on: true }), 'Grants officer granted.')) setSt({ email: '', on: true }); }}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => grants({ action: 'setStaff', email: st.email, on: false }), 'Grants officer removed.')}>Remove</Button>
            </div>
          </Panel>}
        </div>
      )}</Loadable>
    </>
  );
}
