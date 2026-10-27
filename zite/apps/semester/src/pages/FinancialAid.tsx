import { useState } from 'react';
import { toast } from 'sonner';
import { financialAid } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import AidOffice from '../components/AidOffice';
import { PageHeader, Panel, Empty, Status, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await financialAid(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';
const WORD: Record<string, string> = { todo: 'to do', marked_done: 'marked done', verified: 'verified', needs_action: 'needs action', waived: 'waived' };
const blank = { term: '', title: '', instructions: '', sourceUrl: '', dueOn: '', audience: 'all_students', students: [] as string[] };

function Review({ r, row, reload }: { r: any; row: any; reload: () => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border py-2 text-sm first:border-0">
      <span className="min-w-40">{row.name} · <Status value={WORD[row.state]} /></span>
      {row.self ? <span className="text-xs text-muted-foreground">Another staff member reviews your item</span> : <>
        <Input aria-label="Note" className="max-w-xs" placeholder="Note (needed for needs action / waive)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={() => run({ action: 'review', id: r.id, studentId: row.studentId, state: 'verified', note }, 'Verified.', reload)}>Verified</Button>
        <Button size="sm" variant="outline" onClick={() => run({ action: 'review', id: r.id, studentId: row.studentId, state: 'needs_action', note }, 'Student told what to do next.', reload)}>Needs action</Button>
        <Button size="sm" variant="ghost" onClick={() => run({ action: 'review', id: r.id, studentId: row.studentId, state: 'waived', note }, 'Waived.', reload)}>Waive</Button>
      </>}
    </div>
  );
}

export default function FinancialAid() {
  const s = useLoad(() => financialAid({ action: 'get' }));
  const [f, setF] = useState(blank);
  const [who, setWho] = useState('');
  return (
    <>
      <PageHeader eyebrow="You" title="Financial aid checklist" sub="Requirements from your financial aid office, with links to the official source. Never upload aid or tax documents here; the aid office verifies items in its own system." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          <Panel title="Your requirements">
            {!d.mine.length ? <Empty>No aid requirements for you right now.</Empty> : d.mine.map((r: any) => (
              <div key={r.id} className="border-t border-border py-3 text-sm first:border-0">
                <p className="flex flex-wrap items-center gap-2"><Status value={r.overdue ? 'overdue' : WORD[r.state]} /> <span className="font-medium">{r.title}</span> · {r.term} · due {fmtDay(r.dueOn)}</p>
                <p className="mt-1 text-muted-foreground">{r.instructions} <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Official source</a></p>
                {r.note && <p className="mt-1">Aid office: {r.note}</p>}
                {['todo', 'needs_action'].includes(r.state) && <Button className="mt-2" size="sm" variant="outline" onClick={() => run({ action: 'mark', id: r.id, done: true }, 'Marked done. The aid office will verify it.', s.reload)}>I've done this</Button>}
                {r.state === 'marked_done' && <Button className="mt-2" size="sm" variant="ghost" onClick={() => run({ action: 'mark', id: r.id, done: false }, 'Unmarked.', s.reload)}>Not done yet</Button>}
              </div>))}
          </Panel>
          {d.staff && <>
            <Panel title="Requirements and review">
              {!d.requirements.length ? <Empty>No requirements published.</Empty> : d.requirements.map((r: any) => (
                <div key={r.id} className="border-t border-border py-3 first:border-0">
                  <p className="text-sm font-medium">{r.title} · {r.term} · due {fmtDay(r.dueOn)} <span className="font-normal text-muted-foreground">· {r.audience === 'all_students' ? 'all students' : 'selected students'}</span></p>
                  <p className="text-xs text-muted-foreground">{r.counts.todo} to do · {r.counts.marked} marked done · {r.counts.needs} need action · {r.counts.verified} verified · {r.counts.waived} waived</p>
                  {r.toReview.map((row: any) => <Review key={row.studentId} r={r} row={row} reload={s.reload} />)}
                </div>))}
            </Panel>
            <Panel title="Publish a requirement">
              <div className="grid gap-2 md:grid-cols-3">
                <Input aria-label="Term" placeholder="Term" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
                <Input aria-label="Title" placeholder="Title, e.g. Complete the FAFSA" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                <Input aria-label="Due date" type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
              </div>
              <Textarea aria-label="Instructions" className="mt-2" rows={2} placeholder="What the student must do (no documents are collected here)" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <Input aria-label="Official source link" placeholder="https:// official source" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
                <select aria-label="Who it applies to" className={sel} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all_students">All students</option><option value="selected">Selected students</option></select>
                {f.audience === 'selected' && <select aria-label="Students" multiple className={`${sel} h-24`} value={f.students} onChange={(e) => setF({ ...f, students: Array.from(e.target.selectedOptions).map((o) => o.value) })}>{d.students.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
              </div>
              <Button className="mt-2" size="sm" disabled={f.title.trim().length < 3 || f.instructions.trim().length < 10 || !/^https:\/\//.test(f.sourceUrl) || !f.dueOn || f.term.trim().length < 3}
                onClick={() => run({ action: 'publish', id: crypto.randomUUID(), ...f }, 'Published. Students were notified.', () => { setF(blank); s.reload(); })}>Publish</Button>
            </Panel>
          </>}
          {d.isAdmin && <Panel title="Financial aid office staff">
            <ul className="text-sm">{d.staffList.map((m: any) => <li key={m.id} className="flex items-center justify-between py-1">{m.name}<Button size="sm" variant="ghost" onClick={() => run({ action: 'setStaff', userId: m.id, on: false }, 'Removed.', s.reload)}>Remove</Button></li>)}</ul>
            {!d.staffList.length && <Empty>No aid-office staff yet.</Empty>}
            <div className="mt-2 flex gap-2">
              <select aria-label="Member" className={sel} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose a member…</option>{d.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <Button size="sm" disabled={!who} onClick={() => run({ action: 'setStaff', userId: who, on: true }, 'Added.', () => { setWho(''); s.reload(); })}>Add</Button>
            </div>
          </Panel>}
        </div>)}
      </Loadable>
      <div className="mt-4"><AidOffice /></div>
    </>
  );
}
