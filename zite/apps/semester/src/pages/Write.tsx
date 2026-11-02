import { useState } from 'react';
import { toast } from 'sonner';
import { study } from 'zitejs/api';
import { MarkdownEditor } from '@project/components/markdown-editor';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@project/components/ui/radio-group';
import { Label } from '@project/components/ui/label';
import { cn } from '@project/components/lib/utils';
import { PageHeader, Panel, Empty, Loadable, useLoad, SourceTag, errMsg } from '../components/kit';
import { undoToast } from '../components/overlays';

type Item = { id: string; title: string; kind: string; visibility: string; source: string; body: string };
const VIS: [string, string][] = [['Only Me', 'Nobody else can see it.'], ['Course', 'People enrolled in the course it is attached to.'], ['Selected Collaborators', 'Only the people you add by name.'], ['Public Portfolio', 'Anyone with the link to your portfolio.']];

export default function Write() {
  const s = useLoad(() => study({ action: 'list' }));
  const [cur, setCur] = useState<Partial<Item> | null>(null);
  const [key, setKey] = useState(0);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const open = (i: Partial<Item>) => { setCur(i); setKey((k) => k + 1); setSaving('idle'); };
  const save = async () => {
    if (!cur?.title?.trim()) return toast('! Give your document a title.');
    setSaving('saving');
    try { await study({ action: 'save', id: cur.id, title: cur.title, kind: 'Note', visibility: (cur.visibility ?? 'Only Me') as 'Only Me', body: cur.body ?? '' }); setSaving('saved'); s.reload(); }
    catch (e) { setSaving('idle'); toast(`! ${errMsg(e)} Your text is still here.`); }
  };
  const remove = async (i: Item) => {
    await study({ action: 'delete', id: i.id }); s.reload(); if (cur?.id === i.id) setCur(null);
    undoToast(`“${i.title}” deleted.`, async () => { await study({ action: 'save', title: i.title, kind: 'Note', visibility: i.visibility as 'Only Me', body: i.body }); s.reload(); });
  };
  return (
    <>
      <PageHeader eyebrow="Learn" title="Write" sub="Drafts and notes in one place. Everything starts private; you choose who else can see it." actions={<Button onClick={() => open({ title: '', body: '', visibility: 'Only Me' })}>New document</Button>} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Loadable state={s}>{(d) => {
          const docs = (d.items as Item[]).filter((i) => i.kind === 'Note');
          return <Panel title="Documents">{docs.length ? <ul className="space-y-1">{docs.map((i) => (
            <li key={i.id} className={cn('group flex items-center justify-between rounded-[3px] border-l-2 border-transparent px-2 py-1.5 text-sm hover:bg-accent', cur?.id === i.id && 'border-primary bg-accent font-medium')}>
              <button className="flex-1 truncate text-left" onClick={() => open(i)}>{i.title}</button>
              <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100" onClick={() => remove(i)} aria-label={`Delete ${i.title}`}>Delete</button>
            </li>))}</ul> : <Empty>No documents yet.</Empty>}</Panel>;
        }}</Loadable>
        {cur ? (
          <Panel>
            <div className="flex items-center gap-2"><Input className="font-display text-lg" placeholder="Title" value={cur.title ?? ''} onChange={(e) => { setCur({ ...cur, title: e.target.value }); setSaving('idle'); }} /><SourceTag source={cur.source ?? 'Yours'} /></div>
            <MarkdownEditor key={key} content={cur.body ?? ''} onChange={(b) => { setCur((c) => ({ ...c, body: b })); setSaving('idle'); }} className="mt-3 min-h-[320px]" />
            <p className="eyebrow mt-4">Who can see this?</p>
            <RadioGroup className="mt-2 grid gap-2 sm:grid-cols-2" value={cur.visibility ?? 'Only Me'} onValueChange={(v) => { setCur({ ...cur, visibility: v }); setSaving('idle'); }}>
              {VIS.map(([v, about]) => <Label key={v} className="flex items-start gap-2 rounded-[3px] border border-border p-2 font-normal"><RadioGroupItem value={v} className="mt-0.5" /><span><span className="block text-sm">{v}</span><span className="text-xs text-muted-foreground">{about}</span></span></Label>)}
            </RadioGroup>
            <div className="mt-4 flex items-center gap-3"><Button onClick={save} disabled={saving === 'saving'}>Save</Button><span className="text-xs text-muted-foreground" aria-live="polite">{saving === 'saving' ? '… Saving' : saving === 'saved' ? '✓ Saved' : ''}</span></div>
          </Panel>
        ) : <Empty>Pick a document or start a new one.</Empty>}
      </div>
    </>
  );
}
