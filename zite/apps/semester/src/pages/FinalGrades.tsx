import { useState } from 'react';
import { toast } from 'sonner';
import { officialGrades as api } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const MODE: Record<string, string> = {
  design: 'Sandbox — official grades here are practice records and are not written to the institution’s records (except sample institutions).',
  staging: 'Migration staging — not official.', shadow: 'Shadow — calculated and compared, not official.',
  pilot: 'Limited pilot — posted grades are official for approved courses.', authoritative: 'Semester is the official record.', retired: 'Retired.',
};
const key = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const denied = (e: string | null) => !!e && /access|role|allow|registrar|Only/i.test(e);

function Teaching() {
  const s = useLoad(() => api({ action: 'teaching' } as never) as Promise<any>, []);
  const [pick, setPick] = useState<Record<string, string>>({});
  const call = async (body: object, ok: string) => { try { await api(body as never); toast(ok); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  if (s.error) return denied(s.error) ? null : <Panel title="Your sections"><p className="text-sm">! {s.error}</p></Panel>;
  if (!s.data) return <Panel title="Your sections"><p className="text-sm text-muted-foreground">… Loading</p></Panel>;
  const d: any = s.data;
  if (!d.sections.length) return null;
  return (
    <Panel title="Your sections — course grades">
      <p className="text-xs text-muted-foreground">1. Propose from the gradebook → 2. Release to the student (shown as a course grade, not official) → 3. Certify as instructor of record → the registrar posts the official grade. Editing a grade after certifying withdraws the certification.</p>
      {d.sections.map((sec: any) => (
        <div key={sec.id} className="mt-3 overflow-x-auto">
          <p className="text-sm font-medium">{sec.label}</p>
          {!sec.students.length ? <Empty>No enrolled students.</Empty> : <table className="w-full text-sm"><caption className="sr-only">Course grades for {sec.label}</caption>
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Student</th><th className="p-1">Gradebook</th><th className="p-1">Course grade</th><th className="p-1">State</th><th className="p-1"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{sec.students.map((st: any) => { const p = st.proposal; const g = pick[st.enrollmentId] ?? p?.grade ?? '';
              return (
                <tr key={st.enrollmentId} className="border-t border-border align-top">
                  <td className="p-1">{st.name}</td>
                  <td className="p-1 text-xs">{st.live.percent === null ? '—' : `${st.live.percent}%`} ({st.live.earned}/{st.live.possible}){st.live.missing ? ` · ${st.live.missing} missing` : ''}</td>
                  <td className="p-1"><select aria-label={`Course grade for ${st.name}`} className="rounded-md border border-border bg-background p-1" value={g} disabled={p?.state === 'Posted'} onChange={(e) => setPick({ ...pick, [st.enrollmentId]: e.target.value })}>
                    <option value="">—</option>{d.grades.map((x: string) => <option key={x}>{x}</option>)}</select></td>
                  <td className="p-1"><Status value={!p ? 'Not proposed' : p.state === 'Posted' ? 'Official' : p.state === 'Certified' ? 'Certified' : p.released ? 'Released' : 'Draft'} />{p && <span className="block text-xs text-muted-foreground">v{p.version}</span>}</td>
                  <td className="p-1"><div className="flex flex-wrap gap-1">
                    {p?.state !== 'Posted' && g && g !== p?.grade && <Button size="sm" variant="outline" onClick={() => call({ action: 'propose', enrollmentId: st.enrollmentId, grade: g, expectedVersion: p?.version ?? 0 }, p?.state === 'Certified' ? 'Changed; certification withdrawn.' : 'Course grade saved.')}>Save</Button>}
                    {p && !p.released && p.state !== 'Posted' && g === p.grade && <Button size="sm" variant="outline" onClick={() => call({ action: 'release', enrollmentId: st.enrollmentId, expectedVersion: p.version }, 'Released to the student as a course grade.')}>Release</Button>}
                    {p && p.state === 'Draft' && g === p.grade && <Button size="sm" disabled={!d.isFaculty} onClick={() => call({ action: 'certify', enrollmentId: st.enrollmentId, expectedVersion: p.version }, 'Certified. The registrar can now post it.')}>Certify {p.grade}</Button>}
                  </div></td>
                </tr>); })}</tbody></table>}
        </div>))}
    </Panel>
  );
}

function Registrar() {
  const s = useLoad(() => api({ action: 'queue' } as never) as Promise<any>, []);
  const [fix, setFix] = useState<{ enrollmentId: string; grade: string; reason: string; key: string } | null>(null);
  const call = async (body: object) => { try { const r: any = await api(body as never); const rc = r.receipt; toast(rc?.revision ? `Revision ${rc.revision} recorded${rc.replay ? ' (same request, no duplicate)' : ''} · ${rc.projected === 'held' ? 'held in sandbox' : rc.projected}` : 'Done.'); setFix(null); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  if (s.error) return denied(s.error) ? null : <Panel title="Registrar"><p className="text-sm">! {s.error}</p></Panel>;
  if (!s.data) return null;
  const d: any = s.data;
  const unprojected = d.entries.filter((e: any) => !e.projected).length;
  return (
    <Panel title="Registrar — official grades" action={<Status value={`Mode: ${d.mode}`} />}>
      <p className="text-xs">{MODE[d.mode]}</p>
      <p className="mt-3 text-sm font-medium">Certified, waiting to post ({d.ready.length})</p>
      {!d.ready.length ? <Empty>Nothing waiting.</Empty> : <ul className="mt-1 space-y-1 text-sm">{d.ready.map((r: any) => (
        <li key={r.enrollmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
          <span>{r.student} · {r.section} · <strong>{r.grade}</strong> <span className="text-xs text-muted-foreground">certified by {r.certifiedBy}, v{r.version}</span></span>
          {r.mineToPost ? <Button size="sm" onClick={() => call({ action: 'post', enrollmentId: r.enrollmentId, expectedVersion: r.version, requestKey: key() })}>Post official grade</Button> : <span className="text-xs">You certified this; another registrar must post it.</span>}
        </li>))}</ul>}
      <div className="mt-3 flex items-center justify-between"><p className="text-sm font-medium">Official grade revisions ({d.entries.length})</p>
        {unprojected > 0 && <Button size="sm" variant="outline" onClick={() => call({ action: 'reconcile' })}>Reconcile {unprojected} not yet in records</Button>}</div>
      {!d.entries.length ? <Empty>No official grades yet.</Empty> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Official grade revisions</caption>
        <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Student</th><th className="p-1">Section</th><th className="p-1">Rev</th><th className="p-1">Grade</th><th className="p-1">Authority</th><th className="p-1">In records</th><th className="p-1"><span className="sr-only">Correct</span></th></tr></thead>
        <tbody>{d.entries.map((e: any) => <tr key={e.id} className="border-t border-border align-top"><td className="p-1">{e.student}</td><td className="p-1">{e.section}</td><td className="p-1">{e.revision} {e.kind === 'Correction' && <span className="text-xs">({e.previous} → {e.grade}: {e.reason})</span>}</td><td className="p-1">{e.grade}</td><td className="p-1 text-xs">{e.authority}</td><td className="p-1 text-xs">{e.projected ? '✓ yes' : '· held'}</td>
          <td className="p-1"><Button size="sm" variant="ghost" onClick={() => setFix({ enrollmentId: e.enrollmentId, grade: e.grade, reason: '', key: key() })}>Correct</Button></td></tr>)}</tbody></table></div>}
      {fix && <div className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
        <div><label className="text-xs" htmlFor="og-g">Corrected grade</label><Input id="og-g" value={fix.grade} onChange={(e) => setFix({ ...fix, grade: e.target.value.toUpperCase() })} /></div>
        <div className="sm:col-span-2"><label className="text-xs" htmlFor="og-r">Reason (kept with the record)</label><Input id="og-r" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} /></div>
        <div className="flex gap-2 sm:col-span-3"><Button size="sm" disabled={fix.reason.trim().length < 10} onClick={() => call({ action: 'correct', enrollmentId: fix.enrollmentId, grade: fix.grade, reason: fix.reason, requestKey: fix.key })}>Add correction</Button><Button size="sm" variant="ghost" onClick={() => setFix(null)}>Cancel</Button></div>
      </div>}
    </Panel>
  );
}

function Mine() {
  const s = useLoad(() => api({ action: 'mine' } as never) as Promise<any>, []);
  if (s.error || !s.data) return null;
  const d: any = s.data;
  if (!d.grades.length) return null;
  return (
    <Panel title="Your grades">
      <ul className="space-y-1 text-sm">{d.grades.map((g: any) => (
        <li key={g.enrollmentId} className="rounded-md border border-border p-2"><span className="font-medium">{g.section}</span>
          <span className="block text-xs">{g.courseGrade && <>Course grade from your instructor: <strong>{g.courseGrade}</strong>{!g.official && ' — not official yet'}</>}
            {g.official && <>{g.courseGrade ? ' · ' : ''}Official grade: <strong>{g.official.grade}</strong> (revision {g.official.revision}{g.official.authority !== 'pilot' && g.official.authority !== 'authoritative' ? ', sandbox record' : ''})</>}</span></li>))}</ul>
    </Panel>
  );
}

export default function FinalGrades() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Records" title="Final grades" sub="The course gradebook, the course grade you release, and the official academic grade are three separate records. Only a certified grade can be posted, by someone other than the person who certified it." />
      <Teaching /><Registrar /><Mine />
      <p className="text-xs text-muted-foreground">If nothing shows here, you have no sections to grade, no registrar role and no released grades yet.</p>
    </div>
  );
}
