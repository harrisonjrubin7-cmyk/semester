import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { Diagram } from '../components/Diagram';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import type { Figure } from '../lib/types';

type Slide =
  | { kind: 'title'; title: string; sub: string }
  | { kind: 'q'; text: string; n: number; of: number }
  | { kind: 'a'; q: string; text: string }
  | { kind: 'figure'; figure: Figure }
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
  const { guide, figures } = useLive(state.guideId);
  const unitIndex = state.lessonUnit;
  const unit = guide.units[unitIndex];

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
    const figure = figures[unitIndex];
    if (figure) out.push({ kind: 'figure', figure });
    out.push({
      kind: 'end',
      title: 'End of the unit',
      sub: `${unit.cards.length} cards · ${unit.mastery}% mastered`,
    });
    return out;
  }, [unit, unitIndex, guide.code, figures]);

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
    return <div style={{ padding: 18, fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.6 }}>Nothing to show here.</div>;
  }

  const slide = slides[at];

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="kicker">
        {guide.code} · unit {unitIndex + 1} · slide {at + 1} of {slides.length}
      </div>

      <div style={{ height: 3, background: 'var(--app-track)', marginTop: 8 }}>
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
              style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1.05, marginTop: 10, textWrap: 'pretty' }}
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
                marginTop: 12,
                textWrap: 'pretty',
              }}
            >
              {slide.text}
            </div>
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.45, marginTop: 16 }}>
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
                lineHeight: 1.5,
                marginTop: 12,
                textWrap: 'pretty',
              }}
            >
              {slide.text}
            </div>
          </>
        )}

        {slide.kind === 'figure' && (
          <>
            <div className="kicker">Figure</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(20px * var(--text-scale, 1))', marginTop: 4 }}>
              {slide.figure.title}
            </div>
            {slide.figure.type === 'diagram' ? (
              <Diagram kind={slide.figure.kind} />
            ) : (
              <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.75, marginTop: 10, lineHeight: 1.5 }}>
                {slide.figure.caption}
              </div>
            )}
          </>
        )}

        {slide.kind === 'end' && (
          <>
            <div className="chrome-text" style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1.08 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8 }}>{slide.sub}</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'startDrill', unit: unitIndex })}
              style={{
                alignSelf: 'flex-start',
                marginTop: 16,
                height: 42,
                fontSize: 'calc(12px * var(--text-scale, 1))',
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

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
          style={{ flex: 1, height: 46, fontSize: 'calc(13px * var(--text-scale, 1))', letterSpacing: '0.12em', textTransform: 'uppercase' }}
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

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={unitIndex === 0}
          onClick={() => dispatch({ type: 'openDeck', unit: unitIndex - 1 })}
          style={{ flex: 1, height: 40, fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Previous unit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={unitIndex >= guide.units.length - 1}
          onClick={() => dispatch({ type: 'openDeck', unit: unitIndex + 1 })}
          style={{ flex: 1, height: 40, fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Next unit
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
