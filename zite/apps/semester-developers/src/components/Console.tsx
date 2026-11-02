import { useState } from 'react';
import { toast } from 'sonner';
import { platform as consoleApi, PlatformOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { act } from '../hooks';
import { fmt } from '../util';

type App = { id: string; name: string; developer: string; developerId: string; developerTenant: string; status: string; scopes: string[]; review: string;
  reviewedBy: string; reviewedAt: string | null; note: string; installs: number; calls: number; denied: number; createdAt: string };
type Install = { id: string; appId: string; appName: string; tenant: string; scopes: string[]; status: string; expiresAt: string; calls: number; denied: number; lastCall: string | null };
type Data = Omit<PlatformOutputType, 'apps' | 'installs'> & { apps: App[]; installs: Install[] };

const tone: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { approved: 'default', unreviewed: 'secondary', rejected: 'destructive', suspended: 'destructive', revoked: 'outline', active: 'default', sandbox: 'outline' };
export const Pill = ({ v }: { v: string }) => <Badge variant={tone[v] ?? 'outline'} className="capitalize">{v}</Badge>;
const Scopes = ({ s }: { s: string[] }) => <div className="flex flex-wrap gap-1">{s.map((x) => <code key={x} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{x}</code>)}</div>;

function ReasonDialog({ title, label, open, onClose, onSubmit, min = 5 }: { title: string; label: string; open: boolean; onClose: () => void; onSubmit: (t: string) => void; min?: number }) {
  const [t, setT] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Textarea rows={3} placeholder={`Reason (at least ${min} characters)`} value={t} onChange={(e) => setT(e.target.value)} />
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={t.trim().length < min} onClick={() => { onSubmit(t); setT(''); }}>{label}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewQueue({ d, set }: { d: Data; set: (x: Data) => void }) {
  const [open, setOpen] = useState<{ app: App; approve: boolean } | null>(null);
  const queue = d.apps.filter((a) => a.review === 'unreviewed' && !a.name.startsWith('[Sandbox]'));
  const decide = (note: string) => { const o = open!; setOpen(null);
    act(() => consoleApi({ action: 'decide', appId: o.app.id, approve: o.approve, seenScopes: o.app.scopes, note }), (r) => { set(r); toast.success(r.message); }); };
  if (!queue.length) return <p className="py-12 text-center text-sm text-muted-foreground">Nothing waiting for review.</p>;
  return (
    <div className="space-y-3">
      {queue.map((a) => (
        <div key={a.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-display text-lg">{a.name}</p><p className="text-xs text-muted-foreground">{a.developer} · {a.developerTenant} · registered {fmt(a.createdAt)}</p></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={a.developerId === d.me} onClick={() => setOpen({ app: a, approve: false })}>Reject</Button>
              <Button size="sm" disabled={a.developerId === d.me} onClick={() => setOpen({ app: a, approve: true })}>Approve these scopes</Button>
            </div>
          </div>
          <div className="mt-3"><Scopes s={a.scopes} /></div>
          {a.developerId === d.me && <p className="mt-2 text-xs text-muted-foreground">You registered this app, so someone else reviews it.</p>}
        </div>
      ))}
      <ReasonDialog open={!!open} onClose={() => setOpen(null)} title={open?.approve ? `Approve ${open.app.name}?` : `Reject ${open?.app.name}?`} label={open?.approve ? 'Approve' : 'Reject'} onSubmit={decide} />
    </div>
  );
}

export function AppsTable({ d, set }: { d: Data; set: (x: Data) => void }) {
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<App | null>(null);
  const rows = d.apps.filter((a) => `${a.name} ${a.developer} ${a.developerTenant}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (reason: string) => { const a = target!; setTarget(null);
    act(() => consoleApi({ action: 'setStatus', appId: a.id, status: a.status === 'suspended' ? 'sandbox' : 'suspended', reason }), (r) => { set(r); toast.success(r.message); }); };
  return (
    <>
      <Input className="mb-3 max-w-xs" placeholder="Search apps, developers, institutions" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2"><th>App</th><th>Developer</th><th>Scopes</th><th>Review</th><th>Status</th><th className="text-right">Installs</th><th className="text-right">Calls / denied</th><th /></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2.5 align-top">
              <td><p className="font-medium">{a.name}</p><p className="font-mono text-[11px] text-muted-foreground">{a.id}</p></td>
              <td>{a.developer}<p className="text-xs text-muted-foreground">{a.developerTenant}</p></td>
              <td><Scopes s={a.scopes} /></td>
              <td><Pill v={a.review} />{a.reviewedBy && <p className="mt-1 text-xs text-muted-foreground">{a.reviewedBy}</p>}</td>
              <td><Pill v={a.status} /></td>
              <td className="text-right tabular-nums">{a.installs}</td>
              <td className="text-right tabular-nums">{a.calls} / <span className={a.denied ? 'text-destructive' : ''}>{a.denied}</span></td>
              <td className="text-right"><Button size="sm" variant="outline" onClick={() => setTarget(a)}>{a.status === 'suspended' ? 'Reinstate' : 'Suspend'}</Button></td>
            </tr>))}</tbody>
        </table>
        {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">No apps match.</p>}
      </div>
      <ReasonDialog open={!!target} onClose={() => setTarget(null)} title={target?.status === 'suspended' ? `Reinstate ${target?.name}?` : `Suspend ${target?.name} everywhere?`} label={target?.status === 'suspended' ? 'Reinstate' : 'Suspend'} onSubmit={toggle} />
    </>
  );
}

export function KeysTable({ d, set }: { d: Data; set: (x: Data) => void }) {
  const [target, setTarget] = useState<Data['installs'][0] | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);
  const rows = d.installs.filter((i) => !onlyActive || i.status === 'active');
  const revoke = (reason: string) => { const i = target!; setTarget(null);
    act(() => consoleApi({ action: 'revokeInstall', installId: i.id, reason }), (r) => { set(r); toast.success(r.message); }); };
  return (
    <>
      <div className="mb-3 flex items-center justify-between"><p className="text-xs text-muted-foreground">Tokens are stored only as hashes — nobody here can see one, only revoke it.</p>
        <Button size="sm" variant="outline" onClick={() => setOnlyActive(!onlyActive)}>{onlyActive ? 'Show revoked too' : 'Active only'}</Button></div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2"><th>Install</th><th>Institution</th><th>Granted</th><th>Status</th><th>Expires</th><th>Last call</th><th className="text-right">Calls / denied</th><th /></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2.5 align-top">
              <td><p className="font-medium">{i.appName}</p><p className="font-mono text-[11px] text-muted-foreground">{i.id}</p></td>
              <td>{i.tenant}</td><td><Scopes s={i.scopes} /></td><td><Pill v={i.status} /></td>
              <td className="text-xs">{fmt(i.expiresAt)}</td><td className="text-xs">{fmt(i.lastCall)}</td>
              <td className="text-right tabular-nums">{i.calls} / {i.denied}</td>
              <td className="text-right">{i.status === 'active' && <Button size="sm" variant="outline" onClick={() => setTarget(i)}>Revoke</Button>}</td>
            </tr>))}</tbody>
        </table>
        {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">No tokens.</p>}
      </div>
      <ReasonDialog open={!!target} onClose={() => setTarget(null)} title={`Revoke ${target?.appName} for ${target?.tenant}?`} label="Revoke token" onSubmit={revoke} />
    </>
  );
}

export function AuditLog({ d }: { d: Data }) {
  return (
    <div className="rounded-lg border bg-card">
      {d.audit.length ? d.audit.map((a) => (
        <div key={a.id} className="grid gap-1 border-b px-4 py-2.5 text-sm last:border-0 md:grid-cols-[150px_140px_1fr]">
          <span className="text-xs text-muted-foreground">{fmt(a.at)}</span>
          <span className="font-mono text-xs">{a.action}</span>
          <span>{a.actor} · {a.tenant} · <span className="font-mono text-xs">{a.target}</span>{a.detail && <span className="text-muted-foreground"> — {a.detail}</span>}</span>
        </div>)) : <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>}
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">Append-only: the database refuses edits and deletes to this log. Latest 100 entries.</p>
    </div>
  );
}
