import { useMemo, useState } from 'react';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Search } from 'lucide-react';
import { useLoad, fmtDate } from '../lib/useLoad';
import { loadConsole } from '../lib/console';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';
import { AssurancePanel } from '../components/Releases';

const PAGE = 25;

export default function Audit() {
  const q = useLoad(loadConsole);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (q.data?.audit ?? []).filter((a) => `${a.action} ${a.actor} ${a.recordRef} ${a.authority}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div>
      <PageHeader title="Audit log" sub="The 100 most recent actions at this institution. Append-only." />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="relative mb-4 w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search actions, people, records" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
          {rows.length === 0 ? <Empty title="No audit events" /> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">Authority</th><th className="px-4 py-3">Record</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(page * PAGE, (page + 1) * PAGE).map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{fmtDate(a.at)}</td>
                      <td className="px-4 py-3 font-medium">{a.action}{a.viaAssistant && <Badge variant="secondary" className="ml-2">AI</Badge>}</td>
                      <td className="px-4 py-3">{a.actor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.authority}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.recordRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-muted-foreground">{page + 1} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
      <AssurancePanel />
    </div>
  );
}
