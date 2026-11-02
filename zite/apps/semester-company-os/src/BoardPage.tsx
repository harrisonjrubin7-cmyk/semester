import { useState } from 'react';
import { toast } from 'sonner';
import { board } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const val = (f: any) => (f.unit === 'usd' ? `$${Math.round(f.value / 100).toLocaleString('en-US')}` : f.value.toLocaleString('en-US'));

function Figures({ figures }: { figures: Record<string, any> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.values(figures).map((f: any) => (
      <div key={f.label} className="rounded-[3px] border border-border p-3">
        <dt className="text-xs text-muted-foreground">{f.label}</dt>
        <dd className="font-display mt-1 text-2xl tabular-nums">{val(f)}</dd>
        <dd className="mt-1"><Chip value={f.kind === 'estimate' ? 'Estimate' : 'Actual'} />{f.note && <span className="ml-2 text-xs text-muted-foreground">{f.note}</span>}</dd>
      </div>))}</dl>
  );
}

function Prepare({ reload }: { reload: () => void }) {
  const [period, setPeriod] = useState('');
  const [narrative, setNarrative] = useState('');
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [id, setId] = useState(() => crypto.randomUUID());
  return (
    <Panel title="Prepare a snapshot">
      <div className="space-y-2">
        <Input aria-label="Period" placeholder="Period, e.g. Q3 2026" value={period} onChange={(e) => setPeriod(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline" onClick={async () => { try { setPreview(((await board({ op: 'preview' })) as any).figures); } catch (e) { toast.error(errMsg(e)); } }}>Preview current figures</Button>
        {preview && <Figures figures={preview} />}
        <Textarea aria-label="Narrative" rows={4} placeholder="Narrative for the board (40+ characters). Label forecasts as forecasts." value={narrative} onChange={(e) => setNarrative(e.target.value)} />
        <Button size="sm" disabled={period.trim().length < 4 || narrative.trim().length < 40} onClick={async () => {
          try { await board({ op: 'create', id, period, narrative }); toast.success('Snapshot frozen. Another approver releases it.'); setId(crypto.randomUUID()); setNarrative(''); setPreview(null); reload(); }
          catch (e) { toast.error(errMsg(e)); }
        }}>Freeze snapshot</Button>
        <p className="text-xs text-muted-foreground">Figures are recomputed on the server when you freeze. A frozen snapshot can't be edited or deleted; withdraw it and prepare a new one instead.</p>
      </div>
    </Panel>
  );
}

export default function BoardPage() {
  const s = useLoad(() => board({ op: 'list' }) as Promise<any>, []);
  const [reason, setReason] = useState('');
  return (
    <div className="mx-auto max-w-5xl">
      <Header eyebrow="Board" title="Board and investor reporting" sub="Frozen snapshots, released only by an approver who didn't prepare them. Board readers see released snapshots and nothing else." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.roles.includes('board_preparer') && <Prepare reload={s.reload} />}
          {!d.snapshots.length ? <Panel><p className="text-sm text-muted-foreground">{d.staff ? 'No snapshots yet.' : 'Nothing has been released to you yet.'}</p></Panel> : d.snapshots.map((x: any) => (
            <Panel key={x.id} title={<span className="flex flex-wrap items-center gap-2">#{x.number} {x.period} <Chip value={x.state} /></span>}>
              <Figures figures={x.figures} />
              <p className="mt-3 whitespace-pre-wrap text-sm">{x.narrative}</p>
              <p className="mt-2 text-xs text-muted-foreground">Prepared by {x.preparedBy} · {fmt(x.createdAt)}{x.releasedAt ? ` · released by ${x.releasedBy} ${fmt(x.releasedAt)}` : ''}{x.withdrawnReason ? ` · withdrawn: ${x.withdrawnReason}` : ''}</p>
              {d.roles.includes('board_approver') && x.state === 'draft' && x.preparedById !== d.me && <Button size="sm" className="mt-2" onClick={async () => {
                try { await board({ op: 'release', id: x.id, seenHash: x.hash }); toast.success('Released to board readers.'); s.reload(); } catch (e) { toast.error(errMsg(e)); } }}>Release exactly this snapshot</Button>}
              {d.roles.includes('board_approver') && x.state !== 'withdrawn' && <div className="mt-2 flex flex-wrap gap-2">
                <Input aria-label="Withdraw reason" placeholder="Reason to withdraw" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-xs" />
                <Button size="sm" variant="outline" disabled={reason.trim().length < 10} onClick={async () => { try { await board({ op: 'withdraw', id: x.id, reason }); toast.success('Withdrawn.'); setReason(''); s.reload(); } catch (e) { toast.error(errMsg(e)); } }}>Withdraw</Button></div>}
            </Panel>))}
        </div>)}
      </Loadable>
    </div>
  );
}
