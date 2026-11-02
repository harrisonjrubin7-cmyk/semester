import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { PORTFOLIO, STATUS_ORDER, UNVERIFIED_FIELDS, API_DOMAINS, PortfolioApp } from '../lib/portfolio';

type SortKey = 'id' | 'name' | 'tier' | 'status';
const GROUPS = ['all', 'Education', 'Institution', 'Developer', 'Company', 'Public'];
const TIERS = ['all', 'T0', 'T1', 'T2'];
const APIS = ['all', ...API_DOMAINS];

function exportCsv(rows: PortfolioApp[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['id', 'name', 'group', 'tier', 'api', 'roles', 'documented_maturity_2026_10_05', 'status', 'zite_app', 'features', 'authority', 'activation_gate'].join(',')]
    .concat(rows.map((r) => [r.id, q(r.name), r.group, r.tier, q(r.api.join(' ')), q(r.roles), q(r.maturity), r.status, r.inZite ?? '', q(r.features), q(r.authority), q(r.gate)].join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'semester-portfolio.csv'; a.click();
}

function Pick({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o === 'all' ? `All ${label}` : o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export default function PortfolioPage() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all'); const [tier, setTier] = useState('all'); const [api, setApi] = useState('all'); const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<SortKey>('id'); const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return PORTFOLIO.filter((r) => (group === 'all' || r.group === group) && (tier === 'all' || r.tier === tier) && (api === 'all' || r.api.includes(api))
      && (status === 'all' || r.status === status) && (!s || `${r.name} ${r.features} ${r.roles} ${r.authority} ${r.gate}`.toLowerCase().includes(s)))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'tier' ? a.tier.localeCompare(b.tier) || a.id - b.id
        : sort === 'status' ? STATUS_ORDER.indexOf(b.status) - STATUS_ORDER.indexOf(a.status) || a.id - b.id : a.id - b.id);
  }, [q, group, tier, api, status, sort]);

  const counts = STATUS_ORDER.map((st) => [st, PORTFOLIO.filter((r) => r.status === st).length] as const).filter(([, n]) => n);

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Blueprint</div>
        <h1 className="text-2xl font-semibold">App portfolio · 32 workspaces</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Proposed workspaces from the blueprint, mapped to the Zite apps that exist. A mapped app is not evidence of tests, institution authorization or production use. No entry is verified_in_test or beyond.</p>
      </div>
      <div className="flex flex-wrap gap-2">{counts.map(([st, n]) => <Badge key={st} variant="outline" className="font-mono">{st} · {n}</Badge>)}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input placeholder="Search apps, roles, gates" value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-64" />
        <Pick value={group} onChange={setGroup} options={GROUPS} label="groups" />
        <Pick value={tier} onChange={setTier} options={TIERS} label="tiers" />
        <Pick value={api} onChange={setApi} options={APIS} label="API domains" />
        <Pick value={status} onChange={setStatus} options={['all', ...STATUS_ORDER]} label="statuses" />
        <Pick value={sort} onChange={(v) => setSort(v as SortKey)} options={['id', 'name', 'tier', 'status']} label="" />
        <Button variant="outline" onClick={() => exportCsv(rows)}><Download className="mr-2 h-4 w-4" />CSV ({rows.length})</Button>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>App</TableHead><TableHead>Group</TableHead><TableHead>Tier</TableHead><TableHead className="hidden md:table-cell">API</TableHead><TableHead>Status</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No apps match.</TableCell></TableRow>}
            {rows.map((r) => (
              <Fragment key={r.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell className="font-medium">{r.name}{r.inZite && <div className="font-mono text-[11px] text-muted-foreground">apps/{r.inZite}</div>}</TableCell>
                  <TableCell>{r.group}</TableCell>
                  <TableCell className="font-mono">{r.tier}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{r.api.join(', ')}</TableCell>
                  <TableCell><Badge variant={r.status === 'implemented_unverified' ? 'secondary' : 'outline'} className="font-mono text-[11px]">{r.status}</Badge></TableCell>
                  <TableCell><ChevronDown className={`h-4 w-4 transition-transform ${open === r.id ? 'rotate-180' : ''}`} /></TableCell>
                </TableRow>
                {open === r.id && (
                  <TableRow><TableCell colSpan={7} className="bg-muted/40 text-sm">
                    <p><strong>Includes:</strong> {r.features}</p>
                    <p className="mt-1"><strong>Roles:</strong> {r.roles}</p>
                    <p className="mt-1"><strong>Authority:</strong> {r.authority}</p>
                    <p className="mt-1"><strong>Activation gate:</strong> {r.gate}</p>
                    <p className="mt-1"><strong>Documented maturity (5 Oct 2026):</strong> {r.maturity}. Live app state: not verified.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Unverified: {UNVERIFIED_FIELDS.join(' · ')}</p>
                  </TableCell></TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Tiers are capability-risk bands: T0 read/review · T1 scoped authoring or requests · T2 privileged configuration or consequential commands. A tier is the app's highest capability and does not authorize every user.</p>
    </div>
  );
}
