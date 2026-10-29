import { useState } from 'react';
import { toast } from 'sonner';
import { veterans } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const CHAPTER: Record<string, string> = { '30': 'Chapter 30 (Montgomery GI Bill)', '31': 'Chapter 31 (Veteran Readiness and Employment)', '33': 'Chapter 33 (Post-9/11 GI Bill)',
  '35': 'Chapter 35 (Dependents’ Educational Assistance)', '1606': 'Chapter 1606 (Selected Reserve)', '1607': 'Chapter 1607 (REAP)', other: 'Other' };

function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const act = async (input: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await veterans(input as never); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } finally { setBusy(false); }
  };
  return { act, busy };
}

function Intake({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const blank = { term: '', chapter: '33', level: 'undergraduate', program: '', coeOnFile: false };
  const [f, setF] = useState(blank);
  return (
    <Panel title="Request certification for a term">
      <p className="mb-2 text-xs text-muted-foreground">Your school's certifying official reviews your enrolled courses for the term and reports them to the VA. Don't upload documents here; your official will tell you if they need anything.</p>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: 'intake', ...f }, 'Request sent to the certifying official.')) setF(blank); }}>
        <label className="text-xs">Term<Input className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Spring 2027" /></label>
        <label className="text-xs">Benefit<select className={sel} value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })}>{d.chapters.map((c: string) => <option key={c} value={c}>{CHAPTER[c]}</option>)}</select></label>
        <label className="text-xs">Level<select className={sel} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="undergraduate">Undergraduate</option><option value="graduate">Graduate</option></select></label>
        <label className="text-xs">Program<Input className="mt-1" value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} placeholder="BS Biology" /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.coeOnFile} onChange={(e) => setF({ ...f, coeOnFile: e.target.checked })} />My Certificate of Eligibility is already on file with the school</label>
        <Button size="sm" className="justify-self-start" disabled={busy || f.term.trim().length < 3 || f.program.trim().length < 2}>Send request</Button>
      </form>
    </Panel>
  );
}

function Request({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [reason, setReason] = useState<Record<number, string>>({});
  const [text, setText] = useState('');
  const go = (step: string, extra: Record<string, unknown>, ok: string) => act({ action: 'review', step, id: r.id, version: r.version, ...extra }, ok);
  const cur = r.certifications.find((c: any) => c.current);
  const review = d.official && !r.mine;
  const credits = r.lines.filter((l: any) => l.applicable).reduce((s: number, l: any) => s + l.credits, 0);
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong>{r.term}</strong> · {r.student} <Status value={r.state.replace('_', ' ')} />{r.drifted && <Status value="Adjustment needed" />}</span>
      <span className="block text-xs text-muted-foreground">{CHAPTER[r.chapter]} · {r.level} · {r.program} · Certificate of Eligibility {r.coeOnFile ? 'on file' : 'not yet on file'} · sent {fmt(r.createdAt)}</span>
      {r.state === 'returned' && <p className="mt-1" role="status">Returned: {r.returnReason}</p>}
      {cur && <p className="mt-1">Certified: <strong>{cur.credits} credits, {cur.trainingTime}</strong> by {cur.by} · {fmt(cur.at)}{cur.amends ? ' (amendment)' : ''}. {cur.vaRef ? `VA reference ${cur.vaRef}.` : 'Not yet reported to the VA.'}</p>}
      {r.drifted && <p className="mt-1" role="alert">Enrollment changed since certification (now {r.driftCredits} credits). Start an amendment.</p>}
      {r.lines.length > 0 && (review || r.state === 'certified') && <table className="mt-2 w-full text-left text-sm"><thead><tr><th>Course</th><th>Credits</th><th>Applies to program</th></tr></thead>
        <tbody>{r.lines.map((l: any) => (
          <tr key={l.id} className="align-top"><td>{l.course}</td><td>{l.credits}</td><td>
            {l.applicable === null ? 'Not decided' : l.applicable ? '✓ Yes' : `✗ No — ${l.reason}`}
            {review && r.state === 'in_review' && <span className="mt-1 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => go('decide', { lineId: l.id, applicable: true }, 'Marked as applying.')}>Applies</Button>
              <Input aria-label={`Reason ${l.course} does not apply`} className="h-8 max-w-xs" placeholder="Reason it does not apply" value={reason[l.id] ?? ''} onChange={(e) => setReason({ ...reason, [l.id]: e.target.value })} />
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => go('decide', { lineId: l.id, applicable: false, reason: reason[l.id] ?? '' }, 'Marked as not applying.')}>Does not apply</Button></span>}
          </td></tr>))}</tbody></table>}
      {review && <div className="mt-2 flex flex-wrap items-center gap-2">
        {r.state === 'submitted' && <Button size="sm" disabled={busy} onClick={() => go('start', {}, 'Review started with this term’s enrolled courses.')}>Start review</Button>}
        {r.state === 'in_review' && <Button size="sm" disabled={busy || r.lines.some((l: any) => l.applicable === null)} onClick={() => go('certify', {}, 'Certified.')}>Certify {credits} credits</Button>}
        {r.state === 'certified' && <Button size="sm" variant="outline" disabled={busy} onClick={() => go('amend', {}, 'Amendment started.')}>Start amendment</Button>}
        {['submitted', 'in_review'].includes(r.state) && <><Input aria-label="Reason to return" className="h-8 max-w-xs" placeholder="What the student should fix" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" variant="ghost" disabled={busy || text.trim().length < 10} onClick={() => go('return', { reason: text }, 'Returned to the student.')}>Return</Button></>}
        {cur && !cur.vaRef && <><Input aria-label="VA reference" className="h-8 max-w-xs" placeholder="Reference from the VA's system" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || text.trim().length < 4} onClick={() => go('record_ref', { reference: text }, 'VA reference recorded.')}>Record VA reference</Button></>}
      </div>}
      {r.mine && ['submitted', 'returned'].includes(r.state) && <Button size="sm" variant="ghost" className="mt-2" disabled={busy} onClick={() => go('withdraw', {}, 'Request withdrawn.')}>Withdraw</Button>}
    </li>
  );
}

