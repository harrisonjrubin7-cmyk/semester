import { useState } from 'react';
import { toast } from 'sonner';
import { community } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await community(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };

function Appeal({ r, reload }: { r: any; reload: () => void }) {
  const [text, setText] = useState('');
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Appeal" rows={2} placeholder="Why should this change? (20+ characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" disabled={text.trim().length < 20} onClick={() => run({ action: 'appeal', reportId: r.id, text }, 'Appeal sent. A moderator who was not involved will review it.', reload)}>Appeal</Button>
    </div>
  );
}

function Decide({ r, reload }: { r: any; reload: () => void }) {
  const [note, setNote] = useState('');
  if (r.involved) return <p className="mt-1 text-xs text-muted-foreground">You're involved in this report, so another moderator decides it.</p>;
  if (r.state === 'appealed') return (
    <div className="mt-2 space-y-2">
      <p className="text-sm">Appeal: {r.appealText}</p>
      <Input aria-label="Outcome note" placeholder="Explain the outcome to the author (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={note.trim().length < 10} onClick={() => run({ action: 'reviewAppeal', reportId: r.id, outcome: 'overturned', note }, 'Overturned. The post is visible again.', reload)}>Overturn</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'reviewAppeal', reportId: r.id, outcome: 'upheld', note }, 'Decision upheld.', reload)}>Uphold</Button>
      </div>
    </div>
  );
  return (
    <div className="mt-2 space-y-2">
      <Input aria-label="Guideline" placeholder="Which guideline applies and why (needed to hide or remove)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => run({ action: 'decide', reportId: r.id, decision: 'no_action', policy: note }, 'No action taken.', reload)}>No action</Button>
        <Button size="sm" disabled={note.trim().length < 10} onClick={() => run({ action: 'decide', reportId: r.id, decision: 'hide', policy: note }, 'Hidden. The author was told and can appeal.', reload)}>Hide</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'decide', reportId: r.id, decision: 'remove', policy: note }, 'Removed from view. The author can appeal.', reload)}>Remove</Button>
      </div>
    </div>
  );
}

function Context({ c }: { c: any }) {
  if (!c) return null;
  const k = c.counts;
  return (
    <div className="mt-2 rounded-[3px] border border-border p-2 text-xs">
      <p className="font-medium">Context (moderators only)</p>
      <p className="text-muted-foreground">Author: {k.authorDecisions12m} earlier hide/remove in 12 months · {k.authorActiveWarnings} active warnings. Reporter: {k.reporterReports90d} reports in 90 days, {k.reporterUpheld90d} upheld, {k.reporterTargetsAuthor} about this author. Reports on this post: {k.reportsOnThisPost}.</p>
      {c.around?.length > 0 && <ul className="mt-1 space-y-1">{c.around.map((m: any, i: number) => <li key={i} className={m.reported ? 'font-medium' : 'text-muted-foreground'}>{m.reported ? '▶ ' : ''}{m.author} · {fmt(m.at)}: {m.body}</li>)}</ul>}
    </div>
  );
}

function Warn({ r, reload }: { r: any; reload: () => void }) {
  const [open, setOpen] = useState(false); const [g, setG] = useState(''); const [m, setM] = useState(''); const [days, setDays] = useState('30');
  if (r.involved) return null;
  if (!open) return <button className="mt-1 text-xs underline" onClick={() => setOpen(true)}>Send a warning instead of (or as well as) a decision</button>;
  return (
    <div className="mt-2 space-y-2 rounded-[3px] border border-border p-2">
      <Input aria-label="Guideline" placeholder="Guideline (10+ characters)" value={g} onChange={(e) => setG(e.target.value)} />
      <Textarea aria-label="Message to the author" rows={2} placeholder="Message the author sees (10+ characters)" value={m} onChange={(e) => setM(e.target.value)} />
      <div className="flex items-center gap-2 text-xs"><label htmlFor={`wd-${r.id}`}>Expires after</label><Input id={`wd-${r.id}`} className="h-8 w-20" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /> days (7–180)
        <Button size="sm" disabled={g.trim().length < 10 || m.trim().length < 10} onClick={async () => { if (await run({ action: 'warn', reportId: r.id, guideline: g, message: m, days: Number(days) }, 'Warning sent. Nothing was hidden.', reload)) setOpen(false); }}>Send warning</Button></div>
    </div>
  );
}

function Reverse({ r, reload }: { r: any; reload: () => void }) {
  const [why, setWhy] = useState('');
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      <Input aria-label="Reason to reverse" className="h-8 flex-1" placeholder="Why it should be reversed (20+ characters; the author sees this)" value={why} onChange={(e) => setWhy(e.target.value)} />
      <Button size="sm" variant="outline" disabled={why.trim().length < 20} onClick={() => run({ action: 'reverse', reportId: r.id, reason: why }, 'Reversed. The post is visible again.', reload)}>Reverse</Button>
    </div>
  );
}

