import { useState } from 'react';
import { toast } from 'sonner';
import { rosterImport } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const readText = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result ?? '')); r.onerror = () => bad(r.error); r.readAsText(f); });
const key = () => `rgw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Console tab (Integration Admin): roster import in shadow mode — staged, quarantined and compared, never applied. */
export default function RosterImport() {
  const s = useLoad(() => rosterImport({ action: 'get' }) as Promise<any>);
  const [form, setForm] = useState({ name: '', sourceSystem: '' });
  const [link, setLink] = useState<Record<number, { externalClass: string; sectionId: string }>>({});
  const [files, setFiles] = useState<Record<number, { users?: File; enrollments?: File }>>({});
  const [cmp, setCmp] = useState<Record<number, any>>({});
  const [busy, setBusy] = useState(false);
  const call = async (input: any, ok: string) => { setBusy(true); try { const r: any = await rosterImport(input); toast(ok); s.reload(); return r; } catch (e) { toast(`! ${errMsg(e)}`); return null; } finally { setBusy(false); } };
  const upload = async (id: number) => {
    const f = files[id]; if (!f?.users || !f?.enrollments) return;
    const r = await call({ action: 'import', id, usersCsv: await readText(f.users), enrollmentsCsv: await readText(f.enrollments), requestKey: key() }, 'File imported for comparison. Nothing in Semester changed.');
    if (r?.dropped?.length) toast(`Columns not kept: ${r.dropped.join(', ')}`);
  };
  return (
    <div className="space-y-4">
      <Panel title="Roster import (shadow mode)">
        <p className="text-sm text-muted-foreground">Compare a source system’s roster with Semester before any switch. Files are OneRoster-shaped CSV (users.csv and enrollments.csv); no OneRoster certification is claimed. Rows are staged and compared — Semester enrollments never change from here. A second integration administrator approves each connection.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input aria-label="Connection name" placeholder="Connection name (e.g. Registrar roster)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input aria-label="Source system" placeholder="Source system (e.g. current SIS)" value={form.sourceSystem} onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })} />
          <Button disabled={busy || form.name.trim().length < 3 || form.sourceSystem.trim().length < 2} onClick={async () => { if (await call({ action: 'create', ...form }, 'Connection drafted. Another administrator approves it.')) setForm({ name: '', sourceSystem: '' }); }}>Draft connection</Button>
        </div>
      </Panel>
      <Loadable state={s}>{(d: any) => !d.connections.length ? <Empty>No roster connections yet.</Empty> : d.connections.map((c: any) => (
        <Panel key={c.id} title={`${c.name} · ${c.sourceSystem}`}>
          <p className="text-xs text-muted-foreground">{c.standard} · {c.mode} · {c.state}{c.approvedBy ? ` · approved by ${c.approvedBy} ${fmt(c.approvedAt)}` : ` · drafted by ${c.owner}`}</p>
          {c.state === 'Draft' && (c.mine ? <p className="mt-2 text-sm">Waiting for a different integration administrator to approve.</p> : <Button size="sm" className="mt-2" disabled={busy} onClick={() => call({ action: 'approve', id: c.id }, 'Connection approved for shadow imports.')}>Approve connection</Button>)}
          <div className="mt-3 text-sm"><p className="font-medium">Class links</p>
            {c.links.length ? <ul className="text-xs text-muted-foreground">{c.links.map((l: any) => <li key={l.externalClass}>{l.externalClass} → section {l.sectionId}</li>)}</ul> : <p className="text-xs text-muted-foreground">No classes linked. Rows for unlinked classes are quarantined.</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label="Source class id" placeholder="Source class id" value={link[c.id]?.externalClass ?? ''} onChange={(e) => setLink({ ...link, [c.id]: { ...(link[c.id] ?? { sectionId: '' }), externalClass: e.target.value } })} />
              <Input aria-label="Semester section id" placeholder="Semester section id" value={link[c.id]?.sectionId ?? ''} onChange={(e) => setLink({ ...link, [c.id]: { ...(link[c.id] ?? { externalClass: '' }), sectionId: e.target.value } })} />
              <Button size="sm" variant="outline" disabled={busy || !link[c.id]?.externalClass || !link[c.id]?.sectionId} onClick={() => call({ action: 'linkClass', id: c.id, ...link[c.id] }, 'Class linked.')}>Link</Button>
            </div></div>
          {c.state === 'Approved' && <div className="mt-3 text-sm"><p className="font-medium">Import files</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              <label>users.csv <input type="file" accept=".csv,text/csv" onChange={(e) => setFiles({ ...files, [c.id]: { ...files[c.id], users: e.target.files?.[0] } })} /></label>
              <label>enrollments.csv <input type="file" accept=".csv,text/csv" onChange={(e) => setFiles({ ...files, [c.id]: { ...files[c.id], enrollments: e.target.files?.[0] } })} /></label>
              <Button size="sm" disabled={busy || !files[c.id]?.users || !files[c.id]?.enrollments} onClick={() => upload(c.id)}>Import for comparison</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const r = await call({ action: 'compare', id: c.id }, 'Compared.'); if (r) setCmp({ ...cmp, [c.id]: r }); }}>Compare with Semester</Button>
            </div></div>}
          {c.batches.length > 0 && <div className="mt-3 text-xs"><p className="font-medium text-sm">Recent imports</p>{c.batches.map((b: any) => <p key={b.id}>{fmt(b.at)} · {Object.entries(b.summary ?? {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${n} ${k}`).join(' · ')}</p>)}</div>}
          {c.quarantine.length > 0 && <div className="mt-3 text-xs"><p className="font-medium text-sm">Quarantined in the latest import</p><ul>{c.quarantine.map((q: any) => <li key={q.line + q.enrollment}>! line {q.line} · {q.enrollment}: {q.reason}</li>)}</ul></div>}
          {cmp[c.id] && <div className="mt-3 rounded-sm border border-border p-3 text-xs"><p className="font-medium text-sm">Comparison (nothing changed)</p>
            <p>Students: {cmp[c.id].students.matching} matching · {cmp[c.id].students.onlyInSource.length} only in source · {cmp[c.id].students.onlyInSemester.length} only in Semester</p>
            <p>Teachers: {cmp[c.id].teachers.matching} matching · {cmp[c.id].teachers.onlyInSource.length} only in source · {cmp[c.id].teachers.onlyInSemester.length} only in Semester</p></div>}
        </Panel>))}</Loadable>
    </div>
  );
}
