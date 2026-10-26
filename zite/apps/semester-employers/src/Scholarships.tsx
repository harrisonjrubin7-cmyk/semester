import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { scholarshipSponsor } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';

/* eslint-disable @typescript-eslint/no-explicit-any */
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That didn’t go through');
const money = (c: number) => (c / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const STATE: Record<string, string> = {
  requested: 'Waiting for the institution', verified: 'Verified', rejected: 'Not verified', suspended: 'Suspended', submitted: 'New', shortlisted: 'Shortlisted', awarded: 'Awarded — waiting for the student',
  not_selected: 'Not selected', withdrawn: 'Withdrawn', accepted: 'Accepted', declined_award: 'Declined by the student', handed_off: 'With financial aid', approved: 'Renewal approved', denied: 'Renewal denied',
};
const Box = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-md border border-border bg-card p-4"><h2 className="text-lg">{title}</h2><div className="mt-3">{children}</div></section>;

function Profile({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ orgName: d.sponsor?.orgName ?? '', website: d.sponsor?.website ?? '', about: d.sponsor?.about ?? '' });
  const save = async () => { try { await scholarshipSponsor({ action: 'profile', ...f }); toast(d.sponsor && d.sponsor.orgName !== f.orgName ? 'Saved. A new name is re-checked by each institution.' : 'Saved.'); reload(); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <Box title="Your organization">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Organization name<Input className="mt-1" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} /></label>
        <label className="text-xs">Website<Input className="mt-1" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">About (institutions read this when verifying you)<Textarea className="mt-1" value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} /></label>
      </div>
      <Button className="mt-2" size="sm" disabled={f.orgName.trim().length < 2} onClick={save}>Save</Button>
    </Box>
  );
}

function Links({ d, reload }: { d: any; reload: () => void }) {
  const [inst, setInst] = useState('');
  const ask = async () => { try { await scholarshipSponsor({ action: 'requestLink', institutionId: inst }); toast('Request sent to the institution’s scholarship office.'); reload(); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <Box title="Institutions">
      {d.links.length ? <ul className="mb-3 space-y-1 text-sm">{d.links.map((l: any) => <li key={l.institutionId}>{l.institution} · {STATE[l.state] ?? l.state}{l.note ? ` — ${l.note}` : ''}</li>)}</ul> : <p className="mb-3 text-sm text-muted-foreground">Ask an institution to verify you before you offer scholarships there.</p>}
      <div className="flex gap-2">
        <select aria-label="Institution" className="flex-1 rounded-md border border-border bg-background p-2 text-sm" value={inst} onChange={(e) => setInst(e.target.value)}>
          <option value="">Choose an institution…</option>{d.institutions.filter((i: any) => !d.links.some((l: any) => l.institutionId === i.id)).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <Button size="sm" disabled={!inst} onClick={ask}>Ask to be verified</Button>
      </div>
    </Box>
  );
}

function ProgramForm({ d, p, reload, done }: { d: any; p?: any; reload: () => void; done: () => void }) {
  const verified = d.links.filter((l: any) => l.state === 'verified');
  const [f, setF] = useState({ institutionId: p?.institutionId ?? verified[0]?.institutionId ?? '', name: p?.name ?? '', amount: p ? p.amountCents / 100 : 1000, awards: p?.awards ?? 1,
    criteria: p?.criteria ?? '', deadline: p?.deadline ?? '', renewable: p?.renewable ?? false, active: p?.active ?? true });
  const save = async () => {
    try { await scholarshipSponsor({ action: 'program', id: p?.id ?? null, expectedVersion: p?.version ?? 0, institutionId: f.institutionId, name: f.name, amountCents: Math.round(f.amount * 100), awards: f.awards,
      criteria: f.criteria, deadline: f.deadline, renewable: f.renewable, active: f.active }); toast('Scholarship saved.'); reload(); done(); } catch (e) { toast(`! ${msg(e)}`); }
  };
  if (!verified.length && !p) return <p className="text-sm text-muted-foreground">You can create a scholarship once an institution verifies you.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-xs">Institution<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.institutionId} disabled={!!p} onChange={(e) => setF({ ...f, institutionId: e.target.value })}>
        {(p ? d.links : verified).map((l: any) => <option key={l.institutionId} value={l.institutionId}>{l.institution}</option>)}</select></label>
      <label className="text-xs">Name<Input className="mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="text-xs">Amount per award (USD)<Input className="mt-1" type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></label>
      <label className="text-xs">Number of awards<Input className="mt-1" type="number" min={1} max={1000} value={f.awards} onChange={(e) => setF({ ...f, awards: Number(e.target.value) })} /></label>
      <label className="text-xs">Deadline<Input className="mt-1" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label>
      <div className="flex flex-col justify-end gap-1 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.renewable} onChange={(e) => setF({ ...f, renewable: e.target.checked })} />Renewable</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Open for applications</label>
      </div>
      <label className="text-xs sm:col-span-3">Eligibility criteria<Textarea className="mt-1" value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} /></label>
      <div className="flex gap-2 sm:col-span-3"><Button size="sm" disabled={!f.institutionId || f.name.trim().length < 3 || f.criteria.trim().length < 20 || !f.deadline || f.amount < 1} onClick={save}>Save scholarship</Button><Button size="sm" variant="ghost" onClick={done}>Cancel</Button></div>
    </div>
  );
}

