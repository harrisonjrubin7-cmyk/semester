import { useState } from 'react';
import { toast } from 'sonner';
import { partners } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const SCOPE: Record<string, string> = { publish_listings: 'Publish marketplace listings', view_orders: 'See orders for its listings', propose_articulation: 'Propose transfer articulations', manage_course_mappings: 'Manage course mappings', submit_research_requests: 'Submit research data requests', post_opportunities: 'Post opportunities to students' };
const KIND: Record<string, string> = { marketplace: 'Marketplace seller', transfer: 'Transfer partner', research: 'Research partner', employer: 'Employer', service: 'Service provider' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function ScopePicker({ value, onChange, all }: { value: string[]; onChange: (v: string[]) => void; all: string[] }) {
  return <div className="grid gap-1 sm:grid-cols-2">{all.map((s) => <label key={s} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.includes(s)} onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />{SCOPE[s]}</label>)}</div>;
}

function Org({ o, d, reload }: { o: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [m, setM] = useState({ email: '', role: 'member' });
  const [ap, setAp] = useState({ institutionId: '', scopes: [] as string[], note: '' });
  const admin = o.role === 'admin';
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">{KIND[o.kind]}{o.website ? ` · ${o.website}` : ''} · you are {o.role === 'admin' ? 'an administrator' : 'a member'}</p>
      <div><p className="text-xs font-medium">Institutions</p>
        {o.relationships.length ? <ul>{o.relationships.map((r: any) => (
          <li key={r.id} className="border-t border-border py-2 first:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><span><b>{r.institution}</b>{r.validTo ? ` · until ${r.validTo}` : ''}<span className="block text-xs text-muted-foreground">{r.scopes.length ? `Granted: ${r.scopes.map((s: string) => SCOPE[s]).join(', ')}` : `Asked for: ${r.requestedScopes.map((s: string) => SCOPE[s]).join(', ')}`}{r.statusNote ? ` · ${r.statusNote}` : ''}</span></span><Status value={r.status} /></div>
            {r.state === 'agreement_pending' && <div className="mt-2 space-y-2 rounded-md border border-border p-2">
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{r.agreementText}</pre>
              <p className="text-xs">Ends {r.validTo}. Grants: {r.scopes.map((s: string) => SCOPE[s]).join(', ')}.</p>
              {admin ? <Button size="sm" onClick={() => act(() => partners({ action: 'accept', relId: r.id, expectedVersion: r.version, hash: r.agreementHash }), 'Agreement accepted.')}>Accept these exact terms</Button> : <p className="text-xs text-muted-foreground">An administrator of your organization accepts it.</p>}
            </div>}
          </li>))}</ul> : <Empty>Not working with any institution yet.</Empty>}
        {admin && <div className="mt-2 space-y-2 rounded-md border border-border p-2">
          <p className="text-xs font-medium">Apply to an institution</p>
          <select aria-label="Institution" className={sel} value={ap.institutionId} onChange={(e) => setAp({ ...ap, institutionId: e.target.value })}><option value="">Choose…</option>{d.institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <p className="text-xs">What you are asking to do (the institution decides what it grants):</p>
          <ScopePicker value={ap.scopes} onChange={(v) => setAp({ ...ap, scopes: v })} all={d.scopes} />
          <Textarea aria-label="About your organization" placeholder="Who you are and why you want to work with this institution" value={ap.note} onChange={(e) => setAp({ ...ap, note: e.target.value })} />
          <Button size="sm" disabled={!ap.institutionId || !ap.scopes.length} onClick={async () => { if (await act(() => partners({ action: 'apply', orgId: o.id, institutionId: ap.institutionId, scopes: ap.scopes as never, note: ap.note }), 'Application sent.')) setAp({ institutionId: '', scopes: [], note: '' }); }}>Apply</Button>
        </div>}
      </div>
      <div><p className="text-xs font-medium">Members · {o.members.length}</p>
        <ul className="text-xs">{o.members.map((x: any, i: number) => <li key={i}>{x.name} — {x.role}{x.me ? ' (you)' : ''}</li>)}</ul>
        {admin && <div className="mt-2 flex flex-wrap gap-2">
          <Input aria-label="Member email" placeholder="Their Semester email" className="max-w-xs" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} />
          <select aria-label="Role" className="rounded-md border border-border bg-background p-2 text-sm" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })}><option value="member">Member</option><option value="admin">Administrator</option><option value="remove">Remove</option></select>
          <Button size="sm" disabled={!m.email.includes('@')} onClick={() => act(() => partners({ action: 'member', orgId: o.id, email: m.email, role: m.role as never }), 'Saved.')}>Save</Button></div>}
        {admin && <p className="mt-1 text-xs text-muted-foreground">Another administrator changes your own role, and an organization keeps at least one administrator.</p>}
      </div>
    </div>
  );
}

