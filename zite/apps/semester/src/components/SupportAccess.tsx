import { useState } from 'react';
import { toast } from 'sonner';
import { supportAccessApproval } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL: Record<string, string> = { configuration: 'Institution configuration', integration_status: 'Integration status', course_catalog: 'Course catalog' };

function Decide({ r, onDone }: { r: any; onDone: () => void }) {
  const [note, setNote] = useState('');
  const go = async (approve: boolean) => {
    try { await supportAccessApproval({ action: 'decide', id: r.id, approve, seenHash: r.hash, note }); toast(approve ? 'Approved.' : 'Denied.'); onDone(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input aria-label={`Note for request ${r.number}`} placeholder="Note (required to deny)" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-xs" />
      <Button size="sm" onClick={() => go(true)}>Approve for {r.hours} h</Button>
      <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => go(false)}>Deny</Button>
    </div>
  );
}

export default function SupportAccess() {
  const s = useLoad(() => supportAccessApproval({ action: 'list' }));
  return (
    <Loadable state={s}>{(d: any) => !d.ready ? <Empty>Semester support has not requested access to your institution.</Empty> : (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Semester support has no standing access to your institution. They can only see what you approve, for the hours you approve, and never student records. You can end access at any time.</p>
        {!d.requests.length ? <Empty>No support access requests.</Empty> : d.requests.map((r: any) => (
          <Panel key={r.id} title={`#${r.number} · ticket ${r.ticket}`}>
            <p className="flex items-center gap-2 text-sm"><Status value={r.active ? 'Active' : r.state} /> requested {fmt(r.requestedAt)}{r.expiresAt ? ` · ${r.active ? 'expires' : 'expired'} ${fmt(r.expiresAt)}` : ''}</p>
            <p className="mt-1 text-sm">{r.purpose}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.scopes.map((x: string) => LABEL[x]).join(', ')} · {r.hours} h</p>
            {r.state === 'pending' && <Decide r={r} onDone={s.reload} />}
            {r.active && <Button size="sm" variant="outline" className="mt-2" onClick={async () => { try { await supportAccessApproval({ action: 'revoke', id: r.id }); toast('Access ended.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>End access now</Button>}
          </Panel>))}
        <Panel title={`Access log · ${d.log.length}`}>{d.log.length ? <ul className="space-y-1 text-sm">{d.log.map((l: any, i: number) => <li key={i}>{fmt(l.at)} · {LABEL[l.scope] ?? l.scope} · {l.allowed ? 'allowed' : `denied (${l.reason})`}</li>)}</ul> : <Empty>No access yet.</Empty>}</Panel>
      </div>)}
    </Loadable>
  );
}