function Applicant({ x, reload }: { x: any; reload: () => void }) {
  const [note, setNote] = useState('');
  const decide = async (step: 'shortlist' | 'award' | 'not_select') => { try { await scholarshipSponsor({ action: 'decide', id: x.id, step, expectedVersion: x.version, note }); toast('Recorded. The student is notified in Semester.'); reload(); } catch (e) { toast(`! ${msg(e)}`); reload(); } };
  const renew = async (r: any, step: 'approve' | 'deny') => { try { await scholarshipSponsor({ action: 'renewal', id: r.id, step, expectedVersion: r.version, note }); toast('Recorded.'); reload(); } catch (e) { toast(`! ${msg(e)}`); reload(); } };
  const open = ['submitted', 'shortlisted'].includes(x.state);
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{x.name}{x.email ? ` · ${x.email}` : ''}</span><span className="text-xs">{STATE[x.state] ?? x.state}</span></div>
      <p className="mt-1 whitespace-pre-wrap text-xs">{x.statement}</p>
      {(open || x.renewals.some((r: any) => r.state === 'requested')) && <Input aria-label="Note" className="mt-2" placeholder="Note (needed to decline)" value={note} onChange={(e) => setNote(e.target.value)} />}
      {open && <div className="mt-2 flex flex-wrap gap-2">
        {x.state === 'submitted' && <Button size="sm" variant="outline" onClick={() => decide('shortlist')}>Shortlist</Button>}
        <Button size="sm" onClick={() => decide('award')}>Award</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => decide('not_select')}>Not selected</Button>
      </div>}
      {x.renewals.map((r: any) => <div key={r.id} className="mt-2 rounded border border-border p-2 text-xs"><p>Renewal for {r.term}: {r.statement}</p><p className="text-muted-foreground">{STATE[r.state] ?? r.state}</p>
        {r.state === 'requested' && <div className="mt-1 flex gap-2"><Button size="sm" onClick={() => renew(r, 'approve')}>Approve renewal</Button><Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => renew(r, 'deny')}>Deny</Button></div>}</div>)}
    </li>
  );
}

export default function Scholarships() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const load = () => { setErr(null); scholarshipSponsor({ action: 'get' }).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  if (err) return <div className="rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>;
  if (!d) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  return (
    <div className="space-y-4">
      <div><p className="eyebrow">Scholarships</p><h1 className="mt-1 text-3xl">Your scholarships</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Offer scholarships at institutions that verify you. Applicants share their name, email and statement only. Awards go to the institution’s financial aid office; nothing is paid from here.</p></div>
      <Profile d={d} reload={load} />
      {d.sponsor && <Links d={d} reload={load} />}
      {d.sponsor && (
        <Box title={`Scholarships · ${d.programs.length}`}>
          {edit === 'new' ? <ProgramForm d={d} reload={load} done={() => setEdit(null)} /> : <Button size="sm" className="mb-3" onClick={() => setEdit('new')}>Create a scholarship</Button>}
          <div className="space-y-3">{d.programs.map((p: any) => (
            <div key={p.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.name} · {p.institution} · {money(p.amountCents)} × {p.awards}</span>
                <span className="text-xs">{p.active ? `Open until ${p.deadline}` : 'Closed'}</span></div>
              {edit === p.id ? <ProgramForm d={d} p={p} reload={load} done={() => setEdit(null)} /> : <Button size="sm" variant="outline" className="mt-2" onClick={() => setEdit(p.id)}>Edit</Button>}
              {p.applicants.length ? <ul className="mt-3 space-y-2">{p.applicants.map((x: any) => <Applicant key={x.id} x={x} reload={load} />)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No applicants yet.</p>}
            </div>))}</div>
        </Box>
      )}
    </div>
  );
}
