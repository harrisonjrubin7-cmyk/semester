import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { recordSimulationRun } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { CompareCfg, compare } from '../lib/compare';

const FIELDS: [keyof CompareCfg, string][] = [
  ['rate', 'Bucket refill/s'], ['capacity', 'Bucket capacity'], ['windowSec', 'Window (s)'], ['windowLimit', 'Window limit'], ['duration', 'Duration (s)'],
];

export default function AlgoCompare() {
  const [c, setC] = useState<CompareCfg>({ rate: 20, capacity: 100, windowSec: 5, windowLimit: 100, duration: 60 });
  const valid = Object.values(c).every((v) => v > 0) && c.duration <= 300;
  const rows = useMemo(() => (valid ? compare(c) : []), [c, valid]);
  const fmt = (n: number) => n.toLocaleString();

  const save = async () => {
    try {
      await recordSimulationRun({ runType: 'Token Bucket', title: `Bucket vs sliding window ${c.rate}/s·${c.capacity} vs ${c.windowLimit}/${c.windowSec}s`, status: 'recorded', summary: 'Admission-behaviour comparison only. No Redis, throughput, or latency measured.', evidence: JSON.stringify({ config: c, results: rows }, null, 2) });
      toast.success('Saved as a simulation run');
    } catch { toast.error('Could not save'); }
  };

  return (
    <Card className="mt-8 space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Token bucket vs sliding-window log</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Same limits, three synthetic traffic patterns. Shows admission behaviour only. The bucket's extra burst allowance is a design choice, not a speed advantage.</p>
        </div>
        <Button variant="outline" onClick={save} disabled={!valid}>Save comparison</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label>
            <Input type="number" className="font-mono" value={c[k]} onChange={(e) => setC((p) => ({ ...p, [k]: Number(e.target.value) }))} /></div>
        ))}
      </div>
      {!valid && <p className="text-xs text-destructive">All values must be positive; duration ≤ 300s.</p>}
      <Table>
        <TableHeader><TableRow><TableHead>Traffic pattern</TableHead><TableHead className="text-right">Offered</TableHead><TableHead className="text-right">Token bucket accepted</TableHead><TableHead className="text-right">Sliding window accepted</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.pattern}><TableCell>{r.pattern}</TableCell>
              <TableCell className="text-right font-mono">{fmt(r.offered)}</TableCell>
              <TableCell className="text-right font-mono">{fmt(r.bucket)}</TableCell>
              <TableCell className="text-right font-mono">{fmt(r.window)}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Doesn't measure throughput, latency, Redis errors, or multi-instance behaviour, and doesn't prove tenant access. Those need the Go suite against a dedicated Redis test instance. Limits shown are illustrative, not recommended production quotas.</p>
    </Card>
  );
}
