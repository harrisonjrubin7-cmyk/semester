import { useState } from 'react';
import { institutionConsole } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { CheckCircle2, Circle, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLoad, errMsg, fmtDate } from '../lib/useLoad';
import { loadConsole } from '../lib/console';
import { LoadingBlock, DeniedOrError, PageHeader } from '../components/States';
import { ReadinessSharePanel } from '../components/Releases';

export default function Console() {
  const q = useLoad(loadConsole);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const act = async (key: string, input: Parameters<typeof institutionConsole>[0], ok: string) => {
    setBusy(key);
    try { await institutionConsole(input); toast.success(ok); await q.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  if (q.loading && !q.data) return <><PageHeader title="Members & connections" sub="Who belongs, and how source systems are syncing." /><LoadingBlock /></>;
  if (q.error) return <><PageHeader title="Members & connections" sub="Who belongs, and how source systems are syncing." /><DeniedOrError message={q.error} onRetry={q.reload} /></>;
  const d = q.data!;
  const members = d.memberships.filter((m) => `${m.name} ${m.roles.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Members & connections" sub={`${d.institution.name} · retention ${d.institution.retentionDays} days · invite code ${d.institution.inviteCode || '—'}`} />
      <div className="mb-6"><ReadinessSharePanel /></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Connections and data freshness</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {d.integrations.length === 0 && <p className="text-sm text-muted-foreground">No connections configured.</p>}
            {d.integrations.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{x.name} <span className="font-mono text-xs text-muted-foreground">{x.connector}</span></p>
                  <p className="text-xs text-muted-foreground">Last sync {fmtDate(x.lastSyncedAt ?? '')} · retries {x.retryCount}{x.lastReconciliation ? ` · ${x.lastReconciliation}` : ''}</p>
                </div>
                <Badge variant={x.syncStatus === 'Synced' ? 'default' : x.syncStatus === 'Sync Error' ? 'destructive' : 'secondary'}>{x.syncStatus}</Badge>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(`a${x.id}`, { action: 'setAuthorized', id: x.id, authorized: !x.authorized }, x.authorized ? 'Authorization revoked.' : 'Authorized.')}>{x.authorized ? 'Revoke' : 'Authorize'}</Button>
                <Button size="icon" variant="ghost" title="Run sync" disabled={!!busy || !x.authorized} onClick={() => act(`s${x.id}`, { action: 'runSync', id: x.id }, 'Sync finished.')}><RefreshCw className={busy === `s${x.id}` ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
                <Button size="icon" variant="ghost" title="Roll back last sync" disabled={!!busy} onClick={() => act(`r${x.id}`, { action: 'rollback', id: x.id }, 'Rolled back.')}><Undo2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Launch readiness</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.checklist.map((c) => <p key={c.label} className="flex items-center gap-2 text-sm">{c.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}{c.label}</p>)}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Members ({d.memberships.length})</CardTitle>
            <Input className="w-56" placeholder="Search members" value={search} onChange={(e) => setSearch(e.target.value)} />
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <p className="min-w-0 flex-1 font-medium">{m.name}{m.self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                <div className="flex flex-wrap gap-1">{m.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div>
                <Badge variant={m.status === 'Active' ? 'default' : 'outline'}>{m.status}</Badge>
                {!m.self && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(`m${m.id}`, { action: 'setMemberStatus', membershipId: m.id, status: m.status === 'Active' ? 'Suspended' : 'Active' }, 'Membership updated.')}>{m.status === 'Active' ? 'Suspend' : 'Reactivate'}</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
