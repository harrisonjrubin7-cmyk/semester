import { useState } from 'react';
import { toast } from 'sonner';
import { officialGrades as api } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, useLoad, Status, errMsg } from '../components/kit';
import { toDocx } from '../lib/docxRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const MODE: Record<string, string> = {
  design: 'Sandbox — official grades here are practice records and are not written to the institution’s records (except sample institutions).',
  staging: 'Migration staging — not official.', shadow: 'Shadow — calculated and compared, not official.',
  pilot: 'Limited pilot — posted grades are official for approved courses.', authoritative: 'Semester is the official record.', retired: 'Retired.',
};
const key = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const denied = (e: string | null) => !!e && /access|role|allow|registrar|Only/i.test(e);

function transcriptMd(d: any): string {
  const t = d.transcript;
  const head = `${t.official ? 'Official transcript' : 'UNOFFICIAL transcript — sandbox records, not an official academic record'}\n\n**${d.student}** · ${d.institution} · generated ${new Date(d.generatedAt).toLocaleString()}\n\nGPA uses ${t.scale === 'default' ? 'a default 4.0 scale until the institution\'s approved policy is configured' : 'the institution\'s approved scale'}.`;
  const terms = t.terms.map((x: any) => `## ${x.term}\n\n| Course | Title | Credits | Grade | Points |\n|---|---|---|---|---|\n${x.rows.map((r: any) => `| ${r.course} | ${r.title} | ${r.credits} | ${r.grade}${r.corrected ? ' (corrected)' : ''} | ${r.points ?? '—'} |`).join('\n')}\n\nTerm: attempted ${x.attempted} · earned ${x.earned} · GPA ${x.gpa ?? '—'}`).join('\n\n');
  return `${head}\n\n${terms}\n\n## Cumulative\n\nAttempted ${t.attempted} · earned ${t.earned} · GPA credits ${t.gpaCredits} · quality points ${t.qualityPoints} · **GPA ${t.gpa ?? '—'}**`;
}

function TranscriptView({ studentId, onClose }: { studentId?: string; onClose?: () => void }) {
  const s = useLoad(() => api((studentId ? { action: 'transcriptFor', studentId } : { action: 'transcript' }) as never) as Promise<any>, [studentId]);
  if (s.error) return <p className="text-sm">! {s.error}</p>;
  if (!s.data) return <p className="text-sm text-muted-foreground">… Loading transcript</p>;
  const d: any = s.data; const t = d.transcript;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toDocx(`Transcript — ${d.student}`, transcriptMd(d))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); a.download = `transcript-${d.student.replace(/[^\w-]+/g, '-')}.docx`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{t.official ? 'Official transcript' : 'Unofficial transcript (sandbox records)'} — {d.student}</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!t.terms.length} onClick={download}>Download Word</Button>{onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}</div></div>
      {!t.official && <p className="text-xs">! Built from records in {d.mode} mode. It is not an official academic record.</p>}
      {!t.terms.length ? <Empty>No official grades yet. Course grades your instructor released are not on a transcript until the registrar posts them.</Empty> : <>
        {t.terms.map((x: any) => (
          <div key={x.term}><p className="text-xs font-medium">{x.term}</p>
            <table className="w-full text-xs"><caption className="sr-only">{x.term}</caption><thead><tr className="text-left text-muted-foreground"><th className="p-1">Course</th><th className="p-1">Title</th><th className="p-1">Credits</th><th className="p-1">Grade</th><th className="p-1">Points</th></tr></thead>
              <tbody>{x.rows.map((r: any) => <tr key={r.course + r.revision} className="border-t border-border"><td className="p-1">{r.course}</td><td className="p-1">{r.title}</td><td className="p-1">{r.credits}</td><td className="p-1">{r.grade}{r.corrected && <span className="text-muted-foreground"> (corrected)</span>}</td><td className="p-1">{r.points ?? '—'}</td></tr>)}</tbody></table>
            <p className="text-xs text-muted-foreground">Term: attempted {x.attempted} · earned {x.earned} · GPA {x.gpa ?? '—'}</p></div>))}
        <p className="text-sm">Cumulative: attempted {t.attempted} · earned {t.earned} · <strong>GPA {t.gpa ?? '—'}</strong></p>
        <p className="text-xs text-muted-foreground">GPA uses {t.scale === 'default' ? 'a default 4.0 scale (truncated to two decimals) until the institution’s approved policy is configured; repeat rules are not applied yet' : 'the institution’s approved scale'}. P earns credit outside GPA; W and I earn no credit.</p></>}
    </div>
  );
}

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
  const [tx, setTx] = useState<string | null>(null);
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
          <td className="p-1"><Button size="sm" variant="ghost" onClick={() => setFix({ enrollmentId: e.enrollmentId, grade: e.grade, reason: '', key: key() })}>Correct</Button><Button size="sm" variant="ghost" onClick={() => setTx(e.studentId)}>Transcript</Button></td></tr>)}</tbody></table></div>}
      {tx && <TranscriptView studentId={tx} onClose={() => setTx(null)} />}
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
  const [show, setShow] = useState(false);
  if (s.error || !s.data) return null;
  const d: any = s.data;
  if (!d.grades.length) return null;
  return (
    <Panel title="Your grades">
      <ul className="space-y-1 text-sm">{d.grades.map((g: any) => (
        <li key={g.enrollmentId} className="rounded-md border border-border p-2"><span className="font-medium">{g.section}</span>
          <span className="block text-xs">{g.courseGrade && <>Course grade from your instructor: <strong>{g.courseGrade}</strong>{!g.official && ' — not official yet'}</>}
            {g.official && <>{g.courseGrade ? ' · ' : ''}Official grade: <strong>{g.official.grade}</strong> (revision {g.official.revision}{g.official.authority !== 'pilot' && g.official.authority !== 'authoritative' ? ', sandbox record' : ''})</>}</span></li>))}</ul>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setShow(!show)}>{show ? 'Hide transcript' : 'View transcript'}</Button>
      {show && <TranscriptView />}
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
