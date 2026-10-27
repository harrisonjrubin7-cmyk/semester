import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { guides as guidesApi } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { parseGuide, availableModes, slides, script, cram, buildQuiz, mark, review, docHtml, MODE_LABEL, type Guide, type Mode, type Question } from '../lib/guideRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const today = () => new Date().toISOString().slice(0, 10);
const SAMPLE = `What this course is about, in a sentence.
# First unit
A key point, one per line.
Q: A question you should be able to answer :: Its answer
Term :: What it means
Figure: Title | What it shows | A=3, B=5
Case: Title | When | The claim | How it was tested | Verdict | Lesson
## Terms
Word — what it means`;

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { const r: any = await guidesApi(body as never); if (msg) toast(msg); reload(); return r; } catch (e) { toast(`! ${errMsg(e)}`); return null; } };
}

function speak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { toast('! This browser cannot read aloud.'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

function Cards({ g, rec, act }: { g: Guide; rec: any; act: ReturnType<typeof useAct> }) {
  const all = g.units.flatMap((u) => u.cards.map((c, i) => ({ ...c, key: `${u.name}:${i}`, unit: u.name })));
  const due = all.filter((c) => { const r = rec.reviews.find((x: any) => x.card === c.key); return !r || r.due <= today(); });
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const list = due.length ? due : all;
  const c = list[i % list.length];
  if (!c) return <Empty>No cards.</Empty>;
  const answer = async (known: boolean) => {
    const prev = rec.reviews.find((x: any) => x.card === c.key)?.box ?? 1;
    const n = review(prev, known);
    await act({ action: 'review', id: rec.id, card: c.key, box: n.box, inDays: n.inDays }, '');
    setFlip(false); setI(i + 1);
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">{due.length ? `${due.length} due today` : 'Nothing due — reviewing everything'} · {c.unit}</p>
      <button type="button" aria-label="Flip card" className="min-h-32 w-full rounded-md border border-border p-4 text-left" onClick={() => setFlip(!flip)}>{flip ? c.a : c.q}</button>
      {flip ? <div className="flex gap-2"><Button size="sm" onClick={() => answer(true)}>I knew it</Button><Button size="sm" variant="outline" onClick={() => answer(false)}>Again</Button></div>
        : <Button size="sm" variant="outline" onClick={() => setFlip(true)}>Show answer</Button>}
    </div>
  );
}

function Quiz({ g, rec, act }: { g: Guide; rec: any; act: ReturnType<typeof useAct> }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const qs: Question[] = useMemo(() => buildQuiz(g, seed), [g, seed]);
  const [resp, setResp] = useState<Record<number, any>>({});
  const [done, setDone] = useState(false);
  const score = qs.filter((q, i) => resp[i] !== undefined && mark(q, resp[i])).length;
  const submit = async () => { setDone(true); await act({ action: 'attempt', id: rec.id, seed, score, total: qs.length }, `Scored ${score}/${qs.length}.`); };
  return (
    <div className="space-y-3 text-sm">
      {qs.map((q, i) => <div key={i} className="rounded-md border border-border p-2">
        {q.kind === 'choice' && <><p className="font-medium">{q.prompt}</p>{q.options.map((o, k) => <label key={k} className="block"><input type="radio" name={`q${i}`} disabled={done} checked={resp[i] === k} onChange={() => setResp({ ...resp, [i]: k })} /> {o}</label>)}</>}
        {q.kind === 'truefalse' && <><p className="font-medium">{q.prompt}</p><p className="text-xs">Answer shown: {q.shown}</p>
          {[true, false].map((v) => <label key={String(v)} className="mr-3"><input type="radio" name={`q${i}`} disabled={done} checked={resp[i] === v} onChange={() => setResp({ ...resp, [i]: v })} /> {v ? 'True' : 'False'}</label>)}</>}
        {q.kind === 'match' && <><p className="font-medium">Match each question to its answer</p>{q.pairs.map((p, k) => <div key={k} className="flex flex-wrap items-center gap-2"><span>{p.q}</span>
          <select aria-label={`Answer for ${p.q}`} className={sel} disabled={done} value={resp[i]?.[k] ?? ''} onChange={(e) => { const arr = [...(resp[i] ?? q.pairs.map(() => -1))]; arr[k] = Number(e.target.value); setResp({ ...resp, [i]: arr }); }}>
            <option value="">Choose…</option>{q.order.map((o, j) => <option key={j} value={j}>{q.pairs[o].a}</option>)}</select></div>)}</>}
        {done && <p className="text-xs"><Status value={resp[i] !== undefined && mark(q, resp[i]) ? 'correct' : 'wrong'} /></p>}
      </div>)}
      {!done ? <Button size="sm" onClick={submit}>Mark it</Button> : <div className="flex items-center gap-2"><span>Score {score}/{qs.length}</span><Button size="sm" variant="outline" onClick={() => { setSeed(seed + 1); setResp({}); setDone(false); }}>New quiz</Button></div>}
      {rec.attempts.length > 0 && <p className="text-xs text-muted-foreground">Recent: {rec.attempts.map((t: any) => `${t.score}/${t.total}`).join(' · ')}</p>}
    </div>
  );
}

function Slides({ g }: { g: Guide }) {
  const s = slides(g);
  const [i, setI] = useState(0);
  const cur = s[Math.min(i, s.length - 1)];
  return (
    <div className="space-y-2">
      <div className="flex min-h-48 flex-col justify-center rounded-md border border-border p-6"><p className="text-xs text-muted-foreground">{cur.title}</p><p className="text-lg">{cur.body}</p></div>
      <div className="flex items-center gap-2 text-sm"><Button size="sm" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button><span>{i + 1}/{s.length}</span><Button size="sm" variant="outline" disabled={i >= s.length - 1} onClick={() => setI(i + 1)}>Next</Button></div>
    </div>
  );
}

function Narrate({ g, whole }: { g: Guide; whole: boolean }) {
  const chapters = script(g);
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const play = (k: number) => { setAt(k); speak(chapters[k].text, whole && k + 1 < chapters.length ? () => play(k + 1) : () => setAt(null)); };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">{whole ? 'The whole guide read aloud, chapter by chapter. Choose a chapter to jump to it.' : 'One unit at a time, read aloud by your device.'}</p>
      {chapters.map((c, k) => <div key={k} className="flex items-center gap-2"><Button size="sm" variant={at === k ? 'default' : 'outline'} onClick={() => play(k)}>{at === k ? 'Playing' : 'Play'}</Button><span>{c.chapter}</span></div>)}
      <Button size="sm" variant="ghost" onClick={() => { window.speechSynthesis?.cancel(); setAt(null); }}>Stop</Button>
      {whole && <details><summary className="cursor-pointer text-xs">Script</summary>{chapters.map((c, k) => <p key={k} className="text-xs"><b>{c.chapter}.</b> {c.text}</p>)}</details>}
    </div>
  );
}

function ModeView({ mode, g, rec, act }: { mode: Mode; g: Guide; rec: any; act: ReturnType<typeof useAct> }) {
  if (mode === 'cards') return <Cards g={g} rec={rec} act={act} />;
  if (mode === 'quiz') return <Quiz g={g} rec={rec} act={act} />;
  if (mode === 'slides') return <Slides g={g} />;
  if (mode === 'watch' || mode === 'listen') return <Narrate g={g} whole={mode === 'listen'} />;
  if (mode === 'figures') return <div className="space-y-3">{g.units.flatMap((u) => u.figures.map((f, k) => { const max = Math.max(1, ...f.rows.map((r) => r.v));
    return <figure key={u.name + k} className="rounded-md border border-border p-3 text-sm"><figcaption className="font-medium">{f.title} <span className="text-xs text-muted-foreground">· {u.name}</span></figcaption>
      {f.rows.length > 0 && <div className="mt-2 space-y-1" role="img" aria-label={`${f.title}: ${f.rows.map((r) => `${r.l} ${r.v}`).join(', ')}`}>{f.rows.map((r) => <div key={r.l} className="flex items-center gap-2 text-xs"><span className="w-16 shrink-0">{r.l}</span><div className="h-3 rounded-sm bg-primary" style={{ width: `${(r.v / max) * 100}%` }} /><span>{r.v}</span></div>)}</div>}
      <p className="mt-1 text-xs">{f.shows}</p></figure>; }))}</div>;
  if (mode === 'cases') return <div className="space-y-3">{g.cases.map((c, k) => <div key={k} className="rounded-md border border-border p-3 text-sm"><p className="font-medium">{c.title}{c.when ? ` · ${c.when}` : ''}</p>
    {[['Claim', c.claim], ['Test', c.test], ['Verdict', c.verdict], ['Lesson', c.lesson]].filter(([, v]) => v).map(([k2, v]) => <p key={k2} className="text-xs"><b>{k2}:</b> {v}</p>)}</div>)}</div>;
  if (mode === 'cram') return <div className="space-y-2 text-xs">{cram(g).map((s) => <div key={s.unit}><p className="font-medium">{s.unit}</p><ul className="list-disc pl-4">{s.lines.map((l, k) => <li key={k}>{l}</li>)}</ul></div>)}</div>;
  if (mode === 'doc') {
    const download = () => { const url = URL.createObjectURL(new Blob([docHtml(g)], { type: 'application/msword' })); Object.assign(document.createElement('a'), { href: url, download: `${g.title.replace(/[^\w ]+/g, '').trim() || 'guide'}.doc` }).click(); URL.revokeObjectURL(url); };
    const print = () => { const w = window.open('', '_blank'); if (!w) { toast('! Allow pop-ups to print.'); return; } w.document.write(docHtml(g)); w.document.close(); w.print(); };
    return <div className="flex gap-2"><Button size="sm" onClick={download}>Download for Word</Button><Button size="sm" variant="outline" onClick={print}>Print or save as PDF</Button></div>;
  }
  const field = mode === 'field';
  return (
    <article className="space-y-3 text-sm">
      {field && <header><p className="text-xs uppercase tracking-wide text-muted-foreground">Field guide</p><h2 className="text-xl font-semibold">{g.title}</h2>{g.blurb && <p>{g.blurb}</p>}</header>}
      {g.units.map((u) => <section key={u.name}><h3 className="font-medium">{u.name}</h3>{u.points.map((p, k) => <p key={k}>{p}</p>)}</section>)}
      {g.terms.length > 0 && <section><h3 className="font-medium">Glossary</h3><dl>{g.terms.map((t) => <div key={t.t} className="text-xs"><dt className="inline font-medium">{t.t}: </dt><dd className="inline">{t.d}</dd></div>)}</dl></section>}
      {field && g.units.some((u) => u.cards.length) && <section><h3 className="font-medium">Self-test</h3>{g.units.flatMap((u) => u.cards).map((c, k) => <details key={k} className="text-xs"><summary>{c.q}</summary>{c.a}</details>)}</section>}
    </article>
  );
}

function Editor({ d, rec, act, onDone }: { d: any; rec: any | null; act: ReturnType<typeof useAct>; onDone: (id?: number) => void }) {
  const [f, setF] = useState({ title: rec?.title ?? '', source: rec?.source ?? SAMPLE, sectionId: rec?.sectionId ?? '' });
  const preview = parseGuide(f.title || 'Untitled', f.source);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2"><Input aria-label="Guide title" placeholder="Guide title" className="w-64" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select aria-label="Section" className={sel} value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })}><option value="">No section</option>{d.sections.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <Textarea aria-label="Guide text" rows={12} className="font-mono text-xs" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
      <p className="text-xs text-muted-foreground">"# " starts a unit · "question :: answer" is a card · "Figure:" and "Case:" lines use | between parts · terms go under "## Terms". Preview: {preview.units.length} units, {preview.units.reduce((n, u) => n + u.cards.length, 0)} cards, {preview.terms.length} terms · modes: {availableModes(preview).map((m) => MODE_LABEL[m]).join(', ') || 'none yet'}</p>
      <div className="flex gap-2"><Button size="sm" disabled={f.title.trim().length < 2} onClick={async () => { const r = await act({ action: 'save', id: rec?.id ?? null, title: f.title, source: f.source, sectionId: f.sectionId || null, expectedVersion: rec?.version ?? 0 }, 'Saved.'); if (r) onDone(Number(String(r.result).slice(3))); }}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => onDone()}>Cancel</Button></div>
    </div>
  );
}