function WithdrawWarning({ w, reload }: { w: any; reload: () => void }) {
  const [why, setWhy] = useState('');
  if (w.mine) return null;
  return <span className="flex gap-1"><Input aria-label="Reason to withdraw" className="h-7 w-48" placeholder="Reason (10+)" value={why} onChange={(e) => setWhy(e.target.value)} /><Button size="sm" variant="ghost" disabled={why.trim().length < 10} onClick={() => run({ action: 'withdrawWarning', id: w.id, reason: why }, 'Warning withdrawn.', reload)}>Withdraw</Button></span>;
}

export default function Moderation() {
  const s = useLoad(() => community({ action: 'moderation' }));
  const [who, setWho] = useState('');
  return (
    <Loadable state={s}>{(d: any) => (!d.myDecisions.length && !d.myWarnings?.length && !d.isMod && !d.isAdmin) ? null : (
      <div className="mt-6 space-y-4">
        {d.myDecisions.length > 0 && <Panel title="Moderation decisions on your posts">
          {d.myDecisions.map((r: any) => (
            <div key={r.id} className="border-t border-border py-2 text-sm first:border-0">
              <p className="flex items-center gap-2"><Status value={r.appealOutcome ? `appeal ${r.appealOutcome}` : r.decision} /> “{r.excerpt}”</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmt(r.decidedAt)} · {r.policy}{r.appealNote ? ` · Appeal: ${r.appealNote}` : ''}</p>
              {r.canAppeal && <Appeal r={r} reload={s.reload} />}
            </div>))}
        </Panel>}
        {d.myWarnings?.length > 0 && <Panel title="Warnings sent to you">
          {d.myWarnings.map((w: any) => <div key={w.id} className="border-t border-border py-2 text-sm first:border-0"><p>{w.message}</p><p className="text-xs text-muted-foreground">{w.guideline} · {w.withdrawn ? `withdrawn: ${w.withdrawnReason}` : w.active ? `expires ${fmt(w.expiresAt)}` : 'expired'}</p></div>)}
          <p className="mt-1 text-xs text-muted-foreground">Warnings don't change your account, memberships or record.</p>
        </Panel>}
        {d.isMod && <Panel title={`Moderation queue · ${d.queue.length}`}>
          {!d.queue.length ? <Empty>Nothing to review.</Empty> : d.queue.map((r: any) => (
            <div key={r.id} className="border-t border-border py-3 text-sm first:border-0">
              <p className="flex flex-wrap items-center gap-2"><Status value={r.state} /> #{r.number} · by {r.author} · reported by {r.reporter} · {fmt(r.createdAt)}</p>
              <p className="mt-1">“{r.excerpt}”</p>
              <p className="mt-1 text-xs text-muted-foreground">Reason: {r.reason}{r.decision ? ` · First decision: ${r.decision} (${r.policy})` : ''}</p>
              <Context c={r.context} />
              <Decide r={r} reload={s.reload} />
              {r.state === 'open' && <Warn r={r} reload={s.reload} />}
            </div>))}
          <p className="mt-2 text-xs text-muted-foreground">Moderation hides or removes posts from view. It never changes anyone's account or membership, and it is not discipline.</p>
        </Panel>}
        {d.isMod && d.reversible?.length > 0 && <Panel title="Recent decisions you can reverse (30 days)">
          {d.reversible.map((r: any) => <div key={r.id} className="border-t border-border py-2 text-sm first:border-0"><p><Status value={r.decision} /> #{r.number} · by {r.author} · {fmt(r.decidedAt)}</p><p className="mt-1">“{r.excerpt}”</p><p className="text-xs text-muted-foreground">{r.policy}</p><Reverse r={r} reload={s.reload} /></div>)}
          <p className="mt-1 text-xs text-muted-foreground">Only moderators who were not involved see these. A reversal is final.</p>
        </Panel>}
        {d.isMod && d.warnings?.length > 0 && <Panel title={`Active warnings · ${d.warnings.length}`}>
          {d.warnings.map((w: any) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0"><span>{w.author} · {w.guideline} · expires {fmt(w.expiresAt)}</span><WithdrawWarning w={w} reload={s.reload} /></div>)}
        </Panel>}
        {d.isAdmin && <Panel title="Moderators">
          <ul className="text-sm">{d.moderators.map((m: any) => <li key={m.id} className="flex items-center justify-between py-1">{m.name}<Button size="sm" variant="ghost" onClick={() => run({ action: 'setModerator', userId: m.id, on: false }, 'Removed.', s.reload)}>Remove</Button></li>)}</ul>
          {!d.moderators.length && <Empty>No moderators yet. Appeals need at least two.</Empty>}
          <div className="mt-2 flex gap-2">
            <select aria-label="Member" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose a member…</option>{d.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <Button size="sm" disabled={!who} onClick={() => run({ action: 'setModerator', userId: who, on: true }, 'Appointed.', s.reload)}>Appoint</Button>
          </div>
        </Panel>}
      </div>)}
    </Loadable>
  );
}
