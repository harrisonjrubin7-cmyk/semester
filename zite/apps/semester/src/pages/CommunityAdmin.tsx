import { useState } from 'react';
import { toast } from 'sonner';
import { communityAdmin } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type H = { members: number; posts30: number; posters30: number; reports30: number; openReports: number; medianHoursToDecision: number | null; hiddenNow: number; flags: string[] };
type C = { id: string; name: string; members: number; setUp: boolean; description: string; guidelines: string; policy: string; state: string; version: number; health: H | null };
type R = { id: number; groupId: string; community: string; person: string; mine: boolean; note: string; at: string | null };
type Data = { isAdmin: boolean; isStaff: boolean; managers: { id: string; name: string }[]; communities: C[]; requests: R[] };

const run = async (input: Record<string, unknown>, ok: string, reload: () => Promise<void>) => { try { await communityAdmin(input as never); toast.success(ok); await reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };

function Community({ c, reload }: { c: C; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState(false); const [f, setF] = useState({ description: c.description, guidelines: c.guidelines, policy: c.policy });
  const h = c.health;
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.members} members · {c.setUp ? (c.policy === 'request' ? 'Request to join' : 'Open to join') : 'Not set up (open, no guidelines)'}</p></div><Status value={c.state} /></div>
      {h && <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <span>Posts (30 days): <b>{h.posts30}</b></span><span>People posting: <b>{h.posters30}</b></span><span>Reports (30 days): <b>{h.reports30}</b></span><span>Waiting: <b>{h.openReports}</b></span>
        <span>Median to decision: <b>{h.medianHoursToDecision === null ? '—' : `${h.medianHoursToDecision} h`}</b></span><span>Hidden now: <b>{h.hiddenNow}</b></span>
      </div>}
      {h && h.flags.length > 0 && <p className="mt-1 text-xs">! {h.flags.join(' · ')}</p>}
      {c.setUp ? <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setEdit(!edit)}>{edit ? 'Close' : 'Edit settings'}</Button>
        <Button size="sm" variant="outline" onClick={() => run({ action: 'setup', step: c.state === 'active' ? 'archive' : 'reopen', groupId: c.id, expectedVersion: c.version }, c.state === 'active' ? 'Archived. Posts stay; no new members.' : 'Reopened.', reload)}>{c.state === 'active' ? 'Archive' : 'Reopen'}</Button>
      </div> : <p className="mt-2 text-xs text-muted-foreground">Created before setup existed. Create a new community to add guidelines and a join policy.</p>}
      {edit && <div className="mt-2 space-y-2">
        <Label htmlFor={`d-${c.id}`}>Description</Label><Input id={`d-${c.id}`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Label htmlFor={`g-${c.id}`}>Guidelines</Label><Textarea id={`g-${c.id}`} rows={4} value={f.guidelines} onChange={(e) => setF({ ...f, guidelines: e.target.value })} />
        <fieldset className="text-xs"><legend>Join policy</legend><label className="mr-3"><input type="radio" checked={f.policy === 'open'} onChange={() => setF({ ...f, policy: 'open' })} /> Open</label><label><input type="radio" checked={f.policy === 'request'} onChange={() => setF({ ...f, policy: 'request' })} /> Request to join</label></fieldset>
        <Button size="sm" disabled={f.guidelines.trim().length < 40} onClick={async () => { if (await run({ action: 'setup', step: 'edit', groupId: c.id, expectedVersion: c.version, ...f }, 'Saved', reload)) setEdit(false); }}>Save</Button>
      </div>}
    </div>
  );
}

export default function CommunityAdmin() {
  const state = useLoad(() => communityAdmin({ action: 'get' }) as Promise<Data>);
  const [n, setN] = useState({ name: '', description: '', guidelines: '', policy: 'open' });
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <>
      <PageHeader eyebrow="Campus" title="Communities" sub="Set up communities with guidelines and a join policy, answer join requests, and see how each community is doing." />
      <Loadable state={state}>{(d: Data) => !d.isStaff && !d.isAdmin ? <Empty>Community managers are appointed by an administrator. Browse and join communities in Campus.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {d.isStaff && <Panel title={`Join requests · ${d.requests.length}`}>{d.requests.length === 0 ? <Empty>✓ None waiting.</Empty> : d.requests.map((r) => (
              <div key={r.id} className="border-b border-border py-2 text-sm last:border-0"><p><span className="font-medium">{r.person}</span> → {r.community} · {fmt(r.at)}</p>{r.note && <p className="text-xs text-muted-foreground">“{r.note}”</p>}
                {r.mine ? <p className="text-xs">Another manager answers your own request.</p> : <div className="mt-1 flex flex-wrap gap-2"><Button size="sm" onClick={() => run({ action: 'decide', id: r.id, approve: true }, 'Approved and added', state.reload)}>Approve</Button><Input aria-label="Reason to decline" className="h-8 w-56" placeholder="Reason to decline (10+)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} /><Button size="sm" variant="outline" disabled={(notes[r.id] ?? '').trim().length < 10} onClick={() => run({ action: 'decide', id: r.id, approve: false, note: notes[r.id] }, 'Declined', state.reload)}>Decline</Button></div>}
              </div>))}</Panel>}
            <Panel title="Communities">{d.communities.length === 0 ? <Empty>No communities yet.</Empty> : d.communities.map((c) => <Community key={c.id} c={c} reload={state.reload} />)}
              <p className="mt-2 text-xs text-muted-foreground">Health shows counts only — no names or post text. Moderation decisions stay with moderators.</p></Panel>
          </div>
          <div className="space-y-4">
            {d.isStaff && <Panel title="New community">
              <Label htmlFor="nc-n">Name</Label><Input id="nc-n" className="mt-1" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
              <Label htmlFor="nc-d" className="mt-3 block">Description</Label><Input id="nc-d" className="mt-1" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} />
              <Label htmlFor="nc-g" className="mt-3 block">Guidelines</Label><Textarea id="nc-g" className="mt-1" rows={5} value={n.guidelines} onChange={(e) => setN({ ...n, guidelines: e.target.value })} placeholder="What's welcome, what isn't, and how moderation works here (40+ characters)" />
              <fieldset className="mt-3 text-xs"><legend>Join policy</legend><label className="mr-3"><input type="radio" checked={n.policy === 'open'} onChange={() => setN({ ...n, policy: 'open' })} /> Open</label><label><input type="radio" checked={n.policy === 'request'} onChange={() => setN({ ...n, policy: 'request' })} /> Request to join</label></fieldset>
              <Button className="mt-3 w-full" disabled={n.name.trim().length < 3 || n.guidelines.trim().length < 40} onClick={async () => { if (await run({ action: 'create', ...n }, 'Community created', state.reload)) setN({ name: '', description: '', guidelines: '', policy: 'open' }); }}>Create</Button>
            </Panel>}
            {d.isAdmin && <Panel title="Community managers (administrators)">
              <ul className="text-sm">{d.managers.map((m) => <li key={m.id}>{m.name}</li>)}</ul>{!d.managers.length && <Empty>None yet.</Empty>}
              <Label htmlFor="cm-e" className="mt-3 block">Email</Label><Input id="cm-e" className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="mt-2 flex gap-2"><Button size="sm" disabled={!email.includes('@')} onClick={() => run({ action: 'setStaff', email, on: true }, 'Appointed', state.reload)}>Appoint</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => run({ action: 'setStaff', email, on: false }, 'Removed', state.reload)}>Remove</Button></div>
            </Panel>}
          </div>
        </div>
      )}</Loadable>
    </>
  );
}
