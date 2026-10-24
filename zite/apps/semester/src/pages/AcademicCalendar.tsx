import { useState } from 'react';
import { toast } from 'sonner';
import { academicCalendar } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Status, fmt, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await academicCalendar(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const WIN: Record<string, string> = { open: 'registration open', not_yet: 'registration not open yet', closed: 'registration closed' };

function Dates({ c }: { c: any }) {
  return <p className="text-sm">Registration {fmt(c.regOpens)} – {fmt(c.regCloses)} · classes {fmtDay(c.classesStart)} – {fmtDay(c.classesEnd)} · add/drop ends {fmtDay(c.addDropEnds)}</p>;
}

export default function AcademicCalendar() {
  const s = useLoad(() => academicCalendar({ action: 'get' }));
  const [f, setF] = useState({ term: '', regOpens: '', regCloses: '', addDropEnds: '', classesStart: '', classesEnd: '', note: '' });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader eyebrow="Registrar" title="Academic calendar" sub="Term dates and registration windows. A registrar proposes; a different registrar approves. Registration submissions follow the approved window." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          <Panel title="Effective calendar">
            {!d.effective.length ? <Empty>No approved term calendars yet. Registration has no window until one is approved.</Empty> : d.effective.map((c: any) => (
              <div key={c.id} className="border-t border-border py-2 first:border-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">{c.term} <Status value={WIN[c.window]} /> <span className="text-xs font-normal text-muted-foreground">v{c.version}{c.decidedBy && ` · approved by ${c.decidedBy}`}</span></p>
                <Dates c={c} />
              </div>))}
          </Panel>
          {d.canEdit && <>
            <Panel title={`Waiting for approval · ${d.pending.length}`}>
              {!d.pending.length ? <Empty>Nothing waiting.</Empty> : d.pending.map((c: any) => (
                <div key={c.id} className="border-t border-border py-3 text-sm first:border-0">
                  <p className="font-medium">{c.term} · v{c.version} · proposed by {c.proposedBy}</p>
                  <Dates c={c} />{c.note && <p className="text-muted-foreground">{c.note}</p>}
                  {c.mine ? <p className="mt-1 text-xs text-muted-foreground">Another registrar approves your proposal.</p> : <div className="mt-2 flex flex-wrap gap-2">
                    <Input aria-label="Decision note" className="max-w-sm" placeholder="Note (needed to reject)" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                    <Button size="sm" onClick={() => run({ action: 'decide', id: c.id, approve: true, note: notes[c.id] ?? '' }, 'Approved. It is now the effective calendar.', s.reload)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => run({ action: 'decide', id: c.id, approve: false, note: notes[c.id] ?? '' }, 'Rejected.', s.reload)}>Reject</Button>
                  </div>}
                </div>))}
            </Panel>
            <Panel title="Propose term dates">
              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-xs">Term<Input value={f.term} onChange={set('term')} placeholder="Spring 2027" /></label>
                <label className="text-xs">Registration opens<Input type="datetime-local" value={f.regOpens} onChange={set('regOpens')} /></label>
                <label className="text-xs">Registration closes<Input type="datetime-local" value={f.regCloses} onChange={set('regCloses')} /></label>
                <label className="text-xs">Classes start<Input type="date" value={f.classesStart} onChange={set('classesStart')} /></label>
                <label className="text-xs">Classes end<Input type="date" value={f.classesEnd} onChange={set('classesEnd')} /></label>
                <label className="text-xs">Add/drop ends<Input type="date" value={f.addDropEnds} onChange={set('addDropEnds')} /></label>
              </div>
              <Input className="mt-2" aria-label="Note" placeholder="Note for the approver" value={f.note} onChange={set('note')} />
              <Button className="mt-2" size="sm" disabled={!f.term || !f.regOpens || !f.regCloses || !f.classesStart || !f.classesEnd || !f.addDropEnds}
                onClick={() => run({ action: 'propose', ...f, regOpens: new Date(f.regOpens).toISOString(), regCloses: new Date(f.regCloses).toISOString() }, 'Proposed. Another registrar must approve it.', () => { setF({ term: '', regOpens: '', regCloses: '', addDropEnds: '', classesStart: '', classesEnd: '', note: '' }); s.reload(); })}>Propose</Button>
            </Panel>
            {d.history.length > 0 && <Panel title="History">
              <ul className="text-sm">{d.history.map((c: any) => <li key={c.id} className="border-t border-border py-1.5 first:border-0">{c.term} v{c.version} · <Status value={c.state} /> · {c.proposedBy}{c.decidedBy && ` → ${c.decidedBy}`}{c.decisionNote && <span className="text-muted-foreground"> · {c.decisionNote}</span>}</li>)}</ul>
            </Panel>}
          </>}
        </div>)}
      </Loadable>
    </>
  );
}
