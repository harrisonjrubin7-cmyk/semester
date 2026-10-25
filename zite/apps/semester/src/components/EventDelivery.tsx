import { useState } from 'react';
import { toast } from 'sonner';
import { eventDelivery } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, Metric, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: (r: any) => string, reload: () => void) => { try { const r = await eventDelivery(input); toast(ok(r)); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };

/** Console tab (Integration Admin): delivery health, dead letters and two-person replay. */
export default function EventDelivery() {
  const s = useLoad(() => eventDelivery({ action: 'get' }));
  const [reasons, setReasons] = useState<Record<number, string>>({});
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="grid gap-4">
        <Panel title="Event delivery" action={<Button size="sm" variant="outline" onClick={() => run({ action: 'process' }, (r) => `Delivered ${r.ran?.delivered ?? 0}, retrying ${r.ran?.retrying ?? 0}, dead ${r.ran?.dead ?? 0}.`, s.reload)}>Process now</Button>}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Pending" value={d.stats.pending} />
            <Metric label="Oldest pending" value={d.stats.oldestSeconds == null ? '—' : `${Math.round(d.stats.oldestSeconds / 60)} min`} />
            <Metric label="Dead letters" value={d.stats.dead} />
            <Metric label="Delivered" value={d.stats.delivered} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Events are delivered at least once to handlers that are safe to repeat. After three failures an event stops and waits here.</p>
        </Panel>
        <Panel title={`Dead letters · ${d.dead.length}`}>
          {!d.dead.length ? <Empty>No dead letters.</Empty> : d.dead.map((x: any) => (
            <div key={x.id} className="border-t border-border py-2 text-sm first:border-0">
              <p>#{x.id} · {x.topic} · {x.ref} · {x.attempts} attempts · {fmt(x.at)}</p>
              <p className="text-xs text-muted-foreground">{x.error}</p>
              {x.replay ? <p className="text-xs">Replay requested; waiting for a second administrator.</p> : <div className="mt-1 flex gap-2">
                <Input aria-label="What was fixed" className="max-w-sm" placeholder="What was fixed (needed to replay)" value={reasons[x.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [x.id]: e.target.value })} />
                <Button size="sm" variant="outline" disabled={(reasons[x.id] ?? '').trim().length < 10} onClick={() => run({ action: 'requestReplay', outboxId: x.id, reason: reasons[x.id] }, () => 'Replay requested. Another administrator must approve it.', s.reload)}>Request replay</Button>
              </div>}
            </div>))}
        </Panel>
        {d.replays.length > 0 && <Panel title="Replay requests">
          {d.replays.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
              <span>Event #{r.outboxId} · {r.reason} · by {r.requestedBy}{r.approvedBy && ` · approved by ${r.approvedBy}`}</span>
              {!r.approvedBy && (r.requestedByMe ? <span className="text-xs text-muted-foreground">Another administrator approves</span>
                : <Button size="sm" onClick={() => run({ action: 'approveReplay', replayId: r.id }, (x) => `Approved and replayed: delivered ${x.ran?.delivered ?? 0}.`, s.reload)}>Approve replay</Button>)}
            </div>))}
        </Panel>}
        <Panel title="Referral load by office (projection)">
          {!d.officeLoad.length ? <Empty>No referrals yet.</Empty> : <ul className="text-sm">{d.officeLoad.map((l: any) => <li key={l.office} className="border-t border-border py-1.5 first:border-0">{l.office}: {l.awaitingConsent} awaiting student OK · {l.queued} queued · {l.accepted} in progress <span className="text-xs text-muted-foreground">· updated {fmt(l.updatedAt)}</span></li>)}</ul>}
        </Panel>
      </div>)}
    </Loadable>
  );
}
