import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { toolkit, guides as guidesApi } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, errMsg } from '../components/kit';
import { parseOutline, fromGuide, toOutline, toPptx, MAX_BULLETS, MAX_SLIDES, type Slide } from '../lib/deckRules';
import { parseGuide } from '../lib/guideRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const save = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const fileName = (t: string) => (t.trim() || 'deck').replace(/[^\w\- ]+/g, '').slice(0, 60);
const STARTER = '# Why this matters\n- The question this deck answers\n- What you will be able to do after\n> Speaker note: open with an example.\n\n# Main idea\n- First point\n- Second point\n\n# Summary\n- One thing to remember';

function SlideCard({ s, n, title, big }: { s: Slide | null; n: number; title: string; big?: boolean }) {
  return (
    <div className={`flex aspect-video flex-col rounded-md border border-border bg-background ${big ? 'p-8' : 'p-3'}`} role="group" aria-label={`Slide ${n}`}>
      {s === null ? (
        <div className="m-auto text-center"><p className={big ? 'text-4xl font-semibold' : 'text-sm font-semibold'}>{title || 'Untitled deck'}</p></div>
      ) : (<>
        <p className={big ? 'text-3xl font-semibold' : 'text-xs font-semibold'}>{s.title || ' '}</p>
        <ul className={`mt-2 list-disc pl-5 ${big ? 'space-y-2 text-xl' : 'space-y-0.5 text-[10px] leading-tight'}`}>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </>)}
      {!big && <p className="mt-auto text-right text-[10px] text-muted-foreground">{n}</p>}
    </div>
  );
}

