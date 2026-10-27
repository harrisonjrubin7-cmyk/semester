import { useState } from 'react';
import { toast } from 'sonner';
import { organizations } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
const cents = (s: string) => Math.round(Number(s || 0) * 100);

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Detail({ o, d, reload }: { o: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const x = d.detail;
  const c = o.charter;
  const [ch, setCh] = useState({ purpose: c?.purpose ?? '', constitution: c?.constitution ?? '' });
  const [dec, setDec] = useState({ until: '', note: '' });
  const [role, setRole] = useState({ email: '', role: 'officer', termEnd: '' });
  const [post, setPost] = useState<Record<number, string>>({});
  const [chan, setChan] = useState({ name: '', officersOnly: false });
  const [due, setDue] = useState({ memberId: '', term: '', amount: '', reference: '' });
  const [bud, setBud] = useState({ term: '', category: '', amount: '' });
  const [exp, setExp] = useState({ lineId: '', amount: '', description: '' });
  const [el, setEl] = useState({ office: 'president', closesAt: '' });
  const [ho, setHo] = useState({ role: 'president', toId: '', notes: '' });
  if (!x) return null;
  const run = (body: any, msg: string) => act(() => organizations({ ...body, groupId: o.id } as never), msg);
  return (
    <div className="space-y-4 text-sm">
      <div><p className="text-xs font-medium">Charter</p>
        {c ? <p className="text-xs"><Status value={c.state} /> revision {c.rev}{c.until ? ` · recognized until ${c.until}` : ''}{c.note ? ` · ${c.note}` : ''}</p> : <p className="text-xs text-muted-foreground">No charter yet.</p>}
        {c && <details><summary className="cursor-pointer text-xs">Read the constitution</summary><pre className="whitespace-pre-wrap text-xs">{c.constitution}</pre></details>}
        {x.member && c?.state !== 'archived' && (!c || c.state !== 'recognized' || x.officer) && <div className="mt-1 space-y-1">
          <Input aria-label="Purpose" placeholder="Purpose" value={ch.purpose} onChange={(e) => setCh({ ...ch, purpose: e.target.value })} />
          <Textarea aria-label="Constitution" placeholder="Constitution (officers, elections, dues, meetings)" rows={5} value={ch.constitution} onChange={(e) => setCh({ ...ch, constitution: e.target.value })} />
          <Button size="sm" variant="outline" disabled={ch.purpose.length < 10 || ch.constitution.length < 50} onClick={() => run({ action: 'charter', ...ch }, c ? 'Amendment submitted for recognition.' : 'Charter submitted.')}>{c ? 'Submit amendment' : 'Submit charter'}</Button></div>}
        {d.orgAdmin && c && c.state !== 'archived' && <div className="mt-2 flex flex-wrap gap-2">
          {c.state === 'submitted' && !c.submittedByMe && <><Input aria-label="Recognized until" type="date" className="h-8 w-40" value={dec.until} onChange={(e) => setDec({ ...dec, until: e.target.value })} />
            <Button size="sm" disabled={!dec.until} onClick={() => run({ action: 'decide', step: 'recognize', hash: c.sha256, until: dec.until, note: dec.note, expectedVersion: c.version }, 'Recognized.')}>Recognize this revision</Button></>}
          <Input aria-label="Reason" placeholder="Reason (return, suspend, reinstate, archive)" className="h-8 max-w-xs" value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} />
          {(['return', 'suspend', 'reinstate', 'archive'] as const).map((st) => <Button key={st} size="sm" variant="ghost" disabled={dec.note.length < 5} onClick={() => run({ action: 'decide', step: st, note: dec.note, expectedVersion: c.version }, 'Updated.')}>{st}</Button>)}
        </div>}
      </div>
      <div><p className="text-xs font-medium">Officers</p>
        <ul className="text-xs">{x.roles.map((r: any, i: number) => <li key={i}>{r.name} — {r.role}{r.termEnd ? ` until ${r.termEnd}` : ''}</li>)}{!x.roles.length && <li className="text-muted-foreground">None yet.</li>}</ul>
        {(x.president || d.orgAdmin) && <div className="mt-1 flex flex-wrap gap-2">
          <Input aria-label="Member email" placeholder="Member email" className="h-8 max-w-xs" value={role.email} onChange={(e) => setRole({ ...role, email: e.target.value })} />
          <select aria-label="Role" className={sel} value={role.role} onChange={(e) => setRole({ ...role, role: e.target.value })}>{(d.orgAdmin ? ['president', 'treasurer', 'officer'] : ['treasurer', 'officer']).map((r) => <option key={r}>{r}</option>)}</select>
          <Input aria-label="Term end" type="date" className="h-8 w-40" value={role.termEnd} onChange={(e) => setRole({ ...role, termEnd: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!role.email.includes('@')} onClick={() => run({ action: 'role', email: role.email, role: role.role, on: true, termEnd: role.termEnd || null }, 'Role delegated.')}>Delegate</Button>
          <Button size="sm" variant="ghost" disabled={!role.email.includes('@')} onClick={() => run({ action: 'role', email: role.email, role: role.role, on: false }, 'Role ended.')}>End role</Button></div>}
        {x.members.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-xs">Members ({x.memberCount})</summary><ul className="text-xs">{x.members.map((m: any) => <li key={m.id} className="flex items-center gap-2">{m.name}
          <Button size="sm" variant="ghost" onClick={() => { const why = window.prompt(`Reason for removing ${m.name}`); if (why) run({ action: 'removeMember', userId: m.id, userName: m.name, reason: why }, 'Removed.'); }}>Remove</Button></li>)}</ul></details>}
      </div>
      <div><p className="text-xs font-medium">Channels</p>
        {x.channels.map((cc: any) => <div key={cc.id} className="mt-1 rounded border border-border p-2 text-xs"><p className="font-medium">#{cc.name}{cc.officersOnly ? ' (officers)' : ''}</p>
          {cc.posts.slice(0, 10).map((p: any, i: number) => <p key={i}><b>{p.author}</b> {p.body} <span className="text-muted-foreground">{fmt(p.at)}</span></p>)}
          {x.member && <div className="mt-1 flex gap-2"><Input aria-label={`Post in ${cc.name}`} className="h-8" value={post[cc.id] ?? ''} onChange={(e) => setPost({ ...post, [cc.id]: e.target.value })} />
            <Button size="sm" variant="outline" disabled={!(post[cc.id] ?? '').trim()} onClick={async () => { if (await act(() => organizations({ action: 'post', channelId: cc.id, body: post[cc.id] }), 'Posted.')) setPost({ ...post, [cc.id]: '' }); }}>Post</Button></div>}</div>)}
        {!x.channels.length && <Empty>No channels{x.member ? '' : ' visible — join the organization from Campus'}.</Empty>}
        {x.officer && <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Channel name" placeholder="New channel" className="h-8 max-w-[12rem]" value={chan.name} onChange={(e) => setChan({ ...chan, name: e.target.value })} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={chan.officersOnly} onChange={(e) => setChan({ ...chan, officersOnly: e.target.checked })} />Officers only</label>
          <Button size="sm" variant="outline" disabled={chan.name.length < 2} onClick={() => run({ action: 'channel', ...chan }, 'Channel created.')}>Create</Button></div>}
      </div>
      <div><p className="text-xs font-medium">Events</p>
        {x.events.length ? <ul className="space-y-1 text-xs">{x.events.map((e: any) => <li key={e.id} className="flex flex-wrap items-center gap-2">{e.title} · {fmt(e.startsAt)}{e.location ? ` · ${e.location}` : ''} · {e.going}{e.capacity ? `/${e.capacity}` : ''} going{e.membersOnly ? ' · members only' : ''}
          {(['going', 'maybe', 'no'] as const).map((st) => <Button key={st} size="sm" variant={e.mine === st ? 'default' : 'ghost'} onClick={() => act(() => organizations({ action: 'rsvp', eventId: e.id, status: st }), 'RSVP saved.')}>{st}</Button>)}
          {x.officer && <Button size="sm" variant="ghost" onClick={() => { const cap = window.prompt('Capacity (blank for none)', e.capacity ?? ''); if (cap !== null) run({ action: 'eventRules', eventId: e.id, capacity: cap ? Number(cap) : null, membersOnly: window.confirm('Members only?') }, 'Event rules saved.'); }}>Rules</Button>}</li>)}</ul> : <Empty>No events.</Empty>}
      </div>
      <div><p className="text-xs font-medium">Dues</p>
        {x.dues.length ? <ul className="text-xs">{x.dues.map((u: any) => <li key={u.id}>{u.member} · {u.term} · {$(u.amount)} · <Status value={u.state} />{u.reference ? ` · ${u.reference}` : ''}</li>)}</ul> : <p className="text-xs text-muted-foreground">No dues recorded.</p>}
        {x.treasurer && <div className="mt-1 flex flex-wrap gap-2">
          <select aria-label="Member" className={sel} value={due.memberId} onChange={(e) => setDue({ ...due, memberId: e.target.value })}><option value="">Member…</option>{x.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <Input aria-label="Term" placeholder="Term" className="h-8 w-28" value={due.term} onChange={(e) => setDue({ ...due, term: e.target.value })} />
          <Input aria-label="Amount" type="number" placeholder="$" className="h-8 w-24" value={due.amount} onChange={(e) => setDue({ ...due, amount: e.target.value })} />
          <Input aria-label="Receipt reference" placeholder="Receipt reference" className="h-8 w-36" value={due.reference} onChange={(e) => setDue({ ...due, reference: e.target.value })} />
          {(['due', 'recorded_paid', 'waived'] as const).map((st) => <Button key={st} size="sm" variant="outline" disabled={!due.memberId || due.term.length < 3} onClick={() => run({ action: 'dues', memberId: due.memberId, term: due.term, amount: cents(due.amount), state: st, reference: due.reference }, 'Recorded.')}>{st === 'recorded_paid' ? 'Paid (outside Semester)' : st}</Button>)}</div>}
      </div>
      {(x.officer || d.orgAdmin) && <div><p className="text-xs font-medium">Budget</p>
        {x.budget.map((l: any) => <div key={l.id} className="text-xs"><p>{l.term} · {l.category}: {$(l.amount)} allocated · {$(l.spent)} approved</p>
          <ul className="ml-3">{l.expenses.map((e: any) => <li key={e.id}>{e.description} · {$(e.amount)} · <Status value={e.state} />{e.note ? ` — ${e.note}` : ''}
            {x.treasurer && e.state === 'requested' && !e.mine && <><Button size="sm" variant="ghost" onClick={() => act(() => organizations({ action: 'decideExpense', expenseId: e.id, approve: true }), 'Approved.')}>Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt('Reason'); if (n) act(() => organizations({ action: 'decideExpense', expenseId: e.id, approve: false, note: n }), 'Rejected.'); }}>Reject</Button></>}</li>)}</ul></div>)}
        {x.officer && x.budget.length > 0 && <div className="mt-1 flex flex-wrap gap-2">
          <select aria-label="Budget line" className={sel} value={exp.lineId} onChange={(e) => setExp({ ...exp, lineId: e.target.value })}><option value="">Line…</option>{x.budget.map((l: any) => <option key={l.id} value={l.id}>{l.term} {l.category}</option>)}</select>
          <Input aria-label="Expense amount" type="number" placeholder="$" className="h-8 w-24" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
          <Input aria-label="What for" placeholder="What for" className="h-8 max-w-xs" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!exp.lineId || !exp.amount || exp.description.length < 5} onClick={() => act(() => organizations({ action: 'expense', lineId: Number(exp.lineId), amount: cents(exp.amount), description: exp.description }), 'Requested; the treasurer decides.')}>Request spending</Button></div>}
        {d.orgAdmin && <div className="mt-1 flex flex-wrap gap-2">
          <Input aria-label="Budget term" placeholder="Term" className="h-8 w-28" value={bud.term} onChange={(e) => setBud({ ...bud, term: e.target.value })} />
          <Input aria-label="Category" placeholder="Category" className="h-8 w-32" value={bud.category} onChange={(e) => setBud({ ...bud, category: e.target.value })} />
          <Input aria-label="Allocation" type="number" placeholder="$" className="h-8 w-24" value={bud.amount} onChange={(e) => setBud({ ...bud, amount: e.target.value })} />
          <Button size="sm" variant="outline" disabled={bud.term.length < 3 || bud.category.length < 2} onClick={() => run({ action: 'budget', term: bud.term, category: bud.category, amount: cents(bud.amount) }, 'Allocated.')}>Allocate</Button></div>}
      </div>}
      <div><p className="text-xs font-medium">Elections</p>
        {x.elections.map((e: any) => <div key={e.id} className="mt-1 rounded border border-border p-2 text-xs">
          <p>{e.office} · <Status value={e.state} /> · closes {fmt(e.closesAt)} · {e.turnout} voted{e.winner ? ` · winner ${e.winner}` : ''}</p>
          <ul>{e.candidates.map((cd: any) => <li key={cd.id} className="flex items-center gap-2">{cd.name}{cd.statement ? ` — ${cd.statement}` : ''}{cd.votes != null ? ` · ${cd.votes} votes` : ''}
            {e.open && x.member && !e.voted && <Button size="sm" variant="outline" onClick={() => { if (window.confirm(`Vote for ${cd.name}? Your vote is secret and final.`)) act(() => organizations({ action: 'vote', electionId: e.id, candidateId: cd.id }), 'Vote cast.'); }}>Vote</Button>}</li>)}</ul>
          {e.open && x.member && e.turnout === 0 && <Button size="sm" variant="ghost" onClick={() => act(() => organizations({ action: 'candidate', electionId: e.id, statement: window.prompt('Candidate statement') ?? '' }), 'You are a candidate.')}>Stand as candidate</Button>}
          {d.orgAdmin && ['open', 'closed'].includes(e.state) && !e.open && <Button size="sm" onClick={() => act(() => organizations({ action: 'certify', electionId: e.id }), 'Certified; the winner now holds the office.')}>Certify result</Button>}
        </div>)}
        {(x.president || d.orgAdmin) && <div className="mt-1 flex flex-wrap gap-2">
          <select aria-label="Office" className={sel} value={el.office} onChange={(e) => setEl({ ...el, office: e.target.value })}><option>president</option><option>treasurer</option></select>
          <Input aria-label="Closes at" type="datetime-local" className="h-8 w-56" value={el.closesAt} onChange={(e) => setEl({ ...el, closesAt: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!el.closesAt} onClick={() => run({ action: 'election', office: el.office, closesAt: new Date(el.closesAt).toISOString() }, 'Election opened.')}>Open election</Button></div>}
      </div>
      {(x.officer || d.orgAdmin) && <div><p className="text-xs font-medium">Handover</p>
        <ul className="text-xs">{x.handovers.map((h: any, i: number) => <li key={i}>{h.role}: {h.from ?? 'admin'} → {h.to} · {fmt(h.at)} — {h.notes}</li>)}</ul>
        <div className="mt-1 flex flex-wrap gap-2">
          <select aria-label="Handover role" className={sel} value={ho.role} onChange={(e) => setHo({ ...ho, role: e.target.value })}>{['president', 'treasurer', 'officer'].map((r) => <option key={r}>{r}</option>)}</select>
          <select aria-label="To" className={sel} value={ho.toId} onChange={(e) => setHo({ ...ho, toId: e.target.value })}><option value="">Incoming officer…</option>{x.roles.filter((r: any) => r.role === ho.role).map((r: any) => <option key={r.userId} value={r.userId}>{r.name}</option>)}</select>
          <Textarea aria-label="Handover notes" placeholder="Open tasks, accounts, contacts, dates" value={ho.notes} onChange={(e) => setHo({ ...ho, notes: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!ho.toId || ho.notes.length < 10} onClick={() => run({ action: 'handover', ...ho }, 'Handover recorded.')}>Record handover</Button></div></div>}
    </div>
  );
}

export default function Organizations() {
  const [selId, setSelId] = useState<string | null>(null);
  const s = useLoad(() => organizations({ action: 'get', groupId: selId }), [selId]);
  const act = useAct(s.reload);
  const [em, setEm] = useState('');
  return (
    <>
      <PageHeader eyebrow="Campus" title="Student organizations" sub="Charters, officers, channels, events, dues, budgets and elections for clubs. Join a club from Clubs & events." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Organizations">{d.organizations.length ? <ul className="space-y-1 text-sm">{d.organizations.map((o: any) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2"><button className="text-left font-medium underline-offset-2 hover:underline" onClick={() => setSelId(o.id)}>{o.name}</button>
              <span className="text-xs text-muted-foreground">{o.members} members{o.member ? ' · you are a member' : ''}</span>{o.charter ? <Status value={o.charter.state} /> : <span className="text-xs text-muted-foreground">no charter</span>}</li>))}</ul> : <Empty>No clubs yet.</Empty>}</Panel>
          {d.detail && <Panel title={d.detail.name}><Detail o={d.organizations.find((o: any) => o.id === d.detail.id)} d={d} reload={s.reload} /></Panel>}
          {d.isAdmin && <Panel title="Organization admins">
            <p className="text-xs">{Object.values(d.admins).join(', ') || 'Nobody yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={em} onChange={(e) => setEm(e.target.value)} />
              <Button size="sm" disabled={!em.includes('@')} onClick={() => act(() => organizations({ action: 'setAdmin', email: em, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!em.includes('@')} onClick={() => act(() => organizations({ action: 'setAdmin', email: em, on: false }), 'Revoked.')}>Revoke</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Organization admins recognize charters, allocate budgets, certify elections, suspend and archive.</p>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
