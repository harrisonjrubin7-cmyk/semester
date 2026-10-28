import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { guides as guidesApi, papers as papersApi } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, errMsg } from '../components/kit';
import { parseGuide } from '../lib/guideRules';
import { buildPaper, score, keywordHint, remaining, clock, maxMarks, objectiveMax, WRITTEN_MARKS, type Paper as P, type Responses, type SelfMark } from '../lib/paperRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Phase = 'setup' | 'sitting' | 'marking' | 'done';

export default function Paper() {
  const guides = useLoad(() => guidesApi({ action: 'list' } as never) as Promise<any>, []);
  const history = useLoad(() => papersApi({ action: 'list' } as never) as Promise<any>, []);
  const [guideId, setGuideId] = useState<number | null>(null);
  const [nObj, setNObj] = useState(10); const [nWr, setNWr] = useState(3); const [mins, setMins] = useState<number | ''>('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [paper, setPaper] = useState<P | null>(null);
  const [res, setRes] = useState<Responses>({ objective: [], written: [] });
  const [self, setSelf] = useState<SelfMark[]>([]);
  const [startedAt, setStartedAt] = useState(0); const [now, setNow] = useState(Date.now()); const [used, setUsed] = useState(0); const [timedOut, setTimedOut] = useState(false);
  const submitted = useRef(false);
  const gList: any[] = (guides.data as any)?.guides ?? [];
  const guide = gList.find((g) => g.id === guideId);
  const parsed = useMemo(() => (guide ? parseGuide(guide.title, guide.source) : null), [guide]);
  const cardCount = parsed ? parsed.units.reduce((n, u) => n + u.cards.length, 0) : 0;
  const left = phase === 'sitting' && paper ? remaining(startedAt, paper.minutes, now) : 0;

  const submit = (out: boolean) => { if (submitted.current || !paper) return; submitted.current = true; setUsed(Math.min(paper.minutes * 60, Math.round((Date.now() - startedAt) / 1000))); setTimedOut(out); setPhase(paper.written.length ? 'marking' : 'done'); };
  useEffect(() => { if (phase !== 'sitting') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [phase]);
  useEffect(() => { if (phase === 'sitting' && paper && left === 0) submit(true); }, [left, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase !== 'sitting') return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [phase]);

  const start = () => {
    if (!parsed) return;
    const p = buildPaper(parsed, Math.floor(Math.random() * 1e9), { objective: nObj, written: nWr, minutes: mins === '' ? undefined : Number(mins) });
    if (!p.objective.length && !p.written.length) return toast('! This guide needs at least two question :: answer cards.');
    setPaper(p); setRes({ objective: p.objective.map(() => null), written: p.written.map(() => '') }); setSelf(p.written.map(() => null));
    submitted.current = false; setStartedAt(Date.now()); setNow(Date.now()); setPhase('sitting');
  };
  const result = paper ? score(paper, res, self) : null;
  const record = async () => {
    if (!paper || !result || guideId === null) return;
    try { await papersApi({ action: 'record', guideId, seed: paper.seed, minutes: paper.minutes, usedSeconds: used, objective: result.objective, objectiveMax: objectiveMax(paper), written: result.written, writtenMax: paper.written.length * WRITTEN_MARKS, timedOut } as never); history.reload(); setPhase('done'); toast('Attempt saved to your practice record.'); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const setObj = (i: number, v: any) => setRes({ ...res, objective: res.objective.map((x, k) => (k === i ? v : x)) });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title="Practice paper" sub="A timed paper from one of your study guides. Section A is marked against the key; you mark Section B yourself against the model answer. A practice record for you only, not a grade." />

      {phase === 'setup' && <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Set the paper" className="lg:col-span-2">
          <Loadable state={guides}>{() => !gList.length ? <Empty>Make or copy a study guide first (Learn → Study guides).</Empty> : (
            <div className="space-y-3 text-sm">
              <label className="block text-xs font-medium" htmlFor="pp-guide">Study guide</label>
              <select id="pp-guide" className="w-full rounded-md border border-border bg-background p-2" value={guideId ?? ''} onChange={(e) => setGuideId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose a guide…</option>{gList.map((g) => <option key={g.id} value={g.id}>{g.title}{g.section ? ` · ${g.section}` : ''}{g.mine ? '' : ' (course)'}</option>)}</select>
              {parsed && <p className="text-xs text-muted-foreground">{cardCount} question cards in this guide.</p>}
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs" htmlFor="pp-a">Section A questions</label><Input id="pp-a" type="number" min={0} max={30} value={nObj} onChange={(e) => setNObj(Math.max(0, Math.min(30, Number(e.target.value))))} /></div>
                <div><label className="text-xs" htmlFor="pp-b">Section B questions</label><Input id="pp-b" type="number" min={0} max={10} value={nWr} onChange={(e) => setNWr(Math.max(0, Math.min(10, Number(e.target.value))))} /></div>
                <div><label className="text-xs" htmlFor="pp-m">Minutes (blank = suggested)</label><Input id="pp-m" type="number" min={1} max={300} value={mins} onChange={(e) => setMins(e.target.value === '' ? '' : Math.max(1, Math.min(300, Number(e.target.value))))} /></div>
              </div>
              <Button disabled={!parsed || cardCount < 2} onClick={start}>Start the paper</Button>
              {parsed && cardCount < 2 && <p className="text-xs">! The guide needs at least two “question :: answer” cards.</p>}
            </div>)}</Loadable>
        </Panel>
        <Panel title="Your practice record"><Loadable state={history}>{(h: any) => !h.attempts.length ? <Empty>No attempts yet.</Empty> : <ul className="space-y-1 text-sm">{h.attempts.slice(0, 20).map((a: any) => {
          const gt = gList.find((g) => g.id === a.guideId)?.title ?? 'A guide';
          return <li key={a.id} className="rounded-md border border-border p-2"><p className="font-medium">{gt}</p><p className="text-xs">A {a.objective}/{a.objectiveMax}{a.writtenMax ? ` · B ${a.written === null ? 'not marked' : `${a.written}/${a.writtenMax}`}` : ''} · {clock(a.usedSeconds)} of {a.minutes}:00{a.timedOut ? ' · time ran out' : ''}</p><p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p></li>;
        })}</ul>}</Loadable></Panel>
      </div>}

      {phase === 'sitting' && paper && <>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card p-2 text-sm">
          <span>{guide?.title}</span>
          <span role="timer" aria-live={left <= 60 ? 'assertive' : 'off'} className={left <= 60 ? 'font-semibold text-destructive' : 'font-mono'}>{clock(left)} left</span>
          <Button size="sm" onClick={() => submit(false)}>Hand in</Button>
        </div>
        {paper.objective.length > 0 && <Panel title={`Section A — ${paper.objective.length} marks`}>
          <ol className="space-y-4 text-sm">{paper.objective.map((q, i) => (
            <li key={i}><fieldset><legend className="font-medium">{i + 1}. {q.kind === 'match' ? 'Match each item to its answer.' : q.prompt}</legend>
              {q.kind === 'choice' && q.options.map((o, k) => <label key={k} className="mt-1 flex gap-2"><input type="radio" name={`q${i}`} checked={res.objective[i] === k} onChange={() => setObj(i, k)} /> {o}</label>)}
              {q.kind === 'truefalse' && <><p className="mt-1 italic">“{q.shown}”</p>{[true, false].map((v) => <label key={String(v)} className="mr-4 mt-1 inline-flex gap-2"><input type="radio" name={`q${i}`} checked={res.objective[i] === v} onChange={() => setObj(i, v)} /> {v ? 'True' : 'False'}</label>)}</>}
              {q.kind === 'match' && q.pairs.map((p, k) => <div key={k} className="mt-1 flex flex-wrap items-center gap-2"><span className="min-w-40">{p.q}</span>
                <select aria-label={`Answer for ${p.q}`} className="rounded-md border border-border bg-background p-1" value={(res.objective[i] as number[] | null)?.[k] ?? ''} onChange={(e) => { const cur = [...((res.objective[i] as number[] | null) ?? q.pairs.map(() => -1))]; cur[k] = Number(e.target.value); setObj(i, cur); }}>
                  <option value="">Choose…</option>{q.order.map((pi, oi) => <option key={oi} value={oi}>{q.pairs[pi].a}</option>)}</select></div>)}
            </fieldset></li>))}</ol>
        </Panel>}
        {paper.written.length > 0 && <Panel title={`Section B — ${paper.written.length * WRITTEN_MARKS} marks`}>
          <ol className="space-y-4 text-sm" start={paper.objective.length + 1}>{paper.written.map((w, i) => (
            <li key={i}><p className="font-medium">{w.prompt} <span className="text-xs font-normal text-muted-foreground">({WRITTEN_MARKS} marks)</span></p>
              <Textarea aria-label={`Answer to: ${w.prompt}`} rows={4} spellCheck value={res.written[i]} onChange={(e) => setRes({ ...res, written: res.written.map((x, k) => (k === i ? e.target.value : x)) })} /></li>))}</ol>
        </Panel>}
        <Button onClick={() => submit(false)}>Hand in</Button>
      </>}

      {(phase === 'marking' || phase === 'done') && paper && result && <div className="space-y-4">
        <Panel title="Result">
          <p className="text-sm">Section A: <strong>{result.objective} / {objectiveMax(paper)}</strong>{paper.written.length ? <> · Section B: <strong>{result.written === null ? `mark ${result.unmarked} more` : `${result.written} / ${paper.written.length * WRITTEN_MARKS}`}</strong></> : null}{result.total !== null && <> · Total <strong>{result.total} / {maxMarks(paper)}</strong></>}</p>
          <p className="text-xs text-muted-foreground">Time used {clock(used)} of {paper.minutes}:00{timedOut ? ' — time ran out and the paper was handed in automatically' : ''}. This is practice on your own guide, not a prediction of your grade.</p>
          <div className="mt-2 flex gap-2">{phase === 'marking' && <Button size="sm" disabled={result.unmarked > 0} onClick={record}>Save to my practice record</Button>}
            <Button size="sm" variant="outline" onClick={() => { setPhase('setup'); setPaper(null); }}>New paper</Button></div>
          {phase === 'marking' && result.unmarked > 0 && <p className="mt-1 text-xs">Mark each Section B answer below to save.</p>}
        </Panel>
        {paper.objective.length > 0 && <Panel title="Section A — answers">
          <ol className="space-y-2 text-sm">{paper.objective.map((q, i) => {
            const ok = !result.wrong.includes(i);
            return <li key={i}><span aria-hidden>{ok ? '✓' : '✗'}</span> <span className="sr-only">{ok ? 'Correct' : 'Incorrect'}</span> {q.kind === 'match' ? q.pairs.map((p) => `${p.q} → ${p.a}`).join('; ') : q.kind === 'choice' ? `${q.prompt} — ${q.options[q.answer]}` : `${q.prompt} — “${q.shown}” is ${q.answer ? 'true' : 'false'}`}</li>;
          })}</ol>
        </Panel>}
        {paper.written.length > 0 && <Panel title="Section B — mark your answers">
          <ol className="space-y-4 text-sm">{paper.written.map((w, i) => { const h = keywordHint(res.written[i], w.key); return (
            <li key={i} className="rounded-md border border-border p-3"><p className="font-medium">{w.prompt}</p>
              <p className="mt-1"><span className="text-xs text-muted-foreground">Your answer: </span>{res.written[i] || <em>(blank)</em>}</p>
              <p className="mt-1"><span className="text-xs text-muted-foreground">Model answer: </span>{w.key}</p>
              <p className="mt-1 text-xs">Key words you used: {h.used.join(', ') || 'none'}{h.missing.length ? ` · not used: ${h.missing.join(', ')}` : ''} (a hint only — judge the meaning)</p>
              <fieldset className="mt-2" disabled={phase === 'done'}><legend className="text-xs">Your mark</legend>
                {([[2, 'Fully'], [1, 'Partly'], [0, 'Not yet']] as [SelfMark, string][]).map(([v, l]) => <label key={l} className="mr-4 inline-flex gap-2"><input type="radio" name={`m${i}`} checked={self[i] === v} onChange={() => setSelf(self.map((x, k) => (k === i ? v : x)))} /> {l} ({v})</label>)}</fieldset>
            </li>); })}</ol>
        </Panel>}
      </div>}
    </div>
  );
}
