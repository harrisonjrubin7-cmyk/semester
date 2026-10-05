import { useEffect, useState } from 'react';
import { statusOf, syncStatusKey, type StatusKey } from '../../lib/status';
import { offline, watchConnection } from '../../lib/offline';
import { useStore } from '../../state/store';

/**
 * One status, drawn the one way: a glyph, a word, and a tone.
 *
 * The glyph and the word carry the state; the tone only reinforces it. A
 * reader hears the word, forced colours keep the glyph, and nobody has to
 * tell oxidised from sterling to know something needs them. The full
 * sentence rides along as `title` for a pointer and is what a drawer shows.
 */
export function StatusChip({ status, short = false }: { status: StatusKey; short?: boolean }) {
  const s = statusOf(status);
  return (
    <span className="status-chip" data-tone={s.tone} title={s.about}>
      <span className="status-glyph" aria-hidden="true">
        {s.glyph}
      </span>
      {short ? s.short : s.label}
    </span>
  );
}

/**
 * Where the student's work stands — saving, saved, offline, queued, conflict.
 *
 * A quiet line near the work, not a toast: the brief's "Saving… → Saved",
 * with a polite live region so a screen reader hears it settle without being
 * interrupted mid-sentence. Offline and a conflict are the two that interrupt
 * (`urgent`), because both change what the student should do next.
 */
export function SaveState({ status }: { status: StatusKey }) {
  const s = statusOf(status);
  return (
    <span
      className="save-state"
      data-tone={s.tone}
      role={s.urgent ? 'alert' : 'status'}
      aria-live={s.urgent ? 'assertive' : 'polite'}
    >
      <span className="status-glyph" aria-hidden="true">
        {s.glyph}
      </span>
      {s.label}
    </span>
  );
}

/** Whether the browser is certain there is no connection, kept live. */
export function useOffline(): boolean {
  const [off, setOff] = useState(offline);
  useEffect(() => watchConnection((online) => setOff(!online)), []);
  return off;
}

/**
 * The account's sync state, as the app's one save/sync indicator.
 *
 * Reads the store's `sync` and the connection, and says it in the shared
 * vocabulary — so "Offline", "Syncing" and "Sync trouble" read the same here
 * as on the settings screen.
 */
export function SyncState() {
  const { sync } = useStore();
  const off = useOffline();
  return <SaveState status={syncStatusKey(sync.status, off)} />;
}
