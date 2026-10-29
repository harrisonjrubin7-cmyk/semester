import { useState } from 'react';
import { toast } from 'sonner';
import { alumniNetwork, help } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, fmtDay, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } finally { setBusy(false); }
  };
  return { act, busy };
}

function Profile({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const p = d.profile;
  const [f, setF] = useState({ headline: p?.headline ?? '', field: p?.field ?? '', gradYear: p?.gradYear ? String(p.gradYear) : '', listed: p?.listed ?? false,
    audience: p?.audience ?? 'alumni', openToConnect: p?.openToConnect ?? true, openToMentor: p?.openToMentor ?? false });
  const save = () => act(() => alumniNetwork({ action: 'profile', ...f, gradYear: f.gradYear ? Number(f.gradYear) : null, version: p?.version ?? null } as never), f.listed ? 'Profile listed.' : 'Profile saved (not listed).');
  return (
    <Panel title="Your directory profile">
      <p className="mb-2 text-xs text-muted-foreground">Nobody sees you until you choose to be listed. No email or phone number is stored or shown; people reach you through connection requests.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Headline<Input className="mt-1" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="Data analyst at a hospital" /></label>
        <label className="text-xs">Field<Input className="mt-1" value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })} /></label>
        <label className="text-xs">Graduation year<Input className="mt-1" inputMode="numeric" value={f.gradYear} onChange={(e) => setF({ ...f, gradYear: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} /></label>
        <label className="text-xs">Who can see it<select className={sel} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="alumni">Alumni only</option><option value="alumni_and_students">Alumni and students</option></select></label>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} />List me in the directory</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.openToConnect} onChange={(e) => setF({ ...f, openToConnect: e.target.checked })} />Accept connection requests</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.openToMentor} onChange={(e) => setF({ ...f, openToMentor: e.target.checked })} />Show me as a mentor to students</label>
      </div>
      {f.openToMentor && f.audience !== 'alumni_and_students' && <p className="mt-1 text-xs" role="status">Students only see mentors whose profile is visible to students.</p>}
      <Button size="sm" className="mt-3" disabled={busy || f.headline.trim().length < 3} onClick={save}>Save profile</Button>
    </Panel>
  );
}

