/**
 * Type where you want to go, from wherever you are.
 *
 * The app can already find anything — `lib/find.ts` searches deadlines, study
 * units, courses, notes, tasks and its own screens, and does it well. The
 * problem was where that search lived: on a screen, reached by pressing `/`,
 * which *navigated there*. So looking something up meant leaving whatever you
 * were reading, and going back afterwards was a second decision. In practice
 * people did not look things up; they hunted through tabs.
 *
 * This is the same search as an overlay. It opens over the screen, it closes,
 * and the screen is still there. That is the whole difference and it is the
 * one that matters — a lookup you can abandon costs nothing, so people make
 * them.
 *
 * ## Keyboard first, but not keyboard only
 *
 * Arrows move, Enter opens, Escape closes. The rows are still buttons, still
 * tappable, and the overlay still works on a phone reached from the Everything
 * tab — a palette that only exists for people with a keyboard would be a
 * feature for the half of the term spent at a desk and a gap for the other.
 *
 * ## No commands
 *
 * Deliberately not a command palette in the "type a verb, run an action" sense.
 * Actions that change data need to say what they will do before they do it —
 * every one in this app is a screen with a preview and a button — and a list
 * that mixes "go to the calendar" with "delete this course" is a list where
 * one wrong Enter is unrecoverable.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { countHits, findEverything } from '../lib/find';
import { scopesFor } from '../lib/scoped';
import { flatten, hitKey, openHit } from '../lib/openhit';

/** How wide the search column gets, matching the app's own pane. */
const COLUMN = 620;

export function Command({ onClose }: { onClose: () => void }) {
  const { state, dispatch, now, catalog, school } = useStore();
  // Seeded when a screen's own search escalated to here, so "search everywhere
  // for this" arrives with the query rather than asking for it again.
  const [text, setText] = useState(state.finderSeed);
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const found = useMemo(
    () => findEverything(catalog, now, text, state.notes, state.tasks, school.capabilities, state.updates),
    // `state.updates` is searched and was not listed here, so the results
    // could not see material added after the palette opened. `catalog` does
    // not cover it either — that memo depends on the term, the ordering and
    // the courses, not on what has been added to them — so nothing else was
    // making this recompute. Reachable while the palette is open through a
    // sync landing new material, which is rare and is not the same as
    // impossible.
    [catalog, now, text, state.notes, state.tasks, school.capabilities, state.updates],
  );

  /*
   * The collections this overlay does not list, offered as a place to look.
   *
   * Sources, applications, saved places and the rest are each a list of tens
   * with a filter of its own. Inlining them would bury the deadlines and notes
   * people are usually after; naming the screen without a number would be a
   * guess. So: the count, and the query carried over. See `lib/scoped.ts`.
   */
  const groups = useMemo(() => {
    const scopes = scopesFor(text, state);
    if (scopes.length === 0) return found;
    return [
      ...found,
      {
        label: 'Look inside a screen',
        hits: scopes.map((sc) => ({
          kind: 'scope' as const,
          screen: sc.screen,
          query: text.trim(),
          title: `Search “${text.trim()}” in ${sc.label}`,
          sub: `${sc.said} match`,
          tag: 'Filter',
          // Below the real records, always. An offer to keep looking is worth
          // less than a thing that has been found, however many matched.
          score: 0,
        })),
      },
    ];
  }, [found, text, state]);
  const hits = flatten(groups);
  const total = countHits(groups);
  // Clamped rather than reset: the selection following the results down as
  // somebody types is what makes Enter safe to press without looking.
  const cursor = Math.min(at, Math.max(0, hits.length - 1));

  const go = (i: number) => {
    const hit = hits[i];
    if (!hit) return;
    openHit(hit, dispatch);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Search everything"
      aria-modal="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (hits.length === 0) return;
          // Wrapping, because a list you can fall off the bottom of makes
          // somebody look at the screen to find out where they are.
          const next = (cursor + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
          setAt(next);
          list.current
            ?.querySelector(`[data-at="${next}"]`)
            ?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          go(cursor);
        }
      }}
    >
      {/* A column rather than the full width of a laptop. Everything else in
          the app sits in a pane about this wide, and a search that alone runs
          edge to edge reads as a different application having opened. */}
      <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center', padding: '16px 18px 0', width: '100%', maxWidth: COLUMN, margin: '0 auto' }}>
        <input
          ref={box}
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAt(0);
          }}
          placeholder="A course, a topic, a deadline, a screen…"
          aria-label="Search everything"
          style={{ flex: 1, height: 44, fontSize: 'var(--type-lg)' }}
        />
        <button
          type="button"
          className="bare"
          onClick={onClose}
          style={{
            width: 'auto',
            flex: 'none',
            padding: '10px 4px',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.12em',
            opacity: 0.6,
          }}
        >
          CLOSE
        </button>
      </div>

      <div
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.5,
          padding: '9px 18px 0',
          width: '100%',
          maxWidth: COLUMN,
          margin: '0 auto',
        }}
        aria-live="polite"
      >
        {text.trim() === ''
          ? 'Deadlines, courses, study units, your own notes and tasks — and the app’s own screens.'
          : `${total} ${total === 1 ? 'result' : 'results'}`}
      </div>

      <div
        ref={list}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 18px 18px',
          width: '100%',
          maxWidth: COLUMN,
          margin: '0 auto',
        }}
      >
        {groups.map((group) => (
          <div key={group.label}>
            <div className="kicker" style={{ margin: '16px 0 4px' }}>
              {group.label}
            </div>
            {group.hits.map((hit) => {
              const i = hits.indexOf(hit);
              const on = i === cursor;
              return (
                <button
                  key={hitKey(hit)}
                  data-at={i}
                  type="button"
                  className="bare tappable"
                  // Not `onMouseEnter`: a list that re-selects under a
                  // stationary pointer as it re-renders moves the Enter target
                  // without anybody touching anything.
                  onFocus={() => setAt(i)}
                  onClick={() => go(i)}
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-5)',
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 'var(--r-sm)',
                    background: on ? 'var(--app-hero)' : 'transparent',
                    boxShadow: on ? 'inset 2px 0 0 var(--app-accent)' : 'none',
                  }}
                >
                  <span className={hit.kind === 'screen' ? 'tag tag-outline' : 'tag tag-accent'}>
                    {hit.tag}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--type-md)',
                        lineHeight: 1.25,
                      }}
                    >
                      {hit.title}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--type-xs)',
                        opacity: 0.55,
                        lineHeight: 1.35,
                      }}
                    >
                      {hit.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {text.trim() !== '' && total === 0 && (
          <div
            style={{
              fontSize: 'var(--type-base)',
              opacity: 0.6,
              marginTop: 22,
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            Nothing matches &ldquo;{text.trim()}&rdquo;. Try a course code, a topic from a guide, a
            professor, or the name of a screen.
          </div>
        )}
      </div>
    </div>
  );
}
