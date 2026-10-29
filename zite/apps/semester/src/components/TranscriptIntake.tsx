import { useState } from 'react';
import { toast } from 'sonner';
import { transcripts } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from './kit';
import { uploadPrivate, saveBytes } from '../lib/fileClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE: Record<string, string> = { received: 'Waiting for the registrar', accepted_official: 'Accepted as official', accepted_unofficial: 'Accepted as unofficial', rejected: 'Not usable' };
const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

function Item({ t, registrar, reload }: { t: any; registrar: boolean; reload: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => { try { saveBytes((await transcripts({ action: 'read', id: t.id })) as any); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const review = async (decision: string, ok: string) => {
    setBusy(true);
    try { await transcripts({ action: 'review', id: t.id, version: t.version, decision, note } as never); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-md border border-border p-2 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong>{t.fileName}</strong> · {t.requestLabel} · {t.student} <Status value={STATE[t.state]} /></span>
      {t.note && <span className="block text-xs">{t.reviewedBy}: {t.note}</span>}
      <span className="mt-1 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={open}>Open</Button>
        {registrar && !t.mine && t.state === 'received' && <>
          <Input aria-label="Review note" className="h-8 max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed to reject)" />
          <Button size="sm" disabled={busy} onClick={() => review('accepted_official', 'Accepted as official.')}>Official</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => review('accepted_unofficial', 'Accepted as unofficial.')}>Unofficial</Button>
          <Button size="sm" variant="ghost" disabled={busy || note.trim().length < 10} onClick={() => review('rejected', 'Marked not usable.')}>Not usable</Button>
        </>}
      </span>
    </li>
  );
}

export default function TranscriptIntake() {
  const s = useLoad(() => transcripts({ action: 'get' }) as Promise<any>);
  const [req, setReq] = useState('');
  const [busy, setBusy] = useState(false);
  const attach = async (f: File | undefined) => {
    if (!f || !req) return;
    setBusy(true);
    try { const fileId = await uploadPrivate(f, 'evidence'); await transcripts({ action: 'attach', requestId: req, fileId }); toast('Transcript attached for the registrar.'); s.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Loadable state={s}>{(d: any) => {
      const mine = d.transcripts.filter((t: any) => t.mine);
      const queue = d.transcripts.filter((t: any) => !t.mine);
      return (
        <>
          <Panel title="Transcripts">
            <p className="mb-2 text-xs text-muted-foreground">Attach a copy of your transcript to a transfer request (PDF or image, up to 4 MB). It is screened, kept private, and only you and registrars can open it; every opening is logged. A registrar decides whether it counts as official.</p>
            {d.openRequests.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Transfer request" className={sel} value={req} onChange={(e) => setReq(e.target.value)}>
                  <option value="">Choose a request…</option>{d.openRequests.map((q: any) => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
                <input aria-label="Transcript file" type="file" accept="application/pdf,image/png,image/jpeg" disabled={!req || busy} onChange={(e) => attach(e.target.files?.[0])} className="text-sm" />
              </div>
            ) : <Empty>Request an evaluation first, then attach its transcript here.</Empty>}
            {mine.length > 0 && <ul className="mt-3 space-y-2">{mine.map((t: any) => <Item key={`${t.id}:${t.version}`} t={t} registrar={d.registrar} reload={s.reload} />)}</ul>}
          </Panel>
          {d.registrar && <Panel title={`Transcripts to review · ${queue.filter((t: any) => t.state === 'received').length}`}>
            {!queue.length ? <Empty>No transcripts.</Empty> : <ul className="space-y-2">{queue.map((t: any) => <Item key={`${t.id}:${t.version}`} t={t} registrar reload={s.reload} />)}</ul>}
            <p className="mt-2 text-xs text-muted-foreground">Last change {fmt(queue[0]?.at)}. Accepting a transcript posts no credit; evaluation decides each course.</p>
          </Panel>}
        </>
      );
    }}</Loadable>
  );
}