export default function Deck() {
  const state = useLoad(() => toolkit({ action: 'list', kind: 'deck' } as never) as Promise<any>, []);
  const guides = useLoad(() => guidesApi({ action: 'list' } as never) as Promise<any>, []);
  const [open, setOpen] = useState<{ id: number | null; version: number } | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [outline, setOutline] = useState('');
  const [dirty, setDirty] = useState(false);
  const [present, setPresent] = useState<number | null>(null);
  const slides = useMemo(() => parseOutline(outline), [outline]);
  const rawHeadings = (outline.match(/^#{1,3}\s+/gm) ?? []).length;
  const split = slides.filter((s) => s.title.endsWith('(cont.)')).length;
  const total = slides.length + 1;

  useEffect(() => {
    if (present === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresent(null);
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setPresent((p) => Math.min(total - 1, (p ?? 0) + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPresent((p) => Math.max(0, (p ?? 0) - 1));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [present, total]);

  const start = (d: any | null) => { setOpen(d ? { id: d.id, version: d.version } : { id: null, version: 0 }); setTitle(d?.title ?? ''); setSubtitle(d?.data?.subtitle ?? ''); setOutline(d?.data?.outline ?? STARTER); setDirty(false); };
  const persist = async () => {
    try { const r: any = await toolkit({ action: 'save', id: open!.id, kind: 'deck', title: title.trim() || 'Untitled deck', data: { outline, subtitle }, expectedVersion: open!.version } as never); setOpen({ id: r.result.id, version: r.result.version }); setDirty(false); toast('Saved.'); state.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };

  if (present !== null) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background p-6" role="dialog" aria-modal="true" aria-label="Presenting">
        <div className="mx-auto w-full max-w-5xl flex-1"><SlideCard s={present === 0 ? null : slides[present - 1]} n={present + 1} title={title} big /></div>
        {present > 0 && slides[present - 1].notes && <p className="mx-auto mt-3 max-w-5xl text-sm text-muted-foreground">Notes: {slides[present - 1].notes}</p>}
        <div className="mx-auto mt-3 flex items-center gap-2"><Button size="sm" variant="outline" disabled={present === 0} onClick={() => setPresent(present - 1)}>Previous</Button>
          <span className="text-sm" aria-live="polite">{present + 1} / {total}</span>
          <Button size="sm" variant="outline" disabled={present === total - 1} onClick={() => setPresent(present + 1)}>Next</Button>
          <Button size="sm" variant="ghost" onClick={() => setPresent(null)}>Close (Esc)</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title="Make a deck" sub="Write an outline, or start from a study guide, and download a real PowerPoint file. Nothing is generated for you." />
      <Loadable state={state}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-4">
          <Panel title="Your decks"><Button size="sm" onClick={() => start(null)}>New deck</Button>
            {!d.docs.length ? <Empty>No decks yet.</Empty> : d.docs.map((x: any) => (
              <button type="button" key={x.id} onClick={() => start(x)} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${open?.id === x.id ? 'border-primary' : 'border-border'}`}>{x.title}
                <span className="block text-xs text-muted-foreground">{new Date(x.updatedAt).toLocaleDateString()}</span></button>))}
          </Panel>
          <div className="space-y-4 lg:col-span-3">{!open ? <Panel><Empty>Start a new deck or open one of yours.</Empty></Panel> : (<>
            <Panel title={open.id ? 'Edit deck' : 'New deck'} action={<div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={persist}>{dirty ? 'Save' : 'Saved'}</Button>
              <Button size="sm" variant="outline" onClick={() => save(`${fileName(title)}.pptx`, new Blob([toPptx(title, slides, subtitle)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))}>Download PowerPoint</Button>
              <Button size="sm" variant="outline" onClick={() => setPresent(0)}>Present</Button>
              {open.id && <Button size="sm" variant="ghost" onClick={async () => { try { await toolkit({ action: 'delete', id: open.id, kind: 'deck' } as never); setOpen(null); state.reload(); toast('Deleted.'); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Delete</Button>}</div>}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label="Deck title" placeholder="Deck title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
                <Input aria-label="Subtitle" placeholder="Subtitle (course, date, your name)" value={subtitle} onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="dk-guide" className="text-xs">Start from a study guide</label>
                <Loadable state={guides}>{(g: any) => (
                  <select id="dk-guide" className="rounded-md border border-border bg-background p-2 text-sm" defaultValue="" onChange={(e) => {
                    const gd = g.guides.find((x: any) => String(x.id) === e.target.value); if (!gd) return;
                    if (outline.trim() && outline !== STARTER && !window.confirm('Replace the current outline with this guide?')) { e.target.value = ''; return; }
                    setOutline(toOutline(fromGuide(parseGuide(gd.title, gd.source)))); if (!title) setTitle(gd.title); setDirty(true); e.target.value = '';
                  }}><option value="">{g.guides.length ? 'Choose a guide…' : 'No guides yet'}</option>{g.guides.map((x: any) => <option key={x.id} value={x.id}>{x.title}{x.section ? ` · ${x.section}` : ''}</option>)}</select>)}</Loadable>
              </div>
              <Textarea aria-label="Outline" aria-describedby="dk-help" rows={14} className="mt-2 font-mono text-xs" value={outline} onChange={(e) => { setOutline(e.target.value); setDirty(true); }} />
              <p id="dk-help" className="mt-1 text-xs text-muted-foreground"># starts a slide · - adds a bullet · &gt; adds a speaker note. Slides with more than {MAX_BULLETS} bullets continue on the next slide; up to {MAX_SLIDES} slides.</p>
              {split > 0 && <p className="mt-1 text-xs" role="status">{split} slide{split > 1 ? 's' : ''} continued because of length ({rawHeadings} headings became {slides.length} slides).</p>}
            </Panel>
            <Panel title={`Preview (${total} slides)`}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <SlideCard s={null} n={1} title={title} />
                {slides.map((s, i) => <div key={i}><SlideCard s={s} n={i + 2} title={title} />{s.notes && <p className="mt-1 text-[10px] text-muted-foreground">Note: {s.notes}</p>}</div>)}
              </div>
            </Panel>
          </>)}</div>
        </div>)}</Loadable>
    </div>
  );
}
