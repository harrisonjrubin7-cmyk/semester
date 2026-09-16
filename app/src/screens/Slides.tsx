import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { FigureCard } from '../components/FigureCard';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { deckOf } from '../lib/slides';
import { cardKey } from '../lib/review';
import { knowingOf, says } from '../lib/knowing';


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
  const now = useNow();
  const { guide, figuresOn, onUnit } = useLive(state.guideId);
  const unitIndex = state.lessonUnit;
  const unit = guide.units[unitIndex];
  const unitFigures = figuresOn(unitIndex);
  const added = onUnit(unitIndex);

  /* Whether anything in this unit has ever been answered. `Study.tsx`
     computes the same thing for the whole course two lines above the figure
     it labels; this is the unit-sized version of it. */
  const started = useMemo(
    () =>
      !!unit &&
      unit.cards.some((c) => (state.reviews[cardKey(state.guideId, c.q)]?.seen ?? 0) > 0),
    [unit, state.reviews, state.guideId],
  );

  /* And where it stands, in the same words Study and the guide use. */
  const standing = useMemo(
    () =>
      knowingOf(
        (unit?.cards ?? []).map((c) => cardKey(state.guideId, c.q)),
        state.reviews,
        now.getTime(),
      ),
    [unit, state.reviews, state.guideId, now],
  );

  const slides = useMemo(() => {
    if (!unit) return [];
    return deckOf({
      unit,
      code: guide.code,
      figures: unitFigures,
      added,
      /*
       * The same sentence the guide card on Study says, for the same reason,
       * on the one surface that still showed the old one.
       *
       * `unitMastery` blends what you have answered with what the guide
       * declared, and before the first answer there is nothing to blend — so
       * "68% mastered" on the last slide of a deck nobody has drilled is the
       * declared estimate wearing a measurement's clothes. Study said this
       * first and says it this way; a second wording for one fact would be
       * worse than the bug.
       *
       * Now the state rather than the percentage, which is the same argument
       * carried one step further: the blend was still mostly the estimate
       * after the first answer, and a percentage cannot say which part of
       * itself was measured. `lib/knowing.ts` reads the answers only.
       */
      standing: started
        ? `${unit.cards.length} cards · ${says(standing.state).toLowerCase()}`
        : `${unit.cards.length} cards · not started`,
    });
  }, [unit, guide.code, unitFigures, added, started, standing]);

  const [at, setAt] = useState(0);
  const last = slides.length - 1;

  const step = useCallback(
    (delta: number) => setAt((n) => Math.min(last, Math.max(0, n + delta))),
    [last],
  );

  // Moving to another unit starts its deck at the first slide. Adjusting state
  // during render rather than in an effect keeps it to one pass.
  const [showing, setShowing] = useState(unitIndex);
  if (showing !== unitIndex) {
    setShowing(unitIndex);
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
    return <div style={{ padding: 'var(--page-pad)', fontSize: 'var(--type-md)', color: 'var(--app-dim)' }}>Nothing to show here.</div>;
  }

  /*
   * Clamped, because the reset above has not happened yet on this pass.
   *
   * `setAt(0)` during render schedules another render and does not stop this
   * one: the function runs to the end with the *old* `at`, and if the unit
   * being moved to has a shorter deck that index is past it. `slides[at]` is
   * then `undefined`, `slide.kind` throws, and the screen boundary catches a
   * crash of the whole deck.
   *
   * Measured on `origin/main` before this change, so it is not the new slide
   * kinds: ECON's first unit is fifteen slides and its second is eleven, and
   * pressing "Next unit" from the last slide of the first took the screen
   * down every time. Two clicks in the app's own chrome.
   */
  const slide = slides[Math.min(at, last)];

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
                color: 'var(--app-dim)',
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
          Two sides, side by side.

          The card said `X vs. Y` and the answer was two halves of a contrast,
          drawn as one paragraph the reader had to split themselves.
          `lib/slides.ts` has the rule and, more to the point, what it refuses:
          an answer that argues for one side is not a comparison and stays an
          answer slide.

          Stacked rather than columned under about 380px, which is most of the
          phones this is read on — two columns of forty characters is neither
          column readable.
        */}
        {slide.kind === 'compare' && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-lg)',
                lineHeight: 'var(--leading-tight)',
                color: 'var(--app-dim)',
                textWrap: 'pretty',
              }}
            >
              {slide.q}
            </div>
            <div className="slide-two">
              {[
                { name: slide.left, says: slide.leftSays },
                { name: slide.right, says: slide.rightSays },
              ].map((side) => (
                <div key={side.name} className="slide-side">
                  <div
                    className="kicker"
                    style={{ color: 'var(--app-accent)', marginBottom: 'var(--sp-3)' }}
                  >
                    {side.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--type-lg)',
                      lineHeight: 'var(--leading-relaxed)',
                      textWrap: 'pretty',
                    }}
                  >
                    {side.says}
                  </div>
                </div>
              ))}
            </div>
            {slide.also && (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-5)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {slide.also}
              </div>
            )}
          </>
        )}

        {/* An answer that enumerates, as the list it already was. */}
        {slide.kind === 'bullet' && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-lg)',
                lineHeight: 'var(--leading-tight)',
                color: 'var(--app-dim)',
                textWrap: 'pretty',
              }}
            >
              {slide.q}
            </div>
            <ul
              style={{
                margin: 'var(--sp-6) 0 0',
                paddingLeft: '1.1em',
                fontSize: 'var(--type-md)',
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {slide.items.map((item) => (
                <li key={item} style={{ marginBottom: 'var(--sp-3)' }}>
                  {item.replace(/^\d+\.\s*/, '')}
                </li>
              ))}
            </ul>
          </>
        )}

        {/*
          A passage, with where it came from.

          A `note` is prose a reading brought and this is a sentence out of
          one, and the difference is worth a layout: a passage set as a
          quotation is read, and the same words in a paragraph of body text
          are skimmed. `lib/slides.ts` draws the line at length rather than at
          punctuation, because a student pasting the sentence a seminar turns
          on does not put quotation marks round it first.
        */}
        {slide.kind === 'quote' && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xl)',
                lineHeight: 'var(--leading-tight)',
                textWrap: 'pretty',
              }}
            >
              “{slide.text}”
            </div>
            <div
              style={{
                fontSize: 'var(--type-sm)',
                color: 'var(--app-dim)',
                marginTop: 'var(--sp-6)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {slide.from}
              {slide.title && slide.title !== slide.from ? ` · ${slide.title}` : ''}
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
                color: 'var(--app-dim)',
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
            <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)' }}>{slide.sub}</div>
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
                /*
                 * Above the two step regions below, which cover the card and
                 * are drawn after it. This is the only control inside a slide
                 * and it was unreachable: measured at 390×844, the point at
                 * the middle of this button belonged to "Previous slide", so
                 * the last thing a deck asks you to do stepped you backwards
                 * instead. Nothing looked wrong, and no test could see it —
                 * the button was in the document, named, enabled and painted.
                 */
                position: 'relative',
                zIndex: 1,
              }}
            >
              Drill it now
            </button>
          </>
        )}

        {/*
          Tap the left third to go back, the rest to go on.

          `width: 'auto'` is load-bearing, and the reason is two rules away
          from here: `.bare` sets `width: 100%`, and an absolutely positioned
          box with `left`, `right` *and* `width` all set is over-constrained,
          so the browser drops one edge. Measured on the running app at
          390×844: both of these were the full 352px of the card rather than a
          third and two thirds of it, "Previous slide" covered the whole slide,
          and "Next slide" started at 34% and ran 119px past the card — off
          the right of the screen, and the only horizontal overflow anywhere
          in the app at any width. `.rail-item` in app.css carries the same
          note for the same reason.
        */}
        <button
          type="button"
          className="bare"
          aria-label="Previous slide"
          onClick={() => step(-1)}
          style={{ position: 'absolute', inset: '0 66% 0 0', width: 'auto', cursor: 'w-resize' }}
        />
        <button
          type="button"
          className="bare"
          aria-label="Next slide"
          onClick={() => step(1)}
          style={{ position: 'absolute', inset: '0 0 0 34%', width: 'auto', cursor: 'e-resize' }}
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
