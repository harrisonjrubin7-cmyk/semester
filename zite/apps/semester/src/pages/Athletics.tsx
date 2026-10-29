import { useState } from 'react';
import { toast } from 'sonner';
import { athletics } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Rule = { kind: string; value: number };
type RuleSet = { id: number; version: number; rules: Rule[]; hash: string; note: string; state: string; mine: boolean; author: string | null; approver: string | null; approvedAt: string | null; rev: number };
type Line = { studentId: string; name: string | null; facts: { term_credits: number; completed_credits: number; cumulative_gpa: number | null }; results: { kind: string; required: number; actual: number | null; pass: boolean }[];
  passes: boolean; outcome: string | null; exceptionReason: string | null; exceptionRef: string | null; exceptionBy: string | null; exceptionByMe: boolean; exceptionApprovedBy: string | null };
type Review = { id: number; teamId: number; team: string; term: string; rulesVersion: number; state: string; openedBy: string | null; openedByMe: boolean; certifiedBy: string | null; certifiedAt: string | null; note: string; rev: number; lines: Line[] };
type Mine = { team: string; sport: string; term: string; rulesVersion: number; certifiedAt: string | null; outcome: string; facts: Line['facts']; results: Line['results']; exceptionRef: string | null };
type Data = { athleteView: boolean; mine: Mine[]; officer: boolean; isAdmin: boolean; kinds: readonly string[]; officers: (string | null)[]; rules: RuleSet[]; teams: { id: number; name: string; sport: string; roster: { id: string; name: string | null }[] }[]; reviews: Review[] };

const LABEL: Record<string, string> = { min_term_credits: 'Minimum credits this term', min_cumulative_gpa: 'Minimum cumulative GPA (4.0 scale)', min_completed_credits: 'Minimum completed credits' };
const call = async (input: Record<string, unknown>, ok: string, reload: () => void) => { try { await athletics(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
const sel = 'h-8 rounded-md border bg-background px-2 text-sm';

function Rules({ d, reload }: { d: Data; reload: () => void }) {
  const live = d.rules.find((r) => r.state === 'approved'); const draft = d.rules.find((r) => r.state === 'draft');
  const [rules, setRules] = useState<Rule[]>(draft?.rules ?? live?.rules ?? [{ kind: 'min_term_credits', value: 12 }]); const [note, setNote] = useState(draft?.note ?? '');
  return (
    <Panel title="Eligibility rules">
      <p className="mb-2 text-xs text-muted-foreground">These are your institution's own rules. Semester does not supply any athletic association's thresholds.</p>
      {live ? <div className="text-sm"><p className="font-medium">In force: version {live.version} <span className="text-xs text-muted-foreground">approved by {live.approver} {fmt(live.approvedAt)}</span></p>
        <ul className="ml-4 list-disc">{live.rules.map((r) => <li key={r.kind}>{LABEL[r.kind]}: {r.value}</li>)}</ul></div> : <Empty>No approved rules yet.</Empty>}
      {d.officer && <div className="mt-3 space-y-2"><p className="text-sm font-medium">{draft ? `Draft version ${draft.version} by ${draft.mine ? 'you' : draft.author}` : 'New version'}</p>
        {rules.map((r, i) => <div key={i} className="flex flex-wrap items-center gap-2">
          <select aria-label={`Rule ${i + 1}`} className={sel} value={r.kind} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>{d.kinds.map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select>
          <Input aria-label={`Value for rule ${i + 1}`} type="number" step="0.1" className="h-8 w-24" value={r.value} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)))} />
          <Button size="sm" variant="ghost" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}>×</Button></div>)}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setRules([...rules, { kind: d.kinds.find((k) => !rules.some((r) => r.kind === k)) ?? d.kinds[0], value: 0 }])}>Add rule</Button>
          <Input aria-label="Source of these rules" className="h-8 w-72" placeholder="Source (policy document, date)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => call(draft ? { action: 'rules', step: 'edit', id: draft.id, expectedVersion: draft.rev, rules, note } : { action: 'rules', step: 'draft', id: null, expectedVersion: null, rules, note }, 'Draft saved; another officer approves it', reload)}>Save draft</Button>
          {draft && !draft.mine && <Button size="sm" onClick={() => call({ action: 'rules', step: 'approve', id: draft.id, expectedVersion: draft.rev, seen: draft.hash }, 'Rules approved and in force', reload)}>Approve version {draft.version}</Button>}</div></div>}
    </Panel>
  );
}

