import { useState } from 'react';
import { toast } from 'sonner';
import { graduate } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Status, fmt, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await graduate(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const KIND: Record<string, string> = { program_plan: 'Program plan', proposal: 'Proposal', qualifying_exam: 'Qualifying exam', prospectus: 'Prospectus', full_draft: 'Full draft', defense: 'Defense', final_submission: 'Final submission' };
const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';

function Submit({ m, reload }: { m: any; reload: () => void }) {
  const [summary, setSummary] = useState(''); const [link, setLink] = useState(''); const [at, setAt] = useState('');
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="What you are submitting" rows={2} placeholder="What you are submitting and what changed" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Document link" className="max-w-sm" placeholder="https:// link to the document" value={link} onChange={(e) => setLink(e.target.value)} />
        {m.kind === 'defense' && <Input aria-label="Proposed defense date" type="datetime-local" className="max-w-xs" value={at} onChange={(e) => setAt(e.target.value)} />}
        <Button size="sm" disabled={summary.trim().length < 10} onClick={() => run({ action: 'submit', id: m.id, summary, link: link.trim() || null, scheduledAt: at ? new Date(at).toISOString() : null }, 'Submitted to your committee.', reload)}>Submit version {m.version + 1}</Button>
      </div>
    </div>
  );
}

function Review({ m, reload }: { m: any; reload: () => void }) {
  const [note, setNote] = useState('');
  if (m.reviewed) return <p className="mt-1 text-xs text-muted-foreground">You reviewed version {m.version}.</p>;
  if (m.state !== 'under_review') return null;
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Review note" rows={2} placeholder="Your review for the student (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={note.trim().length < 10} onClick={() => run({ action: 'review', id: m.id, version: m.version, decision: 'approve', note }, 'Approved.', reload)}>Approve</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'review', id: m.id, version: m.version, decision: 'revise', note }, 'Revisions requested.', reload)}>Request revisions</Button>
      </div>
    </div>
  );
}

