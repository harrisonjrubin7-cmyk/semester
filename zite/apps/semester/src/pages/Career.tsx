import { useState } from 'react';
import { toast } from 'sonner';
import { campus } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { PageHeader, Panel, Empty, useLoad, Loadable, errMsg } from '../components/kit';
import { StudentVerify } from '../components/PortfolioVerify';

type Opp = { id: string; title: string; kind: string; employer: string; applied: boolean };
type Item = { id: string; title: string };

function ApplyForm({ opp, portfolio, done }: { opp: Opp; portfolio: Item[]; done: () => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setItems((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  const send = async () => {
    setBusy(true);
    try { await campus({ action: 'apply', id: opp.id, shareItems: items, shareContact: contact }); toast.success('Application sent'); done(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <fieldset className="mt-3 space-y-2 text-sm">
      <legend className="font-medium">What {opp.employer} will see</legend>
      <p className="text-muted-foreground">Your name, plus only what you tick here.</p>
      {portfolio.length === 0 ? <p className="text-muted-foreground">You have no portfolio items to share.</p> : portfolio.map((p) => (
        <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={items.includes(p.id)} onChange={() => toggle(p.id)} />{p.title}</label>
      ))}
      <label className="flex items-center gap-2"><input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />Share my email address</label>
      <Button size="sm" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send application'}</Button>
    </fieldset>
  );
}

export default function Career() {
  const state = useLoad(() => campus({ action: 'get' }));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Plan" title="Career" sub="Internships, jobs, research and mentoring from employers your institution has approved. You choose what to share when you apply." />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 md:grid-cols-2">
          {d.opportunities.length === 0 ? <Empty>No approved employer has posted an opportunity yet.</Empty> : d.opportunities.map((o: Opp) => (
            <Panel key={o.id}>
              <p className="eyebrow">{o.kind}</p>
              <p className="mt-1 font-display text-xl">{o.title}</p>
              <p className="text-sm text-muted-foreground">{o.employer}</p>
              {o.applied ? <div className="mt-3"><Badge variant="outline">✓ Applied</Badge></div>
                : open === o.id ? <ApplyForm opp={o} portfolio={d.portfolio ?? []} done={() => { setOpen(null); state.reload(); }} />
                : <div className="mt-3"><Button size="sm" onClick={() => setOpen(o.id)}>Apply</Button></div>}
            </Panel>
          ))}
        </div>
      )}</Loadable>
      <Panel title="Verified evidence" className="mt-6"><StudentVerify /></Panel>
    </>
  );
}
