import { useState } from 'react';
import { toast } from 'sonner';
import { community } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, errMsg } from '../components/kit';
import { ConfirmAction } from '../components/overlays';
import Moderation from '../components/Moderation';

type Post = { id: string; body: string; author: string; mine: boolean; group: string; groupId: string; sentAt: string | null };

export default function Community() {
  const [g, setG] = useState<string | undefined>();
  const s = useLoad(() => community({ action: 'feed', groupId: g }), [g]);
  const [body, setBody] = useState('');
  const [to, setTo] = useState<string>('');
  const [reason, setReason] = useState('');
  const post = async () => { try { await community({ action: 'post', groupId: to, body }); setBody(''); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <>
      <PageHeader eyebrow="Campus" title="Community" sub="Posts from the clubs, communities and study groups you have joined. Members of each group see its posts." />
      <Loadable state={s}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Panel title="Your groups">
            <ul className="space-y-1 text-sm">
              <li><button onClick={() => setG(undefined)} className={cn('w-full rounded-[3px] border-l-2 border-transparent px-2 py-1 text-left', !g && 'border-primary bg-accent font-medium')}>All groups</button></li>
              {d.groups.map((x: { id: string; name: string; members: number }) => <li key={x.id}><button onClick={() => setG(x.id)} className={cn('w-full rounded-[3px] border-l-2 border-transparent px-2 py-1 text-left', g === x.id && 'border-primary bg-accent font-medium')}>{x.name}<span className="block text-xs text-muted-foreground">{x.members} members</span></button></li>)}
            </ul>
            {!d.groups.length && <p className="text-xs text-muted-foreground">Join a club in Clubs & events to see its posts.</p>}
          </Panel>
          <div className="space-y-4">
            {d.groups.length > 0 && (
              <Panel>
                <Textarea rows={3} placeholder="Share something with a group" value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={to} onValueChange={setTo}><SelectTrigger className="w-56"><SelectValue placeholder="Post to…" /></SelectTrigger><SelectContent>{d.groups.map((x: { id: string; name: string }) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>
                  <Button disabled={!to || !body.trim()} onClick={post}>Post</Button>
                  <span className="text-xs text-muted-foreground">Visible to that group’s members.</span>
                </div>
              </Panel>
            )}
            {d.posts.length ? d.posts.map((p: Post) => (
              <Panel key={p.id}>
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{p.author}</span> · {p.group} · {fmt(p.sentAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  {p.mine ? <button className="text-muted-foreground underline" onClick={async () => { await community({ action: 'delete', id: p.id }); s.reload(); }}>Delete</button> : (
                    <ConfirmAction trigger={<button className="text-muted-foreground underline">Report</button>} title="Report this post?" confirmLabel="Send report" onConfirm={async () => { const r = await community({ action: 'report', id: p.id, reason: reason || 'Not appropriate' }); toast(`Report sent to moderation · Ref ${r.reference}`); setReason(''); }}>
                      <p className="text-sm text-muted-foreground">Your report goes to your institution’s moderation queue. The author isn’t told who reported it.</p>
                      <Textarea rows={3} placeholder="What’s wrong with it?" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </ConfirmAction>
                  )}
                </div>
              </Panel>
            )) : <Empty>No posts yet. Be the first to post in one of your groups.</Empty>}
          </div>
        </div>
      )}</Loadable>
      <Moderation />
    </>
  );
}
