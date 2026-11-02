import { useState } from 'react';
import { toast } from 'sonner';
import { institutionOps } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, ActionPreview, errMsg } from '../components/kit';
import { ConfirmAction } from '../components/overlays';

type Pair = { label: string; value: number };
const run = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => { try { await fn(); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };

function Bars({ title, rows }: { title: string; rows: Pair[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Panel title={`${title} · ${total}`}>
      {rows.length ? <ul className="space-y-2">{rows.sort((a, b) => b.value - a.value).map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between"><span>{r.label}</span><span className="tabular-nums text-muted-foreground">{r.value}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>))}</ul> : <Empty>Nothing yet.</Empty>}
    </Panel>
  );
}

export function Analytics() {
  const s = useLoad(() => institutionOps({ action: 'analytics' }));
  const download = async () => {
    try {
      const r = await institutionOps({ action: 'export' }) as { filename: string; csv: string };
      const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv' }));
      const el = document.createElement('a'); el.href = url; el.download = r.filename; el.click(); URL.revokeObjectURL(url);
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <>
      <PageHeader eyebrow="Institution" title="Analytics" sub="Counts for your institution only, from Semester’s records (not your official student system). Small groups are hidden so no one can be identified."
        actions={<Button variant="outline" size="sm" onClick={download}>Export aggregates (CSV)</Button>} />
      <Loadable state={s}>{(d: any) => (
        <>
          {d.isSample && <p className="mb-4 text-xs text-muted-foreground">Sample institution: these figures are demo data.</p>}
          <p className="mb-4 text-xs text-muted-foreground">Any count under {d.minCell} shows as “&lt;{d.minCell}”. When only one group would be hidden, a second one is hidden too, so it can’t be worked out from the total.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {d.metrics.map((m: any) => (
              <Panel key={m.id} title={`${m.label} · total ${m.totalDisplay}`}>
                {m.cells.length ? <ul className="space-y-2 text-sm">{m.cells.map((c: any) => {
                  const max = Math.max(1, ...m.cells.map((x: any) => x.value ?? 0));
                  return (<li key={c.label}>
                    <div className="flex justify-between"><span>{c.label}</span><span className="tabular-nums text-muted-foreground">{c.display}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">{c.value != null && <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(c.value / max) * 100}%` }} />}</div>
                  </li>);
                })}</ul> : <Empty>Nothing yet.</Empty>}
                <details className="mt-3 text-xs text-muted-foreground"><summary>Definition</summary>
                  <p className="mt-1">Counts: {m.counts}. Population: {m.population}. Source: {m.source}. Owner: {m.owner}. Version {m.version}. {m.caveat}</p></details>
              </Panel>))}
          </div>
        </>
      )}</Loadable>
    </>
  );
}

function PlaceHold({ students, reload }: { students: { id: string; name: string }[]; reload: () => void }) {
  const [student, setStudent] = useState('');
  const [office, setOffice] = useState<'Registrar' | 'Bursar' | 'Advising' | 'Student Affairs'>('Registrar');
  const [message, setMessage] = useState('');
  const valid = !!student && message.trim().length >= 10;
  return (
    <Panel title="Place a registration hold" className="mb-4">
      <div className="grid gap-2 md:grid-cols-2">
        <Select value={student} onValueChange={setStudent}><SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
          <SelectContent>{students.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>
        <Select value={office} onValueChange={(v) => setOffice(v as typeof office)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{['Registrar', 'Bursar', 'Advising', 'Student Affairs'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
      </div>
      <Textarea className="mt-2" rows={2} placeholder="What the student sees, and how to clear it (at least 10 characters)" value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button className="mt-2" size="sm" disabled={!valid} onClick={() => run(() => institutionOps({ action: 'placeHold', studentId: student, office, message }), 'Hold placed. The student can’t submit registration until it’s lifted.', () => { setMessage(''); setStudent(''); reload(); })}>Place hold</Button>
    </Panel>
  );
}

export function RegistrationHolds() {
  const s = useLoad(() => institutionOps({ action: 'holds' }));
  const [reason, setReason] = useState('');
  return (
    <>
      <PageHeader eyebrow="Staff · Registrar" title="Registration holds" sub="Holds here stop a student submitting registration. Whoever places a hold can’t lift it — a second person does." />
      <Loadable state={s}>{(d) => (
        <>
          <PlaceHold students={d.students} reload={s.reload} />
          <Panel title={`${d.holds.filter((h: { status: string }) => h.status === 'Active').length} active`}>
            {d.holds.length ? <ul>{d.holds.map((h: { id: string; student: string; office: string; status: string; message: string; mine: boolean }) => (
              <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-3 text-sm last:border-0">
                <div><p className="font-medium">{h.student} · {h.office}</p><p className="text-xs text-muted-foreground">{h.message}</p></div>
                <div className="flex items-center gap-2"><Status value={h.status === 'Active' ? 'Hold' : h.status} />
                  {h.status === 'Active' && (h.mine ? <span className="text-xs text-muted-foreground">You placed this</span> : (
                    <ConfirmAction trigger={<Button size="sm" variant="outline">Lift</Button>} title={`Lift ${h.office} hold for ${h.student}?`} confirmLabel="Lift hold"
                      onConfirm={() => run(() => institutionOps({ action: 'releaseHold', holdId: h.id, reason: reason || 'Resolved' }), 'Hold lifted.', s.reload)}>
                      <ActionPreview says="The student can submit registration again (other holds still apply)." stays="The record of who placed and lifted it." recovery={{ kind: 'request', how: 'place a new hold if needed.' }} />
                      <Textarea rows={2} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </ConfirmAction>))}
                </div>
              </li>))}</ul> : <Empty>No registration holds.</Empty>}
          </Panel>
        </>
      )}</Loadable>
    </>
  );
}
