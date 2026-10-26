import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Area, Bar, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { recordSimulationRun } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { BucketCfg, simulate } from '../lib/bucket';
import { ModeBadge, PageHeader } from '../components/Badges';
import AlgoCompare from '../components/AlgoCompare';

const NUM: [keyof BucketCfg, string, number][] = [
  ['capacity', 'Capacity', 1], ['rate', 'Refill tokens/s', 0.01], ['cost', 'Request cost', 1],
  ['actors', 'Actors', 1], ['instances', 'API instances', 1], ['rps', 'Req/s per actor', 0.1], ['duration', 'Duration (s)', 1],
];

export default function BucketPage() {
  const [c, setC] = useState<BucketCfg>({ capacity: 10, rate: 2, cost: 1, actors: 3, instances: 2, rps: 2, duration: 30, pattern: 'burst', scope: 'shared' });
  const valid = c.capacity > 0 && c.rate > 0 && c.cost > 0 && c.cost <= c.capacity && c.actors >= 1 && c.actors <= 50 && c.rps > 0 && c.rps <= 50 && c.duration >= 1 && c.duration <= 300;
  const r = useMemo(() => (valid ? simulate(c) : null), [c, valid]);
  const set = (k: keyof BucketCfg, v: unknown) => setC((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!r) return;
    try {
      await recordSimulationRun({ runType: 'Token Bucket', title: `Bucket ${c.capacity}/${c.rate}/s ${c.pattern}`, status: 'recorded', summary: `${r.allowed} allowed, ${r.denied} denied. Not a Redis atomicity test.`, evidence: JSON.stringify({ config: c, allowed: r.allowed, denied: r.denied, maxRetryMs: r.maxRetryMs }, null, 2) });
      toast.success('Saved as a simulation run');
    } catch { toast.error('Could not save'); }
  };

  return (
    <div>
      <PageHeader title="Token bucket simulator" sub="Deterministic model of the Lua token bucket (continuous refill, weighted cost). This is a simulation, not a Redis atomicity test. Real Redis runs come from the Go suite.">
        <div className="flex items-center gap-2"><ModeBadge mode="simulation" /><Button onClick={save} disabled={!r}>Save run</Button></div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="space-y-3 p-5">
          {NUM.map(([k, label, step]) => (
            <div key={k} className="space-y-1"><Label className="text-xs">{label}</Label>
              <Input type="number" step={step} className="font-mono" value={c[k] as number} onChange={(e) => set(k, Number(e.target.value))} /></div>
          ))}
          <div className="space-y-1"><Label className="text-xs">Arrival pattern</Label>
            <Select value={c.pattern} onValueChange={(v) => set('pattern', v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="steady">Steady</SelectItem><SelectItem value="burst">Bursts every 5s</SelectItem><SelectItem value="random">Random (Poisson)</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">Bucket scope</Label>
            <Select value={c.scope} onValueChange={(v) => set('scope', v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="shared">Shared (tenant)</SelectItem><SelectItem value="per-actor">Per actor (user)</SelectItem></SelectContent></Select></div>
          {!valid && <p className="text-xs text-destructive">Values must be positive, cost ≤ capacity, ≤50 actors, ≤50 req/s, ≤300s.</p>}
        </Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Allowed', r?.allowed], ['Denied', r?.denied], ['Remaining', r?.remaining], ['Max retry', r ? `${r.maxRetryMs} ms` : '—']].map(([l, v]) => (
              <Card key={l as string} className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-mono text-2xl font-semibold">{v ?? '—'}</div></Card>
            ))}
          </div>
          <Card className="h-80 p-4">
            {r && <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.points}>
                <XAxis dataKey="t" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                <Bar dataKey="allowed" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="denied" stackId="a" fill="hsl(var(--chart-2))" />
                <Area dataKey="tokens" type="monotone" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.15)" />
              </ComposedChart>
            </ResponsiveContainer>}
          </Card>
          <p className="text-xs text-muted-foreground">With a correct shared atomic store, {c.instances} API instances act as one bucket. That's why the instance count doesn't change the model. Proving it needs the Go TestAtomicAcrossClients test against real Redis.</p>
        </div>
      </div>
      <AlgoCompare />
    </div>
  );
}
