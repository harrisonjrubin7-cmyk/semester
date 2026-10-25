import { toast } from 'sonner';
import { campus } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { PageHeader, Panel, Empty, SourceTag, useLoad, Loadable, errMsg } from '../components/kit';

type Opp = { id: string; title: string; kind: string; employer: string; applied: boolean };

export default function Career() {
  const state = useLoad(() => campus({ action: 'get' }));
  const apply = async (id: string) => { try { await campus({ action: 'apply', id }); toast.success('Application sent'); state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <>
      <PageHeader eyebrow="Plan" title="Career" sub="Internships, jobs, research and mentoring. You choose which portfolio items to share when you apply." />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 md:grid-cols-2">
          {d.opportunities.length === 0 ? <Empty>No opportunities posted yet.</Empty> : d.opportunities.map((o: Opp) => (
            <Panel key={o.id}>
              <div className="flex items-start justify-between gap-2"><p className="eyebrow">{o.kind}</p><SourceTag source="Sample" /></div>
              <p className="mt-1 font-display text-xl">{o.title}</p>
              <p className="text-sm text-muted-foreground">{o.employer}</p>
              <div className="mt-3">{o.applied ? <Badge variant="outline">✓ Applied</Badge> : <Button size="sm" onClick={() => apply(o.id)}>Apply</Button>}</div>
            </Panel>
          ))}
        </div>
      )}</Loadable>
    </>
  );
}
