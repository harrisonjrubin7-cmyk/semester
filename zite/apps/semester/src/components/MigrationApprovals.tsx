import { useState } from 'react';
import { toast } from 'sonner';
import { migrationApproval } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
function Approve({ p, onDone }: { p: any; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <Textarea aria-label={`What you checked for ${p.title}`} rows={2} placeholder="What you checked (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" disabled={busy || note.trim().length < 10} onClick={async () => {
        setBusy(true);
        try { await migrationApproval({ action: 'approve', projectId: p.id, seenHash: p.evidence, note }); toast('Cutover approved for this evidence.'); onDone(); }
        catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
      }}>Approve cutover for this evidence</Button>
      <p className="text-xs text-muted-foreground">Your approval covers exactly the runs and rollback plan shown. If Semester records another run or changes the plan, it must be approved again.</p>
    </div>
  );
}

export default function MigrationApprovals() {
  const s = useLoad(() => migrationApproval({ action: 'list' }));
  return (
    <Loadable state={s}>{(d: any) => !d.ready ? <Empty>No migrations have been set up yet.</Empty> : !d.projects.length ? <Empty>No migrations for your institution.</Empty> : (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Semester can't switch a domain over to itself without your approval. Your current system stays authoritative until cutover is approved and the rollback window passes.</p>
        {d.projects.map((p: any) => (
          <Panel key={p.id} title={`#${p.number} ${p.title}`}>
            <p className="flex items-center gap-2 text-sm"><Status value={p.stage.replace('_', ' ')} /> {p.domain.replace('_', ' ')}{p.approved ? ' · approved for current evidence' : ''}</p>
            {p.cutoverAt && <p className="mt-1 text-sm">Cutover {fmt(p.cutoverAt)} · rollback window ends {fmt(p.windowEndsAt)}</p>}
            <ul className="mt-2 space-y-1 text-sm">{p.runs.map((r: any, i: number) => <li key={i}>{r.passed ? 'Passed' : 'Failed'} · {r.kind.replace('_', ' ')} · {r.source}→{r.target} · {r.mismatches} mismatches · {fmt(r.at)}</li>)}</ul>
            {p.rollbackPlan && <p className="mt-2 text-sm"><span className="font-medium">Rollback plan ({p.rollbackHours} h):</span> {p.rollbackPlan}</p>}
            {p.stage === 'awaiting_approval' && !p.approved && <Approve p={p} onDone={s.reload} />}
          </Panel>))}
      </div>)}
    </Loadable>
  );
}
