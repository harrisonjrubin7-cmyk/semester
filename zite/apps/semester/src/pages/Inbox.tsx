import { useState } from 'react';
import { toast } from 'sonner';
import { inbox } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Input } from '@project/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Checkbox } from '@project/components/ui/checkbox';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, errMsg } from '../components/kit';

type Msg = { id: string; body: string; read: boolean; from: string; to: string[]; sentAt: string | null };

function Row({ m, onToggle, sent }: { m: Msg; onToggle?: () => void; sent?: boolean }) {
  return (
    <li className="flex gap-3 border-b border-border py-3 last:border-0">
      <span aria-hidden className="mt-1 w-3 text-xs">{sent ? '→' : m.read ? '○' : '●'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm"><span className={m.read || sent ? '' : 'font-semibold'}>{sent ? `To ${m.to.join(', ')}` : m.from}</span><span className="ml-2 text-xs text-muted-foreground">{fmt(m.sentAt)}</span></p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
      </div>
      {onToggle && <Button size="sm" variant="ghost" onClick={onToggle}>{m.read ? 'Mark unread' : 'Mark read'}</Button>}
    </li>
  );
}

function Compose({ people, onSent }: { people: { id: string; name: string }[]; onSent: () => void }) {
  const [to, setTo] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const list = people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const send = async () => {
    setBusy(true);
    try { await inbox({ action: 'send', to, body }); toast('Message sent. It shows in their Mail.'); setTo([]); setBody(''); onSent(); }
    catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Panel title="New message">
      <Input placeholder="Find a person at your institution" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
        {list.length ? list.map((p) => (
          <li key={p.id}><label className="flex items-center gap-2"><Checkbox checked={to.includes(p.id)} onCheckedChange={(v) => setTo(v ? [...to, p.id] : to.filter((x) => x !== p.id))} />{p.name}</label></li>
        )) : <li className="text-muted-foreground">No one matches.</li>}
      </ul>
      <Textarea className="mt-3" rows={4} placeholder="Write your message" value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="mt-2 text-xs text-muted-foreground">Recipients see your name. Messages stay inside your institution.</p>
      <Button className="mt-3" disabled={!to.length || !body.trim() || busy} onClick={send}>{busy ? 'Sending…' : `Send to ${to.length || '…'}`}</Button>
    </Panel>
  );
}

export default function Inbox({ initial = 'notifications' }: { initial?: 'notifications' | 'mail' }) {
  const s = useLoad(() => inbox({ action: 'list' }));
  const toggle = async (m: Msg) => { try { await inbox({ action: 'read', id: m.id, read: !m.read }); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <>
      <PageHeader eyebrow="Today" title={initial === 'mail' ? 'Mail' : 'Notifications'} sub="Messages from people and offices at your institution, and notices Semester sends about your records." actions={<Button variant="outline" onClick={async () => { await inbox({ action: 'readAll' }); s.reload(); }}>Mark all read</Button>} />
      <Loadable state={s}>{(d) => (
        <Tabs defaultValue={initial}>
          <TabsList><TabsTrigger value="notifications">Notifications · {d.notifications.filter((m: Msg) => !m.read).length}</TabsTrigger><TabsTrigger value="mail">Mail · {d.mail.filter((m: Msg) => !m.read).length}</TabsTrigger><TabsTrigger value="sent">Sent</TabsTrigger></TabsList>
          <TabsContent value="notifications"><Panel>{d.notifications.length ? <ul>{d.notifications.map((m: Msg) => <Row key={m.id} m={m} onToggle={() => toggle(m)} />)}</ul> : <Empty>No notifications. Notices about holds, grades and approvals appear here.</Empty>}</Panel></TabsContent>
          <TabsContent value="mail"><div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><Panel>{d.mail.length ? <ul>{d.mail.map((m: Msg) => <Row key={m.id} m={m} onToggle={() => toggle(m)} />)}</ul> : <Empty>No mail yet.</Empty>}</Panel><Compose people={d.people} onSent={s.reload} /></div></TabsContent>
          <TabsContent value="sent"><Panel>{d.sent.length ? <ul>{d.sent.map((m: Msg) => <Row key={m.id} m={m} sent />)}</ul> : <Empty>You haven’t sent anything.</Empty>}</Panel></TabsContent>
        </Tabs>
      )}</Loadable>
    </>
  );
}
