import { useState } from 'react';
import { explore } from 'zitejs/api';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const CRED: Record<string, string> = { certificate: 'Certificate or minor', associate: 'Associate', bachelor: 'Major (bachelor)', master: 'Master', doctoral: 'Doctoral', professional: 'Professional' };

function Row({ p }: { p: any }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span><strong>{p.name}</strong> <span className="text-muted-foreground">· {p.code} · {CRED[p.credential] ?? p.credential}</span></span>
        <span>{p.remainingCredits} of {p.totalCredits} credits left{p.estimatedTerms != null ? ` · about ${p.estimatedTerms} term(s) at the program's pace` : ''}</span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-[3px] bg-muted" role="img" aria-label={`${p.countedCredits} completed, ${p.inProgressCredits} in progress, of ${p.totalCredits} credits`}>
        <div className="bg-primary" style={{ width: `${Math.min(100, (p.countedCredits / p.totalCredits) * 100)}%` }} />
        <div className="bg-primary/40" style={{ width: `${Math.min(100, (p.inProgressCredits / p.totalCredits) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{p.countedCredits} completed · {p.inProgressCredits} in progress · {p.percent}%</p>
      <button type="button" className="mt-1 text-xs font-medium text-primary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide courses' : 'Show courses'}</button>
      {open && <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
        <div><p className="font-medium">Counts already</p>{p.counted.length ? p.counted.join(', ') : 'None'}</div>
        <div><p className="font-medium">In progress</p>{p.inProgress.length ? p.inProgress.join(', ') : 'None'}</div>
        <div><p className="font-medium">Still to take</p>{p.remaining.length ? p.remaining.join(', ') : 'None'}</div>
      </div>}
    </li>
  );
}

export default function Explore() {
  const s = useLoad(() => explore({}) as Promise<any>);
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader eyebrow="Plan" title="Explore majors and minors" sub="See how the courses you have completed or are taking now would count toward each program your institution has published." />
      <Loadable state={s}>{(d: any) => {
        const list = d.programs.filter((p: any) => `${p.name} ${p.code}`.toLowerCase().includes(q.trim().toLowerCase()));
        return (
          <div className="space-y-4">
            <Panel>
              <Input aria-label="Search programs" placeholder="Search programs" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
              <p className="mt-2 text-xs text-muted-foreground">An estimate from {d.completedCount ?? 0} completed and {d.inProgressCount ?? 0} current course(s). It declares nothing: to change your major or add a minor, ask your advisor or the registrar.</p>
            </Panel>
            {d.note && !d.programs.length ? <Empty>{d.note}</Empty> : !list.length ? <Empty>No program matches “{q}”.</Empty> : <ul className="space-y-2">{list.map((p: any) => <Row key={p.code} p={p} />)}</ul>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
