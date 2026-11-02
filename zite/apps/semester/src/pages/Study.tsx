import { useState } from 'react';
import { toast } from 'sonner';
import { study } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus } from 'lucide-react';
import { PageHeader, Panel, Empty, SourceTag, useLoad, Loadable, errMsg } from '../components/kit';

type Kind = 'Note' | 'Flashcard Deck' | 'Quiz' | 'Study Plan' | 'Portfolio Item';
type Vis = 'Only Me' | 'Course' | 'Selected Collaborators' | 'Public Portfolio';
type Item = { id?: string; title: string; kind: Kind; visibility: Vis; body: string; source?: string; course?: string };
const KINDS: Kind[] = ['Note', 'Flashcard Deck', 'Quiz', 'Study Plan', 'Portfolio Item'];
const VIS: Vis[] = ['Only Me', 'Course', 'Selected Collaborators', 'Public Portfolio'];

function Flashcards({ body }: { body: string }) {
  const cards = body.split('\n').map((l) => l.split('::')).filter((p) => p.length === 2);
  const [i, setI] = useState(0); const [flip, setFlip] = useState(false);
  if (!cards.length) return <p className="text-xs text-muted-foreground">Write cards as “front :: back”, one per line.</p>;
  return (
    <div>
      <button onClick={() => setFlip(!flip)} className="flex h-24 w-full items-center justify-center rounded-md border border-border bg-background p-3 text-center font-sans">{cards[i][flip ? 1 : 0].trim()}</button>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{i + 1} of {cards.length} · tap to flip</span><Button size="sm" variant="ghost" onClick={() => { setI((i + 1) % cards.length); setFlip(false); }}>Next</Button></div>
    </div>
  );
}

export default function Study() {
  const state = useLoad(() => study({ action: 'list' }));
  const [edit, setEdit] = useState<Item | null>(null);
  const save = async () => {
    try { await study({ action: 'save', id: edit!.id, title: edit!.title, kind: edit!.kind, visibility: edit!.visibility, body: edit!.body }); setEdit(null); state.reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (id: string) => { try { await study({ action: 'delete', id }); setEdit(null); state.reload(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <>
      <PageHeader eyebrow="Learn" title="Study" sub="Notes, flashcards, quizzes and study plans. Private unless you choose otherwise."
        actions={<Button size="sm" onClick={() => setEdit({ title: '', kind: 'Note', visibility: 'Only Me', body: '' })}><Plus className="mr-1 h-4 w-4" />New</Button>} />
      <Loadable state={state}>{(d) => d.items.length === 0 ? <Empty>No study items yet.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((it: Item & { id: string; source: string }) => (
            <Panel key={it.id}>
              <div className="flex justify-between gap-2"><p className="eyebrow">{it.kind}{it.course ? ` · ${it.course}` : ''}</p><SourceTag source={it.source} /></div>
              <button className="mt-1 text-left font-display text-lg hover:underline" onClick={() => setEdit(it)}>{it.title}</button>
              <p className="mb-2 text-xs text-muted-foreground">Who can see this: {it.visibility}</p>
              {it.kind === 'Flashcard Deck' ? <Flashcards body={it.body} /> : <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{it.body}</p>}
            </Panel>))}
        </div>)}</Loadable>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit' : 'New'} study item</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div><Label>Title</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Kind</Label><Select value={edit.kind} onValueChange={(v) => setEdit({ ...edit, kind: v as Kind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Who can see this?</Label><Select value={edit.visibility} onValueChange={(v) => setEdit({ ...edit, visibility: v as Vis })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VIS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Content</Label><Textarea rows={6} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder={edit.kind === 'Flashcard Deck' ? 'front :: back' : ''} /></div>
          </div>}
          <DialogFooter>{edit?.id && <Button variant="ghost" className="text-destructive" onClick={() => del(edit.id!)}>Delete</Button>}<Button disabled={!edit?.title.trim()} onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
