import { useState } from 'react';
import { toast } from 'sonner';
import { affiliation } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

export default function Workspaces() {
  const s = useLoad(() => affiliation({ action: 'get' }));
  const [j, setJ] = useState({ inviteCode: '', role: 'Student' });
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); s.reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
  return (
    <>
      <PageHeader eyebrow="You" title="Workspaces" sub="One account for everything: your personal workspace and any institution you belong to. Joining an institution moves nothing — your personal work stays private to you." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Your workspaces">
            {d.workspaces.length ? <ul className="space-y-2">{d.workspaces.map((w: any) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-3 text-sm">
                <span className="font-medium">{w.institutionName}</span>
                <span className="text-xs text-muted-foreground">{w.personal ? 'Personal — only you' : w.sample ? 'Sample data' : 'Institution'} · {w.roles.join(', ')}</span>
                <Status value={w.current ? 'current' : w.status === 'Active' ? 'active' : w.status.toLowerCase()} />
                {w.status === 'Pending' && <span className="text-xs text-muted-foreground">Waiting for the institution’s administrator</span>}
                {w.status === 'Active' && !w.current && <Button size="sm" variant="outline" onClick={async () => { if (await run(() => affiliation({ action: 'switch', membershipId: w.id }), 'Switched.')) window.location.assign('/today'); }}>Switch to this</Button>}
              </li>))}</ul> : <Empty>No workspaces.</Empty>}
          </Panel>
          <Panel title="Join an institution">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <Input aria-label="Invite code" placeholder="Invite code from the institution" value={j.inviteCode} onChange={(e) => setJ({ ...j, inviteCode: e.target.value })} />
              <select aria-label="Join as" className={sel} value={j.role} onChange={(e) => setJ({ ...j, role: e.target.value })}>{['Student', 'Faculty', 'Advisor'].map((r) => <option key={r}>{r}</option>)}</select>
              <div><Button size="sm" disabled={j.inviteCode.trim().length < 4} onClick={async () => { if (await run(() => affiliation({ action: 'join', inviteCode: j.inviteCode, role: j.role as never }), 'Request sent. The administrator will approve it.')) setJ({ inviteCode: '', role: 'Student' }); }}>Request to join</Button></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Uses this same account — no new sign-up. The institution sees your name and email and what you do in its workspace, never your personal workspace. To take personal work with you, use Export my data on the You page.</p>
          </Panel>
        </div>)}
      </Loadable>
    </>
  );
}