function Teams({ d, reload }: { d: Data; reload: () => void }) {
  const [t, setT] = useState({ name: '', sport: '' }); const [email, setEmail] = useState<Record<number, string>>({}); const [term, setTerm] = useState<Record<number, string>>({});
  return (
    <Panel title="Teams and rosters">
      {d.teams.length === 0 ? <Empty>No teams yet.</Empty> : d.teams.map((tm) => (
        <div key={tm.id} className="border-b border-border py-2 text-sm last:border-0">
          <p className="font-medium">{tm.name} <span className="text-xs text-muted-foreground">{tm.sport} · {tm.roster.length} athletes</span></p>
          <p className="text-xs">{tm.roster.map((r) => <span key={r.id} className="mr-2">{r.name}{d.officer && <button className="ml-1 text-muted-foreground hover:underline" aria-label={`Remove ${r.name}`} onClick={() => call({ action: 'team', step: 'remove', teamId: tm.id, studentId: r.id }, 'Removed from roster', reload)}>×</button>}</span>)}</p>
          {d.officer && <div className="mt-1 flex flex-wrap gap-2">
            <Input aria-label={`Add athlete to ${tm.name}`} className="h-8 w-60" placeholder="Student's email" value={email[tm.id] ?? ''} onChange={(e) => setEmail({ ...email, [tm.id]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => call({ action: 'team', step: 'add', teamId: tm.id, email: email[tm.id] }, 'Added to roster', reload)}>Add</Button>
            <Input aria-label={`Review term for ${tm.name}`} className="h-8 w-32" placeholder="Term, e.g. Fall 2026" value={term[tm.id] ?? ''} onChange={(e) => setTerm({ ...term, [tm.id]: e.target.value })} />
            <Button size="sm" disabled={(term[tm.id] ?? '').trim().length < 3 || !tm.roster.length} onClick={() => call({ action: 'openReview', teamId: tm.id, term: term[tm.id] }, 'Roster review opened', reload)}>Open roster review</Button></div>}
        </div>))}
      {d.officer && <div className="mt-3 flex flex-wrap items-end gap-2"><div><Label htmlFor="tm-name">Team</Label><Input id="tm-name" className="h-8" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
        <div><Label htmlFor="tm-sport">Sport</Label><Input id="tm-sport" className="h-8" value={t.sport} onChange={(e) => setT({ ...t, sport: e.target.value })} /></div>
        <Button size="sm" onClick={async () => { if (await call({ action: 'team', step: 'create', teamId: null, ...t }, 'Team created', reload)) setT({ name: '', sport: '' }); }}>Add team</Button></div>}
    </Panel>
  );
}

function LineRow({ r, l, d, reload }: { r: Review; l: Line; d: Data; reload: () => void }) {
  const [reason, setReason] = useState(l.exceptionReason ?? ''); const [ref, setRef] = useState(l.exceptionRef ?? '');
  const open = r.state === 'open' && d.officer;
  return (
    <tr className="border-t align-top">
      <td className="py-1 font-medium">{l.name}</td>
      <td>{l.results.map((x) => <p key={x.kind} className="text-xs">{x.pass ? '✓' : '✕'} {LABEL[x.kind]}: {x.actual ?? 'none'} (needs {x.required})</p>)}</td>
      <td className="text-xs">{l.outcome ? <Status value={l.outcome} /> : 'undecided'}{l.exceptionBy && <p>Exception asked by {l.exceptionBy}: {l.exceptionReason} ({l.exceptionRef}){l.exceptionApprovedBy ? `, approved by ${l.exceptionApprovedBy}` : ''}</p>}</td>
      <td>{open && <div className="flex flex-wrap gap-1">
        {l.passes && <Button size="sm" variant="outline" onClick={() => call({ action: 'line', step: 'eligible', reviewId: r.id, studentId: l.studentId }, 'Marked eligible', reload)}>Eligible</Button>}
        <Button size="sm" variant="outline" onClick={() => call({ action: 'line', step: 'ineligible', reviewId: r.id, studentId: l.studentId }, 'Marked ineligible', reload)}>Ineligible</Button>
        {!l.passes && !l.exceptionBy && <><Input aria-label={`Exception reason for ${l.name}`} className="h-8 w-56" placeholder="Exception reason (30+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input aria-label={`Waiver reference for ${l.name}`} className="h-8 w-32" placeholder="Reference" value={ref} onChange={(e) => setRef(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => call({ action: 'line', step: 'request_exception', reviewId: r.id, studentId: l.studentId, reason, reference: ref }, 'Exception requested; another officer approves it', reload)}>Request exception</Button></>}
        {l.exceptionBy && !l.exceptionApprovedBy && !l.exceptionByMe && <Button size="sm" onClick={() => call({ action: 'line', step: 'approve_exception', reviewId: r.id, studentId: l.studentId }, 'Exception approved', reload)}>Approve exception</Button>}
      </div>}</td>
    </tr>
  );
}

function Reviews({ d, reload }: { d: Data; reload: () => void }) {
  const [note, setNote] = useState('');
  return (
    <Panel title="Roster reviews and certifications">
      {d.reviews.length === 0 ? <Empty>No roster reviews yet.</Empty> : d.reviews.map((r) => {
        const undecided = r.lines.filter((l) => !l.outcome).length;
        return (
          <div key={r.id} className="border-b border-border py-3 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{r.team} · {r.term} <span className="text-xs text-muted-foreground">rules v{r.rulesVersion} · opened by {r.openedByMe ? 'you' : r.openedBy}</span></p><Status value={r.state} /></div>
            <table className="mt-1 w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th>Athlete</th><th>Rules</th><th>Outcome</th><th></th></tr></thead>
              <tbody>{r.lines.map((l) => <LineRow key={`${l.studentId}-${r.rev}`} r={r} l={l} d={d} reload={reload} />)}</tbody></table>
            {r.state === 'certified' ? <p className="mt-1 text-xs">Certified by {r.certifiedBy} {fmt(r.certifiedAt)}{r.note ? ` — ${r.note}` : ''}. Certified reviews cannot change.</p>
              : r.openedByMe ? <p className="mt-1 text-xs text-muted-foreground">You opened this review, so another officer or an administrator certifies it.</p>
                : <div className="mt-2 flex flex-wrap items-center gap-2"><Input aria-label="Certification note" className="h-8 w-72" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button size="sm" disabled={undecided > 0} onClick={() => call({ action: 'certify', reviewId: r.id, expectedVersion: r.rev, note }, 'Review certified', reload)}>Certify review</Button>
                  {undecided > 0 && <span className="text-xs text-muted-foreground">{undecided} athlete(s) still need a decision</span>}</div>}
          </div>);
      })}
    </Panel>
  );
}

function Officers({ d, reload }: { d: Data; reload: () => void }) {
  const [email, setEmail] = useState('');
  if (!d.isAdmin) return null;
  return (
    <Panel title="Administrator: compliance officers">
      <p className="text-sm">{d.officers.filter(Boolean).join(', ') || 'No officers yet. Appoint two so rules, exceptions and certifications can be checked by a second person.'}</p>
      <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Officer's email" className="h-8 w-64" placeholder="Member's email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" onClick={() => call({ action: 'setOfficer', email, on: true }, 'Officer appointed', reload)}>Appoint</Button>
        <Button size="sm" variant="ghost" onClick={() => call({ action: 'setOfficer', email, on: false }, 'Officer removed', reload)}>Remove</Button></div>
    </Panel>
  );
}

function MyEligibility({ d }: { d: Data }) {
  return (
    <Panel title="Your eligibility">
      {d.mine.length === 0 ? <Empty>No certified eligibility review includes you. If you are on a team, your result appears here once the compliance office certifies the term review.</Empty> : d.mine.map((m, i) => (
        <div key={i} className="border-b border-border py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{m.team} · {m.term}</p><Status value={m.outcome === 'exception' ? 'eligible (exception)' : m.outcome} /></div>
          {m.results.map((x) => <p key={x.kind} className="text-xs">{x.pass ? '✓' : '✕'} {LABEL[x.kind]}: {x.actual ?? 'none'} (needs {x.required})</p>)}
          <p className="text-xs text-muted-foreground">Rules version {m.rulesVersion} · certified {fmt(m.certifiedAt)}{m.exceptionRef ? ` · exception ${m.exceptionRef}` : ''}. Questions go to your athletics compliance office.</p>
        </div>))}
    </Panel>
  );
}

export default function Athletics() {
  const s = useLoad(() => athletics({ action: 'get' }) as Promise<Data>);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Athletics compliance" title="Eligibility" sub="Your institution's eligibility rules, team rosters, term reviews from official records, exceptions and certification." />
      <Loadable state={s}>{(d: Data) => d.athleteView ? <MyEligibility d={d} /> : (<>
        <Rules d={d} reload={s.reload} />
        <Teams d={d} reload={s.reload} />
        <Reviews d={d} reload={s.reload} />
        <Officers d={d} reload={s.reload} />
      </>)}</Loadable>
    </div>
  );
}
