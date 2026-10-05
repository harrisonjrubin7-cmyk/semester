import { useState } from 'react';
import {
  NEVER_IN_A_PACKET,
  PRIVATE_NOTES_LINE,
  approve,
  gather,
  preview,
  release,
  stateOf,
  studentConfirms,
  type Candidate,
  type PacketKind,
  type Payload,
} from '../lib/semester-packets';

/** Read at the action boundary, not during render. */
const currentTime = () => Date.now();

/**
 * What would leave the device, shown before anything does.
 *
 * The student ticks each item they want in. The preview below is
 * `preview(packet)` on the packet built from those ticks, line for line, and
 * the confirm button is the one place `studentConfirms` is called; `release`
 * decides whether a payload exists, and `onRelease` receives it only when it
 * does. Nothing is ticked at the start and private notes cannot be ticked.
 */
export function PacketPreview({
  id,
  kind,
  candidates,
  title,
  audience,
  expiresInDays,
  now: nowProp,
  onRelease,
}: {
  id: string;
  kind: PacketKind;
  candidates: readonly Candidate[];
  title?: string;
  audience?: string;
  expiresInDays?: number;
  /** Epoch ms; defaults to the moment of rendering. */
  now?: number;
  onRelease: (payload: Payload) => void;
}) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [said, setSaid] = useState('');
  const [opened] = useState(() => Date.now());
  const now = nowProp ?? opened;

  const packet = gather({ id, kind, title, audience, candidates: approve(candidates, ticked), now, expiresInDays });
  const lines = preview(packet);
  const live = stateOf(packet, now) === 'live';
  const hasPrivate = candidates.some((c) => c.private === true);

  const toggle = (cid: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(cid);
    else next.delete(cid);
    setTicked(next);
    setSaid('');
  };

  const confirm = () => {
    const at = nowProp ?? currentTime();
    const result = release(packet, studentConfirms(packet, at), at);
    if (result.ok) {
      onRelease(result.payload);
      setSaid('Confirmed. What is shown above is what was handed over.');
    } else setSaid(result.text);
  };

  return (
    <section aria-label="Packet preview" className="today-why">
      <h2>What to include</h2>
      <p>Nothing is included until you tick it.</p>
      <ul>
        {candidates
          .filter((c) => c.private !== true)
          .map((c) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={ticked.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                {`${c.section}: ${c.text}`}
              </label>
            </li>
          ))}
      </ul>
      {hasPrivate && <p>{PRIVATE_NOTES_LINE}</p>}

      <h2>This is exactly what would leave your device</h2>
      <dl>
        {lines.map((l, i) => (
          <div key={`${l.key}-${i}`}>
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>
      <p>Never included:</p>
      <ul>
        {NEVER_IN_A_PACKET.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary" disabled={!live || packet.items.length === 0} onClick={confirm}>
        Confirm this packet
      </button>
      <p role="status">{said}</p>
    </section>
  );
}