function Manage({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [text, setText] = useState(r.agreementText);
  const [to, setTo] = useState(r.validTo ?? '');
  const [scopes, setScopes] = useState<string[]>(r.scopes.length ? r.scopes : r.requestedScopes);
  const steps: string[] = [];
  if (r.state === 'applied') steps.push('verify', 'reject');
  if (['verified', 'agreement_pending', 'active', 'suspended'].includes(r.state) && !r.verifiedByMe) steps.push('propose');
  if (['verified', 'agreement_pending'].includes(r.state)) steps.push('reject');
  if (r.state === 'active') steps.push('suspend');
  if (r.state === 'suspended') steps.push('reinstate');
  if (!['offboarded', 'rejected'].includes(r.state)) steps.push('offboard');
  const L: Record<string, string> = { verify: 'Verify organization', reject: 'Reject', propose: r.state === 'verified' ? 'Propose agreement' : 'Change terms or renew', suspend: 'Suspend', reinstate: 'Reinstate', offboard: 'Offboard' };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span><b>{r.org}</b> · {KIND[r.orgKind]}{r.website ? ` · ${r.website}` : ''}<span className="block text-xs text-muted-foreground">Asked for: {r.requestedScopes.map((s: string) => SCOPE[s]).join(', ')}{r.verifiedBy ? ` · verified by ${r.verifiedBy}` : ''}{r.proposedBy ? ` · terms by ${r.proposedBy}` : ''}{r.acceptedBy ? ` · accepted by ${r.acceptedBy} ${fmt(r.acceptedAt)}` : ''}</span></span><Status value={r.status} /></div>
      {r.applicationNote && <p className="mt-1 text-xs">{r.applicationNote}</p>}
      {r.verificationNote && <p className="mt-1 text-xs">Verification: {r.verificationNote}</p>}
      {r.scopes.length > 0 && <p className="mt-1 text-xs">Granted: {r.scopes.map((s: string) => SCOPE[s]).join(', ')}{r.validTo ? ` · until ${r.validTo}` : ''}</p>}
      <div className="mt-2 flex flex-wrap gap-1">{steps.map((s) => <Button key={s} size="sm" variant={open === s ? 'default' : 'outline'} onClick={() => setOpen(open === s ? null : s)}>{L[s]}</Button>)}</div>
      {r.verifiedByMe && r.state === 'verified' && <p className="mt-1 text-xs text-muted-foreground">You verified this organization, so another manager prepares the agreement.</p>}
      {open && <div className="mt-2 space-y-2 rounded-md border border-border p-2">
        {open === 'propose' ? <>
          <Textarea aria-label="Agreement terms" className="min-h-32" placeholder="Agreement terms" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="text-xs">Ends on<Input type="date" className="mt-1 max-w-xs" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <p className="text-xs">Grant (the partner cannot add to this):</p>
          <ScopePicker value={scopes} onChange={setScopes} all={d.scopes} />
          <p className="text-xs text-muted-foreground">The partner must accept these exact terms before anything is granted; changing them later needs acceptance again.</p>
        </> : <Input aria-label="Note" placeholder={open === 'verify' ? 'How the organization was verified' : 'Reason'} value={note} onChange={(e) => setNote(e.target.value)} />}
        <Button size="sm" disabled={open === 'propose' ? text.trim().length < 40 || !to || !scopes.length : open === 'reinstate' ? false : note.trim().length < (open === 'verify' ? 10 : 5)}
          onClick={async () => { if (await act(() => partners({ action: 'manage', relId: r.id, step: open as never, expectedVersion: r.version, note, text, validTo: to || null, scopes: scopes as never }), 'Recorded.')) setOpen(null); }}>{L[open]}</Button>
      </div>}
    </li>
  );
}

export default function Partners() {
  const s = useLoad(() => partners({ action: 'get' }));
  const [reg, setReg] = useState({ name: '', kind: 'marketplace', website: '' });
  const [st, setSt] = useState('');
  const act = useAct(s.reload);
  return (
    <>
      <PageHeader eyebrow="Partners" title="Partner organizations" sub="Organizations that work with institutions — sellers, transfer and research partners, employers. Each institution decides separately what a partner may do." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.myOrgs.map((o: any) => <Panel key={o.id} title={o.name}><Org o={o} d={d} reload={s.reload} /></Panel>)}
          <Panel title="Register an organization">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <Input aria-label="Organization name" placeholder="Organization name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
              <select aria-label="Kind" className="rounded-md border border-border bg-background p-2 text-sm" value={reg.kind} onChange={(e) => setReg({ ...reg, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <Input aria-label="Website" placeholder="Website (optional)" value={reg.website} onChange={(e) => setReg({ ...reg, website: e.target.value })} />
              <div><Button size="sm" disabled={reg.name.trim().length < 2} onClick={async () => { if (await act(() => partners({ action: 'register', ...reg, kind: reg.kind as never }), 'Registered. You are its first administrator.')) setReg({ name: '', kind: 'marketplace', website: '' }); }}>Register</Button></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">If your organization is already registered, ask one of its administrators to add you.</p>
          </Panel>
          {d.manager && <Panel title={`Partners of ${d.institutionName} · ${d.queue.filter((r: any) => ['applied', 'verified', 'agreement_pending'].includes(r.state)).length} waiting`}>
            {d.queue.length ? <ul className="space-y-2">{d.queue.map((r: any) => <Manage key={r.id} r={r} d={d} reload={s.reload} />)}</ul> : <Empty>No partner applications.</Empty>}
          </Panel>}
          {d.isAdmin && <Panel title="Partner managers">
            <p className="text-xs">{d.staff.join(', ') || 'None yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={st} onChange={(e) => setSt(e.target.value)} />
              <Button size="sm" disabled={!st.includes('@')} onClick={() => act(() => partners({ action: 'setStaff', email: st, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.includes('@')} onClick={() => act(() => partners({ action: 'setStaff', email: st, on: false }), 'Removed.')}>Remove</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Managers verify partners and set their terms; one manager verifies, a different one proposes the agreement. You cannot change your own access.</p>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
