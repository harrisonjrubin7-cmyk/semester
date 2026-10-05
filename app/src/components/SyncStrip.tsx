import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { syncLine } from '../lib/syncstatus';
import { offline, watchConnection } from '../lib/offline';

/**
 * One quiet line under the header while the account needs saying about.
 *
 * Offline, offline with changes waiting, a conflict, a choice waiting, a
 * failure — and nothing otherwise. Its button goes to Account, which already
 * holds the whole story (`Review` is drawn there), so this is the route to it
 * from every screen rather than a second copy of it. See `syncLine` in
 * `lib/syncstatus.ts` for which statuses earn a line and what each says.
 *
 * A device that has stopped saving has its own banner above this, in
 * `App.tsx`; that one is about the disk, this one about the account.
 */
export function SyncStrip() {
  const { sync, dispatch, state } = useStore();
  // Watched here as well as in the store, because the store's status only
  // speaks for an account and this line also speaks for a device without one.
  const [online, setOnline] = useState(() => !offline());
  useEffect(() => watchConnection(setOnline), []);
  const line = syncLine(sync.status, sync.error, online);
  // Account says all of it already; a line pointing there from there is noise.
  const shown = line !== null && state.screen !== 'account';

  return (
    // Always mounted, so the live region exists before its text changes and a
    // screen reader hears the change rather than missing the first line of it.
    <div role="status" aria-live="polite" className={!shown ? 'sync-strip-off' : line.warn ? 'sync-strip sync-strip-warn' : 'sync-strip'}>
      {shown && (
        <>
          <span className="sync-strip-text">
            <strong>{line.title}.</strong> {line.detail}
          </span>
          {line.act && (
            <button
              type="button"
              className="bare tappable sync-strip-btn"
              onClick={() => dispatch({ type: 'go', screen: 'account' })}
            >
              {line.act}
            </button>
          )}
        </>
      )}
    </div>
  );
}
