import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { toolkit } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, errMsg } from '../components/kit';
import { parse, toSvg, describe, STARTERS, LIMITS, PRINT, type DiagramKind, type Ink } from '../lib/diagramRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const save = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const fileName = (t: string) => (t.trim() || 'diagram').replace(/[^\w\- ]+/g, '').slice(0, 60);
const SCREEN: Ink = { ink: 'currentColor', paper: 'none', soft: 'none' };
const KINDS: { key: DiagramKind; label: string; help: string }[] = [
  { key: 'flow', label: 'Flow', help: 'One connection per line: Step -> Next step, or Step -> Next step: label. A line without an arrow adds a step on its own.' },
  { key: 'timeline', label: 'Timeline', help: 'One event per line: when: what happened. Events stay in the order you write them.' },
  { key: 'matrix', label: 'Matrix', help: 'First rows: a, b and cols: x, y. Then one cell per line: row / column: text.' },
];

async function toPng(svg: string, w: number, h: number): Promise<Blob> {
  const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('Could not draw the picture.')); img.src = url; });
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d')!; g.scale(2, 2); g.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('Could not make the image.'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export default function Diagram() {
  const state = useLoad(() => toolkit({ action: 'list', kind: 'diagram' } as never) as Promise<any>, []);
  const [open, setOpen] = useState<{ id: number | null; version: number } | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DiagramKind>('flow');
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const parsed = useMemo(() => parse(kind, text), [kind, text]);
  const screen = useMemo(() => toSvg(parsed.diagram, title, SCREEN), [parsed, title]);
  const words = useMemo(() => describe(parsed.diagram), [parsed]);
  const size = () => { const m = screen.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/); return m ? [Number(m[1]), Number(m[2])] : [320, 120]; };

  const start = (d: any | null) => { setOpen(d ? { id: d.id, version: d.version } : { id: null, version: 0 }); setTitle(d?.title ?? ''); const k = (d?.data?.kind as DiagramKind) ?? 'flow'; setKind(k); setText(d?.data?.text ?? STARTERS[k]); setDirty(false); };
  const switchKind = (k: DiagramKind) => { if (k === kind) return; if (text.trim() && text !== STARTERS[kind] && !window.confirm('Start a new description for this kind? The current text will be replaced.')) return; setKind(k); setText(STARTERS[k]); setDirty(true); };
  const persist = async () => {
    try { const r: any = await toolkit({ action: 'save', id: open!.id, kind: 'diagram', title: title.trim() || 'Untitled diagram', data: { kind, text }, expectedVersion: open!.version } as never); setOpen({ id: r.result.id, version: r.result.version }); setDirty(false); toast('Saved.'); state.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const empty = kind === 'flow' ? !(parsed.diagram as any).nodes.length : kind === 'timeline' ? !(parsed.diagram as any).events.length : !(parsed.diagram as any).rows.length || !(parsed.diagram as any).cols.length;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title="Diagram builder" sub="Describe a flow, a timeline or a matrix in a few lines and get a picture you can download. Nothing is generated for you." />
      <Loadable state={state}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-4">
          <Panel title="Your diagrams"><Button size="sm" onClick={() => start(null)}>New diagram</Button>
            {!d.docs.length ? <Empty>No diagrams yet.</Empty> : d.docs.map((x: any) => (
              <button type="button" key={x.id} onClick={() => start(x)} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${open?.id === x.id ? 'border-primary' : 'border-border'}`}>{x.title}
                <span className="block text-xs text-muted-foreground">{x.data?.kind ? `${x.data.kind} · ` : ''}{new Date(x.updatedAt).toLocaleDateString()}</span></button>))}
          </Panel>
          <div className="space-y-4 lg:col-span-3">{!open ? <Panel><Empty>Start a new diagram or open one of yours.</Empty></Panel> : (<>
            <Panel title={open.id ? 'Edit diagram' : 'New diagram'} action={<div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={persist}>{dirty ? 'Save' : 'Saved'}</Button>
              <Button size="sm" variant="outline" disabled={empty} onClick={() => save(`${fileName(title)}.svg`, new Blob([toSvg(parsed.diagram, title, PRINT)], { type: 'image/svg+xml' }))}>Download SVG</Button>
              <Button size="sm" variant="outline" disabled={empty} onClick={async () => { try { const [w, h] = size(); save(`${fileName(title)}.png`, await toPng(toSvg(parsed.diagram, title, PRINT), w, h)); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Download PNG</Button>
              <Button size="sm" variant="outline" disabled={!words} onClick={async () => { try { await navigator.clipboard.writeText(words); toast('Copied the description.'); } catch { toast('! Copy was blocked by the browser.'); } }}>Copy as text</Button>
              {open.id && <Button size="sm" variant="ghost" onClick={async () => { try { await toolkit({ action: 'delete', id: open.id, kind: 'diagram' } as never); setOpen(null); state.reload(); toast('Deleted.'); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Delete</Button>}</div>}>
              <Input aria-label="Diagram title" placeholder="Diagram title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of diagram">
                {KINDS.map((k) => <Button key={k.key} size="sm" role="radio" aria-checked={kind === k.key} variant={kind === k.key ? 'default' : 'outline'} onClick={() => switchKind(k.key)}>{k.label}</Button>)}
              </div>
              <Textarea aria-label="Description" aria-describedby="dg-help dg-problems" rows={10} className="mt-2 font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} />
              <p id="dg-help" className="mt-1 text-xs text-muted-foreground">{KINDS.find((k) => k.key === kind)!.help} Up to {kind === 'flow' ? `${LIMITS.nodes} steps` : kind === 'timeline' ? `${LIMITS.events} events` : `${LIMITS.cells} × ${LIMITS.cells} cells`}. Lines starting with // are ignored.</p>
              <div id="dg-problems" role="status" aria-live="polite">{parsed.problems.length > 0 && <ul className="mt-2 space-y-0.5 text-xs">{parsed.problems.map((p, i) => <li key={i}>! {p}</li>)}</ul>}</div>
            </Panel>
            <Panel title="Preview">
              {empty ? <Empty>The picture appears as you write.</Empty> : <>
                <div className="overflow-x-auto rounded-md border border-border bg-background p-3 text-foreground" dangerouslySetInnerHTML={{ __html: screen }} />
                <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">In words: </span>{words}</p>
              </>}
            </Panel>
          </>)}</div>
        </div>)}</Loadable>
    </div>
  );
}
