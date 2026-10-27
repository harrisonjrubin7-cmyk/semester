import { useState } from 'react';
import { toast } from 'sonner';
import { transfer } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Status, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await transfer(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';
const OUT: Record<string, string> = { equivalent: 'Equivalent', elective: 'Elective credit', no_credit: 'No credit' };
const emptyLine = { course: '', title: '', credits: '3', grade: '', suggestion: '' };

function Lines({ q }: { q: any }) {
  return (
    <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Their course</th><th>Credits</th><th>Published rule</th><th>Decision</th></tr></thead>
      <tbody>{q.lines.map((l: any) => (
        <tr key={l.line} className="border-t border-border align-top">
          <td className="py-1.5">{l.course}{l.title && ` · ${l.title}`}{l.grade && <span className="text-muted-foreground"> · {l.grade}</span>}</td>
          <td className="py-1.5">{l.credits}</td>
          <td className="py-1.5 text-xs">{l.rule ? `${OUT[l.rule.outcome]}${l.rule.code ? ` → ${l.rule.code}` : ''} (provisional)` : '—'}</td>
          <td className="py-1.5">{l.outcome ? <>{OUT[l.outcome]}{l.code && ` → ${l.code}`} · {l.awarded} cr<div className="text-xs text-muted-foreground">{l.reason}</div></> : <span className="text-muted-foreground">Waiting</span>}</td>
        </tr>))}</tbody></table>
  );
}

function Evaluate({ q, reload }: { q: any; reload: () => void }) {
  const init = Object.fromEntries(q.lines.map((l: any) => [l.line, { outcome: l.outcome ?? l.rule?.outcome ?? '', code: l.code ?? l.rule?.code ?? '', reason: l.rule ? 'Published articulation rule' : '' }]));
  const [d, setD] = useState<Record<number, any>>(init);
  const [note, setNote] = useState('');
  const appeal = q.state === 'appealed';
  if (appeal && q.evaluatedByMe) return <p className="mt-2 text-xs text-muted-foreground">You made the first decision; a different evaluator reviews this appeal.</p>;
  const decisions = q.lines.map((l: any) => ({ line: l.line, outcome: d[l.line]?.outcome, code: d[l.line]?.code || undefined, reason: d[l.line]?.reason ?? '' }));
  return (
    <div className="mt-2 space-y-2">
      {appeal && <p className="text-sm">Appeal: {q.appealText}</p>}
      {q.lines.map((l: any) => (
        <div key={l.line} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-40">{l.course}</span>
          <select aria-label={`Outcome for ${l.course}`} className={sel} value={d[l.line]?.outcome ?? ''} onChange={(e) => setD({ ...d, [l.line]: { ...d[l.line], outcome: e.target.value } })}><option value="">Outcome…</option>{Object.entries(OUT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {d[l.line]?.outcome === 'equivalent' && <Input aria-label={`Our course for ${l.course}`} className="max-w-[9rem]" placeholder="Our course" value={d[l.line]?.code ?? ''} onChange={(e) => setD({ ...d, [l.line]: { ...d[l.line], code: e.target.value } })} />}
          <Input aria-label={`Reason for ${l.course}`} className="max-w-xs" placeholder="Reason" value={d[l.line]?.reason ?? ''} onChange={(e) => setD({ ...d, [l.line]: { ...d[l.line], reason: e.target.value } })} />
        </div>))}
      {appeal && <Input aria-label="Appeal outcome" placeholder="Explain the appeal outcome to the student" value={note} onChange={(e) => setNote(e.target.value)} />}
      <Button size="sm" onClick={() => run(appeal ? { action: 'reviewAppeal', id: q.id, version: q.version, decisions, note } : { action: 'evaluate', id: q.id, version: q.version, decisions }, appeal ? 'Appeal decided.' : 'Evaluation sent to the student.', reload)}>{appeal ? 'Decide appeal' : 'Finish evaluation'}</Button>
    </div>
  );
}

export default function Transfer() {
  const s = useLoad(() => transfer({ action: 'get' }));
  const [inst, setInst] = useState(''); const [lines, setLines] = useState([{ ...emptyLine }]);
  const [appeal, setAppeal] = useState<Record<string, string>>({});
  const [r, setR] = useState({ institution: '', course: '', outcome: 'equivalent', code: '', credits: '', term: '' });
  const valid = inst.trim().length >= 3 && lines.every((l) => l.course.trim().length >= 3 && Number(l.credits) > 0);
  return (
    <>
      <PageHeader eyebrow="Plan" title="Transfer credit" sub="List courses you took elsewhere. A registrar evaluates them using published rules; you can appeal once. Matches shown before evaluation are provisional, not awarded credit." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          <Panel title="Your evaluations">
            {!d.mine.length ? <Empty>No requests yet.</Empty> : d.mine.map((q: any) => (
              <div key={q.id} className="border-t border-border py-3 first:border-0">
                <p className="flex flex-wrap items-center gap-2 text-sm"><Status value={q.state} /> {q.institution} · sent {fmtDay(q.createdAt)} · {q.lines.reduce((n: number, l: any) => n + (l.awarded ?? 0), 0)} credits decided</p>
                <Lines q={q} />
                {q.appealNote && <p className="mt-1 text-sm">Appeal outcome: {q.appealNote}</p>}
                {q.state === 'decided' && <div className="mt-2 space-y-2">
                  <Textarea aria-label="Appeal" rows={2} placeholder="If a decision looks wrong, explain why (one appeal per evaluation)" value={appeal[q.id] ?? ''} onChange={(e) => setAppeal({ ...appeal, [q.id]: e.target.value })} />
                  <Button size="sm" variant="outline" disabled={(appeal[q.id] ?? '').trim().length < 20} onClick={() => run({ action: 'appeal', id: q.id, text: appeal[q.id] }, 'Appeal sent to a different evaluator.', s.reload)}>Appeal</Button>
                </div>}
              </div>))}
            <p className="mt-2 text-xs text-muted-foreground">Decisions here are the evaluation record. Posting credit to your official transcript is done by the registrar separately.</p>
          </Panel>
          <Panel title="Request an evaluation">
            <Input aria-label="Institution" placeholder="Where you took these courses" value={inst} onChange={(e) => setInst(e.target.value)} />
            {lines.map((l, i) => (
              <div key={i} className="mt-2 grid gap-2 md:grid-cols-5">
                <Input aria-label="Course code" placeholder="Course code" value={l.course} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, course: e.target.value } : x))} />
                <Input aria-label="Title" placeholder="Title" value={l.title} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <Input aria-label="Credits" type="number" placeholder="Credits" value={l.credits} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, credits: e.target.value } : x))} />
                <Input aria-label="Grade" placeholder="Grade" value={l.grade} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))} />
                <Input aria-label="Suggested match" placeholder="Our course you think matches" value={l.suggestion} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, suggestion: e.target.value } : x))} />
              </div>))}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="ghost" disabled={lines.length >= 30} onClick={() => setLines([...lines, { ...emptyLine }])}>Add course</Button>
              <Button size="sm" disabled={!valid} onClick={() => run({ action: 'submit', id: crypto.randomUUID(), institution: inst, lines: lines.map((l) => ({ ...l, credits: Number(l.credits) })) }, 'Sent to the registrar.', () => { setInst(''); setLines([{ ...emptyLine }]); s.reload(); })}>Send for evaluation</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Transcript uploads stay off until private storage is in place; the registrar may ask for an official transcript separately.</p>
          </Panel>
          {d.pathComparison && d.pathComparison.requirements.length > 0 && <Panel title="How transfer credit would apply to your degree">
            <p className="text-xs text-muted-foreground">A planning scenario, not your official degree audit. Evaluated = decided by the registrar; provisional = published rules for courses not yet evaluated.</p>
            <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Requirement</th><th>Official</th><th>+ evaluated</th><th>+ provisional</th></tr></thead>
              <tbody>{d.pathComparison.requirements.map((r: any) => <tr key={r.id} className="border-t border-border"><td className="py-1.5">{r.name}</td><td>{r.official}/{r.required}</td><td>{r.withEvaluated}/{r.required}</td><td>{r.withProvisional}/{r.required}</td></tr>)}</tbody></table>
            {(d.pathComparison.electiveEvaluated > 0 || d.pathComparison.electiveProvisional > 0) && <p className="mt-2 text-sm">Elective credit: {d.pathComparison.electiveEvaluated} evaluated, {d.pathComparison.electiveProvisional} provisional (counts toward total credits, not a specific requirement).</p>}
            {d.pathComparison.unmatched.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Not in our course list: {d.pathComparison.unmatched.join(', ')}.</p>}
          </Panel>}
          <Panel title={`Published articulation rules · ${d.rules.length}`}>
            {!d.rules.length ? <Empty>No published rules yet.</Empty> : <ul className="text-sm">{d.rules.map((x: any) => <li key={x.id} className="border-t border-border py-1.5 first:border-0">{x.institution} {x.course} → {OUT[x.outcome]}{x.code && ` ${x.code}`}{x.credits && ` · ${x.credits} cr`} · from {x.term}</li>)}</ul>}
          </Panel>
          {d.isRegistrar && <>
            <Panel title={`Evaluation queue · ${d.queue.length}`}>
              {!d.queue.length ? <Empty>Nothing to evaluate.</Empty> : d.queue.map((q: any) => (
                <div key={q.id} className="border-t border-border py-3 first:border-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm"><Status value={q.state} /> #{q.number} · {q.student} · {q.institution}</p>
                  <Lines q={q} /><Evaluate q={q} reload={s.reload} />
                </div>))}
            </Panel>
            <Panel title="Articulation rules waiting">
              {d.pendingRules.map((x: any) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
                <span>{x.institution} {x.course} → {OUT[x.outcome]}{x.code && ` ${x.code}`} · from {x.term}{x.fromPartner && <span className="text-xs text-muted-foreground"> · proposed by the partner organization — check it against their catalog</span>}</span>
                {x.mine ? <span className="text-xs text-muted-foreground">Another registrar approves</span> : <span className="flex gap-2"><Button size="sm" onClick={() => run({ action: 'decideRule', id: x.id, approve: true, note: '' }, 'Published.', s.reload)}>Approve</Button><Button size="sm" variant="outline" onClick={() => run({ action: 'decideRule', id: x.id, approve: false, note: 'Not equivalent on review' }, 'Rejected.', s.reload)}>Reject</Button></span>}
              </div>)}
              <div className="mt-3 grid gap-2 md:grid-cols-6">
                <Input aria-label="Institution" className="md:col-span-2" placeholder="Institution" value={r.institution} onChange={(e) => setR({ ...r, institution: e.target.value })} />
                <Input aria-label="Their course" placeholder="Their course" value={r.course} onChange={(e) => setR({ ...r, course: e.target.value })} />
                <select aria-label="Outcome" className={sel} value={r.outcome} onChange={(e) => setR({ ...r, outcome: e.target.value })}>{Object.entries(OUT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <Input aria-label="Our course" placeholder="Our course" value={r.code} onChange={(e) => setR({ ...r, code: e.target.value })} />
                <Input aria-label="Effective term" placeholder="From term" value={r.term} onChange={(e) => setR({ ...r, term: e.target.value })} />
              </div>
              <Button className="mt-2" size="sm" disabled={!r.institution || !r.course || !r.term} onClick={() => run({ action: 'proposeRule', ...r, credits: r.credits ? Number(r.credits) : null }, 'Proposed. Another registrar must approve it.', () => { setR({ institution: '', course: '', outcome: 'equivalent', code: '', credits: '', term: '' }); s.reload(); })}>Propose rule</Button>
            </Panel>
          </>}
        </div>)}
      </Loadable>
    </>
  );
}
