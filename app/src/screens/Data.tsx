import { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { useStore } from '../state/store';
import { pickPersisted } from '../state/shape';
import { bytesOf, inventory, space, type Row, type Space } from '../lib/inventory';
import { formatBytes } from '../lib/files';

/**
 * What data exists, and whether the app is healthy.
 *
 * Not the reports and not an insight. Those answer "what does my data mean";
 * this answers "what data is there", and stops at counts, sizes and dates.
 * Nothing here interprets, and that is the whole design: the screen you open
 * when something looks wrong has to be one you can check rather than one you
 * have to trust.
 *
 * ## Why this is not the privacy screen
 *
 * `privacy` answers a different question — what leaves the device, what the
 * app promises, how to delete all of it. That is a statement about behaviour,
 * it changes when the app changes, and somebody reads it once. This is a
 * measurement, it changes every minute, and somebody reads it when their
 * phone says it is out of space. Folding one into the other would put a legal
 * statement above a byte count and serve neither.
 *
 * They link to each other instead, and `privacy` gives up the label "Your
 * data" — which described this screen and not that one.
 */
export function DataScreen() {
  const { state, dispatch } = useStore();
  const [room, setRoom] = useState<Space | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const store = useMemo(() => inventory(pickPersisted(state)), [state]);

  useEffect(() => {
    let alive = true;
    void space().then((s) => {
      if (alive) setRoom(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * How full it is, and what to do about it.
   *
   * The app already sheds data silently when the quota is exceeded. The
   * warning here is deliberately a warning and not an action: an automatic
   * deletion is what this screen exists to make visible, not something to do
   * more of.
   */
  const full = room?.used && room?.quota ? room.used / room.quota : null;

  return (
    <Page
      blurb="Every record the app holds, what it weighs, and how much room is left. Nothing on this screen changes anything."
    >
        <>
          <SectionLabel>What you have</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginBottom: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            Largest first, so what is taking the room is at the top.
          </div>

          {store.rows.map((row) => (
            <Collection
              key={row.key}
              row={row}
              value={(pickPersisted(state) as unknown as Record<string, unknown>)[row.key]}
              open={open === row.key}
              onToggle={() => setOpen(open === row.key ? null : row.key)}
            />
          ))}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--sp-5)',
              padding: '11px 0',
              marginTop: 'var(--sp-4)',
              borderTop: '1px solid var(--app-line)',
              fontSize: 'var(--type-md)',
            }}
          >
            <span>Everything</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(store.bytes)}</span>
          </div>
          {store.span && (
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, lineHeight: 'var(--leading-normal)' }}>
              Spanning {new Date(store.span.from).toLocaleDateString()} to{' '}
              {new Date(store.span.to).toLocaleDateString()}.
            </div>
          )}

          <SectionLabel>Room</SectionLabel>
          {room === null ? (
            <div style={{ fontSize: 'var(--type-base)', opacity: 0.6 }}>Asking the browser…</div>
          ) : room.unknown ? (
            <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, lineHeight: 'var(--leading-relaxed)' }}>
              This browser will not say how much room it has given the app. That is normal in a
              private window, and it means the figures above are the only ones there are.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--type-md)', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(room.used ?? 0)} used of {formatBytes(room.quota ?? 0)}
                {full !== null ? ` — ${Math.round(full * 100)}%` : ''}
              </div>
              {/* The bar is the second telling of it, never the only one: a
                  length is not a number anybody can act on. */}
              <div
                aria-hidden
                style={{
                  height: 8,
                  marginTop: 'var(--sp-4)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--app-track)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round((full ?? 0) * 100))}%`,
                    height: '100%',
                    background: (full ?? 0) > 0.8 ? 'var(--app-warn)' : 'var(--app-accent-deep)',
                  }}
                />
              </div>
              {full !== null && full > 0.8 && (
                <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-warn)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
                  Over 80% full. Nothing is deleted because of this. The largest collections are at
                  the top of this screen.
                </div>
              )}
            </>
          )}

          <Blueprint plain style={{ padding: '11px 13px', marginTop: 'var(--sp-6)' }}>
            <div className="kicker">How it is stored</div>
            <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-2)' }}>
              {room?.backend === 'indexeddb'
                ? 'Files are in IndexedDB; everything else is in localStorage under one key.'
                : 'localStorage only — this browser has no IndexedDB, so files cannot be kept.'}
            </div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.7, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
              {room?.persisted === true
                ? 'The browser has promised not to clear it to make room for other sites.'
                : room?.persisted === false
                  ? 'The browser has not promised to keep it, so it may be cleared if the device runs low.'
                  : 'This browser will not say whether it has promised to keep it.'}
            </div>
          </Blueprint>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'go', screen: 'privacy' })}
            style={{ height: 42, marginTop: 'var(--sp-6)' }}
          >
            Where any of this goes, and how to delete it
          </button>
        </>
    </Page>
  );
}

