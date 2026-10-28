import { customerEvidence } from 'zitejs/api';
import { Header, Panel, Chip, Loadable, useLoad, fmt } from './ui';

type Readiness = { institution: string; sharedAt: string; ready: boolean; checks: { key: string; label: string; state: string }[] };
type Assurance = { capability: string; domain: string; stages: string[]; environments: string[]; releasedAt: string };

/** Only what institutions chose to share and what Security Lab released. Company OS holds no student records. */
export default function CustomerEvidencePage() {
  const s = useLoad(() => customerEvidence({}) as Promise<{ readiness: Readiness[]; assurance: Assurance[] }>);
  return (
    <>
      <Header eyebrow="Customers" title="Customer readiness & assurance" sub="Readiness states institutions chose to share, and assurance coverage Security Lab released. Nothing here is read from tenant records." />
      <Loadable state={s}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Shared readiness">{d.readiness.length === 0 ? <p className="text-sm text-muted-foreground">No institution has shared its readiness.</p> : d.readiness.map((r) => (
            <div key={r.institution} className="border-t border-border py-2 text-sm first:border-t-0">
              <p className="font-medium">{r.institution} <Chip value={r.ready ? 'Ready' : 'Not ready'} /></p>
              <p className="text-xs text-muted-foreground">Shared {fmt(r.sharedAt)}</p>
              <ul className="mt-1">{r.checks.map((c) => <li key={c.key}>{c.label}: {c.state}</li>)}</ul>
            </div>))}</Panel>
          <Panel title="Released assurance coverage">{d.assurance.length === 0 ? <p className="text-sm text-muted-foreground">Nothing released.</p> : d.assurance.map((a) => (
            <div key={a.capability} className="border-t border-border py-2 text-sm first:border-t-0">
              <p className="font-medium">{a.capability} <span className="text-muted-foreground">· {a.domain}</span></p>
              <p>{a.stages.join(', ')} · {a.environments.join(', ')}</p>
              <p className="text-xs text-muted-foreground">Released {fmt(a.releasedAt)}</p>
            </div>))}</Panel>
        </div>
      )}</Loadable>
    </>
  );
}
