import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { allCards } from '../data/catalog';
import { liveGuide } from '../lib/live';
import { cardKey, dueFirst } from '../lib/review';
import { nextClass, railFor } from '../lib/select';
import {
  addSample,
  budgetLine,
  cardsThatFit,
  gapLine,
  gapNow,
  goLine,
  leftOf,
  readPace,
  roomOf,
  runLine,
  walkLine,
  writePace,
  walkTo,
  type Gap as Window,
} from '../lib/gap';
import { canSpeak, hush, readAloud, say, spoken, writeAloud } from '../lib/speak';
import { buzz } from '../lib/device';
import { useKeepAwake } from '../lib/awake';
import { current } from '../lib/housing';

/**
 * The window, worked out once and read by both the screen and the offer.
 *
 * Kept here rather than in `lib/gap.ts` because it is the only part that
 * needs the store; everything it decides is decided by tested functions.
 */
function useWindow(): Window | null {
  const { state, catalog, now } = useStore();

  const rail = useMemo(
    () => railFor(catalog, now, state.appointments, state.commitments),
    [catalog, now, state.appointments, state.commitments],
  );

  return useMemo(() => {
    const next = nextClass(catalog, now);
    if (!next) return null;
    return gapNow(
      {
        title: next.block.title,
        where: roomOf(next.block.meta),
        inMinutes: next.inMinutes,
        isTomorrow: next.isTomorrow,
      },
      // Before your first class the origin is where you live, if the housing
      // portal's room has been filled in. See `lib/housing.ts`.
      walkTo(rail, next.block.at, state.places, current(state.residences, state.term)?.hall ?? ''),
    );
  }, [catalog, now, rail, state.places, state.residences, state.term]);
}

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
      <div style={{ padding: 18, fontSize: 14, opacity: 0.6, lineHeight: 1.55 }}>
        Nothing to fill. This opens when there is a real gap before your next class — long enough
        to be worth starting something, short enough that sitting down for it would be a waste.
      </div>
    );
  }

  // Keyed on the window, so a new gap starts a genuinely new run rather than
  // resuming the deck of a run that ended forty minutes ago in another
  // building.
  return <Run key={`${win.title}-${win.startsIn}`} win={win} />;
}

function Run({ win }: { win: Window }) {
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
      <div style={{ padding: 18, fontSize: 14, opacity: 0.6, lineHeight: 1.55 }}>
        No cards yet. Import a syllabus and the app builds them out of it.
      </div>
    );
  }

  if (over) {
    return (
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
        <div style={{ flex: 1, paddingTop: 40 }}>
          <div className="chrome-text" style={{ fontSize: 46, lineHeight: 1.1 }}>
            {runLine(idx, got)}
          </div>
          <div style={{ fontSize: 15, marginTop: 14, lineHeight: 1.5, textWrap: 'pretty' }}>
            {stopped
              ? goLine(win)
              : left === 0
                ? `That is the window. ${goLine(win)}`
                : `${deck.length} cards was the lot. ${goLine(win)}`}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 12, lineHeight: 1.5 }}>
            Every answer is recorded against the card, the same as a sitting-down drill — what you
            missed comes back sooner and what you knew comes back later.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'home' })}
          style={{ height: 60, fontSize: 15 }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '78vh', padding: '0 16px' }}>
      {/* How much of the window is gone. A bar rather than a clock: a number
          counting down is a thing you watch instead of the card. */}
      <div style={{ position: 'relative', height: 3, marginTop: 4 }}>
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
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginTop: 9,
        }}
      >
        <span>{card.code}</span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          {canSpeak() ? (
            <button
              type="button"
              className="bare"
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
                fontSize: 11,
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
          gap: 16,
          cursor: shown ? 'default' : 'pointer',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 25,
            lineHeight: 1.25,
            textWrap: 'pretty',
          }}
        >
          {card.q}
        </div>
        {shown ? (
          <div
            style={{
              fontSize: 16,
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
          <div style={{ fontSize: 12, opacity: 0.4, letterSpacing: '0.06em' }}>
            Tap anywhere to turn it over
          </div>
        )}
      </button>

      {/* Both targets in the bottom third, where a thumb reaches without the
          hand moving on the phone. */}
      <div style={{ paddingBottom: 18 }}>
        {shown ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => answer(false)}
              style={{ flex: 1, height: 76, fontSize: 15 }}
            >
              Again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => answer(true)}
              style={{ flex: 1, height: 76, fontSize: 15 }}
            >
              Got it
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setShown(true)}
            style={{ height: 76, fontSize: 15 }}
          >
            Show
          </button>
        )}

        <button
          type="button"
          className="bare"
          onClick={() => setStopped(true)}
          style={{ width: '100%', height: 36, fontSize: 12, opacity: 0.45, marginTop: 4 }}
        >
          Stop here
        </button>
      </div>
    </div>
  );
}

/**
 * The offer on Today. One line, and only in a gap worth using.
 *
 * Silent when the next class is tomorrow, when one has already started, when
 * the window is too short to open anything, and when it is long enough to be
 * a work window instead — ninety free minutes are a thing to sit down for, and
 * spending them on flashcards is the worst available use of them.
 */
export function GapOffer() {
  const { dispatch } = useStore();
  const win = useWindow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pace = useMemo(() => readPace(), []);

  if (!win || win.long) return null;

  const cards = cardsThatFit(win.minutes, pace);

  return (
    <button
      type="button"
      className="bare"
      onClick={() => dispatch({ type: 'go', screen: 'gap' })}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '13px 14px',
        marginBottom: 14,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <div className="kicker">Between classes</div>
      <div style={{ fontSize: 16, lineHeight: 1.35, marginTop: 5, textWrap: 'pretty' }}>
        {gapLine(win)}
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6, lineHeight: 1.5 }}>
        {budgetLine(cards, pace)} One thumb, no typing.
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.45, marginTop: 5, lineHeight: 1.45 }}>
        {walkLine(win)}
      </div>
    </button>
  );
}
