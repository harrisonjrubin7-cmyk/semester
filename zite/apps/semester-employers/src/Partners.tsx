import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { employer } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';

type Inst = { id: string; name: string; status: string; note: string };
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That didn’t go through');

/** Institutions decide separately whether an employer may reach their students. */
export default function Partners() {
  const [rows, setRows] = useState<Inst[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [org, setOrg] = useState('');
  const load = () => { setErr(null); (employer({ action: 'partners' }) as Promise<{ institutions: Inst[] }>).then((r) => setRows(r.institutions)).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  const ask = async (id: string) => {
    try { await employer({ action: 'requestPartner', institutionId: id, organization: org }); toast('Request sent. The institution’s staff will decide.'); load(); }
    catch (e) { toast(`! ${msg(e)}`); }
  };
  return (
    <section aria-labelledby="partners-h">
      <p className="eyebrow">Employers</p><h1 id="partners-h" className="mt-1 text-3xl">Institutions</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Students only see your opportunities at institutions that have approved you. Each institution decides on its own.</p>
      <label className="mt-4 block max-w-sm text-sm">Organization name<Input className="mt-1" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="As students should see it" /></label>
      {err && <div className="mt-4 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!rows && !err && <div className="mt-4 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
      {rows && rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No institutions are on Semester yet.</p>}
      <ul className="mt-4 space-y-2">
        {rows?.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
            <span><span className="font-medium">{i.name}</span> · <span>{i.status}</span>{i.note && <span className="text-muted-foreground"> — {i.note}</span>}</span>
            {(i.status === 'Not requested' || i.status === 'Declined' || i.status === 'Revoked') &&
              <Button size="sm" variant="outline" disabled={org.trim().length < 2} onClick={() => ask(i.id)}>Request approval</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