function Body({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [openId, setOpenId] = useState<number | null>(d.guides[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('read');
  const [editing, setEditing] = useState<'new' | number | null>(d.guides.length ? null : 'new');
  const rec = d.guides.find((g: any) => g.id === openId) ?? null;
  const g = useMemo(() => (rec ? parseGuide(rec.title, rec.source) : null), [rec]);
  const modes = g ? availableModes(g) : [];
  useEffect(() => { if (g && !modes.includes(mode) && modes.length) setMode(modes[0]); }, [g, modes, mode]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Guides">
        <Button size="sm" onClick={() => setEditing('new')}>New guide</Button>
        {!d.guides.length ? <Empty>No guides yet. Write one, or open a course whose instructor published one.</Empty> : d.guides.map((x: any) => <button type="button" key={x.id} onClick={() => { setOpenId(x.id); setEditing(null); }} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${x.id === openId ? 'border-primary' : 'border-border'}`}>
          <span className="font-medium">{x.title}</span>{x.section && <span className="text-xs"> · {x.section}</span>}<br /><span className="text-xs text-muted-foreground">{x.mine ? 'Yours' : `From ${x.owner}`}{x.published ? ' · published' : ''}</span></button>)}
      </Panel>
      <div className="lg:col-span-2">
        {editing !== null ? <Panel title={editing === 'new' ? 'New guide' : 'Edit guide'}><Editor d={d} rec={editing === 'new' ? null : rec} act={act} onDone={(id) => { setEditing(null); if (id) setOpenId(id); }} /></Panel>
          : rec && g ? <Panel title={rec.title} action={<div className="flex flex-wrap gap-2">
              {rec.mine && <Button size="sm" variant="outline" onClick={() => setEditing(rec.id)}>Edit</Button>}
              {!rec.mine && <Button size="sm" variant="outline" onClick={() => act({ action: 'copy', id: rec.id }, 'Copied to your guides.')}>Make my own copy</Button>}
              {rec.mine && rec.sectionId && d.sections.find((s: any) => s.id === rec.sectionId)?.teaching && <Button size="sm" variant="outline" onClick={() => act({ action: 'publish', id: rec.id, on: !rec.published }, rec.published ? 'Unpublished.' : 'Published to the section.')}>{rec.published ? 'Unpublish' : 'Publish to section'}</Button>}
              {rec.mine && <Button size="sm" variant="ghost" onClick={() => act({ action: 'delete', id: rec.id }, 'Deleted.')}>Delete</Button>}</div>}>
              <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Study modes">{modes.map((m) => <Button key={m} size="sm" role="tab" aria-selected={mode === m} variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)}>{MODE_LABEL[m]}</Button>)}</div>
              {modes.length ? <ModeView key={rec.id + mode} mode={mode} g={g} rec={rec} act={act} /> : <Empty>Add units, points and cards to unlock the study modes.</Empty>}
            </Panel> : <Panel><Empty>Choose a guide.</Empty></Panel>}
      </div>
    </div>
  );
}

export default function Guides() {
  const state = useLoad(() => guidesApi({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Learn" title="Study guides" sub="One guide per course, studied any way: Cards, Read, Field guide, Watch, Slides, Doc, Quiz, Figures, Cases, Cram and Listen. Instructors can publish a guide to their section." />
      <Loadable state={state}>{(d: any) => <Body d={d} act={act} />}</Loadable>
    </div>
  );
}
