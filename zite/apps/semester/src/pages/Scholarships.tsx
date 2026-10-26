import { useState } from 'react';
import { toast } from 'sonner';
import { scholarships } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const money = (c: number) => (c / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const STATE: Record<string, string> = {
  submitted: 'Submitted', shortlisted: 'Shortlisted', awarded: 'Awarded — your answer needed', not_selected: 'Not selected', withdrawn: 'Withdrawn',
  accepted: 'Accepted — with financial aid', declined_award: 'Award declined', handed_off: 'Handed to financial aid',
  requested: 'Renewal requested', approved: 'Renewal approved', denied: 'Renewal denied', verified: 'Verified', rejected: 'Rejected', suspended: 'Suspended',
};

function Apply({ p, reload }: { p: any; reload: () => void }) {
  const [text, setText] = useState('');
  const [agree, setAgree] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const go = async () => { try { const r: any = await scholarships({ action: 'apply', requestKey: key, programId: p.id, statement: text, consent: true }); toast(r.result?.replayed ? 'Already sent.' : 'Application sent.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <div className="mt-2 space-y-2 text-xs">
      <Textarea aria-label="Statement" placeholder="Why you fit the criteria (50+ characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{p.consent}</label>
      <Button size="sm" disabled={text.trim().length < 50 || !agree} onClick={go}>Apply</Button>
    </div>
  );
}

function Mine({ x, reload }: { x: any; reload: () => void }) {
  const [term, setTerm] = useState('');
  const [why, setWhy] = useState('');
  const act = async (step: 'withdraw' | 'accept' | 'decline_award') => { try { await scholarships({ action: 'step', id: x.id, step, expectedVersion: x.version }); toast('Recorded.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const renew = async () => { try { await scholarships({ action: 'renew', id: x.id, term, statement: why }); toast('Renewal requested.'); setTerm(''); setWhy(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{x.program} · {x.sponsor} · {money(x.amountCents)}</span><Status value={STATE[x.state] ?? x.state} /></div>
      {x.note && <p className="mt-1 text-xs">Note: {x.note}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {x.steps.includes('accept') && <Button size="sm" onClick={() => act('accept')}>Accept the award</Button>}
        {x.steps.includes('decline_award') && <Button size="sm" variant="outline" onClick={() => act('decline_award')}>Decline the award</Button>}
        {x.steps.includes('withdraw') && <Button size="sm" variant="outline" onClick={() => act('withdraw')}>Withdraw</Button>}
      </div>
      {x.state === 'accepted' && <p className="mt-1 text-xs text-muted-foreground">Financial aid will add this to your aid package. Nothing is paid from here.</p>}
      {x.renewals.length > 0 && <ul className="mt-2 space-y-1 text-xs">{x.renewals.map((r: any) => <li key={r.id}>{r.term}: {STATE[r.state] ?? r.state}{r.note ? ` — ${r.note}` : ''}</li>)}</ul>}
      {x.state === 'handed_off' && x.renewable && (
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-[10rem_1fr_auto]">
          <Input aria-label="Renewal term" placeholder="Term, e.g. Fall 2028" value={term} onChange={(e) => setTerm(e.target.value)} />
          <Input aria-label="Renewal statement" placeholder="How the year went (20+ characters)" value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button size="sm" disabled={term.trim().length < 2 || why.trim().length < 20} onClick={renew}>Ask to renew</Button>
        </div>
      )}
    </li>
  );
}

function Handoffs({ d, reload }: { d: any; reload: () => void }) {
  const [ref, setRef] = useState<Record<string, string>>({});
  const hand = async (x: any) => { try { await scholarships({ action: 'step', id: x.id, step: 'handoff', expectedVersion: x.version, note: ref[`a${x.id}`] ?? '' }); toast('Hand-off recorded.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const handR = async (r: any) => { try { await scholarships({ action: 'renewHandoff', id: r.id, expectedVersion: r.version, note: ref[`r${r.id}`] ?? '' }); toast('Renewal hand-off recorded.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const accepted = d.applications.filter((x: any) => !x.mine && x.state === 'accepted');
  const renewals = d.applications.filter((x: any) => !x.mine).flatMap((x: any) => x.renewals.filter((r: any) => r.state === 'approved').map((r: any) => ({ ...r, x })));
  return (
    <Panel title={`Awards to hand to financial aid · ${accepted.length + renewals.length}`}>
      {accepted.length + renewals.length === 0 ? <Empty>Nothing waiting.</Empty> : (
        <ul className="space-y-2 text-sm">
          {accepted.map((x: any) => <li key={`a${x.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"><span className="flex-1">{x.student} · {x.program} · {money(x.amountCents)}</span>
            <Input aria-label="Aid term and reference" className="max-w-xs" placeholder="Aid term and reference" value={ref[`a${x.id}`] ?? ''} onChange={(e) => setRef({ ...ref, [`a${x.id}`]: e.target.value })} />
            <Button size="sm" disabled={(ref[`a${x.id}`] ?? '').trim().length < 5} onClick={() => hand(x)}>Record hand-off</Button></li>)}
          {renewals.map((r: any) => <li key={`r${r.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"><span className="flex-1">Renewal {r.term} · {r.x.student} · {r.x.program}</span>
            <Input aria-label="Aid term and reference" className="max-w-xs" placeholder="Aid term and reference" value={ref[`r${r.id}`] ?? ''} onChange={(e) => setRef({ ...ref, [`r${r.id}`]: e.target.value })} />
            <Button size="sm" disabled={(ref[`r${r.id}`] ?? '').trim().length < 5} onClick={() => handR(r)}>Record hand-off</Button></li>)}
        </ul>)}
      <p className="mt-2 text-xs text-muted-foreground">A hand-off is a record for your aid packaging. It does not pay anyone.</p>
    </Panel>
  );
}

function Sponsors({ d, reload }: { d: any; reload: () => void }) {
  const [note, setNote] = useState<Record<number, string>>({});
  const decide = async (s: any, decision: 'verify' | 'reject' | 'suspend') => { try { await scholarships({ action: 'verify', sponsorId: s.id, decision, expectedVersion: s.version, note: note[s.id] ?? '' }); toast('Recorded.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  return (
    <Panel title="Sponsors">
      {d.sponsors.length === 0 ? <Empty>No sponsor has asked to offer scholarships here yet.</Empty> : (
        <ul className="space-y-2">{d.sponsors.map((s: any) => (
          <li key={s.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{s.org}{s.website ? ` · ${s.website}` : ''}</span><Status value={STATE[s.state] ?? s.state} /></div>
            {s.about && <p className="mt-1 text-xs">{s.about}</p>}
            {s.note && <p className="mt-1 text-xs text-muted-foreground">Last note: {s.note}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input aria-label="How you checked" className="max-w-md" placeholder="How you checked this sponsor (10+ characters)" value={note[s.id] ?? ''} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
              {s.state !== 'verified' && <Button size="sm" disabled={(note[s.id] ?? '').trim().length < 10} onClick={() => decide(s, 'verify')}>Verify</Button>}
              {s.state === 'requested' && <Button size="sm" variant="outline" disabled={(note[s.id] ?? '').trim().length < 10} onClick={() => decide(s, 'reject')}>Reject</Button>}
              {s.state === 'verified' && <Button size="sm" variant="outline" disabled={(note[s.id] ?? '').trim().length < 10} onClick={() => decide(s, 'suspend')}>Suspend (closes their programs)</Button>}
            </div>
          </li>))}</ul>)}
    </Panel>
  );
}

function Access({ d, reload }: { d: any; reload: () => void }) {
  const [email, setEmail] = useState('');
  const set = async (on: boolean) => { try { await scholarships({ action: 'setOffice', email, on }); toast('Saved.'); setEmail(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Scholarship office">
      {d.office.length ? <ul className="mb-2 space-y-1 text-sm">{d.office.map((o: any, i: number) => <li key={i}>{o.name}</li>)}</ul> : <Empty>No one yet. Sponsors stay unverified until someone is added.</Empty>}
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={!email.includes('@')} onClick={() => set(true)}>Add</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => set(false)}>Remove</Button></div>
    </Panel>
  );
}

export default function Scholarships() {
  const s = useLoad(() => scholarships({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Financial aid" title="Scholarships" sub="Scholarships from sponsors your institution has verified. You choose what a sponsor sees; your grades and records are never shared." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.applications.filter((x: any) => x.mine);
        return (
          <div className="space-y-4">
            {mine.length > 0 && <Panel title="My applications"><ul className="space-y-2">{mine.map((x: any) => <Mine key={x.id} x={x} reload={s.reload} />)}</ul></Panel>}
            <Panel title={`Open scholarships · ${d.programs.filter((p: any) => p.open).length}`}>
              {d.programs.length === 0 ? <Empty>No scholarships are open at your institution right now.</Empty> : (
                <ul className="space-y-2">{d.programs.map((p: any) => (
                  <li key={p.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.name} · {p.sponsor} · {money(p.amountCents)}</span>
                      <Status value={p.open ? `Apply by ${p.deadline}` : 'Closed'} /></div>
                    <p className="mt-1 whitespace-pre-wrap text-xs">{p.criteria}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.made}/{p.awards} awarded{p.renewable ? ' · renewable' : ''}</p>
                    {p.applied ? <p className="mt-1 text-xs">You applied.</p> : p.open && <Apply p={p} reload={s.reload} />}
                  </li>))}</ul>)}
            </Panel>
            {d.isOffice && <Handoffs d={d} reload={s.reload} />}
            {d.isOffice && <Sponsors d={d} reload={s.reload} />}
            {d.isAdmin && <Access d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
