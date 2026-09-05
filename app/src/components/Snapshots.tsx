import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from './ui';
import { backupOf } from '../lib/export';
import { formatBytes } from '../lib/files';
import {
  LOCAL_LINE,
  NONE_LINE,
  RESTORED_LINE,
  RESTORE_LINE,
  changed,
  costLine,
  countsOf,
  dropSnapshot,
  listSnapshots,
  readSnapshot,
  reasonLabel,
  takeSnapshot,
  whenLine,
  type Snapshot,
} from '../lib/snapshots';

/**
 * Going back a day.
 *
 * The export file is a backup somebody has to have remembered to make, and the
 * undo banner has moved on by the time most damage is noticed. This is the
 * middle: copies the app took by itself, listed with what restoring each one
 * would cost, in counts, before anything happens.
 *
 * Restoring replaces rather than merges, which runs against the rule the whole
 * sync design rests on, so it is fenced: the cost is shown first, a copy of
 * right now is taken first, and it never runs as a side effect of anything.
 */
export function Snapshots() {
  const { state, dispatch, now } = useStore();
  const [list, setList] = useState<Snapshot[] | null>(null);
  const [picked, setPicked] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

  const refresh = () => void listSnapshots().then(setList);
  useEffect(refresh, []);

  const mine = countsOf(backupOf(state) as unknown as Record<string, unknown>);

  const restore = async (snap: Snapshot) => {
    setBusy(true);
    setSaid('');
    // A copy of now, first and always. Restoring the wrong day is exactly the
    // kind of mistake this whole feature exists for, and it would be absurd
    // for the escape hatch to be the one action with no way back.
    await takeSnapshot('restore', backupOf(state) as unknown as Record<string, unknown>, now);
    const data = await readSnapshot(snap.id);
    setBusy(false);
    setPicked(null);
    if (!data) {
      setSaid('That copy could not be read. Nothing was changed.');
      refresh();
      return;
    }
    dispatch({ type: 'restore', persisted: data as never });
    setSaid(RESTORED_LINE);
    refresh();
  };

  const take = async () => {
    setBusy(true);
    setSaid('');
    const made = await takeSnapshot('asked', backupOf(state) as unknown as Record<string, unknown>, now);
    setBusy(false);
    setSaid(made ? 'Copy taken.' : 'This device would not store a copy. Nothing else changed.');
    refresh();
  };

  const rows = picked ? changed(mine, picked.counts) : [];

  return (
    <div>
      <SectionLabel>Go back a day</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, marginBottom: 10, textWrap: 'pretty' }}>
        {LOCAL_LINE}
      </div>

      {list === null ? null : list.length === 0 ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.5, textWrap: 'pretty' }}>
          {NONE_LINE}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setSaid('');
                setPicked(picked?.id === s.id ? null : s);
              }}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
                width: '100%',
                minHeight: 44,
                padding: '9px 2px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--app-line)',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 'calc(13px * var(--text-scale, 1))' }}>
                {reasonLabel(s.reason)}
                <span style={{ opacity: 0.55 }}> · {whenLine(s.at, now)}</span>
              </span>
              <span
                style={{
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  opacity: 0.45,
                  flex: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatBytes(s.bytes)}
              </span>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <Blueprint style={{ padding: '13px 14px', marginTop: 10 }}>
          <div className="kicker">
            {reasonLabel(picked.reason)} · {whenLine(picked.at, now)}
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 8, lineHeight: 1.5, textWrap: 'pretty' }}>
            {costLine(rows)}
          </div>
          {rows.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 17, fontSize: 'calc(12.5px * var(--text-scale, 1))', lineHeight: 1.6 }}>
              {rows.map((r) => (
                <li key={r.line} style={{ opacity: r.loses ? 1 : 0.6 }}>
                  {r.line}
                </li>
              ))}
            </ul>
          )}
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, marginTop: 9, lineHeight: 1.5, textWrap: 'pretty' }}>
            {RESTORE_LINE}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPicked(null)}
              style={{ flex: 1, height: 42 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void restore(picked)}
              style={{ flex: 1, height: 42 }}
            >
              Go back to this
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void dropSnapshot(picked.id).then(() => {
                setPicked(null);
                refresh();
              });
            }}
            style={{
              marginTop: 10,
              minHeight: 32,
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              opacity: 0.5,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Delete this copy
          </button>
        </Blueprint>
      )}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={busy}
        onClick={() => void take()}
        style={{ height: 44, marginTop: 12 }}
      >
        Take a copy now
      </button>

      {said ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', marginTop: 10, lineHeight: 1.5, opacity: 0.85, textWrap: 'pretty' }}>
          {said}
        </div>
      ) : null}
    </div>
  );
}
