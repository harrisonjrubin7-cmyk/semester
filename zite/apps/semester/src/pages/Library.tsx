import { useState } from 'react';
import { toast } from 'sonner';
import { library } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmtDay } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `lib-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const RSTATE: Record<string, string> = { submitted: 'Submitted', license_review: 'Checking licence and accessibility', approved: 'Approved — being added', declined: 'Declined', published: 'Available in the catalog', withdrawn: 'Withdrawn' };
const RLABEL: Record<string, string> = { review: 'Start licence review', approve: 'Approve', decline: 'Decline', publish: 'Add to catalog', withdraw: 'Withdraw my request' };

function Catalog({ d, reload }: { d: any; reload: () => void }) {
  const [q, setQ] = useState('');
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const shown = d.items.filter((i: any) => !q || `${i.title} ${i.author}`.toLowerCase().includes(q.toLowerCase())).slice(0, 100);
  return (
    <>
      <Input aria-label="Search the catalog" placeholder="Search title or author" className="mb-2 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 ? <Empty>{d.items.length ? 'Nothing matches that search.' : 'The catalog is empty. Library staff add items, and you can request one below.'}</Empty> : (
        <ul>{shown.map((i: any) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
            <span><b>{i.title}</b>{i.author && ` · ${i.author}`}<span className="block text-xs text-muted-foreground">{i.kind === 'ebook' ? 'E-book' : 'Print'} · {i.free} of {i.copies} free{i.waiting ? ` · ${i.waiting} waiting` : ''}{!i.active ? ' · withdrawn' : ''}</span></span>
            <span className="flex gap-2">
              {i.mine ? <Status value="On loan to you" /> : i.held ? <Status value="On hold for you" /> : i.active && (i.free > 0 && !i.waiting
                ? <Button size="sm" onClick={() => act(() => library({ action: 'borrow', requestKey: key(), itemId: i.id }), i.kind === 'ebook' ? 'Borrowed — you have access now.' : 'Borrowed — collect it at the desk.')}>Borrow</Button>
                : <Button size="sm" variant="outline" onClick={() => act(() => library({ action: 'hold', itemId: i.id }), 'Hold placed. You will be told when it is ready.')}>Place hold</Button>)}
            </span>
          </li>))}</ul>)}
    </>
  );
}

function Mine({ d, reload }: { d: any; reload: () => void }) {
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  return (
    <div className="space-y-3">
      {d.myLoans.length === 0 && d.myHolds.length === 0 ? <Empty>Nothing on loan or on hold.</Empty> : null}
      {d.myLoans.length > 0 && <ul>{d.myLoans.map((l: any) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
          <span><b>{l.title}</b><span className="block text-xs text-muted-foreground">Due {fmtDay(l.dueAt)} · renewed {l.renewals} of 2{l.renewBlocked ? ` · ${l.renewBlocked}` : ''}</span></span>
          <span className="flex gap-2">{l.overdue && <Status value="Overdue" />}
            <Button size="sm" variant="outline" disabled={!!l.renewBlocked} onClick={() => act(() => library({ action: 'renew', loanId: l.id, expectedVersion: l.version }), 'Renewed.')}>Renew</Button>
            {l.kind === 'ebook' ? <Button size="sm" variant="ghost" onClick={() => act(() => library({ action: 'return', loanId: l.id, expectedVersion: l.version }), 'Returned.')}>Return</Button> : <span className="text-xs text-muted-foreground">Return at the desk</span>}</span>
        </li>))}</ul>}
      {d.myHolds.length > 0 && <ul>{d.myHolds.map((h: any) => (
        <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm">
          <span><b>{h.title}</b><span className="block text-xs text-muted-foreground">{h.state === 'ready' ? `Ready for you until ${fmtDay(h.readyUntil)}` : h.ahead ? `${h.ahead} ahead of you` : 'You are next'}</span></span>
          <span className="flex gap-2">{h.state === 'ready' && <Button size="sm" onClick={() => act(() => library({ action: 'borrow', requestKey: key(), itemId: h.itemId }), 'Borrowed.')}>Borrow now</Button>}
            <Button size="sm" variant="ghost" onClick={() => act(() => library({ action: 'cancelHold', holdId: h.id }), 'Hold cancelled.')}>Cancel hold</Button></span>
        </li>))}</ul>}
      <p className="text-xs text-muted-foreground">Once you return something, the library keeps no record that you borrowed it.</p>
    </div>
  );
}

function RStep({ r, step, reload }: { r: any; step: string; reload: () => void }) {
  const [note, setNote] = useState('');
  const [acc, setAcc] = useState<string>('');
  const [kind, setKind] = useState('ebook');
  const [copies, setCopies] = useState(1);
  const [author, setAuthor] = useState('');
  const need = step === 'approve' ? 10 : step === 'decline' ? 5 : 0;
  const go = async () => {
    try { await library({ action: 'rstep', id: r.id, step: step as never, expectedVersion: r.version, note, accessible: acc === '' ? null : acc === 'yes', kind: step === 'publish' ? kind as never : null, copies: step === 'publish' ? copies : null, author });
      toast('Recorded.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2 text-sm">
      {need > 0 && <Textarea aria-label={step === 'approve' ? 'Licence terms' : 'Reason'} placeholder={step === 'approve' ? 'Licence terms: who may use it, how many seats, for how long' : 'Reason'} value={note} onChange={(e) => setNote(e.target.value)} />}
      {step === 'approve' && <label className="block text-xs">Meets accessibility needs?<select className={sel} value={acc} onChange={(e) => setAcc(e.target.value)}><option value="">Not checked yet</option><option value="yes">Yes</option><option value="no">No — approved with a known gap</option></select></label>}
      {step === 'publish' && <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">Format<select className={sel} value={kind} onChange={(e) => setKind(e.target.value)}><option value="ebook">E-book</option><option value="print">Print</option></select></label>
        <label className="text-xs">{kind === 'ebook' ? 'Licence seats' : 'Copies'}<Input type="number" min={1} max={500} className="mt-1" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} /></label>
        <label className="text-xs">Author<Input className="mt-1" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
      </div>}
      <Button size="sm" disabled={note.trim().length < need || (step === 'approve' && acc === '')} onClick={go}>{RLABEL[step]}</Button>
    </div>
  );
}

function Requests({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ title: '', reason: '' });
  const [k, setK] = useState(key());
  const [open, setOpen] = useState<string | null>(null);
  const send = async () => { try { await library({ action: 'request', requestKey: k, ...f }); toast('Request sent to the library.'); setF({ title: '', reason: '' }); setK(key()); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <div className="space-y-3">
      {d.requests.length > 0 && <ul className="space-y-2">{d.requests.map((r: any) => (
        <li key={r.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span><b>{r.title}</b><span className="block text-xs text-muted-foreground">{r.mine ? 'Your request' : `From ${r.requester}`}</span></span><Status value={RSTATE[r.state] ?? r.state} /></div>
          <p className="mt-1 text-xs">{r.reason}</p>
          {r.licenseNote && <p className="mt-1 text-xs"><b>Licence:</b> {r.licenseNote}{r.accessible === false ? ' · does not fully meet accessibility needs' : r.accessible ? ' · accessible' : ''}</p>}
          {r.decisionNote && <p className="mt-1 text-xs"><b>Reason:</b> {r.decisionNote}</p>}
          {r.steps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{r.steps.map((s: string) => <Button key={s} size="sm" variant={open === `${r.id}:${s}` ? 'default' : 'outline'} onClick={() => setOpen(open === `${r.id}:${s}` ? null : `${r.id}:${s}`)}>{RLABEL[s]}</Button>)}</div>}
          {open?.startsWith(`${r.id}:`) && <RStep r={r} step={open.split(':')[1]} reload={() => { setOpen(null); reload(); }} />}
        </li>))}</ul>}
      <div className="grid gap-2 text-sm">
        <Input aria-label="Title wanted" placeholder="Book, journal or database you need" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea aria-label="Why you need it" placeholder="What you need it for" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <div><Button size="sm" disabled={f.title.trim().length < 2 || f.reason.trim().length < 10} onClick={send}>Request it</Button></div>
      </div>
    </div>
  );
}

function Staff({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ title: '', author: '', kind: 'print', copies: 1, sourceRef: '' });
  const [email, setEmail] = useState('');
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  return (
    <div className="space-y-4 text-sm">
      {d.staff && <>
        <div><p className="mb-1 text-xs font-medium">Desk returns · {d.desk.length} on loan</p>
          {d.desk.length ? <ul>{d.desk.map((l: any) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-0">
              <span>{l.title}<span className="block text-xs text-muted-foreground">{l.patron} · due {fmtDay(l.dueAt)}</span></span>
              <span className="flex gap-2">{l.overdue && <Status value="Overdue" />}<Button size="sm" variant="outline" onClick={() => act(() => library({ action: 'return', loanId: l.id, expectedVersion: l.version }), 'Return recorded.')}>Record return</Button></span>
            </li>))}</ul> : <Empty>Nothing on loan.</Empty>}
          <p className="mt-1 text-xs text-muted-foreground">Only current loans are listed. Returned loans keep no borrower.</p></div>
        <div className="grid gap-2 sm:grid-cols-2"><p className="text-xs font-medium sm:col-span-2">Add an item</p>
          <Input aria-label="Item title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input aria-label="Item author" placeholder="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
          <label className="text-xs">Format<select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="print">Print</option><option value="ebook">E-book</option></select></label>
          <label className="text-xs">{f.kind === 'ebook' ? 'Licence seats' : 'Copies'}<Input type="number" min={1} className="mt-1" value={f.copies} onChange={(e) => setF({ ...f, copies: Math.max(1, Number(e.target.value) || 1) })} /></label>
          <Input aria-label="Source" className="sm:col-span-2" placeholder="Source record (catalog number, vendor)" value={f.sourceRef} onChange={(e) => setF({ ...f, sourceRef: e.target.value })} />
          <div><Button size="sm" disabled={f.title.trim().length < 2} onClick={() => act(() => library({ action: 'item', id: null, ...f, kind: f.kind as never, active: true }), 'Item added.')}>Add item</Button></div>
        </div>
      </>}
      {d.isAdmin && <div className="space-y-2"><p className="text-xs font-medium">Library staff · {d.staffList.length}</p>
        <p className="text-xs">{d.staffList.join(', ') || 'None yet.'}</p>
        <Input aria-label="Staff email" placeholder="Member email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2"><Button size="sm" disabled={!email.includes('@')} onClick={() => act(() => library({ action: 'setStaff', email, on: true }), 'Granted.')}>Grant</Button>
          <Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => act(() => library({ action: 'setStaff', email, on: false }), 'Removed.')}>Remove</Button></div>
        <p className="text-xs text-muted-foreground">You cannot change your own library access.</p></div>}
    </div>
  );
}

export default function Library() {
  const s = useLoad(() => library({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="Library" sub="Find, borrow and hold books and e-books, or ask the library to get something. No fines are charged in Semester." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Catalog"><Catalog d={d} reload={s.reload} /></Panel>
          <Panel title={`My loans and holds · ${d.myLoans.length + d.myHolds.length}`}><Mine d={d} reload={s.reload} /></Panel>
          <Panel title="Requests"><Requests d={d} reload={s.reload} /></Panel>
          {(d.staff || d.isAdmin) && <Panel title="Library staff"><Staff d={d} reload={s.reload} /></Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
