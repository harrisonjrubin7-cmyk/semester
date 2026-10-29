import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { evidenceProposals } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Checkbox } from '@project/components/ui/checkbox';
import { Label } from '@project/components/ui/label';

type P = { key: string; capability: string; stage: string; environment: string; reference: string; scope: string };
type Out = { key: string; ok: boolean; message?: string };

// Proposed evidence: prepared from the code and re-run checks, but it counts only once a security lead accepts it here.
// Accepting records it under the lead's name with the usual rules, including reviewer separation between stages.
export default function ProposedEvidence({ onRecorded }: { onRecorded: () => void }) {
  const [rows, setRows] = useState<P[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Out[]>([]);
  const load = () => evidenceProposals({ action: 'list' }).then((r: { pending: P[] }) => { setRows(r.pending); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load proposals'));
  useEffect(() => { load(); }, []);
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const accept = async () => {
    setBusy(true);
    try {
      const r = (await evidenceProposals({ action: 'accept', keys: [...picked], confirm: 'I checked each reference' })) as { outcomes: Out[]; pending: P[] };
      setOutcomes(r.outcomes); setRows(r.pending); setPicked(new Set()); setChecked(false);
      const ok = r.outcomes.filter((o) => o.ok).length;
      toast.success(`${ok} recorded under your name${r.outcomes.length > ok ? `, ${r.outcomes.length - ok} refused` : ''}`); onRecorded();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not record'); } finally { setBusy(false); }
  };
  if (error) return <Card className="mb-4 p-4 text-sm">Proposed evidence: {error} <Button size="sm" variant="ghost" onClick={load}>Retry</Button></Card>;
  if (!rows) return <Card className="mb-4 p-4 text-sm text-muted-foreground">Loading proposed evidence…</Card>;
  if (rows.length === 0 && outcomes.length === 0) return null;
  return (
    <Card className="mb-4 p-4">
      <h2 className="font-semibold">Proposed evidence ({rows.length} waiting)</h2>
      <p className="mt-1 text-xs text-muted-foreground">Prepared by an engineering session from commit references and checks re-run on 29 Oct. None of it counts until you accept it. Open each reference before accepting; you cannot record both Implemented and Tested for the same capability.</p>
      {outcomes.filter((o) => !o.ok).length > 0 && <ul className="mt-2 text-xs">{outcomes.filter((o) => !o.ok).map((o) => <li key={o.key}>Refused: {rows.find((r) => r.key === o.key)?.capability ?? o.key.split(':')[1]} — {o.message}</li>)}</ul>}
      <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">{rows.map((p) => (
        <li key={p.key} className="flex gap-2 border-b border-border pb-2 last:border-0">
          <Checkbox id={p.key} checked={picked.has(p.key)} onCheckedChange={() => toggle(p.key)} aria-label={`Select ${p.capability} ${p.stage}`} />
          <label htmlFor={p.key} className="min-w-0"><span className="font-medium">{p.capability}</span> · {p.stage} · {p.environment}
            <span className="block break-words font-mono text-xs text-muted-foreground">{p.reference}</span><span className="block text-xs">Scope: {p.scope}</span></label>
        </li>))}</ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Checkbox id="pe-confirm" checked={checked} onCheckedChange={(v) => setChecked(v === true)} /><Label htmlFor="pe-confirm">I checked each selected reference</Label></div>
        <Button size="sm" disabled={!checked || picked.size === 0 || busy} onClick={accept}>Accept {picked.size || ''} as my evidence</Button>
      </div>
    </Card>
  );
}
