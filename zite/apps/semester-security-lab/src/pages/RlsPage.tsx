import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { requestSuiteRun, updateFinding } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { useLabData } from '../lib/useLabData';
import { PageHeader, StatusBadge } from '../components/Badges';

const RANK: Record<string, number> = { critical: 0, high: 1, review: 2 };

export default function RlsPage() {
  const { data, reload } = useLabData();
  const [q, setQ] = useState('');
  const findings = useMemo(() => (data?.findings ?? [])
    .filter((f) => `${f.objectName} ${f.check}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (RANK[a.severity ?? ''] ?? 9) - (RANK[b.severity ?? ''] ?? 9)), [data, q]);
  const suite = data?.suites.find((s) => s.kind === 'PostgreSQL RLS Audit');

  const run = async () => {
    if (!suite) return;
    try { await requestSuiteRun({ suiteId: suite.id }); toast.warning('Recorded as blocked: no approved read-only audit runner is connected'); reload(); } catch { toast.error('Request failed'); }
  };
  const change = async (id: string, remediation: 'open' | 'accepted exception' | 'fixed') => {
    try { await updateFinding({ id, remediation }); reload(); } catch { toast.error('Update failed'); }
  };

  return (
    <div>
      <PageHeader title="RLS audit" sub="Findings from audit_rls.sql, run read-only against an approved environment. Findings are evidence to classify, not proof of a leak. A clean audit doesn't prove there are no cross-tenant leaks either.">
        <Button onClick={run} disabled={!suite}>Request audit run</Button>
      </PageHeader>
      <div className="mb-4"><Input placeholder="Search object or check…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" /></div>
      <Card className="overflow-x-auto">
        {!data ? <Skeleton className="m-4 h-40" /> : findings.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No findings recorded. Findings only show up after a real audit runner sends them in. Nothing here is generated.</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Check</TableHead><TableHead>Object</TableHead><TableHead>Detail</TableHead><TableHead>Remediation</TableHead></TableRow></TableHeader>
            <TableBody>{findings.map((f) => (
              <TableRow key={f.id}>
                <TableCell><StatusBadge value={f.severity} /></TableCell>
                <TableCell className="font-mono text-xs">{f.check}</TableCell>
                <TableCell className="font-mono text-xs">{f.objectName}</TableCell>
                <TableCell className="text-sm">{f.detail}</TableCell>
                <TableCell><Select value={f.remediation ?? 'open'} onValueChange={(v) => change(f.id, v as 'open')}>
                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="open">open</SelectItem><SelectItem value="accepted exception">accepted exception</SelectItem><SelectItem value="fixed">fixed</SelectItem></SelectContent>
                </Select></TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