/**
 * One collection, and its records when opened.
 *
 * Paginated from the start rather than when it becomes a problem — twelve
 * hundred answers rendered at once is the case this screen is most likely to
 * meet, since it is the screen somebody opens when the app has too much in it.
 */
function Collection({
  row,
  value,
  open,
  onToggle,
}: {
  row: Row;
  value: unknown;
  open: boolean;
  onToggle: () => void;
}) {
  const PAGE = 25;
  const [shown, setShown] = useState(PAGE);

  const records: { key: string; text: string; bytes: number }[] = useMemo(() => {
    if (!open) return [];
    const list = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : value && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
        : [];
    return list.map(([k, v]) => ({ key: k, text: describe(v), bytes: bytesOf(v) }));
  }, [open, value]);

  return (
    <div style={{ borderBottom: '1px solid var(--app-line)' }}>
      <button
        type="button"
        className="bare tappable"
        aria-expanded={open}
        disabled={!row.browsable}
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          gap: 'var(--sp-5)',
          alignItems: 'baseline',
          padding: '10px 0',
          textAlign: 'left',
          opacity: row.count === 0 ? 0.45 : 1,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}>{row.label}</span>
        <span style={{ fontSize: 'var(--type-sm)', opacity: 0.6, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
          {row.count.toLocaleString()}
        </span>
        <span style={{ fontSize: 'var(--type-sm)', opacity: 0.75, fontVariantNumeric: 'tabular-nums', flex: 'none', minWidth: 62, textAlign: 'right' }}>
          {formatBytes(row.bytes)}
        </span>
      </button>

      {open && (
        <div style={{ paddingBottom: 'var(--sp-5)' }}>
          {records.slice(0, shown).map((r) => (
            <div
              key={r.key}
              style={{
                display: 'flex',
                gap: 'var(--sp-4)',
                padding: '7px 0 7px 12px',
                borderLeft: '2px solid var(--app-line)',
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.text}
              </span>
              <span style={{ opacity: 0.5, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(r.bytes)}
              </span>
            </div>
          ))}
          {records.length > shown && (
            <button
              type="button"
              className="bare tappable"
              onClick={() => setShown((n) => n + PAGE)}
              style={{ width: 'auto', marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)', opacity: 0.6, letterSpacing: '0.1em' }}
            >
              {records.length - shown} MORE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One record in a line.
 *
 * Whatever field looks like a name, then whatever looks like a date. Not the
 * whole record: this is a list to scan for the row that should not be there,
 * and a wall of JSON is not scannable.
 */
function describe(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object') return String(value);
  const r = value as Record<string, unknown>;
  const named = ['title', 'name', 'label', 'code', 'q', 't', 'what', 'said', 'raw'];
  for (const key of named) {
    if (typeof r[key] === 'string' && r[key]) return r[key] as string;
  }
  if ('course' in r && r.course && typeof r.course === 'object') {
    const c = r.course as Record<string, unknown>;
    if (typeof c.code === 'string') return c.code;
  }
  const keys = Object.keys(r);
  return keys.length > 0 ? `{ ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''} }` : '{}';
}
