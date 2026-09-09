import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { FigureCard } from '../components/FigureCard';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import type { Figure } from '../lib/types';
import { cardKey, masteryWord } from '../lib/review';

type Slide =
  | { kind: 'title'; title: string; sub: string }
  | { kind: 'q'; text: string; n: number; of: number }
  | { kind: 'a'; q: string; text: string }
  | { kind: 'figure'; figure: Figure }
  /** Prose from a reading that never became a question. */
  | { kind: 'note'; title: string; text: string; from: string }
  | { kind: 'end'; title: string; sub: string };

/**
 * The deck.
 *
 * The same unit as Read, cut into slides and shown one at a time: question,
 * then answer. Sitting through a deck is a worse way to memorise than drilling
 * cards, and a much better way to sit with a unit you have not read yet — which
 * is what it is for, and why the question always lands before its answer.
 *
 * Arrow keys, or tap the left and right halves of the slide.
 */
export function SlideDeck() {
  const { state, dispatch } = useStore();
  const { guide, figuresOn, onUnit } = useLive(state.guideId);
  const unitIndex = state.lessonUnit;
  const unit = guide.units[unitIndex];
  const unitFigures = figuresOn(unitIndex);
  const added = onUnit(unitIndex);

  const slides = useMemo<Slide[]>(() => {
    if (!unit) return [];
    const out: Slide[] = [
      {
        kind: 'title',
        title: unit.name.replace(/^\d+(\/\d+)?\s*·\s*/, ''),
        sub: `${guide.code} · ${unit.cards.length} things to know`,
      },
    ];
    unit.cards.forEach((c, i) => {
      out.push({ kind: 'q', text: c.q, n: i + 1, of: unit.cards.length });
      out.push({ kind: 'a', q: c.q, text: c.a });
    });
    /*
     * Every figure the unit has, not just the one it leads with.
     *
     * This took `figures[unitIndex]` — the single figure a header shows — so a
     * reading that brought three tables contributed one slide and dropped two
     * with nothing said. A deck is the one place with room for all of them.
     */
    for (const figure of unitFigures) out.push({ kind: 'figure', figure });

    // Prose a reading never split into questions. It is in Read and on the
    // cram sheet; leaving it out of the deck made the deck the one format that
    // did not have the whole unit in it.
    for (const up of added) {
      if (up.body) {
        out.push({
          kind: 'note',
          title: up.title || 'Added since',
          text: up.body,
          from: up.source || 'Added by you',
        });
      }
    }

    out.push({
      kind: 'end',
      title: 'End of the unit',
      /* Same word, same reason as the guide card on Study: until a card in
         this unit has been answered the figure is the guide's estimate, and
         nothing has watched you learn it. `masteryWord` in `lib/review.ts`. */
      sub: `${unit.cards.length} cards · ${unit.mastery}% ${masteryWord(
        unit.cards.map((c) => cardKey(state.guideId, c.q)),
        state.reviews,
      )}`,
    });
    return out;
  }, [unit, guide.code, unitFigures, added, state.guideId, state.reviews]);

  const [at, setAt] = useState(0);
  const last = slides.length - 1;

  const step = useCallback(
    (delta: number) => setAt((n) => Math.min(last, Math.max(0, n + delta))),
    [last],
  );

  // Moving to another unit starts its deck at the first slide. Adjusting state
  // during render rather than in an effect keeps it to one pass.
  const [deckOf, setDeckOf] = useState(unitIndex);
  if (deckOf !== unitIndex) {
    setDeckOf(unitIndex);
    setAt(0);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (!unit || slides.length === 0) {
    return <div style={{ padding: 'var(--page-pad)', fontSize: 'var(--type-md)', opacity: 0.6 }}>Nothing to show here.</div>;
  }

  const slide = slides[at];

  /*
   * No `<Page>` here, deliberately.
   *
   * A slideshow is one slide filling the height, advanced by arrow keys or a
   * tap. The frame's search box would sit above the slide on every one of
   * them, and `minHeight: '100%'` is doing work the frame does not know
   * about. This screen is presented, not read.
   */
  return (
    <div style={{ padding: 'var(--page-pad)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="kicker">
        {guide.code} · unit {unitIndex + 1} · slide {at + 1} of {slides.length}
      </div>

      <div style={{ height: 3, background: 'var(--app-track)', marginTop: 'var(--sp-4)' }}>
        <div
          style={{
            height: '100%',
            width: `${((at + 1) / slides.length) * 100}%`,
            background: 'var(--chrome)',
            transition: 'width 160ms ease',
          }}
        />
      </div>

      {/* The slide itself. Tapping the left third goes back, the rest forward. */}
      <Blueprint
        style={{
          position: 'relative',
          marginTop: 14,
          padding: 22,
          minHeight: 330,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'var(--app-hero)',
        }}
      >
        {slide.kind === 'title' && (
          <>
            <div className="kicker">{slide.sub}</div>
            <div
              className="chrome-text"
              style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1.05, marginTop: 'var(--sp-5)', textWrap: 'pretty' }}
            >
              {slide.title}
            </div>
          </>
        )}

        {slide.kind === 'q' && (
          <>
            <div className="kicker" style={{ color: 'var(--app-accent)' }}>
              {slide.n} of {slide.of}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(25px * var(--text-scale, 1))',
                lineHeight: 1.15,
                marginTop: 'var(--sp-6)',
                textWrap: 'pretty',
              }}
            >
              {slide.text}
            </div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.45, marginTop: 'var(--sp-7)' }}>
              Answer it before you advance.
            </div>
          </>
        )}

        {slide.kind === 'a' && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(17px * var(--text-scale, 1))',
                lineHeight: 1.2,
                opacity: 0.5,
                textWrap: 'pretty',
              }}
            >
              {slide.q}
            </div>
            <div
              style={{
                fontSize: 'calc(17px * var(--text-scale, 1))',
                lineHeight: 'var(--leading-relaxed)',
                marginTop: 'var(--sp-6)',
                textWrap: 'pretty',
              }}
            >
              {slide.text}
            </div>
          </>
        )}

        {/*
          The same card the Figures tab draws.

          This used to draw a diagram and, for everything else, print the
          caption — so a table of numbers appeared in the deck as one line of
          italics with no numbers in it, and a process appeared as a sentence
          about a process. `FigureCard` already knew how to draw all four, and
          a second, worse renderer for the same union is exactly the thing that
          drifts.
        */}
        {slide.kind === 'figure' && <FigureCard figure={slide.figure} unit="Figure" />}

        {slide.kind === 'note' && (
          <>
            <div className="kicker">{slide.from}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(20px * var(--text-scale, 1))', marginTop: 'var(--sp-2)' }}>
              {slide.title}
            </div>
            <div
              style={{
                fontSize: 'var(--type-md)',
                opacity: 0.8,
                marginTop: 'var(--sp-5)',
                lineHeight: 'var(--leading-relaxed)',
                whiteSpace: 'pre-wrap',
                textWrap: 'pretty',
              }}
            >
              {slide.text}
            </div>
          </>
        )}

        {slide.kind === 'end' && (
          <>
            <div className="chrome-text" style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1.08 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-4)' }}>{slide.sub}</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'startDrill', unit: unitIndex })}
              style={{
                alignSelf: 'flex-start',
                marginTop: 'var(--sp-7)',
                height: 42,
                fontSize: 'var(--type-sm)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Drill it now
            </button>
          </>
        )}

        <button
          type="button"
          className="bare"
          aria-label="Previous slide"
          onClick={() => step(-1)}
          style={{ position: 'absolute', inset: '0 66% 0 0', cursor: 'w-resize' }}
        />
        <button
          type="button"
          className="bare"
          aria-label="Next slide"
          onClick={() => step(1)}
          style={{ position: 'absolute', inset: '0 0 0 34%', cursor: 'e-resize' }}
        />
      </Blueprint>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => step(-1)}
          disabled={at === 0}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (at === last ? dispatch({ type: 'back' }) : step(1))}
          style={{ flex: 1, height: 46, fontSize: 'var(--type-base)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          {at === last ? 'Done' : 'Next'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => step(1)}
          disabled={at === last}
          aria-label="Forward"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={unitIndex === 0}
          onClick={() => dispatch({ type: 'openDeck', unit: unitIndex - 1 })}
          style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Previous unit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={unitIndex >= guide.units.length - 1}
          onClick={() => dispatch({ type: 'openDeck', unit: unitIndex + 1 })}
          style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Next unit
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
