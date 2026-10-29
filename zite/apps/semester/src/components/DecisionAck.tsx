import { useState } from 'react';
import { toast } from 'sonner';
import { decisionAck } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Panel, Loadable, useLoad, fmt, Status, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Shown on Transition only when there is something to show: a released decision for this person, or the staff list.
export default function DecisionAck() {
  const s = useLoad(() => decisionAck({ action: 'get' }) as Promise<any>);
  const [busy, setBusy] = useState(false);
  const ack = async (d: any) => {
    setBusy(true);
    try { await decisionAck({ action: 'ack', applicationId: d.applicationId, seen: d.seen }); toast('Acknowledged.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Loadable state={s}>{(d: any) => (
      <>
        {d.decisions.length > 0 && <Panel title="Your admissions decision">
          <ul className="space-y-3">{d.decisions.map((x: any) => (
            <li key={x.applicationId} className="text-sm">
              <span className="flex flex-wrap items-center gap-2"><strong>{x.decision}</strong> <span className="text-xs text-muted-foreground">released {fmt(x.releasedAt)}</span>
                <Status value={x.acknowledgedAt ? 'Acknowledged' : 'Not acknowledged'} /></span>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-border p-2">{x.message || 'No message was included.'}</p>
              {x.acknowledgedAt ? <p className="mt-1 text-xs text-muted-foreground">You acknowledged this on {fmt(x.acknowledgedAt)}.</p> : <>
                <Button size="sm" className="mt-2" disabled={busy} onClick={() => ack(x)}>I have read this decision</Button>
                <p className="mt-1 text-xs text-muted-foreground">Acknowledging records that you read this exact text. It does not accept an offer or pay a deposit; say whether you plan to enroll below.</p>
              </>}
            </li>))}</ul>
        </Panel>}
        {d.staff && <Panel title={`Decision acknowledgments · ${d.staff.filter((x: any) => !x.acknowledgedAt).length} not yet`}>
          {!d.staff.length ? <p className="text-sm text-muted-foreground">No released decisions.</p> : <ul className="space-y-1 text-sm">{d.staff.map((x: any) => (
            <li key={x.applicationId} className="flex flex-wrap justify-between gap-2"><span>{x.applicant} · {x.decision}</span>
              <span className="text-muted-foreground">{x.acknowledgedAt ? `acknowledged ${fmt(x.acknowledgedAt)}` : `released ${fmt(x.releasedAt)}, not acknowledged`}</span></li>))}</ul>}
        </Panel>}
      </>
    )}</Loadable>
  );
}
