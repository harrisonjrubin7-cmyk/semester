import { useEffect, useState } from 'react';
import { SectionLabel } from './ui';
import { askToPersist, roomLine, storageRoom, type Room } from '../lib/device';

/**
 * How much room there is, and whether the browser may take it back.
 *
 * The app already says when the store is *full* — a write fails and it says
 * so rather than losing it quietly. This is the half that was missing: how
 * close it is before that happens, and whether the browser is allowed to
 * delete the lot in the meantime to make room for something else.
 *
 * The second question is the more serious one and the one nobody thinks to
 * ask. localStorage and IndexedDB are evictable by default; a semester of
 * notes, answers and sources can go without a prompt. The app asks for
 * persistence at boot, but the browser is free to refuse — so this says which
 * answer it got, and offers to ask again, because the answer changes once a
 * browser decides you use the app enough to count.
 */
export function StorageRoom() {
  const [room, setRoom] = useState<Room | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    void storageRoom().then((r) => {
      if (alive) setRoom(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!room) return null;

  const askAgain = async () => {
    setAsking(true);
    await askToPersist();
    setRoom(await storageRoom());
    setAsking(false);
  };

  const pct = room.used >= 0 && room.quota > 0 ? Math.min(100, (room.used / room.quota) * 100) : -1;

  return (
    <>
      <SectionLabel>Room on this device</SectionLabel>

      {pct >= 0 ? (
        <div
          style={{
            position: 'relative',
            height: 4,
            borderRadius: 2,
            marginBottom: 9,
            background: 'var(--app-track)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '0 auto 0 0',
              width: `${Math.max(1, pct)}%`,
              borderRadius: 2,
              background: pct > 85 ? 'var(--app-warn)' : 'var(--app-accent)',
            }}
          />
        </div>
      ) : null}

      <div style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
        {roomLine(room)}
      </div>

      {!room.safe && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void askAgain()}
          disabled={asking}
          style={{ height: 40, marginTop: 10, fontSize: 12.5 }}
        >
          {asking ? 'Asking…' : 'Ask the browser to keep it'}
        </button>
      )}

      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 9, lineHeight: 1.45 }}>
        Whether to grant this is the browser's decision, not the app's. Installing the app to your
        home screen is what most often changes the answer. Signing in is the other half: an account
        keeps a copy off this device entirely, which is the only thing that survives losing it.
      </div>
    </>
  );
}