function Directory({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [q, setQ] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const list = d.directory.filter((p: any) => !q || `${p.name} ${p.headline} ${p.field}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel title={`Directory · ${d.directory.length}`}>
      <Input aria-label="Search the directory" placeholder="Search by name, field or headline" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      {!list.length ? <Empty>{d.directory.length ? 'No one matches that search.' : 'No alumni have listed themselves yet.'}</Empty> : (
        <ul className="space-y-2">{list.map((p: any) => (
          <li key={p.id} className="rounded-md border border-border p-2 text-sm">
            <span className="flex flex-wrap items-center gap-2"><strong>{p.name}</strong>{p.gradYear && <span className="text-xs text-muted-foreground">Class of {p.gradYear}</span>}{p.openToMentor && <Status value="Mentor" />}</span>
            <span className="block">{p.headline}{p.field ? ` · ${p.field}` : ''}</span>
            {p.link ? <span className="mt-1 block text-xs text-muted-foreground">{p.link === 'accepted' ? 'Connected' : 'Request waiting'}</span>
              : p.openToConnect ? <span className="mt-1 flex flex-wrap gap-2"><Input aria-label={`Note to ${p.name}`} className="h-8 max-w-sm" placeholder="Short note (optional)" value={note[p.id] ?? ''} onChange={(e) => setNote({ ...note, [p.id]: e.target.value.slice(0, 300) })} />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => alumniNetwork({ action: 'connect', target: p.id, note: note[p.id] ?? '' }), 'Request sent.')}>Ask to connect</Button></span>
              : <span className="mt-1 block text-xs text-muted-foreground">Not taking connection requests.</span>}
          </li>))}</ul>)}
    </Panel>
  );
}

function Connections({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const r = (id: number, step: string, ok: string) => act(() => alumniNetwork({ action: 'respond', id, step } as never), ok);
  const incoming = d.connections.filter((c: any) => c.incoming && c.state === 'requested');
  return (
    <Panel title="Connections">
      {!d.connections.length && <Empty>No connections or requests yet.</Empty>}
      {incoming.length > 0 && <h3 className="mb-1 text-sm font-medium">Waiting for your answer</h3>}
      <ul className="space-y-2 text-sm">{incoming.map((c: any) => (
        <li key={c.id} className="rounded-md border border-border p-2"><strong>{c.other}</strong> asked to connect{c.note ? `: “${c.note}”` : '.'}
          <span className="mt-1 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => r(c.id, 'accept', 'Connected.')}>Accept</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => r(c.id, 'decline', 'Declined.')}>Decline</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => r(c.id, 'block', 'Blocked. You will not see each other here.')}>Block</Button></span></li>))}</ul>
      <ul className="mt-2 space-y-1 text-sm">{d.connections.filter((c: any) => !(c.incoming && c.state === 'requested')).map((c: any) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2">{c.other} · {c.state === 'accepted' ? 'connected' : 'request sent'}
          {c.state === 'requested' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => r(c.id, 'withdraw', 'Request withdrawn.')}>Withdraw</Button>}
          {c.state === 'accepted' && c.incoming && <Button size="sm" variant="ghost" disabled={busy} onClick={() => r(c.id, 'block', 'Blocked.')}>Block</Button>}</li>))}</ul>
    </Panel>
  );
}

function Opportunities({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const blank = { kind: 'internship', title: '', org: '', body: '', url: '', audience: 'students', expiresAt: '' };
  const [f, setF] = useState(blank);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [share, setShare] = useState<Record<number, boolean>>({});
  const queue = d.opportunities.filter((o: any) => d.center && o.state === 'pending' && !o.mine);
  const open = d.opportunities.filter((o: any) => o.live && !o.mine);
  const mine = d.opportunities.filter((o: any) => o.mine);
  const review = (id: number, step: string) => act(() => alumniNetwork({ action: 'review', id, step, note: notes[id] ?? '' } as never), step === 'approve' ? 'Approved and now visible.' : step === 'reject' ? 'Rejected.' : 'Closed.');
  return (
    <div className="space-y-4">
      {d.center && <Panel title={`Waiting for career center review · ${queue.length}`}>
        {!queue.length ? <Empty>Nothing waiting.</Empty> : <ul className="space-y-2 text-sm">{queue.map((o: any) => (
          <li key={o.id} className="rounded-md border border-border p-2"><strong>{o.title}</strong> · {o.org} <Status value={o.kind} /> <span className="text-xs text-muted-foreground">by {o.poster} · for {o.audience} · ends {fmtDay(o.expiresAt)}</span>
            <span className="mt-1 block whitespace-pre-wrap">{o.body}</span>{o.url && <span className="block text-xs">Link: {o.url}</span>}
            <span className="mt-1 flex flex-wrap gap-2"><Input aria-label="Review note" className="h-8 max-w-sm" placeholder="Note (required to reject)" value={notes[o.id] ?? ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
              <Button size="sm" disabled={busy} onClick={() => review(o.id, 'approve')}>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => review(o.id, 'reject')}>Reject</Button></span></li>))}</ul>}
      </Panel>}
      <Panel title={`Opportunities · ${open.length}`}>
        <p className="mb-2 text-xs text-muted-foreground">Posted by alumni and checked by the career center. Showing interest tells the poster how many people are interested; your name is shared only if you tick the box.</p>
        {!open.length ? <Empty>No open opportunities right now.</Empty> : <ul className="space-y-2 text-sm">{open.map((o: any) => (
          <li key={o.id} className="rounded-md border border-border p-2"><span className="flex flex-wrap items-center gap-2"><strong>{o.title}</strong> · {o.org} <Status value={o.kind} /></span>
            <span className="text-xs text-muted-foreground">Posted by {o.poster} · open until {fmtDay(o.expiresAt)}</span>
            <span className="mt-1 block whitespace-pre-wrap">{o.body}</span>
            {o.url && <a className="mt-1 inline-block text-sm underline" href={o.url} target="_blank" rel="noopener noreferrer">Open the posting (external site)</a>}
            <span className="mt-1 flex flex-wrap items-center gap-3">{o.myInterest ? <>
                <span className="text-xs">You showed interest{o.myInterest.shareName ? ' and shared your name' : ''}.</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => alumniNetwork({ action: 'interest', id: o.id, on: false, shareName: false }), 'Interest removed.')}>Remove</Button></>
              : <><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!share[o.id]} onChange={(e) => setShare({ ...share, [o.id]: e.target.checked })} />Share my name with the poster</label>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => alumniNetwork({ action: 'interest', id: o.id, on: true, shareName: !!share[o.id] }), 'Interest recorded.')}>I'm interested</Button></>}</span>
          </li>))}</ul>}
      </Panel>
      {d.alumni && <Panel title={`Your postings · ${mine.length}`}>
        <ul className="space-y-2 text-sm">{mine.map((o: any) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2"><strong>{o.title}</strong> <Status value={o.state === 'live' && !o.live ? 'expired' : o.state} />
            {o.state === 'live' && <span className="text-xs">{o.interested} interested{o.sharedNames?.length ? `: ${o.sharedNames.join(', ')}` : ''}</span>}
            {o.state === 'rejected' && o.reviewNote && <span className="text-xs">Reason: {o.reviewNote}</span>}
            {['pending', 'live'].includes(o.state) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => review(o.id, 'close')}>Close</Button>}</li>))}</ul>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await act(() => alumniNetwork({ action: 'post', ...f, expiresAt: new Date(`${f.expiresAt}T23:59:00`).toISOString() } as never), 'Sent to the career center for review.')) setF(blank); }}>
          <label className="text-xs">Kind<select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['job', 'internship', 'project', 'volunteer', 'event'].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="text-xs">Who can see it<select className={sel} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="students">Students</option><option value="alumni">Alumni</option><option value="both">Both</option></select></label>
          <label className="text-xs">Title<Input className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="text-xs">Organization<Input className="mt-1" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} /></label>
          <label className="text-xs sm:col-span-2">Description<Textarea className="mt-1" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
          <label className="text-xs">Link (https, optional)<Input className="mt-1" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></label>
          <label className="text-xs">Open until (within 90 days)<Input type="date" className="mt-1" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></label>
          <Button size="sm" className="justify-self-start" disabled={busy || f.title.trim().length < 4 || !f.expiresAt}>Send for review</Button>
        </form>
      </Panel>}
    </div>
  );
}

function Mentors({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  if (!d.student) return null;
  return (
    <Panel title="Mentoring with alumni">
      {!d.slots.length ? <Empty>No alumni mentoring slots are open right now.</Empty> : <ul className="space-y-1 text-sm">{d.slots.map((s: any) => (
        <li key={s.id} className="flex flex-wrap items-center gap-2">{fmt(s.startsAt)} · {s.mentor} · {s.label.replace(/^Mentoring · /, '')}
          {s.mine ? <><Status value="Booked" /><Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => help({ action: 'cancel', id: s.id } as never), 'Booking cancelled.')}>Cancel</Button></>
            : <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => help({ action: 'book', id: s.id } as never), 'Booked. The mentor has been told.')}>Book</Button>}</li>))}</ul>}
    </Panel>
  );
}

function Record({ d }: { d: any }) {
  if (!d.record) return null;
  const r = d.record;
  return (
    <Panel title="Your record">
      <p className="text-sm"><strong>{r.courses.length}</strong> completed courses{r.courses.length ? `: ${r.courses.slice(0, 12).join(', ')}${r.courses.length > 12 ? '…' : ''}` : ''}</p>
      <h3 className="mt-2 text-sm font-medium">Credentials</h3>
      {!r.credentials.length ? <p className="text-sm text-muted-foreground">No issued credentials.</p> : <ul className="text-sm">{r.credentials.map((c: any) => (
        <li key={c.code}>{c.title} · issued {fmtDay(c.issuedAt)} · verification code {c.code}{c.revoked ? ' · revoked' : ''}</li>))}</ul>}
      <h3 className="mt-2 text-sm font-medium">Portfolio</h3>
      {!r.portfolio.length ? <p className="text-sm text-muted-foreground">No portfolio items.</p> : <ul className="text-sm">{r.portfolio.map((p: any) => (
        <li key={p.id}>{p.title} · {p.verified ? '✓ verified by an instructor' : 'not verified'}</li>))}</ul>}
      <p className="mt-2 text-xs text-muted-foreground">Only you see this. Nothing here is shared with the directory or with employers.</p>
    </Panel>
  );
}

export default function Network() {
  const s = useLoad(() => alumniNetwork({ action: 'get' }) as Promise<any>);
  return (
    <>
      <PageHeader eyebrow="Alumni" title="Alumni network" sub="An opt-in directory, connections, opportunities checked by the career center, and alumni mentors." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">{d.alumni && <Profile key={d.profile?.version ?? 0} d={d} reload={s.reload} />}<Directory d={d} reload={s.reload} /><Connections d={d} reload={s.reload} /></div>
          <div className="space-y-4"><Opportunities d={d} reload={s.reload} /><Mentors d={d} reload={s.reload} /><Record d={d} /></div>
        </div>)}</Loadable>
    </>
  );
}
