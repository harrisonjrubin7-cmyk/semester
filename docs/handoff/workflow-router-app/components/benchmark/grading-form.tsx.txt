'use client';
import { useState, useTransition } from 'react';
import { CRITERIA, type Weights } from '@/lib/benchmark/benchmark.config';
import { weightedScore, type Grades } from '@/lib/benchmark/scoring';
import { gradeRun } from '@/app/benchmark/actions';
const LABEL: Record<string, string> = { correctness: 'Correctness', codeQuality: 'Code quality', rendering: 'Rendering', stateManagement: 'State management', maintainability: 'Maintainability', handoff: 'Handoff/export', sandboxFit: 'Sandbox fit', persistence: 'Persistence' };
export function GradingForm({ runId, weights, persistenceCeiling }: { runId: string; weights?: Weights; persistenceCeiling: number }) {
  const [g, setG] = useState<Grades>({}); const [evidence, setEvidence] = useState(''); const [notes, setNotes] = useState(''); const [said, setSaid] = useState(''); const [pending, start] = useTransition();
  const s = weightedScore(g, weights);
  return (<form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await gradeRun({ runId, ...Object.fromEntries(CRITERIA.map((c) => [c, g[c] ?? null])), evidence, notes }); setSaid(r.ok ? 'Grade saved.' : 'Not saved — check the fields.'); }); }}>
    {CRITERIA.map((c) => (<fieldset key={c} className="flex items-center gap-3"><legend className="w-40 text-sm">{LABEL[c]}</legend>
      {[0, 1, 2, 3, 4, 5].map((n) => { const capped = c === 'persistence' && n > persistenceCeiling; return (<label key={n} className={'inline-flex min-h-9 min-w-9 items-center justify-center rounded border text-sm ' + (g[c] === n ? 'bg-slate-800 text-white' : '') + (capped ? ' opacity-40' : '')}><input type="radio" className="sr-only" name={c} disabled={capped} checked={g[c] === n} onChange={() => setG({ ...g, [c]: n })} />{n}</label>); })}</fieldset>))}
    <p className="text-xs text-neutral-600">Persistence is capped at {persistenceCeiling} by the recorded reload test.</p>
    <label className="grid gap-1 text-sm">Evidence<textarea required value={evidence} onChange={(e) => setEvidence(e.target.value)} className="min-h-20 rounded border p-2" /></label>
    <label className="grid gap-1 text-sm">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 rounded border p-2" /></label>
    <p className="tabular-nums text-sm">Weighted: {s.outOf5 ?? '—'} / 5 · {s.outOf100 ?? '—'} / 100 {s.missing.length ? '· missing ' + s.missing.join(', ') : ''}</p>
    <button disabled={pending} className="min-h-10 rounded bg-slate-800 px-4 text-sm text-white">Save grade</button><p role="status" className="text-sm">{said}</p></form>);
}
