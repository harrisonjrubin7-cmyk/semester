import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { officialGrades as api } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, useLoad, Status, fmt, errMsg } from './kit';
import { policyProblems, scaleFromText, scaleToText, gradeList, DEFAULT_STANDING, type RepeatRule } from '../lib/transcriptRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const REPEAT: Record<RepeatRule, string> = { latest: 'The latest completed attempt counts', highest: 'The highest grade counts', all: 'Every attempt counts' };
const denied = (e: string | null) => !!e && /access|role|allow|registrar|Only/i.test(e);

/** Registrar: the institution's grading policy. One registrar proposes; a different registrar approves before transcripts use it. */
export default function GradingPolicyPanel() {
  const s = useLoad(() => api({ action: 'policy' } as never) as Promise<any>, []);
  const [edit, setEdit] = useState<{ scale: string; passing: string; noCredit: string; notAttempted: string; incomplete: string; repeat: RepeatRule; note: string; minGpa: string; honorsGpa: string; honorsCredits: string } | null>(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = useMemo(() => {
    if (!edit) return null;
    const { scale, problems } = scaleFromText(edit.scale);
    const policy = { scale, passing: gradeList(edit.passing), noCredit: gradeList(edit.noCredit), notAttempted: gradeList(edit.notAttempted), incomplete: gradeList(edit.incomplete), repeat: edit.repeat, standing: { minGpa: Number(edit.minGpa), honorsGpa: Number(edit.honorsGpa), honorsCredits: Number(edit.honorsCredits) } };
    return { policy, problems: [...problems, ...policyProblems({ ...policy, label: '', source: 'institution' })] };
  }, [edit]);
  const run = async (body: object, ok: string) => { setBusy(true); try { await api(body as never); toast(ok); setEdit(null); setWhy(''); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); } };

  if (s.error) return denied(s.error) ? null : <Panel title="Grading policy"><p className="text-sm">! {s.error}</p></Panel>;
  if (!s.data) return null;
  const d: any = s.data; const cur = d.current; const pending = d.history.find((h: any) => h.status === 'Proposed');
  const open = (p: any) => setEdit({ scale: scaleToText(p.scale), passing: p.passing.join(', '), noCredit: p.noCredit.join(', '), notAttempted: p.notAttempted.join(', '), incomplete: p.incomplete.join(', '), repeat: p.repeat, note: '', minGpa: String((p.standing ?? DEFAULT_STANDING).minGpa), honorsGpa: String((p.standing ?? DEFAULT_STANDING).honorsGpa), honorsCredits: String((p.standing ?? DEFAULT_STANDING).honorsCredits) });
  return (
    <Panel title="Grading policy" action={<Status value={cur.source === 'institution' ? `Version ${cur.version} in force` : 'Sample policy in force'} />}>
      <p className="text-xs text-muted-foreground">Transcripts and GPA use this policy. A change takes effect only after a second registrar approves it; every version is kept.</p>
      <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
        <div><p className="font-medium">{cur.label}</p>
          <p className="text-xs">{Object.entries(cur.scale).map(([g, v]: any) => `${g} ${Number(v).toFixed(1)}`).join(' · ')}</p></div>
        <ul className="text-xs"><li>Credit outside GPA: {cur.passing.join(', ') || 'none'}</li><li>No credit: {cur.noCredit.join(', ') || 'none'}</li>
          <li>Not attempted: {cur.notAttempted.join(', ') || 'none'}</li><li>Incomplete: {cur.incomplete.join(', ') || 'none'}</li><li>Repeats: {REPEAT[cur.repeat as RepeatRule]}</li><li>Good standing from GPA {(cur.standing ?? DEFAULT_STANDING).minGpa.toFixed(2)} · Dean’s list at {(cur.standing ?? DEFAULT_STANDING).honorsGpa.toFixed(2)} with {(cur.standing ?? DEFAULT_STANDING).honorsCredits} graded credits</li></ul>
      </div>

      {pending ? (
        <div className="mt-3 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">Version {pending.version} proposed by {pending.proposedBy} · {fmt(pending.proposedAt)}</p>
          <p className="text-xs">Based on: {pending.note}</p>
          <p className="mt-1 text-xs">{Object.entries(pending.policy.scale).map(([g, v]: any) => `${g} ${Number(v).toFixed(1)}`).join(' · ')} · Repeats: {REPEAT[pending.policy.repeat as RepeatRule]}</p>
          {pending.mine ? <p className="mt-2 text-xs">You proposed this; another registrar must approve or reject it.</p> : (
            <div className="mt-2 space-y-2">
              <Input aria-label="Decision note" placeholder="Note (required to reject)" value={why} onChange={(e) => setWhy(e.target.value)} />
              <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => run({ action: 'decidePolicy', id: pending.id, approve: true, note: why }, `Version ${pending.version} approved; transcripts use it now.`)}>Approve</Button>
                <Button size="sm" variant="outline" disabled={busy || why.trim().length < 10} onClick={() => run({ action: 'decidePolicy', id: pending.id, approve: false, note: why }, 'Proposal rejected.')}>Reject</Button></div>
            </div>)}
        </div>
      ) : !edit ? <Button size="sm" variant="outline" className="mt-3" onClick={() => open(cur)}>Propose a change</Button> : (
        <div className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
          <label className="text-xs sm:row-span-3">Scale, one grade per line<Textarea rows={12} className="mt-1 font-mono text-xs" aria-describedby="gp-problems" value={edit.scale} onChange={(e) => setEdit({ ...edit, scale: e.target.value })} /></label>
          <label className="text-xs">Credit outside GPA<Input value={edit.passing} onChange={(e) => setEdit({ ...edit, passing: e.target.value })} /></label>
          <label className="text-xs">No credit (attempted)<Input value={edit.noCredit} onChange={(e) => setEdit({ ...edit, noCredit: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Not attempted<Input value={edit.notAttempted} onChange={(e) => setEdit({ ...edit, notAttempted: e.target.value })} /></label>
            <label className="text-xs">Incomplete<Input value={edit.incomplete} onChange={(e) => setEdit({ ...edit, incomplete: e.target.value })} /></label>
          </div>
          <label className="text-xs sm:col-span-2">Repeated courses
            <select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm" value={edit.repeat} onChange={(e) => setEdit({ ...edit, repeat: e.target.value as RepeatRule })}>
              {(Object.keys(REPEAT) as RepeatRule[]).map((k) => <option key={k} value={k}>{REPEAT[k]}</option>)}</select></label>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <label className="text-xs">Good standing from GPA<Input inputMode="decimal" value={edit.minGpa} onChange={(e) => setEdit({ ...edit, minGpa: e.target.value })} /></label>
            <label className="text-xs">Dean’s list GPA<Input inputMode="decimal" value={edit.honorsGpa} onChange={(e) => setEdit({ ...edit, honorsGpa: e.target.value })} /></label>
            <label className="text-xs">Dean’s list credits<Input inputMode="numeric" value={edit.honorsCredits} onChange={(e) => setEdit({ ...edit, honorsCredits: e.target.value })} /></label>
          </div>
          <Input className="sm:col-span-2" aria-label="Source of this policy" placeholder="Based on (for example: 2026–27 catalog, Academic Regulations §4.2)" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          <div id="gp-problems" role="status" aria-live="polite" className="sm:col-span-2">{draft!.problems.length > 0 && <ul className="text-xs">{draft!.problems.map((p, i) => <li key={i}>! {p}</li>)}</ul>}</div>
          <div className="flex gap-2 sm:col-span-2"><Button size="sm" disabled={busy || draft!.problems.length > 0 || edit.note.trim().length < 10} onClick={() => run({ action: 'proposePolicy', policy: draft!.policy, note: edit.note, expectedVersion: cur.version }, 'Proposed. Another registrar must approve it.')}>Propose for approval</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>)}

      <p className="mt-3 text-sm font-medium">History</p>
      {!d.history.length ? <Empty>No institution policy yet. The sample policy applies.</Empty> : (
        <ul className="mt-1 space-y-1 text-xs">{d.history.map((h: any) => <li key={h.id}><Status value={h.status} /> Version {h.version} · proposed by {h.proposedBy} {fmt(h.proposedAt)}{h.decidedBy ? ` · ${h.status === 'Rejected' ? 'rejected' : 'approved'} by ${h.decidedBy} ${fmt(h.decidedAt)}` : ''}{h.decisionNote ? ` · ${h.decisionNote}` : ''}<span className="block text-muted-foreground">Based on: {h.note}</span></li>)}</ul>)}
    </Panel>
  );
}
