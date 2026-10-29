import { useState } from 'react';
import { toast } from 'sonner';
import { departmentForms } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Field = { key: string; label: string; type: 'text' | 'longtext' | 'choice' | 'date'; required?: boolean; options?: string[] };
type Form = { id: number; departmentId: number; department: string; title: string; instructions: string; fields: Field[]; audience: string; state: string; version: number; seenHash: string; mine: boolean; author: string; manage: boolean; canAnswer: boolean };
type Resp = { id: number; formId: number; mine: boolean; respondent: string; answers: Record<string, string>; state: string; note: string; version: number; at: string | null };
type Dept = { id: number; name: string; admin: boolean; chair: boolean; admins: string[] };
type Data = { me: string; isAdmin: boolean; departments: Dept[]; forms: Form[]; responses: Resp[] };

const key = () => crypto.randomUUID();
const AUD: Record<string, string> = { students: 'Students', staff: 'Staff', everyone: 'Everyone' };
const slug = (s: string, i: number) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'field') .replace(/^[^a-z]/, 'f') + (i ? `_${i}` : '');

function Answer({ f, reload }: { f: Form; reload: () => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({}); const [k] = useState(key);
  const missing = f.fields.some((x) => x.required && !(v[x.key] ?? '').trim());
  const send = async () => { try { await departmentForms({ action: 'respond', formId: f.id, requestKey: k, answers: Object.fromEntries(Object.entries(v).filter(([, x]) => x.trim())) }); toast.success('Sent to the department'); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="space-y-3">
      {f.instructions && <p className="text-sm text-muted-foreground">{f.instructions}</p>}
      {f.fields.map((x) => <div key={x.key}><Label htmlFor={`a-${f.id}-${x.key}`}>{x.label}{x.required ? ' *' : ''}</Label>
        {x.type === 'longtext' ? <Textarea id={`a-${f.id}-${x.key}`} className="mt-1" value={v[x.key] ?? ''} onChange={(e) => setV({ ...v, [x.key]: e.target.value })} />
          : x.type === 'choice' ? <Select value={v[x.key] ?? ''} onValueChange={(o) => setV({ ...v, [x.key]: o })}><SelectTrigger id={`a-${f.id}-${x.key}`} className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{(x.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
          : <Input id={`a-${f.id}-${x.key}`} className="mt-1" type={x.type === 'date' ? 'date' : 'text'} value={v[x.key] ?? ''} onChange={(e) => setV({ ...v, [x.key]: e.target.value })} />}</div>)}
      <Button disabled={missing} onClick={send}>Send</Button>
    </div>
  );
}

function Builder({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const depts = d.departments.filter((x) => x.admin);
  const [f, setF] = useState({ departmentId: '', title: '', instructions: '', audience: 'students' });
  const [fields, setFields] = useState<Field[]>([{ key: 'request', label: 'What do you need?', type: 'longtext', required: true }]);
  if (!depts.length) return null;
  const upd = (i: number, p: Partial<Field>) => setFields(fields.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const save = async () => {
    try { await departmentForms({ action: 'form', step: 'draft', id: null, expectedVersion: null, departmentId: Number(f.departmentId), title: f.title, instructions: f.instructions, audience: f.audience as never, fields }); toast.success('Draft saved. Send it for approval when ready.'); setF({ ...f, title: '', instructions: '' }); await reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel title="Build a form">
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label htmlFor="b-d">Department</Label><Select value={f.departmentId} onValueChange={(v) => setF({ ...f, departmentId: v })}><SelectTrigger id="b-d" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{depts.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="b-a">For</Label><Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v })}><SelectTrigger id="b-a" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(AUD).map(([k2, l]) => <SelectItem key={k2} value={k2}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="b-t">Title</Label><Input id="b-t" className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      </div>
      <Label htmlFor="b-i" className="mt-3 block">Instructions</Label><Textarea id="b-i" className="mt-1" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      <p className="mt-3 text-sm font-medium">Fields</p>
      <ul className="mt-1 space-y-2">{fields.map((x, i) => (
        <li key={i} className="grid gap-2 rounded-sm border border-border p-2 sm:grid-cols-4">
          <Input aria-label={`Field ${i + 1} label`} value={x.label} onChange={(e) => upd(i, { label: e.target.value, key: slug(e.target.value, i) })} />
          <Select value={x.type} onValueChange={(t) => upd(i, { type: t as Field['type'], options: t === 'choice' ? x.options ?? ['Yes', 'No'] : undefined })}><SelectTrigger aria-label={`Field ${i + 1} type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Short text</SelectItem><SelectItem value="longtext">Long text</SelectItem><SelectItem value="choice">Choice</SelectItem><SelectItem value="date">Date</SelectItem></SelectContent></Select>
          {x.type === 'choice' ? <Input aria-label={`Field ${i + 1} options, comma separated`} value={(x.options ?? []).join(', ')} onChange={(e) => upd(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} /> : <span />}
          <div className="flex items-center gap-2 text-xs"><label className="flex items-center gap-1"><input type="checkbox" checked={!!x.required} onChange={(e) => upd(i, { required: e.target.checked })} />Required</label><Button size="sm" variant="ghost" disabled={fields.length < 2} onClick={() => setFields(fields.filter((_, j) => j !== i))}>Remove</Button></div>
        </li>))}</ul>
      <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={fields.length >= 25} onClick={() => setFields([...fields, { key: slug('field', fields.length), label: '', type: 'text' }])}>Add field</Button>
        <Button size="sm" disabled={!f.departmentId || f.title.trim().length < 5 || fields.some((x) => x.label.trim().length < 2)} onClick={save}>Save draft</Button></div>
    </Panel>
  );
}

function Manage({ f, d, reload }: { f: Form; d: Data; reload: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const step = async (s: 'submit' | 'approve' | 'return' | 'close' | 'copy') => { try { await departmentForms({ action: 'form', step: s, id: f.id, expectedVersion: f.version, seenHash: f.seenHash, note }); toast.success('Saved'); setNote(''); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  const review = async (r: Resp, s: 'accept' | 'return' | 'decline') => { try { await departmentForms({ action: 'review', id: r.id, expectedVersion: r.version, step: s, note }); toast.success('Saved'); setNote(''); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  const resps = d.responses.filter((r) => r.formId === f.id && !r.mine);
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.department} · for {AUD[f.audience]} · built by {f.mine ? 'you' : f.author} · {f.fields.length} fields</p></div><Status value={f.state.replace('_', ' ')} /></div>
      <ul className="mt-1 text-xs text-muted-foreground">{f.fields.map((x) => <li key={x.key}>{x.label}{x.required ? ' *' : ''} · {x.type}{x.options ? ` (${x.options.join(', ')})` : ''}</li>)}</ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {f.state === 'draft' && f.mine && <Button size="sm" onClick={() => step('submit')}>Send for approval</Button>}
        {f.state === 'in_review' && !f.mine && <><Input aria-label="Note" className="h-8 w-56" placeholder="Note (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" onClick={() => step('approve')}>Approve and open</Button><Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => step('return')}>Return</Button></>}
        {f.state === 'in_review' && f.mine && <span className="text-xs text-muted-foreground">Waiting for the chair or another department admin.</span>}
        {f.state === 'open' && <Button size="sm" variant="outline" onClick={() => step('close')}>Close</Button>}
        {(f.state === 'open' || f.state === 'closed') && <Button size="sm" variant="outline" onClick={() => step('copy')}>Copy to a new draft</Button>}
      </div>
      {resps.length > 0 && <details className="mt-2"><summary className="text-xs">Responses ({resps.length})</summary><ul className="mt-1 space-y-2">{resps.map((r) => (
        <li key={r.id} className="rounded-sm border border-border p-2 text-xs"><p className="flex justify-between"><span className="font-medium">{r.respondent}</span><span>{r.state} · {fmt(r.at)}</span></p>
          <dl>{f.fields.map((x) => r.answers[x.key] ? <div key={x.key}><dt className="text-muted-foreground">{x.label}</dt><dd className="whitespace-pre-wrap">{r.answers[x.key]}</dd></div> : null)}</dl>
          {r.state === 'submitted' && <div className="mt-1 flex flex-wrap gap-2"><Button size="sm" onClick={() => review(r, 'accept')}>Accept</Button><Input aria-label="Note to the person" className="h-8 w-56" placeholder="Note to the person" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => review(r, 'return')}>Return</Button><Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => review(r, 'decline')}>Decline</Button></div>}
          {r.note && <p className="mt-1">Note: {r.note}</p>}</li>))}</ul></details>}
    </div>
  );
}

function AdminSetup({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const [s, setS] = useState({ departmentId: '', email: '' });
  const go = async (active: boolean) => { try { await departmentForms({ action: 'setAdmin', departmentId: Number(s.departmentId), email: s.email, active }); toast.success(active ? 'Appointed' : 'Revoked'); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Panel title="Department admins (institution administrators)">
      {d.departments.length === 0 ? <Empty>No departments yet. Add them in Section requests.</Empty> : <>
        <ul className="mb-3 text-sm">{d.departments.map((x) => <li key={x.id}>{x.name}: {x.admins.join(', ') || 'no admins'}</li>)}</ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label htmlFor="sa-d">Department</Label><Select value={s.departmentId} onValueChange={(v) => setS({ ...s, departmentId: v })}><SelectTrigger id="sa-d" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{d.departments.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="sa-e">Email</Label><Input id="sa-e" className="mt-1" type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
        </div>
        <div className="mt-2 flex gap-2"><Button size="sm" disabled={!s.departmentId || !s.email.includes('@')} onClick={() => go(true)}>Appoint</Button><Button size="sm" variant="outline" disabled={!s.departmentId || !s.email.includes('@')} onClick={() => go(false)}>Revoke</Button></div>
      </>}
    </Panel>
  );
}

export default function DepartmentForms() {
  const state = useLoad(() => departmentForms({ action: 'get' }) as Promise<Data>);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHeader eyebrow="Institution" title="Department forms" sub="Forms a department publishes after the chair or another department admin approves the exact fields." />
      <Loadable state={state}>{(d: Data) => {
        const answerable = d.forms.filter((f) => f.canAnswer);
        const managed = d.forms.filter((f) => f.manage);
        const mine = d.responses.filter((r) => r.mine);
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {managed.length > 0 && <Panel title="Your departments' forms">{managed.map((f) => <Manage key={f.id} f={f} d={d} reload={state.reload} />)}</Panel>}
              <Builder d={d} reload={state.reload} />
              {d.isAdmin && <AdminSetup d={d} reload={state.reload} />}
            </div>
            <div className="space-y-4">
              <Panel title="Forms for you">{answerable.length === 0 ? <Empty>No open forms for you.</Empty> : answerable.map((f) => {
                const sent = mine.find((r) => r.formId === f.id && (r.state === 'submitted' || r.state === 'accepted'));
                return <div key={f.id} className="border-b border-border py-2 last:border-0"><button className="w-full text-left font-sans text-sm font-medium" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>{f.title}</button><p className="text-xs text-muted-foreground">{f.department}{sent ? ` · sent (${sent.state})` : ''}</p>{open === f.id && !sent && <div className="mt-2"><Answer f={f} reload={state.reload} /></div>}</div>;
              })}</Panel>
              <Panel title="Your responses">{mine.length === 0 ? <Empty>None yet.</Empty> : mine.map((r) => <div key={r.id} className="border-b border-border py-2 text-sm last:border-0"><p>{d.forms.find((f) => f.id === r.formId)?.title ?? 'Form'}</p><p className="text-xs"><Status value={r.state} /> {r.note && `· ${r.note}`}</p></div>)}</Panel>
            </div>
          </div>
        );
      }}</Loadable>
    </>
  );
}
