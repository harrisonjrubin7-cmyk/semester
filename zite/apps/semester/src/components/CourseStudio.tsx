import { useState } from 'react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { learn } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, SourceTag, fmt, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await learn(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };

/** Syllabus: everyone reads the current version; instructors publish new versions, which are kept forever. */
export function SyllabusTab({ d, sectionId, reload }: { d: any; sectionId: string; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(d.section.syllabus ?? '');
  const [note, setNote] = useState('');
  return (
    <div className="space-y-3">
      <Panel action={d.teaching && !editing ? <Button size="sm" variant="outline" onClick={() => { setBody(d.section.syllabus ?? ''); setEditing(true); }}>{d.section.syllabus ? 'Edit' : 'Write syllabus'}</Button> : undefined}>
        {editing ? (
          <div className="space-y-2">
            <Textarea aria-label="Syllabus (Markdown)" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
            <Input aria-label="What changed" placeholder="What changed (students see this in their notification)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={body.trim().length < 20} onClick={async () => { if (await run({ action: 'publishSyllabus', sectionId, body, note, expectedVersion: d.syllabusVersion }, 'Published. Enrolled students were notified.', reload)) { setEditing(false); setNote(''); } }}>Publish version {d.syllabusVersion + 1}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : d.section.syllabus ? <Markdown>{d.section.syllabus}</Markdown> : <Empty>No syllabus posted.</Empty>}
        {!editing && d.syllabusUpdatedAt && <p className="mt-3 text-xs text-muted-foreground">Version {d.syllabusVersion} · updated {fmt(d.syllabusUpdatedAt)}</p>}
      </Panel>
      {d.teaching && d.syllabusHistory.length > 0 && <Panel title="Version history">
        <ul className="text-sm">{d.syllabusHistory.map((h: any) => <li key={h.version} className="border-t border-border py-1.5 first:border-0">v{h.version} · {h.by} · {fmt(h.at)}{h.note && <span className="text-muted-foreground"> · {h.note}</span>}</li>)}</ul>
        <p className="mt-2 text-xs text-muted-foreground">Versions can't be edited or deleted, so everyone can see what applied on a given date.</p>
      </Panel>}
    </div>
  );
}

/** Materials: course links instructors share (https only; files stay off until private storage exists). */
export function MaterialsTab({ d, sectionId, reload }: { d: any; sectionId: string; reload: () => void }) {
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [note, setNote] = useState('');
  const valid = title.trim().length >= 2 && /^https:\/\/\S+\.\S+/.test(url.trim());
  return (
    <div className="space-y-3">
      {d.teaching && <Panel title="Share a material">
        <div className="grid gap-2 md:grid-cols-2">
          <Input aria-label="Title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input aria-label="Link" placeholder="https:// link" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Input aria-label="Note" className="mt-2" placeholder="Optional note for students" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button className="mt-2" size="sm" disabled={!valid} onClick={async () => { if (await run({ action: 'addMaterial', sectionId, title, url: url.trim(), note }, 'Shared with the course.', reload)) { setTitle(''); setUrl(''); setNote(''); } }}>Share</Button>
        <p className="mt-2 text-xs text-muted-foreground">Links only. File uploads stay off until private storage with per-download checks is in place.</p>
      </Panel>}
      <Panel>{d.materials.length === 0 ? <Empty>No materials yet.</Empty> : d.materials.map((m: any) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
          <span>{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{m.title}</a> : m.title} <span className="text-muted-foreground">· {m.kind}{m.note && ` · ${m.note}`}</span></span>
          <span className="flex items-center gap-2"><SourceTag source={m.source} />{d.teaching && m.course && <Button size="sm" variant="ghost" onClick={() => run({ action: 'hideMaterial', sectionId, id: m.id }, 'Hidden from the course.', reload)}>Hide</Button>}</span>
        </div>))}</Panel>
    </div>
  );
}