export default function Graduate() {
  const s = useLoad(() => graduate({ action: 'get' }));
  const [who, setWho] = useState(''); const [role, setRole] = useState<'chair' | 'member'>('member');
  const [kind, setKind] = useState('proposal'); const [title, setTitle] = useState(''); const [due, setDue] = useState('');
  const [fk, setFk] = useState('assistantship'); const [src, setSrc] = useState(''); const [term, setTerm] = useState(''); const [hrs, setHrs] = useState('');
  return (
    <>
      <PageHeader eyebrow="Progress" title="Graduate milestones" sub="Your committee, milestones and reviews. Committee members see only your milestones, and only after they accept." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          {(d.invitations.length > 0 || d.toReview.length > 0) && <Panel title="Committee work">
            {d.invitations.map((i: any) => (
              <div key={i.studentId} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
                <span>{i.student} invited you as {i.role}</span>
                <span className="flex gap-2"><Button size="sm" onClick={() => run({ action: 'respond', studentId: i.studentId, accept: true }, 'Accepted.', s.reload)}>Accept</Button><Button size="sm" variant="ghost" onClick={() => run({ action: 'respond', studentId: i.studentId, accept: false }, 'Declined.', s.reload)}>Decline</Button></span>
              </div>))}
            {d.toReview.map((m: any) => (
              <div key={m.id} className="border-t border-border py-3 text-sm first:border-0">
                <p className="flex flex-wrap items-center gap-2"><Status value={m.state} /> {m.student} · {KIND[m.kind]}: {m.title} · v{m.version}{m.scheduledAt && ` · proposed ${fmt(m.scheduledAt)}`}</p>
                <p className="mt-1 text-muted-foreground">{m.summary}{m.link && <> · <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-primary underline">document</a></>}</p>
                <Review m={m} reload={s.reload} />
              </div>))}
          </Panel>}
          <Panel title="Your committee">
            {!d.committee.length ? <Empty>No committee yet. Invite a chair first; you can submit for review once your chair accepts.</Empty>
              : <ul className="text-sm">{d.committee.map((c: any) => <li key={c.id} className="flex items-center justify-between border-t border-border py-1.5 first:border-0"><span>{c.name} · {c.role} · <Status value={c.state} /></span>{c.state !== 'declined' && <Button size="sm" variant="ghost" onClick={() => run({ action: 'remove', memberId: c.id }, 'Removed.', s.reload)}>Remove</Button>}</li>)}</ul>}
            <div className="mt-3 flex flex-wrap gap-2">
              <select aria-label="Faculty member" className={sel} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose faculty…</option>{d.faculty.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <select aria-label="Role" className={sel} value={role} onChange={(e) => setRole(e.target.value as 'chair' | 'member')}><option value="member">Member</option><option value="chair">Chair</option></select>
              <Button size="sm" disabled={!who} onClick={() => run({ action: 'invite', memberId: who, role }, 'Invitation sent.', () => { setWho(''); s.reload(); })}>Invite</Button>
            </div>
          </Panel>
          <Panel title="Milestones">
            {!d.milestones.length ? <Empty>Add your first milestone below.</Empty> : d.milestones.map((m: any) => (
              <div key={m.id} className="border-t border-border py-3 text-sm first:border-0">
                <p className="flex flex-wrap items-center gap-2"><Status value={m.state} /> {KIND[m.kind]}: {m.title}{m.dueOn && ` · target ${fmtDay(m.dueOn)}`}{m.version > 0 && ` · v${m.version}`}{m.scheduledAt && ` · defense ${fmt(m.scheduledAt)}`}</p>
                {m.reviews.length > 0 && <ul className="mt-1 text-xs text-muted-foreground">{m.reviews.map((r: any, i: number) => <li key={i}>v{r.version} · {r.by}: {r.decision === 'approve' ? 'approved' : 'asked for revisions'} — {r.note}</li>)}</ul>}
                {['planned', 'revisions'].includes(m.state) && <Submit m={m} reload={s.reload} />}
              </div>))}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <select aria-label="Milestone type" className={sel} value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <Input aria-label="Title" className="max-w-xs" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input aria-label="Target date" type="date" className="max-w-[11rem]" value={due} onChange={(e) => setDue(e.target.value)} />
              <Button size="sm" disabled={title.trim().length < 3} onClick={() => run({ action: 'plan', id: crypto.randomUUID(), kind, title, dueOn: due || null }, 'Milestone added.', () => { setTitle(''); setDue(''); s.reload(); })}>Add</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">A version is approved when your chair approves it and no member asked for revisions on it. The defense opens once your full draft is approved. Official degree conferral stays with the registrar.</p>
          </Panel>
          <Panel title="Funding and assistantships (your notes)">
            <p className="text-xs text-muted-foreground">Only you see these. They help you plan; they are not your official aid or employment record.</p>
            <ul className="mt-2 text-sm">{d.funding.map((f: any) => <li key={f.id} className="flex items-center justify-between border-t border-border py-1.5 first:border-0"><span>{f.kind} · {f.source} · {f.term}{f.hours != null && ` · ${f.hours} h/week`}{f.note && <span className="text-muted-foreground"> · {f.note}</span>}</span><Button size="sm" variant="ghost" onClick={() => run({ action: 'removeFunding', id: f.id }, 'Removed.', s.reload)}>Remove</Button></li>)}</ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <select aria-label="Funding type" className={sel} value={fk} onChange={(e) => setFk(e.target.value)}>{['assistantship', 'fellowship', 'grant', 'other'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
              <Input aria-label="Source" className="max-w-[12rem]" placeholder="Source" value={src} onChange={(e) => setSrc(e.target.value)} />
              <Input aria-label="Term" className="max-w-[9rem]" placeholder="Term" value={term} onChange={(e) => setTerm(e.target.value)} />
              <Input aria-label="Hours per week" type="number" className="max-w-[8rem]" placeholder="Hours/week" value={hrs} onChange={(e) => setHrs(e.target.value)} />
              <Button size="sm" disabled={src.trim().length < 2 || term.trim().length < 2} onClick={() => run({ action: 'addFunding', id: crypto.randomUUID(), kind: fk, source: src, term, hours: hrs ? Number(hrs) : null, note: '' }, 'Saved.', () => { setSrc(''); setTerm(''); setHrs(''); s.reload(); })}>Add</Button>
            </div>
          </Panel>
        </div>)}
      </Loadable>
    </>
  );
}
