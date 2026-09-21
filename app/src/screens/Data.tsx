import { useEffect, useMemo, useState } from 'react';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { Downloads } from '../components/Downloads';
import { useStore } from '../state/store';
import { pickPersisted } from '../state/shape';
import { bytesOf, elsewhere, inventory, space, type Elsewhere, type Row, type Space } from '../lib/inventory';
import { formatBytes, totalSize } from '../lib/files';
import { weigh } from '../lib/keep';
import { allVersions } from '../lib/docversions';
import { DRAFTS_KEY } from '../lib/draft';
import { STORAGE_KEY } from '../state/shape';
import { firstPaint, readings, saidMs } from '../lib/timing';

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
/** One measured line: what it was, and how slow it has ever been. */
const READING = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 'var(--sp-5)',
  marginTop: 'var(--sp-2)',
  fontSize: 'var(--type-sm)',
} as const;

export function DataScreen() {
  const { state, dispatch } = useStore();
  /*
   * Read once, when the screen opens.
   *
   * Not live: the readings change as this very screen draws, and a list that
   * rewrote itself while being read would be measuring its own measuring. A
   * snapshot is what somebody can read out loud, which is what it is for.
   */
  const [timings] = useState(() => readings());
  const [paint] = useState(() => firstPaint());
  const [room, setRoom] = useState<Space | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  /*
   * The two things the app holds that are not in the store.
   *
   * Came from Settings → Storage, which measured them beside a second copy of
   * the quota figure below. The quota is now measured once, by `space()`, and
   * these two moved here rather than being lost with that copy: a screen that
   * answers "what is this app holding" and omits the attachments is answering
   * it wrongly. Drafts are a string this app wrote, so their size is exact;
   * attachments are asked of IndexedDB and can decline to answer.
   */
  const [drafts] = useState(() => {
    try {
      return weigh(localStorage.getItem(DRAFTS_KEY) ?? '');
    } catch {
      // A private window with storage switched off has nothing to measure.
      return 0;
    }
  });
  /*
   * And everything else this app has put in the browser.
   *
   * The store is one key; the assistant's conversations, the open tabs and
   * their groups, the bookmarks, the recent searches, the error log and what
   * the shared key has been spent on are a dozen more, each written by the
   * feature that needed it and none of them on this screen before. Measured
   * by prefix in `lib/inventory.ts`, so a feature that starts writing a new
   * key appears here without anybody adding a row for it.
   */
  const [other] = useState<Elsewhere>(() => elsewhere([STORAGE_KEY, DRAFTS_KEY]));
  const [files, setFiles] = useState<number | null>(null);
  const [history, setHistory] = useState<number | null>(null);

  const store = useMemo(() => inventory(pickPersisted(state)), [state]);

  useEffect(() => {
    let alive = true;
    void space().then((s) => {
      if (alive) setRoom(s);
    });
    void totalSize()
      .then((n) => {
        if (alive) setFiles(n);
      })
      .catch(() => {
        if (alive) setFiles(null);
      });
    /*
     * The document history, which this screen did not count.
     *
     * `semester-drafts` holds up to twenty full copies of every document, and
     * it is its own database — so none of the three figures above could see
     * it and the screen's answer to "what is this app taking up" was short by
     * however much somebody had written. `lib/erase.ts` found the same gap
     * from the other end: erase did not clear this database either, and its
     * comment says a list of databases drifts exactly this way.
     */
    void allVersions()
      .then((vs) => {
        if (alive) setHistory(weigh(JSON.stringify(vs)));
      })
      .catch(() => {
        if (alive) setHistory(null);
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
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginBottom: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
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
              paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: '0',
              marginTop: 'var(--sp-4)',
              borderTop: '1px solid var(--app-line)',
              fontSize: 'var(--type-md)',
            }}
          >
            <span>Everything</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(store.bytes)}</span>
          </div>
          {store.span && (
            <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)' }}>
              Spanning {new Date(store.span.from).toLocaleDateString()} to{' '}
              {new Date(store.span.to).toLocaleDateString()}.
            </div>
          )}

          {/*
            Outside the store, and said so.

            These are not collections and must not be added into the total
            above, which is the size of one string this app writes. Kept
            beside it because the question people arrive with is "what is
            this app taking up", and the answer is all five. Document history
            was one of the two missing: its own database, so none of the
            others could see it, and up to twenty full copies of every
            document in it. The other was everything the app writes that is
            not the store — the assistant's conversations most of all — which
            is measured by prefix rather than by a list, so the next feature
            to write a key of its own is counted the day it does.
          */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)', marginTop: 'var(--sp-5)', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
            <span>Drafts in progress</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {drafts ? formatBytes(drafts) : 'None'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)', marginTop: 'var(--sp-2)', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
            <span>Attachments</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {files === null ? 'Not available' : formatBytes(files)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)', marginTop: 'var(--sp-2)', fontSize: 'var(--type-sm)', ...secondLine() }}>
            <span>
              Everything else the app has written
              {other.keys > 0 ? ` (${other.keys} ${other.keys === 1 ? 'store' : 'stores'})` : ''}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {other.bytes ? formatBytes(other.bytes) : 'None'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)', marginTop: 'var(--sp-2)', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
            <span>Document history</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {history === null ? 'Not available' : history ? formatBytes(history) : 'None'}
            </span>
          </div>

          {/*
            What the app measured about itself, which is the point of §7.1.
            The screen you open when something looks wrong should let you say
            what is slow rather than that it feels slow — and these figures are
            in memory, gone on reload, and in nothing that syncs. See
            `lib/timing.ts` for why that is the design and not a shortcoming.
          */}
          <SectionLabel>How fast</SectionLabel>
          {paint !== null && (
            <div style={READING}>
              <span>First drawn</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{saidMs(paint)}</span>
            </div>
          )}
          {timings.length === 0 ? (
            <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
              Nothing measured yet. Move around the app and come back — the readings start empty on
              every reload, because none of this is written down anywhere.
            </div>
          ) : (
            timings.map((r) => (
              <div key={r.name} style={READING}>
                <span>
                  {r.name}
                  {r.over ? <span style={{ color: 'var(--app-dim)' }}> · {r.over}</span> : null}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {saidMs(r.worst)}
                  <span style={{ color: 'var(--app-dim)' }}> worst of {r.count}</span>
                </span>
              </div>
            ))
          )}
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            The slowest each of them has been since this tab opened, and what that slowest run was
            over. Kept in memory only — nothing here is stored, synced or sent anywhere, and a
            reload empties it. Read it out to somebody if the app feels slow; there is no figure
            here saying whether it is, because that one does not exist until enough semesters have
            been through it.
          </div>

          <SectionLabel>Room</SectionLabel>
          {room === null ? (
            <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)' }}>Asking the browser…</div>
          ) : room.unknown ? (
            <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
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

          {/*
            Under Room, because it is the largest part of the answer to it and
            the only part a person can act on without giving anything up. The
            figures above this come from `navigator.storage.estimate()`, which
            counts the media cache — so before this section existed, a student
            watching that number climb past two hundred megabytes had nothing
            on the screen naming what it was.
          */}
          <Downloads />

          <Blueprint plain style={{ paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))', marginTop: 'var(--sp-6)' }}>
            <div className="kicker">How it is stored</div>
            <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-2)' }}>
              {/*
                What is where, which had fallen a rewrite behind: the store
                moved into IndexedDB and stopped being the one localStorage
                key this sentence described, and the app has been writing a
                dozen smaller keys beside it ever since — the row above counts
                them, and a line saying "one key" over that count is a line
                that reads as a bug in one of the two.
              */}
              {room?.backend === 'indexeddb'
                ? 'Your records, your files, the document history and the daily copies are in IndexedDB. The smaller stores counted above — drafts, the assistant’s conversations, open tabs, bookmarks — are keys in localStorage.'
                : 'localStorage only — this browser has no IndexedDB, so the records are one key there, and files cannot be kept at all.'}
            </div>
            <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
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
          paddingBlock: 'calc(10px * var(--density, 1))', paddingInline: '0',
          textAlign: 'left',
          opacity: row.count === 0 ? DIMMED_ROW : 1,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}>{row.label}</span>
        <span style={{ fontSize: 'var(--type-sm)', ...secondLine(row.count === 0), fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
          {row.count.toLocaleString()}
        </span>
        <span style={{ fontSize: 'var(--type-sm)', ...secondLine(row.count === 0), fontVariantNumeric: 'tabular-nums', flex: 'none', minWidth: 62, textAlign: 'right' }}>
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
                paddingTop: 'calc(7px * var(--density, 1))', paddingRight: '0', paddingBottom: 'calc(7px * var(--density, 1))', paddingLeft: 'calc(12px * var(--density, 1))',
                borderLeft: '2px solid var(--app-line)',
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.text}
              </span>
              <span style={{ color: 'var(--app-dim)', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(r.bytes)}
              </span>
            </div>
          ))}
          {records.length > shown && (
            <button
              type="button"
              className="bare tappable"
              onClick={() => setShown((n) => n + PAGE)}
              style={{ width: 'auto', marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em' }}
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
