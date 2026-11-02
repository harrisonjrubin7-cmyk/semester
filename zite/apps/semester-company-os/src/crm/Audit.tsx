import { useState } from 'react';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { useData } from './data';

export default function Audit() {
  const { data } = useData();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const rows = (data?.audit ?? []).filter((a) =>
    `${a.actorName} ${a.action} ${a.targetTable} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Company OS</p>
        <h1 className="font-display text-3xl">Audit log</h1>
        <p className="text-sm text-muted-foreground">Every change made through this console is recorded here. It can't be edited from this app. Shows the latest 200.</p>
      </header>
      <Input aria-label="Filter audit log" placeholder="Filter…" className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
      {!data ? <Skeleton className="h-64" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {rows.slice(0, limit).map((a) => (
            <li key={a.id} className="px-3 py-2 text-sm grid sm:grid-cols-[180px_1fr] gap-1">
              <span className="font-mono text-xs text-muted-foreground">{new Date(a.occurredAt).toLocaleString()}</span>
              <span><b>{a.actorName ?? 'System'}</b> {a.action} <span className="font-mono text-xs">{a.targetTable}/{String(a.targetId).slice(0, 8)}</span>
                {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>Show more</Button>}
    </div>
  );
}
