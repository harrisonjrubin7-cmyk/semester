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

type Profile = { headline: string; program: string; gradYear: number | null; skills: string; roles: string; discoverable: boolean };

function DiscoveryPanel({ profile, reload }: { profile: Profile | null; reload: () => void }) {
  const [f, setF] = useState<Profile>(profile ?? { headline: '', program: '', gradYear: null, skills: '', roles: '', discoverable: false });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await campus({ action: 'saveProfile', ...f }); toast.success(f.discoverable ? 'Saved. Approved employers can now find you.' : 'Saved. You are not discoverable.'); reload(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const inp = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
  const lab = 'text-xs text-muted-foreground';
  return (
    <Panel title="Be discoverable by employers" className="mt-6">
      <p className="text-sm text-muted-foreground">Write a short profile and choose whether employers can find you. Only employers your institution has approved can search, they see only what you write here, and turning this off hides you right away.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><label className={lab} htmlFor="dp-head">Headline</label><input id="dp-head" className={inp} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} maxLength={120} placeholder="e.g. Data-minded economist" /></div>
        <div><label className={lab} htmlFor="dp-prog">Program</label><input id="dp-prog" className={inp} value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} maxLength={120} placeholder="e.g. Economics, BS" /></div>
        <div><label className={lab} htmlFor="dp-year">Graduation year</label><input id="dp-year" className={inp} inputMode="numeric" value={f.gradYear ?? ''} onChange={(e) => setF({ ...f, gradYear: e.target.value.trim() === '' ? null : Number(e.target.value) })} placeholder="e.g. 2027" /></div>
        <div><label className={lab} htmlFor="dp-roles">Roles you want</label><input id="dp-roles" className={inp} value={f.roles} onChange={(e) => setF({ ...f, roles: e.target.value })} maxLength={300} placeholder="e.g. Data analyst intern" /></div>
        <div className="md:col-span-2"><label className={lab} htmlFor="dp-skills">Skills</label><input id="dp-skills" className={inp} value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} maxLength={500} placeholder="e.g. Python, Excel, SQL" /></div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.discoverable} onChange={(e) => setF({ ...f, discoverable: e.target.checked })} />Let approved employers discover me</label>
      <Button size="sm" className="mt-3" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save discovery profile'}</Button>
    </Panel>
  );
}

export default function Career() {
  const state = useLoad(() => campus({ action: 'get' }));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Plan" title="Career" sub="Internships, jobs, research and mentoring from employers your institution has approved. You choose what to share when you apply." />
      <Loadable state={state}>{(d) => (<>
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
        <DiscoveryPanel profile={d.profile ?? null} reload={state.reload} />
      </>)}</Loadable>
      <Panel title="Verified evidence" className="mt-6"><StudentVerify /></Panel>
    </>
  );
}
