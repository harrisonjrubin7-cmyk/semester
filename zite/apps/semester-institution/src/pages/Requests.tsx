import { useMemo, useState } from 'react';
import { sectionRequests } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Plus, Search } from 'lucide-react';
import { useLoad } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';
import NewRequestDialog from '../components/NewRequestDialog';
import RequestSheet from '../components/RequestSheet';
import type { SreqData, SreqRow } from '../components/sreqTypes';
import { STATE_LABEL, needsMe } from '../components/sreqTypes';

export default function Requests() {
  const q = useLoad(() => sectionRequests({ action: 'get' }) as Promise<SreqData>);
  const [tab, setTab] = useState('mine');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    if (!q.data) return [] as SreqRow[];
    const s = search.toLowerCase();
    return q.data.requests
      .filter((r) => tab === 'all' || (tab === 'mine' ? needsMe(r, q.data!.me) : r.mine))
      .filter((r) => !s || `${r.ref} ${r.label} ${r.department} ${r.instructor}`.toLowerCase().includes(s));
  }, [q.data, tab, search]);

  const open = q.data?.requests.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Section requests" sub="Department → chair → registrar → canonical section → instructor → registration, with a receipt."
        action={q.data?.me.canRequest && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Request a section</Button>} />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="mine">Needs my action</TabsTrigger>
                <TabsTrigger value="submitted">Submitted by me</TabsTrigger>
                <TabsTrigger value="all">All visible</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {rows.length === 0 ? <Empty title="Nothing here" hint={tab === 'mine' ? 'No requests are waiting on you.' : 'No matching requests.'} /> : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {rows.map((r) => (
                <button key={r.id} onClick={() => setOpenId(r.id)} className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/60">
                  <span className="w-16 font-mono text-xs text-muted-foreground">{r.ref}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{r.department} · {r.meetingTimes} · {r.room} · {r.instructor}</p>
                  </div>
                  <Badge variant={r.state === 'rejected' || r.state === 'withdrawn' ? 'outline' : r.state === 'reconciled' ? 'default' : 'secondary'}>{STATE_LABEL[r.state] ?? r.state}</Badge>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {q.data && <NewRequestDialog open={creating} onOpenChange={setCreating} data={q.data} onDone={(d) => q.setData(d)} />}
      {q.data && <RequestSheet row={open} me={q.data.me} onClose={() => setOpenId(null)} onDone={(d) => q.setData(d)} />}
    </div>
  );
}
