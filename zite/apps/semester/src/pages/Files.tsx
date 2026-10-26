import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { files } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';
import { ConfirmAction } from '../components/overlays';
import { MIME_ALLOW, MAX_BYTES } from '../lib/fileRules';
import { uploadPrivate, saveBytes } from '../lib/fileClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

async function open(id: string) {
  try { saveBytes((await files({ action: 'download', id })) as never); } catch (e) { toast(`! ${errMsg(e)}`); }
}

function ShareForm({ onShare }: { onShare: (email: string, days: number) => void }) {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(14);
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-xs">Member's email<Input type="email" className="mt-1 w-64" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="text-xs">Days<Input type="number" min={1} max={365} className="mt-1 w-20" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
      <Button size="sm" disabled={!email.includes('@') || days < 1 || days > 365} onClick={() => onShare(email.trim(), days)}>Share</Button>
    </div>
  );
}

/** You → Files: private file store (decision D2). Owner-only by default; shares name one member and end on a date. */
export default function Files() {
  const s = useLoad(() => files({ action: 'mine' }));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<{ id: string } | null>(null);
  const call = async (body: any, ok: string) => { try { await files(body); toast(ok); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const upload = async (f: File) => {
    setBusy(true);
    try { await uploadPrivate(f, 'personal'); toast('Uploaded. Only you can open it.'); s.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <>
      <PageHeader eyebrow="You" title="Files" sub="Private by default. There are no public links: every download is checked against who is asking, and each share names one person and ends on a date." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Your files" action={<>
            <input ref={input} type="file" className="sr-only" id="file-up" accept={Object.keys(MIME_ALLOW).join(',')} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload'}</Button></>}>
            <p className="mb-2 text-xs text-muted-foreground">PDF, images, text, CSV or Office files, up to {MAX_BYTES / 1024 / 1024} MB.</p>
            {!d.mine.length ? <Empty>No files yet.</Empty> : <ul className="divide-y divide-border text-sm">{d.mine.map((f: any) => (
              <li key={f.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-medium">{f.name}</span> <span className="text-xs text-muted-foreground">{MIME_ALLOW[f.mime] ?? f.mime} · {kb(f.size)} · {fmtDay(f.at)}</span></span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(f.id)}>Download</Button>
                    <Button size="sm" variant="ghost" aria-expanded={share?.id === f.id} onClick={() => setShare(share?.id === f.id ? null : { id: f.id })}>Share</Button>
                    <ConfirmAction trigger={<Button size="sm" variant="ghost">Delete</Button>} title={`Delete ${f.name}?`} confirmLabel="Delete for good" onConfirm={() => call({ action: 'delete', id: f.id }, 'Deleted. The file contents are gone.')}>
                      <p className="text-sm">The file contents are removed and every share ends. A record that the file existed stays in the access log.</p>
                    </ConfirmAction>
                  </span>
                </div>
                {f.sharedWith.length > 0 && <ul className="mt-1 text-xs text-muted-foreground">{f.sharedWith.map((g: any) => (
                  <li key={g.userId} className="flex items-center gap-2">Shared with {g.name} until {fmtDay(g.until)}
                    <button className="text-primary underline" onClick={() => call({ action: 'revoke', id: f.id, userId: g.userId }, 'Share ended.')}>End share</button></li>))}</ul>}
                {share?.id === f.id && <ShareForm onShare={(email, days) => { call({ action: 'share', id: f.id, email, days }, 'Shared.'); setShare(null); }} />}
              </li>))}</ul>}
          </Panel>
          <Panel title="Shared with you">
            {!d.sharedWithMe.length ? <Empty>Nothing shared with you right now.</Empty> : <ul className="divide-y divide-border text-sm">{d.sharedWithMe.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2"><span>{f.name}<span className="block text-xs text-muted-foreground">From {f.owner} · until {fmtDay(f.until)}</span></span>
                <Button size="sm" variant="ghost" onClick={() => open(f.id)}>Download</Button></li>))}</ul>}
          </Panel>
        </div>)}
      </Loadable>
    </>
  );
}
