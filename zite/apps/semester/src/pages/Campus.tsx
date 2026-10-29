import { useState } from 'react';
import { toast } from 'sonner';
import { campus, privacy } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Flag } from 'lucide-react';
import { PageHeader, Panel, Empty, SourceTag, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type G = { id: string; name: string; kind: string; members: number; joined: boolean; policy?: string; archived?: boolean; pending?: boolean };
type E = { id: string; title: string; startsAt: string | null; location: string; group: string; going: boolean; count: number };

function ProfileVisibility() {
  const state = useLoad(() => privacy({ action: 'get' }));
  return (
    <Panel title="Who can see your profile?">
      <Loadable state={state}>{(d) => {
        const c = d.consents.find((x: { type: string }) => x.type === 'Directory Visibility');
        const set = async (on: boolean) => { if (!c) return; try { await privacy({ action: 'setConsent', id: c.id, granted: on }); state.reload(); } catch (e) { toast.error(errMsg(e)); } };
        return (
          <div className="space-y-1.5 text-sm">
            {[['Only me', false], ['Course', null], ['Selected people', null], ['Public portfolio', null], ['Campus directory', true]].map(([label, val]) => (
              <button key={String(label)} disabled={val === null} onClick={() => set(val as boolean)} className="flex w-full items-center gap-2 text-left font-sans disabled:text-muted-foreground">
                <span>{(val === true && c?.granted) || (val === false && !c?.granted) ? '●' : '○'}</span>{label}{val === null && <span className="text-xs">· per item in Study</span>}
              </button>))}
          </div>);
      }}</Loadable>
    </Panel>
  );
}

export default function Campus() {
  const state = useLoad(() => campus({ action: 'get' }));
  const [report, setReport] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const ReportBtn = ({ target }: { target: string }) => <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Report" onClick={() => { setReport(target); setReason(''); }}><Flag className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>;

  return (
    <>
      <PageHeader eyebrow="Campus" title="What’s happening" sub="Clubs, communities and events at your institution." />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {d.groups.length === 0 ? <Empty>No groups yet.</Empty> : d.groups.map((g: G) => (
                <Panel key={g.id}>
                  <div className="flex items-start justify-between"><p className="eyebrow">{g.kind}</p><div className="flex items-center gap-1"><SourceTag source="Sample" /><ReportBtn target={g.name} /></div></div>
                  <p className="font-display text-xl">{g.name}</p><p className="text-sm text-muted-foreground">{g.members} members</p>
                  {g.pending ? <p className="mt-3 text-xs text-muted-foreground">… Request sent. A community manager will answer.</p> : g.archived && !g.joined ? <p className="mt-3 text-xs text-muted-foreground">Archived · not taking new members</p> :
                    <Button size="sm" variant={g.joined ? 'outline' : 'default'} className="mt-3 w-full" onClick={() => act(async () => { const r = (await campus({ action: 'toggleGroup', id: g.id })) as { requested?: boolean }; if (r.requested) toast.success('Request sent to the community managers'); })}>{g.joined ? '✓ Joined · Leave' : g.policy === 'request' ? 'Ask to join' : 'Join'}</Button>}
                </Panel>))}
            </div>
            <Panel title="Events">
              {d.events.length === 0 ? <Empty>No upcoming events.</Empty> : d.events.map((e: E) => (
                <div key={e.id} className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
                  <div><p className="font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{fmt(e.startsAt)} · {e.location} · {e.group} · {e.count} going</p></div>
                  <div className="flex items-center gap-1"><ReportBtn target={e.title} /><Button size="sm" variant={e.going ? 'outline' : 'default'} onClick={() => act(() => campus({ action: 'toggleEvent', id: e.id }), e.going ? undefined : 'Added to your calendar and Today')}>{e.going ? '✓ Going' : 'RSVP'}</Button></div>
                </div>))}
            </Panel>
          </div>
          <ProfileVisibility />
        </div>
      )}</Loadable>
      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report “{report}”</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Your report goes to the institution’s moderation queue as a case.</p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What’s wrong?" />
          <DialogFooter><Button disabled={reason.trim().length < 3} onClick={() => { const t = report!; setReport(null); act(() => campus({ action: 'report', target: t, reason }), 'Report sent to moderation'); }}>Send report</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
