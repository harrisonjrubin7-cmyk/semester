import { useState } from 'react';
import { toast } from 'sonner';
import { study } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, SourceTag, errMsg } from '../components/kit';
import { undoToast } from '../components/overlays';

type Item = { id: string; title: string; kind: string; visibility: string; source: string; body: string; course: string };
const parse = (b: string) => b.split('\n').map((l) => l.split('::')).filter((p) => p.length >= 2 && p[0].trim()).map(([q, ...a]) => ({ q: q.trim(), a: a.join('::').trim() }));

function Practice({ deck, onExit }: { deck: Item; onExit: () => void }) {
  const cards = parse(deck.body);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [known, setKnown] = useState(0);
  if (!cards.length) return <Empty>This deck has no cards. Add lines like “Mitosis :: Cell division into two identical cells”.</Empty>;
  if (i >= cards.length) return <Panel><p className="font-display text-xl">✓ Round finished</p><p className="mt-1 text-sm text-muted-foreground">You knew {known} of {cards.length}. Next: run it again, or go back to your decks.</p><div className="mt-4 flex gap-2"><Button onClick={() => { setI(0); setKnown(0); setShow(false); }}>Run again</Button><Button variant="outline" onClick={onExit}>Back to decks</Button></div></Panel>;
  const next = (k: boolean) => { if (k) setKnown((n) => n + 1); setShow(false); setI(i + 1); };
  return (
    <Panel>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{deck.title}</span><span className="tabular-nums">Card {i + 1} of {cards.length}</span></div>
      <button onClick={() => setShow(true)} className="mt-4 flex min-h-[180px] w-full flex-col items-center justify-center rounded-md border border-border bg-background p-6 text-center">
        <p className="font-display text-2xl">{cards[i].q}</p>
        {show ? <p className="mt-4 text-muted-foreground">{cards[i].a}</p> : <p className="mt-4 text-xs text-muted-foreground">Select to show the answer</p>}
      </button>
      <div className="mt-4 flex gap-2">{show ? <><Button onClick={() => next(true)}>✓ I knew it</Button><Button variant="outline" onClick={() => next(false)}>Not yet</Button></> : <Button onClick={() => setShow(true)}>Show answer</Button>}<Button variant="ghost" onClick={onExit}>End</Button></div>
    </Panel>
  );
}

export default function Decks() {
  const s = useLoad(() => study({ action: 'list' }));
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [play, setPlay] = useState<Item | null>(null);
  const save = async () => {
    try { await study({ action: 'save', id: edit!.id, title: edit!.title!, kind: 'Flashcard Deck', visibility: (edit!.visibility ?? 'Only Me') as 'Only Me', body: edit!.body ?? '' }); toast('Deck saved.'); setEdit(null); s.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const remove = async (d: Item) => { await study({ action: 'delete', id: d.id }); s.reload(); undoToast('Deck deleted.', async () => { await study({ action: 'save', title: d.title, kind: 'Flashcard Deck', visibility: d.visibility as 'Only Me', body: d.body }); s.reload(); }); };
  if (play) return <><PageHeader eyebrow="Learn" title="Practice" /><Practice deck={play} onExit={() => setPlay(null)} /></>;
  return (
    <>
      <PageHeader eyebrow="Learn" title="Decks" sub="Flashcards you write and practise. No streaks or scores — just what you knew this round." actions={<Button onClick={() => setEdit({ title: '', body: '' })}>New deck</Button>} />
      {edit && (
        <Panel title={edit.id ? 'Edit deck' : 'New deck'} className="mb-4">
          <Input placeholder="Deck title" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <Textarea className="mt-3 font-mono text-sm" rows={8} placeholder={'One card per line: question :: answer\nOsmosis :: Water moving across a membrane'} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">{parse(edit.body ?? '').length} cards · Only you can see this deck</p>
          <div className="mt-3 flex gap-2"><Button disabled={!edit.title?.trim()} onClick={save}>Save deck</Button><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button></div>
        </Panel>
      )}
      <Loadable state={s}>{(d) => {
        const decks = (d.items as Item[]).filter((i) => i.kind === 'Flashcard Deck');
        return decks.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{decks.map((k) => (
          <Panel key={k.id}>
            <p className="eyebrow">{k.course || 'Deck'}</p><h2 className="mt-1 text-lg">{k.title}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><SourceTag source={k.source} />{parse(k.body).length} cards</div>
            <div className="mt-4 flex gap-2"><Button size="sm" onClick={() => setPlay(k)}>Practise</Button><Button size="sm" variant="outline" onClick={() => setEdit(k)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => remove(k)}>Delete</Button></div>
          </Panel>))}</div> : <Empty>No decks yet. Start one to practise a course’s key terms.</Empty>;
      }}</Loadable>
    </>
  );
}
