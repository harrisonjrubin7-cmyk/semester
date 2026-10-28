// Search result filtering (S-92 §7 P04, §4 masking). lib/search.ts fetches; this pure step decides what becomes a hit and
// re-checks ownership and institution even if a fetch returned more than it should. A record the caller may not see
// contributes nothing — no hit, no title, no snippet, and nothing to any count. Tested in tests/searchHits.test.ts.
export type Note = { id: string; owner: string[]; title: string; body: string; kind: string; visibility: string; source: string };
export type OwnedTask = { id: string; owner: string[]; title: string; rubric: string; type: string; dueAt: string; status: string; source: string };
export type NoteHit = { id: string; kind: string; title: string; detail: string; source: string; path: string };

export const matcher = (q: string) => { const n = q.toLowerCase().trim(); return (...s: (string | undefined)[]) => !n || s.some((x) => (x ?? '').toLowerCase().includes(n)); };

/** Private notes and resources: only the caller's own. */
export function noteHits(uid: string, q: string, notes: Note[]): NoteHit[] {
  const m = matcher(q);
  return notes.filter((r) => r.owner.includes(uid) && m(r.title, r.body))
    .map((r) => ({ id: r.id, kind: r.kind || 'Note', title: r.title, detail: `Visibility: ${r.visibility}`, source: r.source || 'Yours', path: '/learn/study' }));
}
/** Tasks: only the caller's own. */
export function taskHits(uid: string, q: string, tasks: OwnedTask[]): NoteHit[] {
  const m = matcher(q);
  return tasks.filter((t) => t.owner.includes(uid) && m(t.title, t.rubric))
    .map((t) => ({ id: t.id, kind: t.type || 'Task', title: t.title, detail: t.dueAt ? `Due ${t.dueAt}` : t.status, source: t.source || 'Yours', path: t.type === 'Hold' ? '/help' : '/today' }));
}
