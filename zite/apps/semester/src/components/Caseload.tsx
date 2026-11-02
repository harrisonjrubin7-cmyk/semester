import { useState } from 'react';
import { toast } from 'sonner';
import { help } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Panel, Empty, Status, errMsg, ActionPreview } from './kit';

type Case = { id: string; title: string; category: string; status: string; reference: string; student: string; notes: string; reviews: number; mine: boolean };
type Mate = { id: string; name: string; roles: string[] };

function Refer({ c, team, done }: { c: Case; team: Mate[]; done: () => void }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const who = team.find((t) => t.id === to);
  const send = async () => {
    setBusy(true);
    try {
      await help({ action: 'refer', id: c.id, toUserId: to, note });
      toast.success(`Referred to ${who?.name}`); setOpen(false); setTo(''); setNote(''); done();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Refer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Refer {c.reference}</DialogTitle></DialogHeader>
        {team.length === 0 ? <Empty>No other advisors or staff are active in your institution.</Empty> : (
          <div className="space-y-3">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Choose a colleague" /></SelectTrigger>
              <SelectContent>{team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.roles.join(', ')}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hand-off: where things stand and what's next (at least 20 characters)" />
            {who && <ActionPreview says={`${who.name} becomes the case owner and gets an in-app notice.`} exactly="The case title, reference and your hand-off note. Not the student's grades or private notes." stays="The decision trail keeps your name and this note." recovery={{ kind: 'request', how: `ask ${who.name} to refer it back` }} />}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep it</Button>
          <Button disabled={!to || note.trim().length < 20 || busy} onClick={send}>{busy ? 'Referring…' : 'Refer case'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STANDING: [string, string][] = [['on_track', 'On track'], ['needs_support', 'Needs support'], ['at_risk', 'At risk']];
const OUTCOME: [string, string][] = [['goals_met', 'Goals met'], ['referred_out', 'Referred to another office'], ['student_withdrew', 'Student withdrew'], ['no_response', 'No response after outreach']];

function TermReview({ c, done }: { c: Case; done: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ term: '', standing: 'on_track', steps: '', share: true });
  const go = async () => {
    try { await help({ action: 'termReview', id: c.id, term: f.term, standing: f.standing as never, steps: f.steps.split('\n'), shareWithStudent: f.share }); toast.success('Term review recorded'); setOpen(false); done(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Term review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Term review · {c.reference}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input aria-label="Term" className="w-full rounded-[3px] border border-input bg-background p-2 text-sm" placeholder="Term, e.g. Fall 2026" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
          <Select value={f.standing} onValueChange={(v) => setF({ ...f, standing: v })}><SelectTrigger aria-label="Standing"><SelectValue /></SelectTrigger>
            <SelectContent>{STANDING.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          <Textarea rows={3} aria-label="Next steps" placeholder="Agreed next steps, one per line" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.share} onChange={(e) => setF({ ...f, share: e.target.checked })} />Send the student their standing and next steps</label>
          <p className="text-xs text-muted-foreground">Your case notes stay with advising staff. The student only ever gets the standing and next steps, and only if you send them.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={go}>Record review</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseCase({ c, done }: { c: Case; done: () => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('goals_met');
  const [summary, setSummary] = useState('');
  const go = async () => {
    try { await help({ action: 'close', id: c.id, outcome: outcome as never, summary }); toast.success('Case closed'); setOpen(false); done(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Close</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Close {c.reference}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={outcome} onValueChange={setOutcome}><SelectTrigger aria-label="Outcome"><SelectValue /></SelectTrigger>
            <SelectContent>{OUTCOME.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          {outcome === 'goals_met' && c.reviews === 0 && <p role="status" className="text-xs">Record a term review first: "goals met" needs one on record.</p>}
          <Textarea rows={3} aria-label="Closing summary" placeholder="Closing summary someone could pick up from (20+ characters)" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Keep open</Button><Button disabled={summary.trim().length < 20} onClick={go}>Close case</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Caseload({ cases, team, reload }: { cases: Case[]; team: Mate[]; reload: () => void }) {
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const mine = cases.filter((c) => c.mine);
  const open = cases.filter((c) => !c.mine);
  const row = (c: Case) => (
    <div key={c.id} className="border-b border-border py-2 text-sm last:border-0">
      <div className="flex justify-between gap-2"><span>{c.title} · {c.student}</span><Status value={c.status} /></div>
      <p className="font-mono text-xs text-muted-foreground">{c.reference} · {c.category}</p>
      {c.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{c.notes}</p>}
      <div className="mt-1 flex gap-2">
        {c.mine ? <>
          <Refer c={c} team={team} done={reload} />
          <TermReview c={c} done={reload} />
          <CloseCase c={c} done={reload} />
        </> : <Button size="sm" variant="outline" onClick={() => act(() => help({ action: 'claim', id: c.id }), 'Claimed. It is in your caseload.')}>Claim</Button>}
      </div>
    </div>
  );
  return (
    <Panel title={`Caseload · ${mine.length} yours · ${open.length} unassigned`}>
      <p className="mb-3 text-xs text-muted-foreground">Can see: cases assigned to you and unclaimed cases · Can approve: overrides (not your own) · Cannot: change grades or release holds alone · Every action is logged</p>
      {mine.length === 0 ? <Empty>Nothing assigned to you.</Empty> : mine.map(row)}
      {open.length > 0 && <><p className="mt-4 text-xs tracking-widest text-muted-foreground">UNASSIGNED</p>{open.map(row)}</>}
    </Panel>
  );
}
