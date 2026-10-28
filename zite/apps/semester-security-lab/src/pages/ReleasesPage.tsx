import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { releaseAssurance } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { PageHeader } from '../components/Badges';

type Cap = { id: string; capability: string; domain: string; released: boolean; releasedAt: string | null };
const msg = (e: unknown) => (e instanceof Error ? (e as { userFacingMessage?: string }).userFacingMessage ?? e.message : 'That didn’t go through');

/** What leaves the lab: per capability, which stages have evidence and in which environments. Never summaries,
 *  references, reviewers or anything recorded against production. */
export default function ReleasesPage() {
  const [rows, setRows] = useState<Cap[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { (releaseAssurance({ action: 'list' }) as Promise<{ capabilities: Cap[] }>).then((r) => setRows(r.capabilities)).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  const act = async (action: 'release' | 'withdraw', capabilityId: string) => { try { await releaseAssurance({ action, capabilityId }); toast.success(action === 'release' ? 'Released to Company OS and institutions.' : 'Withdrawn.'); load(); } catch (e) { toast.error(msg(e)); } };
  return (
    <div>
      <PageHeader title="Evidence releases" sub="Release sanitised coverage to Company OS and institution administrators. Only stages and environments leave the lab." />
      {err ? <p className="text-sm">! {err}</p> : !rows ? <p className="text-sm text-muted-foreground">Loading…</p> : !rows.length ? <p className="text-sm text-muted-foreground">No capabilities registered.</p> : (
        <ul className="space-y-2">{rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
            <span>{c.capability} <span className="text-muted-foreground">· {c.domain}</span>{c.released && <Badge variant="outline" className="ml-2">Released</Badge>}</span>
            {c.released ? <Button size="sm" variant="outline" onClick={() => act('withdraw', c.id)}>Withdraw</Button> : <Button size="sm" onClick={() => act('release', c.id)}>Release coverage</Button>}
          </li>))}</ul>
      )}
    </div>
  );
}
