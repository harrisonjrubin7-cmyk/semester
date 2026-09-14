/**
 * Finding one tab among a hundred.
 *
 * The strip holds a hundred now, which makes it somewhere to *keep* tabs
 * rather than a row anybody reads end to end — and a row you scroll sideways
 * through is not a way back to the thing you were reading an hour ago. This
 * is the other half of that: press the caret at the end of the strip, type
 * two words, press Enter.
 *
 * It is the same control every browser has grown for the same reason, in the
 * same place, and it earns its forty pixels only once there is something to
 * search: under `ENOUGH` tabs the strip *is* the search, and a second way to
 * do what one glance already does is a control people learn to look past.
 *
 * ## It lists rather than ranks
 *
 * Nothing typed shows every tab in the strip's own order — the pinned ones
 * first, the groups in their runs — because opening the list with an empty
 * box is how you see what you have got. What is typed filters it, exact
 * matches before near misses, and the order never otherwise changes. See
 * `findTabs` in `lib/browser.ts`; the matching is the app's own `nearAny`, so
 * `calender` lands on the calendar here exactly as it does in the palette.
 */

import { useRef, useState } from 'react';
import { findTabs, whatClosed, type AppTab, type Found } from '../lib/browser';
import { forgetWhatClosed, reopenTab, useStrip } from '../lib/browser.hook';
import { secondLine } from '../lib/dim';
import { Popover, type Corner } from './Popover';
import { ChevronDown, Search as SearchIcon } from './Icons';
import { TabGlyph } from './TabIcon';
import { toneAt, useTones } from './tones';

/**
 * How many tabs make this worth drawing.
 *
 * Four is where a strip stops being one glance: three tabs and their names
 * are all on screen at any width this app runs at, and the fourth is where a
 * phone starts scrolling.
 */
export const ENOUGH = 4;

/** How tall the list may get before it scrolls rather than fills the window. */
const TALL = 320;

export function TabFind({
  /** Go to this tab — the strip's own `pick`, which knows how to land. */
  onPick,
  /** Close this tab, by its seat. */
  onClose,
  /** Show a tab that has just been reopened — the strip's own `land`. */
  onBack,
}: {
  onPick: (at: number) => void;
  onClose: (at: number) => void;
  onBack: (tab: AppTab) => void;
}) {
  const strip = useStrip();
  const [corner, setCorner] = useState<Corner | null>(null);

  /*
   * Enough tabs to look through, *or* something to put back.
   *
   * The second half arrived with the closed list and is not a nicety: close
   * one of three tabs and the strip would have fallen under the threshold,
   * taking the only way back to what you just closed with it — at exactly the
   * moment somebody wants it.
   */
  if (strip.tabs.length < ENOUGH && strip.closed.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="bare tappable"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          // Right-aligned to the control, because the list is wider than it
          // is and a panel hanging off the right edge of the window is the
          // one thing a control at the end of a row must not do. `Popover`
          // clamps as well; this is what makes it land under the caret
          // rather than at the clamp.
          setCorner({ x: box.right - WIDE, y: box.bottom + 2 });
        }}
        aria-label={`Search the ${strip.tabs.length} open tabs, and what was closed`}
        aria-haspopup="dialog"
        title="Search open tabs"
        style={{
          width: 'auto',
          flex: 'none',
          padding: 'var(--sp-3) var(--sp-4)',
          borderRadius: 'var(--r-sm)',
          ...secondLine(),
        }}
      >
        <ChevronDown size={15} />
      </button>
      {/*
        Drawn here rather than through a portal to the body, and it matters:
        every control primitive in this app is scoped `.device .bare`,
        `.device .input`, so a panel mounted outside that scope is the one
        part of the app not drawn in the app's own materials. `Popover` is
        `position: fixed`, so staying in the tree costs it nothing.
      */}
      {corner && (
        <Finder
          corner={corner}
          onClose={() => setCorner(null)}
          onPick={onPick}
          onShut={onClose}
          onBack={onBack}
        />
      )}
    </>
  );
}

/** Wide enough for a tab's name and the group it is in. */
const WIDE = 300;

