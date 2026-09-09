import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { EmptyState } from '../components/ui';
import { allCards } from '../data/catalog';
import { liveGuide } from '../lib/live';
import { cardKey, dueFirst } from '../lib/review';
import {
  addSample,
  cardsThatFit,
  goLine,
  leftOf,
  readPace,
  runLine,
  writePace,
  type Gap as GapWindow,
} from '../lib/gap';
import { useWindow } from './GapOffer';
import { canSpeak, hush, readAloud, say, spoken, writeAloud } from '../lib/speak';
import { buzz } from '../lib/device';
import { useKeepAwake } from '../lib/awake';

/**
 * The twenty minutes between two classes.
 *
 * Everything else in the app assumes you are sitting down: drill wants a
 * course chosen and a unit picked, the guide wants scrolling, the quiz wants
 * a finger on each hand. None of that survives a courtyard.
 *
 * So this screen asks nothing. One card at a time, one thumb, two targets big
 * enough to hit without looking, and no field anywhere. It works out how long
 * you have — see `lib/gap.ts` — fills it, and stops when it is time to walk.
 *
 * The deck is mixed across every course you are taking, weakest and most
 * overdue first, because between two classes is exactly when picking a course
 * is the thing that makes you put the phone away.
 */
export function Gap() {
  const win = useWindow();

  if (!win) {
    return (
      <EmptyState
        title="Nothing to fill"
        body="This opens when there is a real gap before your next class — long enough to be worth starting something, short enough that sitting down for it would be a waste."
      />
    );
  }

  // Keyed on the window, so a new gap starts a genuinely new run rather than
  // resuming the deck of a run that ended forty minutes ago in another
  // building.
  return <Run key={`${win.title}-${win.startsIn}`} win={win} />;
}

