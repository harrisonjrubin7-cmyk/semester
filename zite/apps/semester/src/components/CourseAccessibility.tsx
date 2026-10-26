import { useState } from 'react';
import { toast } from 'sonner';
import { courseAccessibility } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Loadable, useLoad, Status, fmt, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const WORD: Record<string, string> = { error: '! Must fix', warning: 'Check', info: 'Suggestion' };

/** Course staff: automated accessibility findings for this section, and the recorded reviews. */
export default function CourseAccessibility({ sectionId }: { sectionId: string }) {
  const s = useLoad(() => courseAccessibility({ action: 'get', sectionId }), [sectionId]);
  const [note, setNote] = useState('');
  const record = async () => { try { await courseAccessibility({ action: 'record', sectionId, note }); toast('Review recorded.'); setNote(''); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-4">
        <Panel title={`Accessibility findings · ${d.summary.errors} must fix · ${d.summary.warnings} to check`}>
          <p className="mb-2 text-xs text-muted-foreground">Automatic checks of the syllabus, materials, assignments and assessments. Assessments with “must fix” findings cannot be published. Linked files and videos still need a person to check them.</p>
          {d.issues.length ? <ul className="space-y-2">{d.issues.map((i: any, k: number) => (
            <li key={k} className="text-sm"><Status value={WORD[i.level] ?? i.level} /> <span className="font-medium">{i.where}</span><span className="block text-xs">{i.message}</span></li>))}</ul>
            : <Empty>✓ No findings. Check linked files and media by hand.</Empty>}
        </Panel>
        <Panel title="Recorded reviews">
          {d.reviews.length ? <ul className="mb-3 space-y-1 text-sm">{d.reviews.map((r: any, k: number) => <li key={k}>{fmt(r.at)} · {r.by} · {r.errors} must fix, {r.warnings} to check<span className="block text-xs text-muted-foreground">{r.note}</span></li>)}</ul>
            : <Empty>No review recorded yet.</Empty>}
          {d.role === 'instructor' && <div className="space-y-2">
            <Textarea aria-label="Review note" placeholder="What you checked by hand (files, videos, captions) and what remains" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={note.trim().length < 10} onClick={record}>Record review</Button>
          </div>}
        </Panel>
      </div>
    )}</Loadable>
  );
}
