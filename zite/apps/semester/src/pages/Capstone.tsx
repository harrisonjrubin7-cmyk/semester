import { useState } from 'react';
import { toast } from 'sonner';
import { capstone } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared by the Student app (/progress/capstone) and the Faculty app (/capstones): the endpoint decides what each person sees.
const sel = 'mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const LABEL: Record<string, string> = { proposal: 'Proposal', plan: 'Plan', draft: 'Draft', final: 'Final', question: 'Question', method: 'Method', evidence: 'Evidence', communication: 'Communication' };

function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const act = async (input: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await capstone(input as never); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } finally { setBusy(false); }
  };
  return { act, busy };
}

function Propose({ d, reload }: { d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const blank = { term: '', title: '', summary: '', supervisorId: '' };
  const [f, setF] = useState(blank);
  return (
    <Panel title="Propose a capstone">
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: 'propose', ...f }, 'Sent to your proposed supervisor.')) setF(blank); }}>
        <label className="text-xs">Term<Input className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Spring 2027" /></label>
        <label className="text-xs">Supervisor<select className={sel} value={f.supervisorId} onChange={(e) => setF({ ...f, supervisorId: e.target.value })}><option value="">Choose faculty…</option>
          {d.faculty.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="text-xs sm:col-span-2">Title<Input className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">Question and approach<Textarea className="mt-1" rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
        <Button size="sm" className="justify-self-start" disabled={busy || !f.supervisorId || f.title.trim().length < 5 || f.summary.trim().length < 40}>Send proposal</Button>
      </form>
    </Panel>
  );
}

