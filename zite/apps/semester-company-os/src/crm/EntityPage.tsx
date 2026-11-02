import { useMemo, useState } from 'react';
import { ArrowUpDown, Pencil, Plus, Search, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Field, GATES, money, TableKey, TABLES, TITLE_FIELD } from './config';
import { useData } from './data';
import RecordForm from './RecordForm';

type Row = Record<string, any>;
const PAGE = 15;

function useDisplay() {
  const { data } = useData();
  return (f: Field, r: Row): string => {
    const v = r[f.key];
    if (v == null || v === '') return '—';
    if (f.kind === 'money') return money(v);
    if (f.kind === 'date') return new Date(String(v).length === 10 ? v + 'T12:00:00' : v).toLocaleDateString();
    if (f.kind === 'user') return data?.users.find((u) => u.id === v)?.name ?? 'Unknown';
    if (f.kind === 'link') return (data?.[f.link!] as Row[] | undefined)?.find((x) => x.id === v)?.[TITLE_FIELD[f.link!]] ?? '—';
    if (f.kind === 'multi') return f.key === 'gatesPassed' ? `${v.length}/${GATES.length}` : v.join(', ');
    return String(v);
  };
}

export default function EntityPage({ table }: { table: TableKey }) {
  const { data, error, refresh, mutate } = useData();
  const cfg = TABLES[table];
  const display = useDisplay();
  const cols = cfg.fields.filter((f) => f.inTable);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: TITLE_FIELD[table], dir: 1 });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const rows = useMemo(() => {
    const all = (data?.[table] ?? []) as Row[];
    const needle = q.toLowerCase();
    const filtered = needle ? all.filter((r) => cols.some((c) => display(c, r).toLowerCase().includes(needle))) : all;
    const col = cfg.fields.find((f) => f.key === sort.key)!;
    return [...filtered].sort((a, b) => {
      const av = col.kind === 'money' ? a[col.key] ?? -1 : display(col, a);
      const bv = col.kind === 'money' ? b[col.key] ?? -1 : display(col, b);
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }, [data, q, sort, table]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Company OS</p>
          <h1 className="font-display text-3xl">{cfg.label}</h1>
          <p className="text-sm text-muted-foreground">{cfg.blurb}</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />New {cfg.singular}</Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input aria-label={`Search ${cfg.label}`} placeholder="Search…" className="pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card p-6 text-sm">
          <p className="font-medium">These records didn't load.</p>
          <p className="text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
        </div>
      ) : !data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {q ? 'Nothing matches that search.' : `No ${cfg.label.toLowerCase()} yet. Create the first ${cfg.singular} to start the lifecycle.`}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c.key}>
                    <button className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider"
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (-s.dir as 1 | -1) : 1 }))}>
                      {c.label}<ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="text-right sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id}>
                  {cols.map((c, i) => (
                    <TableCell key={c.key} className={c.kind === 'money' ? 'font-mono text-xs' : ''}>
                      {i === 0 ? (
                        <span className="font-medium">{display(c, r)}{r.isSample && <Badge variant="outline" className="ml-2 text-[10px]">Sample</Badge>}</span>
                      ) : c.kind === 'select' ? <Badge variant="secondary">{display(c, r)}</Badge> : display(c, r)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap">
                    {table === 'deals' && r.stage === 'Commercial Approval' && !r.approvedAt && (
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => mutate({ table: 'deals', op: 'approveDeal', id: r.id })}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />Approve
                      </Button>
                    )}
                    {table === 'deals' && r.approvedAt && <Badge variant="outline" className="mr-1">Approved</Badge>}
                    <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {table !== 'tickets' && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>{rows.length} records</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page + 1} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <RecordForm table={table} row={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {cfg.singular}?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.[TITLE_FIELD[table]]}" will be removed. The deletion is recorded in the audit log.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { mutate({ table, op: 'delete', id: toDelete!.id }, 'Deleted'); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