function Finder({
  corner,
  onClose,
  onPick,
  onShut,
  onBack,
}: {
  corner: Corner;
  onClose: () => void;
  onPick: (at: number) => void;
  onShut: (at: number) => void;
  /** A closed tab is open again, and the app should be showing it. */
  onBack: (tab: AppTab) => void;
}) {
  const strip = useStrip();
  const tones = useTones();
  const [text, setText] = useState('');
  const [at, setAt] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const found = findTabs(strip, text);
  /*
   * What was closed lately, filtered by the same words.
   *
   * Under the open tabs rather than mixed in with them: they are a different
   * kind of thing — one is where you are, the other is where you were — and a
   * list that mixed them would make Enter mean two things depending on how
   * far down the arrow keys had got. The arrow keys walk the open ones; a
   * closed tab takes a press of its own.
   */
  const gone = whatClosed(strip, text);
  const cursor = Math.min(at, Math.max(0, found.length - 1));

  const go = (seat: number) => {
    onClose();
    onPick(seat);
  };

  return (
    <Popover label="Open tabs" corner={corner} width={WIDE} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2)' }}>
        <SearchIcon size={15} />
        <input
          ref={field}
          autoFocus
          className="bare"
          value={text}
          placeholder="Search open tabs"
          aria-label="Search open tabs"
          onChange={(e) => {
            setText(e.target.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAt((n) => Math.min(n + 1, found.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAt((n) => Math.max(n - 1, 0));
            } else if (e.key === 'Enter' && found[cursor]) {
              e.preventDefault();
              go(found[cursor].seat.at);
            }
            // Escape is the dialog's, and `Popover` already has it.
          }}
          style={{ flex: 1, minWidth: 0, width: 'auto', fontSize: 'var(--type-md)' }}
        />
      </div>

      {found.length === 0 && gone.length === 0 ? (
        <div style={{ padding: 'var(--sp-4)', fontSize: 'var(--type-sm)', ...secondLine() }}>
          Nothing open or lately closed matches that.
        </div>
      ) : (
        <div
          role="listbox"
          aria-label="Open tabs"
          style={{ maxHeight: TALL, overflowY: 'auto' }}
        >
          {found.map((f, i) => (
            <Row
              key={f.seat.tab.id}
              found={f}
              on={f.seat.at === strip.at}
              under={i === cursor}
              tone={f.group ? toneAt(tones, f.group.tone).fill : ''}
              onPick={() => go(f.seat.at)}
              onOver={() => setAt(i)}
              onShut={() => onShut(f.seat.at)}
            />
          ))}
        </div>
      )}

      {gone.length > 0 && (
        <>
          <div
            className="kicker"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--sp-4)',
              padding: 'var(--sp-4) var(--sp-4) var(--sp-2)',
              borderTop: '1px solid var(--app-line)',
              marginTop: 'var(--sp-2)',
              ...secondLine(),
            }}
          >
            <span>Recently closed</span>
            {/* The one control over a list the app is keeping about you. It
                is next to the list rather than in a settings page, because
                that is where somebody is when they want it gone. */}
            <button
              type="button"
              className="bare tappable"
              onClick={() => forgetWhatClosed()}
              style={{ width: 'auto', padding: 0, fontSize: 'var(--type-xs)', ...secondLine() }}
            >
              Clear
            </button>
          </div>
          {gone.map(({ tab }) => (
            <button
              key={tab.id}
              type="button"
              className="bare tappable"
              onClick={() => {
                const back = reopenTab(tab.id);
                onClose();
                if (back) onBack(back);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-3) var(--sp-4)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--type-md)',
              }}
            >
              {tab.screen ? <TabGlyph screen={tab.screen} size={15} /> : <SearchIcon size={15} />}
              <span
                style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {tab.title}
              </span>
              <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>Reopen</span>
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}

function Row({
  found,
  on,
  under,
  tone,
  onPick,
  onOver,
  onShut,
}: {
  found: Found;
  /** The tab the app is showing, which the list says rather than reorders. */
  on: boolean;
  /** Under the arrow keys. */
  under: boolean;
  tone: string;
  onPick: () => void;
  onOver: () => void;
  onShut: () => void;
}) {
  const tab: AppTab = found.seat.tab;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="option"
        aria-selected={under}
        aria-current={on ? 'page' : undefined}
        className="bare tappable"
        onClick={onPick}
        onMouseEnter={onOver}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          padding: 'var(--sp-3) var(--sp-4)',
          borderRadius: 'var(--r-sm)',
          background: under ? 'var(--app-hero)' : 'transparent',
          fontSize: 'var(--type-md)',
        }}
      >
        {tab.screen ? <TabGlyph screen={tab.screen} size={15} /> : <SearchIcon size={15} />}
        <span
          style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {tab.title}
        </span>
        {/* Which work it belongs to, as the group's own dot and name. */}
        {found.group && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              flex: 'none',
              maxWidth: 90,
              fontSize: 'var(--type-xs)',
              ...secondLine(),
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 'var(--sp-3)', height: 'var(--sp-3)', borderRadius: '50%', background: tone }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {found.group.name || 'Group'}
            </span>
          </span>
        )}
      </button>
      {/* A pinned tab has no cross here either — see `Tab` in `Tabs.tsx`. */}
      {!tab.pinned && (
        <button
          type="button"
          className="bare tappable"
          onClick={onShut}
          aria-label={`Close ${tab.title}`}
          style={{ width: 'auto', flex: 'none', padding: 'var(--sp-3)', ...secondLine() }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