function Run({ win }: { win: GapWindow }) {
  const { state, dispatch, catalog, now } = useStore();

  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [got, setGot] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [aloud, setAloud] = useState(readAloud);

  // Walking, one thumb, and the phone may be at your side while it reads the
  // card out. The screen must not lock between two cards.
  useKeepAwake();

  // Read once, and only added to. The budget must not change under you
  // mid-run: a deck that grows by four cards because you answered the first
  // three quickly is one you can never finish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pace = useMemo(() => readPace(), []);

  // Fixed for the run. `now` in the store moves on a thirty-second timer and
  // re-sorting the deck under a thumb skips cards and repeats others.
  const startedAt = useRef(Date.now());
  const cardShownAt = useRef(Date.now());

  const budget = cardsThatFit(win.minutes, pace);

  const deck = useMemo(() => {
    // Every course at once. Choosing one is the thing that makes you put the
    // phone away, and the schedule already knows which cards are owed.
    const all = catalog.courses.flatMap((c) => {
      const guide = liveGuide(catalog, c.id, state.updates, state.reviews);
      return allCards(guide).map((card) => ({
        ...card,
        code: guide.code || c.code,
        key: cardKey(c.id, card.q),
      }));
    });
    return dueFirst(all, state.reviews, startedAt.current).slice(0, budget);
    // Deliberately not depending on `state.reviews`: it changes on every
    // answer, and a deck that reshuffles mid-run is a deck you cannot finish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, state.updates, budget]);

  // The card read out loud, when asked for. What actually stops somebody
  // using a phone in motion is having to look at it; see `lib/speak.ts`.
  const card = deck[idx];
  useEffect(() => {
    if (!aloud || !card) return;
    say(spoken(card, shown));
  }, [aloud, card, shown]);

  // Nothing should still be reading a card on the screen you left for.
  useEffect(() => hush, []);

  // From the store's clock rather than a fresh `Date.now()`, so the render
  // is pure and the bar advances on the same thirty-second tick as the rest
  // of the app instead of only when a card is answered.
  const elapsed = now.getTime() - startedAt.current;
  const left = leftOf(win, elapsed);
  const over = stopped || left === 0 || idx >= deck.length;

  const answer = (right: boolean) => {
    if (!card) return;
    // Something to feel, for a tap you did not look at. Firm for the answer
    // that means more work. Absent on iOS, so it sits on top of the visible
    // change rather than replacing it.
    buzz(right ? 'light' : 'firm');
    writePace(addSample(readPace(), (Date.now() - cardShownAt.current) / 1000));
    dispatch({ type: 'recordCard', key: card.key, got: right });
    if (right) setGot((n) => n + 1);
    setIdx((n) => n + 1);
    setShown(false);
    cardShownAt.current = Date.now();
  };

  if (deck.length === 0) {
    return (
      <EmptyState
        title="No cards yet"
        body="Import a syllabus and the app builds them out of it."
        action={{ label: 'Add a course', onClick: () => dispatch({ type: 'go', screen: 'import' }) }}
      />
    );
  }

  if (over) {
    return (
      <div style={{ padding: 'var(--page-pad)', display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
        <div style={{ flex: 1, paddingTop: 40 }}>
          <div className="chrome-text" style={{ fontSize: 'calc(46px * var(--text-scale, 1))', lineHeight: 1.1 }}>
            {runLine(idx, got)}
          </div>
          <div style={{ fontSize: 'var(--type-lg)', marginTop: 14, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
            {stopped
              ? goLine(win)
              : left === 0
                ? `That is the window. ${goLine(win)}`
                : `${deck.length} cards was the lot. ${goLine(win)}`}
          </div>
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 'var(--sp-6)', lineHeight: 'var(--leading-relaxed)' }}>
            Every answer is recorded against the card, the same as a sitting-down drill — what you
            missed comes back sooner and what you knew comes back later.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'home' })}
          style={{ height: 60, fontSize: 'var(--type-lg)' }}
        >
          Done
        </button>
      </div>
    );
  }

  /*
   * No `<Page>` here, deliberately.
   *
   * This is the twenty minutes between two classes, timed: a bar counting the
   * window down and one card at a time filling the rest of the height. A
   * search box above it is a thing to look at instead of the card, which is
   * the one thing this screen exists to stop.
   */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '78vh', padding: '0 16px' }}>
      {/* How much of the window is gone. A bar rather than a clock: a number
          counting down is a thing you watch instead of the card. */}
      <div style={{ position: 'relative', height: 3, marginTop: 'var(--sp-2)' }}>
        {/* The empty track has to read as empty. At full strength a 402px
            hairline looks like a bar that is already finished, so the track
            is dimmed and the fill is not. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--app-line)',
            borderRadius: 2,
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 3,
            borderRadius: 2,
            background: 'var(--app-accent)',
            width: `${Math.min(100, (elapsed / (win.minutes * 60_000)) * 100)}%`,
            transition: 'width 500ms linear',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginTop: 9,
        }}
      >
        <span>{card.code}</span>
        <span style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'baseline' }}>
          {canSpeak() ? (
            <button
              type="button"
              /*
               * `tap-y`, not `tap`. This drew 38x17 — a fingertip and a half
               * short — and survived the audit that took 104 targets under
               * 30px down to none, because a walk of the screens never sees
               * it: it is drawn only inside a running gap session, behind a
               * start button and behind a browser that can speak.
               *
               * Vertical only, for the reason that audit gives: the card
               * counter shares this row, and a target that grew sideways
               * would reach across the gap towards it.
               */
              className="bare tap-y"
              aria-pressed={aloud}
              aria-label={aloud ? 'Stop reading cards aloud' : 'Read cards aloud'}
              onClick={() => {
                const on = !aloud;
                setAloud(on);
                writeAloud(on);
                if (!on) hush();
              }}
              style={{
                width: 'auto',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: aloud ? 1 : 0.5,
                color: aloud ? 'var(--app-accent)' : 'var(--app-fg)',
              }}
            >
              {aloud ? 'Aloud ON' : 'Aloud'}
            </button>
          ) : null}
          <span>
            {left} min · {idx + 1}/{deck.length}
          </span>
        </span>
      </div>

      {/* The card is the tap target, all of it. Aiming at a small "flip" is
          the thing that does not survive walking. */}
      <button
        type="button"
        className="bare"
        onClick={() => setShown(true)}
        aria-label={shown ? 'Answer shown' : 'Show the answer'}
        style={{
          flex: 1,
          width: '100%',
          textAlign: 'left',
          padding: '22px 2px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 'var(--sp-7)',
          cursor: shown ? 'default' : 'pointer',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(25px * var(--text-scale, 1))',
            lineHeight: 1.25,
            textWrap: 'pretty',
          }}
        >
          {card.q}
        </div>
        {shown ? (
          <div
            style={{
              fontSize: 'calc(16px * var(--text-scale, 1))',
              lineHeight: 1.55,
              opacity: 0.85,
              textWrap: 'pretty',
              borderTop: '1px solid var(--app-line)',
              paddingTop: 14,
            }}
          >
            {card.a}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.4, letterSpacing: '0.06em' }}>
            Tap anywhere to turn it over
          </div>
        )}
      </button>

      {/* Both targets in the bottom third, where a thumb reaches without the
          hand moving on the phone. */}
      <div style={{ paddingBottom: 18 }}>
        {shown ? (
          <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => answer(false)}
              style={{ flex: 1, height: 76, fontSize: 'var(--type-lg)' }}
            >
              Again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => answer(true)}
              style={{ flex: 1, height: 76, fontSize: 'var(--type-lg)' }}
            >
              Got it
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setShown(true)}
            style={{ height: 76, fontSize: 'var(--type-lg)' }}
          >
            Show
          </button>
        )}

        <button
          type="button"
          className="bare"
          onClick={() => setStopped(true)}
          style={{ width: '100%', height: 36, fontSize: 'var(--type-sm)', opacity: 0.45, marginTop: 'var(--sp-2)' }}
        >
          Stop here
        </button>
      </div>
    </div>
  );
}
