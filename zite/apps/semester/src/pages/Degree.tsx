import { progress } from 'zitejs/api';
import { PageHeader, Panel, Empty, Loadable, useLoad, SourceLine } from '../components/kit';
import { SourceDetails } from '../components/overlays';

type R = { id: string; name: string; required: number; earned: number; pending: number };

function Bar({ r }: { r: R }) {
  const pct = (n: number) => `${r.required ? Math.min(100, (n / r.required) * 100) : 0}%`;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-[3px] bg-muted" role="img" aria-label={`${r.earned} earned, ${r.pending} in progress, of ${r.required}`}>
      <div className="bg-primary" style={{ width: pct(r.earned) }} />
      <div className="border border-primary bg-[repeating-linear-gradient(45deg,hsl(var(--primary))_0_2px,transparent_2px_6px)]" style={{ width: pct(Math.min(r.pending, r.required - r.earned)) }} />
    </div>
  );
}

export default function Degree() {
  const s = useLoad(() => progress({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Progress" title="Degree requirements" sub="Each requirement, what counts toward it, and what is left. The Registrar’s audit is the official record." />
      <Loadable state={s}>{(d) => {
        const left = Math.max(0, d.totalReq - d.totalEarned);
        const reqs = d.requirements as R[];
        return (
          <div className="space-y-4">
            <Panel>
              <SourceLine source="Sample" by="Degree audit" when="Updated 1 Oct">
                <p className="font-display text-2xl font-semibold">{left ? `You need ${left} more credits to graduate.` : 'Every listed requirement is met.'}</p>
              </SourceLine>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span><span className="mr-1 inline-block h-2 w-4 bg-primary align-middle" />Earned (released grades)</span>
                <span><span className="mr-1 inline-block h-2 w-4 border border-primary bg-[repeating-linear-gradient(45deg,hsl(var(--primary))_0_2px,transparent_2px_6px)] align-middle" />In progress · estimated</span>
                <SourceDetails source="Sample" usedIn="Degree · Progress · Ask Semester" limitations="Credits in progress count only once a grade is released." />
              </div>
            </Panel>
            {reqs.length ? reqs.map((r) => {
              const status = r.earned >= r.required ? '✓ Met' : r.earned + r.pending >= r.required ? '… Met once current courses finish' : r.earned || r.pending ? '… In progress' : '○ Not started';
              return (
                <Panel key={r.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg">{r.name}</h2><span className="text-sm tabular-nums text-muted-foreground">{r.earned} of {r.required} credits · {status}</span></div>
                  <div className="mt-3"><Bar r={r} /></div>
                  {r.pending > 0 && <p className="mt-2 text-xs text-muted-foreground">≈ {r.pending} credits in progress this term.</p>}
                </Panel>
              );
            }) : <Empty>No requirements are on file for your program yet.</Empty>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
