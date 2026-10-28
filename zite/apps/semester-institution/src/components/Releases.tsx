// Sanitised releases across boundaries (C19, C22). Readiness sharing is the institution's choice; assurance coverage is
// what Security Lab released about the product.
import { readinessShare, assuranceEvidence } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { toast } from 'sonner';
import { useLoad, errMsg, fmtDate } from '../lib/useLoad';

type Share = { sharing: boolean; sharedAt: string | null; snapshot: { ready: boolean; checks: { key: string; label: string; state: string }[] } | null };
export function ReadinessSharePanel() {
  const q = useLoad(() => readinessShare({ action: 'status' }) as Promise<Share>);
  const act = async (action: 'share' | 'stop') => { try { await readinessShare({ action }); toast.success(action === 'share' ? 'Shared. Semester staff now see the check states below.' : 'Stopped sharing.'); q.reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <section aria-labelledby="rs-h" className="rounded-md border border-border bg-card p-4 text-sm">
      <h2 id="rs-h" className="text-base">Share readiness with Semester</h2>
      <p className="mt-1 text-muted-foreground">Semester's implementation team sees only whether each setup check passed. No names, counts of people or student records.</p>
      {q.error ? <p className="mt-2">! {q.error}</p> : !q.data ? <p className="mt-2 text-muted-foreground">Loading…</p> : <>
        <p className="mt-2">{q.data.sharing ? `Shared ${fmtDate(q.data.sharedAt ?? '')}.` : 'Not shared.'}</p>
        {q.data.snapshot && <ul className="mt-2 space-y-1">{q.data.snapshot.checks.map((c) => <li key={c.key}>{c.label} <Badge variant="outline" className="ml-1">{c.state}</Badge></li>)}</ul>}
        <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => act('share')}>{q.data.sharing ? 'Refresh shared status' : 'Share status'}</Button>{q.data.sharing && <Button size="sm" variant="outline" onClick={() => act('stop')}>Stop sharing</Button>}</div>
      </>}
    </section>
  );
}

type Rel = { capability: string; domain: string; stages: string[]; environments: string[]; evidenceCount: number; releasedAt: string };
export function AssurancePanel() {
  const q = useLoad(() => assuranceEvidence({}) as Promise<{ releases: Rel[] }>);
  return (
    <section aria-labelledby="as-h" className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
      <h2 id="as-h" className="text-base">Product assurance from Semester Security Lab</h2>
      <p className="mt-1 text-muted-foreground">Coverage the lab released, from synthetic and sandbox tests only. It is evidence about the product, not about your data.</p>
      {q.error ? <p className="mt-2">! {q.error}</p> : !q.data ? <p className="mt-2 text-muted-foreground">Loading…</p> : !q.data.releases.length ? <p className="mt-2 text-muted-foreground">Nothing released yet.</p> : (
        <table className="mt-2 w-full"><caption className="sr-only">Released assurance coverage</caption>
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-normal">Capability</th><th className="font-normal">Stages with evidence</th><th className="font-normal">Environments</th><th className="font-normal">Released</th></tr></thead>
          <tbody>{q.data.releases.map((r) => <tr key={r.capability} className="border-t border-border"><td className="py-1.5">{r.capability} <span className="text-muted-foreground">· {r.domain}</span></td><td>{r.stages.join(', ')}</td><td>{r.environments.join(', ')}</td><td>{fmtDate(r.releasedAt)}</td></tr>)}</tbody></table>
      )}
    </section>
  );
}
