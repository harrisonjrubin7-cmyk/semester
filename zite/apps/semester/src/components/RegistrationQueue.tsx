import { useState } from 'react';
import { toast } from 'sonner';
import { registrarQueue, registrarDecide, RegistrarQueueOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Loadable, useLoad, fmtDay, Status, ActionPreview, errMsg } from './kit';
import { ConfirmAction } from './overlays';
import RegistrarLedger from './RegistrarLedger';

type Req = RegistrarQueueOutputType['pending'][0];

function Decide({ r, reload }: { r: Req; reload: () => void }) {
  const [note, setNote] = useState('');
  const go = async (decision: 'commit' | 'reject') => {
    try {
      const res = await registrarDecide({ requestId: r.id, decision, expectedSectionVersion: r.sectionVersion, note: note || undefined });
      toast(`${res.state === 'Committed' ? '✓' : res.resultCode === 'STALE_VERSION' ? '!' : '○'} ${res.message}`);
      reload();
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  if (r.self) return <span className="text-xs text-muted-foreground">Your own — another registrar decides</span>;
  const full = r.capacity != null && r.enrolled >= r.capacity;
  return (
    <span className="flex justify-end gap-2">
      <ConfirmAction trigger={<Button size="sm" disabled={full}>Commit</Button>} title={`Commit ${r.student} to ${r.section}?`} confirmLabel="Commit — confirm" keepLabel="Not yet" onConfirm={() => go('commit')}>
        <ActionPreview says={`${r.student} becomes Enrolled (Official) in ${r.section}. Seats are locked and counted inside one database transaction when you confirm.`} stays="Their other requests, holds and the SIS (not connected — record it there too)." recovery={{ kind: 'request', how: 'drop the enrollment from this desk.' }} />
      </ConfirmAction>
      <ConfirmAction trigger={<Button size="sm" variant="outline">Reject</Button>} title={`Reject ${r.student}’s request?`} confirmLabel="Reject" keepLabel="Keep pending" onConfirm={() => go('reject')}>
        <ActionPreview says="The student sees “Not approved” with the reason below." stays="Their enrollment status." recovery={{ kind: 'request', how: 'the student can submit a new request.' }} />
        <Textarea rows={2} maxLength={500} placeholder="Reason the student will see (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmAction>
    </span>
  );
}

const Row = ({ r, reload }: { r: Req; reload?: () => void }) => (
  <tr className="border-t border-border align-top">
    <td className="py-2 pr-3">{r.student}<span className="block font-mono text-[11px] text-muted-foreground">{r.requestKey.slice(0, 12)}</span></td>
    <td className="pr-3">{r.action} · {r.section}<span className="block text-xs text-muted-foreground">Seats {r.enrolled}/{r.capacity ?? '∞'} · v{r.sectionVersion} · {fmtDay(r.submittedAt)}</span></td>
    <td className="pr-3"><Status value={r.state} />{r.explanation && <span className="block text-xs text-muted-foreground">{r.explanation}</span>}</td>
    <td className="text-right">{reload ? <Decide r={r} reload={reload} /> : <span className="font-mono text-xs text-muted-foreground">{r.resultCode}</span>}</td>
  </tr>
);

export default function RegistrationQueue() {
  const s = useLoad(() => registrarQueue({}));
  return (
    <Loadable state={s}>{(d) => (
      <div className="mb-4 space-y-4">
        <Panel title={`Registration requests · ${d.pending.length} waiting`}>
          <p className="mb-2 text-xs text-muted-foreground">A submitted request is not an enrollment. Commits are decided in one Postgres transaction with a seat lock, so a section can't be oversold and a repeated click can't double-enroll.</p>
          {d.pending.length ? <table className="w-full text-sm"><tbody>{d.pending.map((r) => <Row key={r.id} r={r} reload={s.reload} />)}</tbody></table> : <Empty>No requests waiting.</Empty>}
        </Panel>
        <RegistrarLedger />
        {d.decided.length > 0 && <Panel title="Recently decided"><table className="w-full text-sm"><tbody>{d.decided.map((r) => <Row key={r.id} r={r} />)}</tbody></table></Panel>}
      </div>
    )}</Loadable>
  );
}
