import { useState } from 'react';
import { toast } from 'sonner';
import { assignments } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Loadable, useLoad, Status, fmt, errMsg } from './kit';
import { emptyDraft, publishProblems, AI_POLICIES, type AssignmentDraft } from '../lib/assignmentRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const local = (iso: string) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d.getTime())) return ''; d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

/** Instructor of record: draft → preview → publish an exact version → revise as a new version. Students never see drafts. */
export default function AssignmentStudio({ sectionId, onPublished }: { sectionId: string; onPublished?: () => void }) {
  const s = useLoad(() => assignments({ action: 'list', sectionId } as never) as Promise<any>, [sectionId]);
  const [open, setOpen] = useState<{ id: number | null; draftVersion: number; draft: AssignmentDraft } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<{ id: number; versions: any[] } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AssignmentDraft>) => { setOpen((o) => (o ? { ...o, draft: { ...o.draft, ...p } } : o)); setPreview(null); };
  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => { setBusy(true); try { return await fn(); } catch (e) { toast(`! ${errMsg(e)}`); return null; } finally { setBusy(false); } };

  const save = async () => {
    const r: any = await run(() => assignments({ action: 'saveDraft', sectionId, id: open!.id, draft: open!.draft, expectedDraftVersion: open!.draftVersion } as never));
    if (r) { setOpen({ ...open!, id: r.id, draftVersion: r.draftVersion }); toast('Draft saved. Students cannot see drafts.'); s.reload(); }
    return r;
  };
  const doPreview = async () => { const saved = await save(); if (!saved) return; const p = await run(() => assignments({ action: 'preview', sectionId, id: saved.id } as never)); if (p) setPreview(p); };
  const publish = async () => {
    const r: any = await run(() => assignments({ action: 'publish', sectionId, id: open!.id, expectedDraftVersion: preview.draftVersion, note } as never));
    if (r) { toast(r.version === 1 ? `Published version 1 to ${r.created} student${r.created === 1 ? '' : 's'}.` : `Published version ${r.version}: ${r.changes.join('; ')}`); setOpen(null); setPreview(null); setNote(''); s.reload(); onPublished?.(); }
  };
  const local_problems = open ? publishProblems(open.draft) : [];

  return (
    <Loadable state={s}>{(d: any) => d.role !== 'instructor' ? null : (
      <Panel title="Assignments" action={!open && <Button size="sm" onClick={() => { setOpen({ id: null, draftVersion: 0, draft: emptyDraft() }); setPreview(null); }}>New assignment</Button>}>
        <p className="mb-2 text-xs text-muted-foreground">Drafts are private to the course's instructors. Publishing gives students one exact version; a later change is published as a new version, and work already submitted keeps the version it was submitted against.</p>
        {!open && (d.assignments.length === 0 ? <Empty>No assignments yet.</Empty> : (
          <ul className="divide-y divide-border">{d.assignments.map((x: any) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div><p className="font-medium">{x.draft.title || 'Untitled draft'}</p>
                <p className="text-xs text-muted-foreground">{x.currentVersion ? `Version ${x.currentVersion} published · given to ${x.given}` : 'Draft — not visible to students'}{x.currentVersion && x.unpublishedChanges ? ' · unpublished changes' : ''}</p></div>
              <div className="flex gap-2"><Status value={x.state} />
                <Button size="sm" variant="outline" onClick={() => { setOpen({ id: x.id, draftVersion: x.draftVersion, draft: { ...emptyDraft(), ...x.draft } }); setPreview(null); }}>{x.currentVersion ? 'Revise' : 'Edit'}</Button>
                {x.currentVersion > 0 && <Button size="sm" variant="ghost" onClick={async () => { const h: any = await run(() => assignments({ action: 'versions', sectionId, id: x.id } as never)); if (h) setHistory({ id: x.id, versions: h.versions }); }}>History</Button>}</div>
            </li>))}</ul>))}
        {history && !open && <div className="mt-3 rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between"><p className="font-medium">Version history</p><Button size="sm" variant="ghost" onClick={() => setHistory(null)}>Close</Button></div>
          <ul className="mt-1 space-y-1">{history.versions.map((v) => <li key={v.version}><span className="font-medium">Version {v.version}</span> · {fmt(v.at)} · {v.by} · {v.submissions} submission{v.submissions === 1 ? '' : 's'} against it
            <span className="block text-xs text-muted-foreground">{v.changes.join('; ')}{v.note ? ` · ${v.note}` : ''} · content {v.sha256}…</span></li>)}</ul></div>}
        {open && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs sm:col-span-2">Title<Input value={open.draft.title} onChange={(e) => set({ title: e.target.value })} /></label>
            <label className="text-xs sm:col-span-2">Instructions<Textarea rows={6} value={open.draft.instructions} onChange={(e) => set({ instructions: e.target.value })} /></label>
            <label className="text-xs">Due<Input type="datetime-local" value={local(open.draft.dueAt)} onChange={(e) => set({ dueAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} /></label>
            <label className="text-xs">Points<Input inputMode="numeric" value={String(open.draft.points)} onChange={(e) => set({ points: Number(e.target.value) || 0 })} /></label>
            <label className="text-xs">Attempts allowed<Input inputMode="numeric" value={String(open.draft.attemptsAllowed)} onChange={(e) => set({ attemptsAllowed: Math.round(Number(e.target.value) || 0) })} /></label>
            <label className="text-xs">AI use<select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm" value={open.draft.aiPolicy} onChange={(e) => set({ aiPolicy: e.target.value })}>
              {AI_POLICIES.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="text-xs sm:col-span-2">Rubric (one criterion per line)<Textarea rows={3} value={open.draft.rubric} onChange={(e) => set({ rubric: e.target.value })} /></label>
            <div role="status" aria-live="polite" className="sm:col-span-2">{local_problems.length > 0 && <ul className="text-xs">{local_problems.map((p) => <li key={p}>! {p}</li>)}</ul>}</div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={save}>Save draft</Button>
              <Button size="sm" disabled={busy} onClick={doPreview}>Preview for students</Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(null); setPreview(null); }}>Close</Button>
            </div>
            {preview && (
              <div className="rounded-md border border-border p-3 text-sm sm:col-span-2">
                <p className="eyebrow">What students will see{preview.currentVersion ? ` (version ${preview.currentVersion + 1})` : ' (version 1)'}</p>
                <p className="font-display text-lg">{preview.draft.title}</p>
                <p className="text-xs text-muted-foreground">Due {preview.draft.dueAt ? fmt(preview.draft.dueAt) : '—'} · {preview.draft.points} pts · {preview.draft.attemptsAllowed} attempt{preview.draft.attemptsAllowed === 1 ? '' : 's'} · AI use: {preview.draft.aiPolicy}</p>
                <p className="mt-2 whitespace-pre-wrap">{preview.draft.instructions || 'No instructions.'}</p>
                <p className="mt-2 text-xs"><span className="font-medium">Changes:</span> {preview.changes.length ? preview.changes.join('; ') : 'none — nothing new to publish'}</p>
                {preview.problems.length > 0 ? <ul className="mt-2 text-xs">{preview.problems.map((p: string) => <li key={p}>! {p}</li>)}</ul> : preview.changes.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {preview.currentVersion > 0 && <Input className="max-w-sm" aria-label="Note to students" placeholder="Why it changed (shown in history)" value={note} onChange={(e) => setNote(e.target.value)} />}
                    <Button size="sm" disabled={busy} onClick={publish}>{preview.currentVersion ? `Publish version ${preview.currentVersion + 1}` : 'Publish to students'}</Button>
                  </div>)}
              </div>)}
          </div>)}
      </Panel>
    )}</Loadable>
  );
}