function Project({ p, d, reload }: { p: any; d: any; reload: () => void }) {
  const { act, busy } = useAct(reload);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [reader, setReader] = useState('');
  const [sc, setSc] = useState<Record<string, number>>({});
  const go = (step: string, extra: Record<string, unknown>, ok: string) => act({ action: 'step', step, id: p.id, version: p.version, ...extra }, ok);
  const waiting = p.submissions.filter((s: any) => !s.decision).slice(-1)[0];
  const approved = (m: string) => p.submissions.some((s: any) => s.milestone === m && s.decision === 'approved');
  const isReader = p.role !== 'student';
  return (
    <Panel title={<span className="flex flex-wrap items-center gap-2">{p.title} <Status value={p.state} /></span> as any}>
      <p className="text-xs text-muted-foreground">{p.term} · student {p.student} · supervisor {p.supervisor}{p.secondReader ? ` · second reader ${p.secondReader}` : ''}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{p.summary}</p>
      {p.state === 'declined' && <p className="mt-1 text-sm" role="status">Declined: {p.declineReason}</p>}
      <ol className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Milestones">{d.milestones.map((m: string) => (
        <li key={m} className="rounded-md border border-border px-2 py-1"><span aria-hidden>{approved(m) ? '✓ ' : p.current === m ? '→ ' : '○ '}</span>{LABEL[m]}<span className="sr-only">{approved(m) ? ' approved' : p.current === m ? ' open now' : ' not yet open'}</span></li>))}</ol>
      {p.submissions.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">Submissions · {p.submissions.length}</summary>
        <ul className="mt-1 space-y-2">{p.submissions.map((s: any) => (
          <li key={s.id} className="rounded-md border border-border p-2"><strong>{LABEL[s.milestone]} v{s.version}</strong> · {fmt(s.at)} · {s.decision ? (s.decision === 'approved' ? '✓ approved' : 'revisions requested') : 'waiting'}
            <span className="mt-1 block whitespace-pre-wrap">{s.body}</span>{s.url && <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">Linked file (external)</a>}
            {s.note && <span className="mt-1 block text-xs">Supervisor: {s.note}</span>}</li>))}</ul></details>}

      {p.role === 'student' && p.state === 'active' && p.current && !waiting && <div className="mt-3 grid gap-2">
        <Textarea aria-label={`${LABEL[p.current]} submission`} rows={4} placeholder={`Your ${LABEL[p.current].toLowerCase()}`} value={text} onChange={(e) => setText(e.target.value)} />
        <Input aria-label="Link (optional)" placeholder="https:// link to a shared document (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" className="justify-self-start" disabled={busy || text.trim().length < 20} onClick={async () => { if (await go('submit', { milestone: p.current, body: text, url }, 'Submitted to your supervisor.')) { setText(''); setUrl(''); } }}>Submit {LABEL[p.current].toLowerCase()}</Button></div>}
      {p.role === 'student' && waiting && <p className="mt-2 text-sm" role="status">Waiting for your supervisor on the {LABEL[waiting.milestone].toLowerCase()}.</p>}

      {p.role === 'supervisor' && p.state === 'proposed' && <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => go('accept', {}, 'Accepted.')}>Accept</Button>
        <Input aria-label="Reason to decline" className="h-8 max-w-sm" placeholder="Reason, if declining" value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy || text.trim().length < 10} onClick={() => go('decline', { note: text }, 'Declined.')}>Decline</Button></div>}
      {p.role === 'supervisor' && waiting && <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => go('approve', {}, 'Approved.')}>Approve {LABEL[waiting.milestone].toLowerCase()}</Button>
        <Input aria-label="Revision note" className="h-8 max-w-sm" placeholder="What to revise" value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy || text.trim().length < 10} onClick={async () => { if (await go('revise', { note: text }, 'Revisions requested.')) setText(''); }}>Ask for revisions</Button></div>}
      {p.role === 'supervisor' && p.state === 'active' && !p.recommendation && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">Second reader<select className={sel} value={reader} onChange={(e) => setReader(e.target.value)}><option value="">Choose faculty…</option>{d.faculty.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <Button size="sm" variant="outline" disabled={busy || !reader} onClick={() => go('reader', { readerId: reader }, 'Second reader named.')}>{p.secondReader ? 'Change second reader' : 'Name second reader'}</Button></div>}

      {isReader && p.state === 'active' && !p.current && !p.myScoreDone && <div className="mt-3 space-y-2">
        <p className="text-sm font-medium">Your scores (1 = not yet, 4 = excellent). The other reader cannot see yours until both are in.</p>
        <div className="flex flex-wrap gap-3">{d.criteria.map((k: string) => <label key={k} className="text-xs">{LABEL[k]}<select className={sel} value={sc[k] ?? ''} onChange={(e) => setSc({ ...sc, [k]: Number(e.target.value) })}><option value="">–</option>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>)}</div>
        <Textarea aria-label="Comment on your scores" rows={2} placeholder="Comment explaining your scores" value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" disabled={busy || d.criteria.some((k: string) => !sc[k]) || text.trim().length < 20} onClick={() => go('score', { ...sc, comment: text }, 'Scores recorded.')}>Submit scores</Button></div>}
      {p.scores.length > 0 && <table className="mt-3 w-full text-left text-sm"><thead><tr><th>Reader</th>{d.criteria.map((k: string) => <th key={k}>{LABEL[k]}</th>)}</tr></thead>
        <tbody>{p.scores.map((s: any) => <tr key={s.role}><td>{s.role === 'supervisor' ? 'Supervisor' : 'Second reader'}</td>{d.criteria.map((k: string) => <td key={k}>{s[k]}</td>)}</tr>)}</tbody></table>}
      {p.scores.map((s: any) => <p key={s.role} className="mt-1 text-xs">{s.role === 'supervisor' ? 'Supervisor' : 'Second reader'}: {s.comment}</p>)}
      {p.recommendation && <p className="mt-2 text-sm"><strong>Recommendation: {p.recommendation.band}</strong> (average {p.recommendation.average} of 4). This goes to the instructor of record; it is not an official grade.
        {p.recommendation.disagreement.length > 0 && <span className="block" role="status">Readers differ by 2 or more on {p.recommendation.disagreement.map((k: string) => LABEL[k].toLowerCase()).join(', ')}: discuss before the grade is set.</span>}</p>}
      {p.role === 'student' && ['proposed', 'active'].includes(p.state) && <Button size="sm" variant="ghost" className="mt-2" disabled={busy} onClick={() => go('withdraw', {}, 'Withdrawn.')}>Withdraw</Button>}
    </Panel>
  );
}

export default function Capstone() {
  const s = useLoad(() => capstone({ action: 'get' }) as Promise<any>);
  return (
    <>
      <PageHeader eyebrow="Progress" title="Capstone" sub="Propose to a faculty supervisor, work through four milestones, and get a two-reader recommendation." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.isStudent && !d.projects.some((p: any) => p.role === 'student' && ['proposed', 'active'].includes(p.state)) && <Propose d={d} reload={s.reload} />}
          {!d.projects.length ? <Empty>{d.isFaculty ? 'No capstones name you as supervisor or second reader.' : 'No capstone yet.'}</Empty>
            : d.projects.map((p: any) => <Project key={`${p.id}:${p.version}`} p={p} d={d} reload={s.reload} />)}
        </div>)}</Loadable>
    </>
  );
}