function Settings({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [email, setEmail] = useState('');
  const [p, setP] = useState<Record<string, { full: string; threeQuarter: string; half: string }>>(() => Object.fromEntries(d.policies.map((x: any) => [x.level, { full: String(x.full), threeQuarter: String(x.threeQuarter), half: String(x.half) }])));
  if (!d.isAdmin && !d.official) return null;
  return (
    <Panel title="Certifying officials and thresholds">
      <p className="text-sm">Officials: {d.officials.length ? d.officials.join(', ') : 'none appointed'}</p>
      {d.isAdmin && <span className="mt-2 flex flex-wrap gap-2"><Input aria-label="Email" className="h-8 max-w-xs" placeholder="Member email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={busy} onClick={() => act({ action: 'official', email, on: true }, 'Official appointed.')}>Appoint</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: 'official', email, on: false }, 'Official removed.')}>Remove</Button></span>}
      <h3 className="mt-3 text-sm font-medium">Credit thresholds by level</h3>
      <p className="text-xs text-muted-foreground">Training time comes from these. Until an official confirms them they are defaults, not your institution's rules.</p>
      <ul className="mt-1 space-y-2 text-sm">{d.policies.map((x: any) => (
        <li key={x.level} className="flex flex-wrap items-end gap-2"><span className="w-28 capitalize">{x.level}</span>
          {(['full', 'threeQuarter', 'half'] as const).map((k) => <label key={k} className="text-xs">{k === 'full' ? 'Full time' : k === 'half' ? 'Half time' : 'Three-quarter'}
            <Input className="mt-1 w-20" inputMode="decimal" disabled={!d.official} value={p[x.level]?.[k] ?? ''} onChange={(e) => setP({ ...p, [x.level]: { ...p[x.level], [k]: e.target.value } })} /></label>)}
          <Status value={x.confirmed ? 'Confirmed' : 'Default'} />
          {d.official && <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: 'policy', level: x.level, full: Number(p[x.level].full), threeQuarter: Number(p[x.level].threeQuarter), half: Number(p[x.level].half) }, 'Thresholds confirmed.')}>Confirm</Button>}</li>))}</ul>
    </Panel>
  );
}

export default function Veterans() {
  const s = useLoad(() => veterans({ action: 'get' }) as Promise<any>);
  return (
    <>
      <PageHeader eyebrow="Benefits" title="Veterans education benefits" sub="Request certification for a term, and certifying officials review it course by course. Nothing is sent to the VA from here." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.student && <Intake d={d} reload={s.reload} />}
          <Panel title={d.official ? `Certification queue · ${d.requests.filter((r: any) => !r.mine && ['submitted', 'in_review'].includes(r.state)).length} waiting` : 'Your requests'}>
            {!d.requests.length ? <Empty>{d.official ? 'No requests yet.' : 'You have not requested certification yet.'}</Empty>
              : <ul className="space-y-2">{d.requests.map((r: any) => <Request key={`${r.id}:${r.version}`} r={r} d={d} reload={s.reload} />)}</ul>}
          </Panel>
          <Settings d={d} reload={s.reload} />
        </div>)}</Loadable>
    </>
  );
}
