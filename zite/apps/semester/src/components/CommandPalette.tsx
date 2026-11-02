import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { search, SearchOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogTitle } from '@project/components/ui/dialog';
import { Search } from 'lucide-react';
import { SourceTag } from './kit';

const JUMPS = [['Today', '/today'], ['Registration', '/plan/registration'], ['Courses', '/learn'], ['Ask Semester', '/learn/ask'], ['Advising', '/help'], ['Degree path', '/progress'], ['Privacy & data', '/you']];

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchOutputType['hits']>([]);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const run = useDebouncedCallback(async (v: string) => {
    if (!v.trim()) { setHits([]); return; }
    setBusy(true);
    try { setHits((await search({ q: v })).hits); } finally { setBusy(false); }
  }, 250);
  const go = (p: string) => { onOpenChange(false); setQ(''); setHits([]); nav(p); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogTitle className="sr-only">Search Semester</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); run(e.target.value); }} placeholder="Search tasks, courses, notes, events…" className="flex-1 bg-transparent text-sm outline-none" />
          {busy && <span className="text-xs text-muted-foreground">Searching…</span>}
        </div>
        <div className="max-h-96 overflow-y-auto p-2 text-sm">
          {!q && JUMPS.map(([l, p]) => <button key={p} onClick={() => go(p)} className="block w-full rounded-[3px] px-3 py-2 text-left font-sans hover:bg-muted">Go to {l}</button>)}
          {q && !busy && hits.length === 0 && <p className="px-3 py-6 text-center text-muted-foreground">No records you can see match “{q}”.</p>}
          {hits.map((h) => (
            <button key={h.kind + h.id} onClick={() => go(h.path)} className="flex w-full items-center justify-between gap-3 rounded-[3px] px-3 py-2 text-left font-sans hover:bg-muted">
              <span className="min-w-0"><span className="block truncate">{h.title}</span><span className="block truncate text-xs text-muted-foreground">{h.kind} · {h.detail}</span></span>
              <SourceTag source={h.source} />
            </button>
          ))}
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Results only include records your role and privacy settings allow.</p>
      </DialogContent>
    </Dialog>
  );
}
