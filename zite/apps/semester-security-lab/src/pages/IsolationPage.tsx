import { useState } from 'react';
import { toast } from 'sonner';
import { requestSuiteRun } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { useLabData } from '../lib/useLabData';
import { ModeBadge, PageHeader, StatusBadge } from '../components/Badges';

export default function IsolationPage() {
  const { data, reload } = useLabData();
  const [busy, setBusy] = useState(false);
  const suite = data?.suites.find((s) => s.kind === 'Tenant Isolation');
  const run = async () => {
    if (!suite) return;
    setBusy(true);
    try { await requestSuiteRun({ suiteId: suite.id }); toast.warning('Recorded as blocked: no staging runner is connected'); await reload(); }
    catch { toast.error('Request failed'); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title="Tenant isolation" sub="16 assertions with synthetic fixtures: Institution A (A1, A2), Institution B (B1), Alice, Alex, Bob, an A1 advisor and Semester support. Results come only from a real staging runner.">
        <Button onClick={run} disabled={busy || !suite}>Request staging run</Button>
      </PageHeader>
      <Card className="mb-4 p-4 text-sm text-muted-foreground">Request path: signed test token → staging app → authenticated workflow → authorization boundary → tenant-scoped query → database policy → sanitized response → evidence. Hiding navigation is not a test, and a denied update must be checked against the record's before/after state.</Card>
      <Card className="overflow-x-auto">
        {!data ? <Skeleton className="m-4 h-60" /> :
        <Table>
          <TableHeader><TableRow><TableHead>Layer</TableHead><TableHead>Test</TableHead><TableHead>Actor → target</TableHead><TableHead>Expected</TableHead><TableHead>Mode</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
          <TableBody>{data.isolation.map((t) => (
            <TableRow key={t.id} title={t.evidence}>
              <TableCell className="font-medium">{t.layer}</TableCell><TableCell>{t.test}</TableCell>
              <TableCell className="font-mono text-xs">{t.actorFixture} → {t.targetFixture}</TableCell>
              <TableCell className="text-sm">{t.expected}</TableCell>
              <TableCell>{t.mode ? <ModeBadge mode={t.mode} /> : '—'}</TableCell><TableCell><StatusBadge value={t.result} /></TableCell>
            </TableRow>))}
          </TableBody>
        </Table>}
      </Card>
    </div>
  );
}
