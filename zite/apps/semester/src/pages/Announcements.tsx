import { useState } from 'react';
import { toast } from 'sonner';
import { announcements } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Corr = { text: string; at: string };
type Feed = { id: number; title: string; body: string; important: boolean; mustAck: boolean; acked: boolean; communities: string[]; publishedAt: string | null; expiresAt: string | null; corrections: Corr[] };
type Work = { id: number; title: string; body: string; hash: string; groups: string[]; communities: string[]; important: boolean; mustAck: boolean; publishAt: string | null; expiresAt: string | null; state: string; live: boolean; mine: boolean;
  author: string; approver: string | null; withdrawnReason: string | null; corrections: Corr[]; acks: number; audience: number; rev: number };
type Data = { manager: boolean; communities: { id: string; name: string; members: number }[]; feed: Feed[]; work: Work[] };

const call = async (input: Record<string, unknown>, ok: string, reload: () => void) => { try { await announcements(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

function FeedItem({ f, reload }: { f: Feed; reload: () => void }) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <p className="font-medium">{f.important ? '! ' : ''}{f.title} {f.important && <span className="text-xs font-normal">Important</span>}</p>
      <p className="text-xs text-muted-foreground">{f.communities.join(', ')} · {fmt(f.publishedAt)}{f.expiresAt ? ` · until ${fmt(f.expiresAt)}` : ''}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{f.body}</p>
      {f.corrections.map((c, i) => <p key={i} className="mt-1 rounded-sm border-l-2 border-border pl-2 text-sm"><span className="font-medium">Correction {fmt(c.at)}:</span> {c.text}</p>)}
      {f.mustAck && (f.acked ? <p className="mt-1 text-xs">✓ You acknowledged this</p> : <Button size="sm" className="mt-2" onClick={() => call({ action: 'ack', id: f.id }, 'Acknowledged', reload)}>I've read this</Button>)}
    </div>
  );
}

function WorkItem({ w, reload }: { w: Work; reload: () => void }) {
  const [t, setT] = useState('');
  return (
    <div className="border-b border-border py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{w.title} <span className="text-xs text-muted-foreground">{w.communities.join(', ')}</span></p>
        <Status value={w.state === 'approved' ? (w.live ? 'live' : w.expiresAt && new Date(w.expiresAt) < new Date() ? 'expired' : 'scheduled') : w.state.replace('_', ' ')} /></div>
      <p className="whitespace-pre-wrap">{w.body}</p>
      <p className="text-xs text-muted-foreground">by {w.mine ? 'you' : w.author}{w.approver ? ` · approved by ${w.approver}` : ''}{w.important ? ' · important' : ''}{w.publishAt ? ` · from ${fmt(w.publishAt)}` : ''}{w.expiresAt ? ` until ${fmt(w.expiresAt)}` : ''}
        {w.mustAck ? ` · ${w.acks} of ${w.audience} members acknowledged` : ''}{w.withdrawnReason ? ` · withdrawn: ${w.withdrawnReason}` : ''}</p>
      {w.corrections.map((c, i) => <p key={i} className="text-xs">Correction {fmt(c.at)}: {c.text}</p>)}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {w.state === 'draft' && w.mine && <Button size="sm" onClick={() => call({ action: 'step', step: 'submit', id: w.id, expectedVersion: w.rev }, w.groups.length > 1 || w.important ? 'Sent to another manager for approval' : 'Published', reload)}>{w.groups.length > 1 || w.important ? 'Send for approval' : 'Publish'}</Button>}
        {w.state === 'pending_approval' && (w.mine ? <span className="text-xs text-muted-foreground">Another community manager approves this.</span> :
          <Button size="sm" onClick={() => call({ action: 'step', step: 'approve', id: w.id, expectedVersion: w.rev, seen: w.hash }, 'Approved and published', reload)}>Approve and publish</Button>)}
        {w.state !== 'withdrawn' && <><Input aria-label={`Correction or reason for ${w.title}`} className="h-8 w-72" placeholder={w.state === 'approved' ? 'Correction, or reason to withdraw' : 'Reason to withdraw'} value={t} onChange={(e) => setT(e.target.value)} />
          {w.state === 'approved' && <Button size="sm" variant="outline" disabled={t.trim().length < 10} onClick={() => call({ action: 'step', step: 'correct', id: w.id, expectedVersion: w.rev, text: t }, 'Correction added', reload)}>Add correction</Button>}
          <Button size="sm" variant="ghost" disabled={t.trim().length < 10} onClick={() => call({ action: 'step', step: 'withdraw', id: w.id, expectedVersion: w.rev, text: t }, 'Withdrawn', reload)}>Withdraw</Button></>}
      </div>
    </div>
  );
}

function Compose({ d, reload }: { d: Data; reload: () => void }) {
  const [f, setF] = useState({ title: '', body: '', important: false, mustAck: false, publishAt: '', expiresAt: '' });
  const [groups, setGroups] = useState<string[]>([]);
  const second = groups.length > 1 || f.important;
  return (
    <Panel title="New announcement">
      {d.communities.length === 0 ? <Empty>Set up a community first (Communities page).</Empty> : <div className="grid gap-2">
        <fieldset className="flex flex-wrap gap-3"><legend className="mb-1 text-sm font-medium">Communities</legend>{d.communities.map((c) => <label key={c.id} className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={groups.includes(c.id)} onChange={(e) => setGroups(e.target.checked ? [...groups, c.id] : groups.filter((x) => x !== c.id))} />{c.name} <span className="text-xs text-muted-foreground">({c.members})</span></label>)}</fieldset>
        <Input aria-label="Title" className="h-8" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea aria-label="Announcement" rows={4} placeholder="What members need to know" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.important} onChange={(e) => setF({ ...f, important: e.target.checked })} />Important</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.mustAck} onChange={(e) => setF({ ...f, mustAck: e.target.checked })} />Ask members to acknowledge</label>
          <div><Label htmlFor="an-pub">Publish (optional)</Label><Input id="an-pub" type="datetime-local" className="h-8" value={f.publishAt} onChange={(e) => setF({ ...f, publishAt: e.target.value })} /></div>
          <div><Label htmlFor="an-exp">Expires (optional)</Label><Input id="an-exp" type="datetime-local" className="h-8" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">{second ? 'Going to several communities or marked important: another community manager approves the exact text before it appears.' : 'One community: it appears as soon as you publish (or at the time you set).'} Shown in Semester only; nothing is emailed.</p>
        <Button size="sm" className="w-fit" disabled={!groups.length} onClick={async () => { if (await call({ action: 'step', step: 'draft', id: null, expectedVersion: null, groups, ...f, publishAt: toIso(f.publishAt), expiresAt: toIso(f.expiresAt) }, 'Draft saved', reload)) { setF({ title: '', body: '', important: false, mustAck: false, publishAt: '', expiresAt: '' }); setGroups([]); } }}>Save draft</Button>
      </div>}
    </Panel>
  );
}

export default function Announcements() {
  const s = useLoad(() => announcements({ action: 'get' }) as Promise<Data>);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Campus" title="Announcements" sub="Announcements from the communities you belong to." />
      <Loadable state={s}>{(d: Data) => (<>
        <Panel title="For you">{d.feed.length === 0 ? <Empty>No announcements from your communities right now.</Empty> : d.feed.map((f) => <FeedItem key={f.id} f={f} reload={s.reload} />)}</Panel>
        {d.manager && <><Compose d={d} reload={s.reload} /><Panel title="Manage announcements">{d.work.length === 0 ? <Empty>None yet.</Empty> : d.work.map((w) => <WorkItem key={`${w.id}-${w.rev}`} w={w} reload={s.reload} />)}</Panel></>}
      </>)}</Loadable>
    </div>
  );
}
