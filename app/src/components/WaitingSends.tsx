import { useRef, useState } from 'react';
import { formatDateTime } from '../lib/locale';
import { HOLD_MS, KINDS, type Kind } from '../lib/sync/outbox';
import { useOutbox, type Row } from '../lib/sync/useOutbox';
import { cloudConfigured } from '../lib/cloud';

/**
 * What the student saved to send later, and the one tap that sends it.
 *
 * Nothing here sends by itself, ever. Coming back online turns "You are
 * offline" into a button that works; it does not press it. See
 * `lib/sync/outbox.ts` for why (D-055's reasoning, kept).
 */
export function WaitingSends() {
  const o = useOutbox();
  const head = useRef<HTMLHeadingElement>(null);
  if (!cloudConfigured || !o.ready || o.rows.length === 0) return null;
  // After a change the row that was being acted on may be gone, so focus goes
  // to the heading rather than to nothing.
  const settle = (run: () => Promise<void>) => () => void run().then(() => head.current?.focus());
  return (
    <section aria-labelledby="waiting-head" style={{ marginTop: 'var(--sp-6)' }}>
      <h2 id="waiting-head" ref={head} tabIndex={-1} className="kicker" style={{ margin: 0 }}>
        Waiting for you to send
      </h2>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
        Saved on this device. Nothing here is sent by itself, even when you are back online: you send each one, and it is
        held for {Math.round(HOLD_MS / 86_400_000)} days.
        {o.durable ? '' : ' This browser would not keep them, so they will be lost if you close the app.'}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {o.rows.map((r) => (
          <Item key={r.entry.id} row={r} online={o.online} onSend={(confirmed) => settle(() => o.sendOne(r.entry.id, confirmed))()} onDrop={settle(() => o.drop(r.entry.id))} />
        ))}
      </ul>
      <div role="status" aria-live="polite" style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
        {o.said}
      </div>
    </section>
  );
}

function statusLine(r: Row): string {
  const e = r.entry;
  const at = (t: number) => formatDateTime(t, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  switch (r.shown) {
    case 'sent':
      return `Sent ${at(e.settledAt ?? e.createdAt)}.`;
    case 'sending':
      return 'Sending…';
    case 'expired':
      return `Held since ${at(e.createdAt)} and not sent. It waited too long, so it will not go. Make it again to send it.`;
    case 'unknown':
      return `${e.said ?? 'It may have gone.'}`;
    case 'failed':
      return `Not sent. ${e.said ?? ''}`.trim();
    default:
      return `Kept ${at(e.createdAt)} on this device. Held until ${at(e.expiresAt)}.`;
  }
}

function Item({ row, online, onSend, onDrop }: { row: Row; online: boolean; onSend: (confirmed: boolean) => void; onDrop: () => void }) {
  const [sure, setSure] = useState(false);
  const e = row.entry;
  const whyId = `why-${e.id}`;
  const sent = row.shown === 'sent';
  const dead = row.shown === 'expired';
  // A share that may have already gone is checked, then sent again on purpose.
  const risky = row.needsConfirm;
  const can = risky ? sure && row.can.ok : row.can.ok;
  return (
    <li style={{ marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-5)', borderTop: '1px solid var(--app-line)' }}>
      <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>{KINDS[e.kind as Kind].label}</div>
      <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-1)', overflowWrap: 'anywhere' }}>{e.summary}</div>
      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>{statusLine(row)}</div>
      {risky ? (
        <label style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start', marginTop: 'var(--sp-3)', fontSize: 'var(--type-sm)' }}>
          <input type="checkbox" checked={sure} onChange={(ev) => setSure(ev.target.checked)} />
          <span>I checked, and it did not arrive. Send it again.</span>
        </label>
      ) : null}
      {!sent && !dead && !row.can.ok && !risky ? (
        <div id={whyId} style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>
          {row.can.why}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        {sent || dead ? null : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!can || !online}
            aria-describedby={!row.can.ok && !risky ? whyId : undefined}
            aria-label={`Send: ${e.summary}`}
            onClick={() => onSend(risky)}
            style={{ minHeight: 44 }}
          >
            {risky ? 'Send again' : 'Send'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" aria-label={`${sent ? 'Remove from the list' : 'Discard'}: ${e.summary}`} onClick={onDrop} style={{ minHeight: 44 }}>
          {sent ? 'Remove from the list' : 'Discard'}
        </button>
      </div>
    </li>
  );
}

/**
 * The offer on the screen that was refused: keep it, and send it yourself later.
 * Shown only where there is an account to hold it for.
 */
export function KeepForLater({ kind, summary, payload }: { kind: Kind; summary: string; payload: unknown }) {
  const o = useOutbox();
  const [kept, setKept] = useState(false);
  const [refused, setRefused] = useState(false);
  if (!cloudConfigured || !o.ready) return null;
  return (
    <div role="group" aria-label="Keep it to send later" style={{ marginTop: 'var(--sp-4)' }}>
      {kept ? (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: 0 }}>
          Kept on this device. Find it under “Waiting for you to send” on Account. It will not go by itself.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 0 }}>
            You can keep this on this device and send it yourself when you are back online. It will not send by itself, and it is held for{' '}
            {Math.round(HOLD_MS / 86_400_000)} days.
            {o.durable ? '' : ' This browser would not keep it if you close the app.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 'var(--sp-3)', minHeight: 44 }}
            onClick={() =>
              void o.keep(kind, summary, payload).then((e) => {
                setKept(e !== null);
                setRefused(e === null);
              })
            }
          >
            Keep it to send later
          </button>
          {refused ? (
            <p role="alert" style={{ fontSize: 'var(--type-sm)', margin: 'var(--sp-3) 0 0' }}>
              This could not be kept: the browser would not save it. Nothing was saved and nothing was sent.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
