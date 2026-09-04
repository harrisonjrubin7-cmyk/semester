import { useEffect, useMemo, useState } from 'react';
import { allCards } from '../data/catalog';
import { useStore } from '../state/store';
import { SURES, beliefs, calibration, calibrationLine } from '../lib/sure';
import { SayIt } from '../components/SayIt';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { buildQuiz } from '../lib/quiz';
import { cardKey, dueCount, dueFirst } from '../lib/review';
import { interleave, mixLine, worthMixing } from '../lib/interleave';
import { useKeepAwake } from '../lib/awake';
import { unitName } from '../lib/unit';
import { Toggle } from '../components/ui';

/** Tap-to-flip drill, with Again / Got it and an end-of-run score. */
export function Drill() {
  const { state, dispatch, now, catalog, courseCode } = useStore();
  const { guide } = useLive(state.guideId);

  // A drill has pauses in it while you try to remember, which is exactly what
  // a phone reads as idling. See `lib/awake.ts`.
  useKeepAwake();

  // Order is the point of keeping records: what is overdue comes first, then
  // what you have never seen, then what you already know — weakest first
  // inside each band. The run is fixed when it starts so answering a card does
  // not reshuffle the deck under your thumb.
  const pool = useMemo(() => {
    /*
     * Mixing pulls from every course, not from this one.
     *
     * Interleaving within a single guide would be a different word for
     * shuffling units — the whole result is about having to work out *which
     * kind* of question this is, and two units of one course are not different
     * kinds. So the mixed deck is built across the catalogue and the unit
     * filter is dropped, because a unit belongs to one course by definition.
     */
    if (state.drillMix) {
      const every = catalog.modules.flatMap((m) =>
        allCards(m.guide).map((c) => ({
          ...c,
          key: cardKey(m.course.id, c.q),
          courseId: m.course.id,
        })),
      );
      return interleave(dueFirst(every, state.reviews, now.getTime()), (c) => c.courseId);
    }
    const all = allCards(guide).map((c) => ({
      ...c,
      key: cardKey(state.guideId, c.q),
      courseId: state.guideId,
    }));
    const scoped = state.drillUnit === null ? all : all.filter((c) => c.ui === state.drillUnit);
    return dueFirst(scoped, state.reviews, now.getTime());
    // Deliberately NOT depending on `guide` or `state.reviews`. Both change on
    // every answer now that mastery is measured, and re-sorting the deck under
    // your thumb mid-run skips cards and repeats others — a full pass of 68
    // recorded 34. The order is decided when the run starts and then held.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.guideId, state.drillUnit, state.drillMix]);

  /*
   * Whether mixing is even on the table.
   *
   * Computed from the whole catalogue rather than from `pool`, because when
   * mixing is off the pool is one course and would always say no — the switch
   * would appear only once it was already on.
   */
  const canMix = useMemo(
    () =>
      worthMixing(
        catalog.modules.flatMap((m) =>
          m.guide.units.flatMap((u) => u.cards.map(() => ({ c: m.course.id }))),
        ),
        (x) => x.c,
      ),
    [catalog],
  );

  // Cleared whenever the card changes, so the last card's answer cannot be
  // left sitting under the next question.
  const [said, setSaid] = useState('');
  useEffect(() => setSaid(''), [state.drillIdx]);

  const finished = state.drillIdx >= pool.length;
  const card = pool[state.drillIdx] ?? pool[0];

  if (pool.length === 0) {
    return (
      <div style={{ padding: 18, fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.6 }}>
        Nothing to drill in this unit yet.
      </div>
    );
  }

  if (finished) {
    const got = state.drillGot;
    // A key back to its question, from the deck in hand. Cards from other
    // courses cannot be resolved here and are left out rather than shown as a
    // hash, which would be worse than saying nothing.
    const cardText = (key: string) => pool.find((c) => c.key === key)?.q ?? '';
    const waiting = dueCount(
      pool.map((c) => c.key),
      state.reviews,
      now.getTime(),
    );
    const verdict =
      got === pool.length
        ? 'Cold locked.'
        : got >= pool.length * 0.6
          ? 'Solid.'
          : 'Come back tonight.';
    return (
      <div style={{ padding: 18 }}>
        <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
          <div className="chrome-text" style={{ fontSize: 'calc(60px * var(--text-scale, 1))', lineHeight: 1 }}>
            {got}/{pool.length}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(24px * var(--text-scale, 1))', marginTop: 4 }}>
            {verdict}
          </div>
          <div
            style={{
              fontSize: 'calc(14px * var(--text-scale, 1))',
              opacity: 0.65,
              marginTop: 8,
              maxWidth: '32ch',
              marginInline: 'auto',
              textWrap: 'pretty',
            }}
          >
            You reviewed {pool.length} cards in {guide.code}. Every answer is recorded against the
            card, so what you missed comes back sooner and what you know comes back later.
          </div>

          {/* This used to promise "missed ones come back first tomorrow" while
              keeping no record of what was missed. Now it reads the schedule. */}
          <Blueprint plain style={{ padding: 14, marginTop: 26, textAlign: 'left' }}>
            <div className="kicker">What comes back</div>
            <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 6, lineHeight: 1.5 }}>
              {waiting === 0
                ? 'Nothing in this course is due right now. Come back tomorrow.'
                : `${waiting} ${waiting === 1 ? 'card is' : 'cards are'} due again in ${guide.code}.`}
            </div>
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.45 }}>
              Missed cards return in ten minutes. A card you get right three times running moves out
              to weeks.
            </div>
          </Blueprint>

          {/*
            How well you know what you know.

            Students are systematically overconfident about anything they have
            reread, and being shown the gap is what breaks the reread habit.
            Two facts about the same person, no grade and no target — see
            `lib/sure.ts` for why a graded calibration destroys its own signal.
          */}
          <Blueprint plain style={{ padding: 14, marginTop: 14, textAlign: 'left' }}>
            <div className="kicker">How sure you were</div>
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
              {calibrationLine(calibration(state.answers))}
            </div>
            {beliefs(state.answers).length > 0 ? (
              <div
                style={{
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  opacity: 0.7,
                  marginTop: 8,
                  lineHeight: 1.5,
                  textWrap: 'pretty',
                }}
              >
                {/* Named rather than counted. A wrong answer you were certain
                    about is a belief, and it is the one thing in the whole log
                    worth going back to on purpose. */}
                {beliefs(state.answers)
                  .slice(0, 3)
                  .map((b) => cardText(b.key))
                  .filter(Boolean)
                  .join(' · ') || 'Those cards are in this course’s deck, marked to come back soon.'}
              </div>
            ) : null}
          </Blueprint>

          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'go', screen: 'guide' })}
              style={{ flex: 1, height: 48, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Guide
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'redrill' })}
              style={{ flex: 1, height: 48, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Run it again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 620,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--app-track)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((state.drillIdx / pool.length) * 100)}%`,
              background: 'var(--chrome)',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            opacity: 0.55,
          }}
        >
          {state.drillIdx + 1} / {pool.length}
        </div>
      </div>

      <div className="kicker" style={{ marginTop: 18 }}>
        {/* In a mixed run the course matters more than the unit — knowing
            which subject you are in is half of what the card is testing, so
            it is named rather than left to be inferred from the question. The
            unit's number comes off: every course has a unit 0, and
            `ECON 1020 · 0 · …` reads as three things when it is two. */}
        {state.drillMix ? `${courseCode(card.courseId)} · ${unitName(card.unit)}` : card.unit}
      </div>

      {canMix && (
        <div style={{ marginTop: 10 }}>
          <Toggle
            label="Mix the courses"
            on={state.drillMix}
            onChange={() => dispatch({ type: 'mixCourses', on: !state.drillMix })}
          />
          <div
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.55,
              marginTop: 6,
              lineHeight: 1.45,
              textWrap: 'pretty',
            }}
          >
            {mixLine(pool, (c) => c.courseId, state.drillMix)}
          </div>
        </div>
      )}

      <button
        type="button"
        className="blueprint bare"
        onClick={() => !state.revealed && dispatch({ type: 'flip' })}
        style={{
          marginTop: 10,
          padding: '24px 20px',
          minHeight: 250,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: state.revealed ? 'var(--app-panel)' : 'transparent',
          cursor: state.revealed ? 'default' : 'pointer',
        }}
      >
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        <span
          className="chrome-text"
          style={{
            fontSize: 'calc(26px * var(--text-scale, 1))',
            lineHeight: 1.14,
            letterSpacing: '-0.01em',
            textWrap: 'pretty',
            display: 'block',
          }}
        >
          {card.q}
        </span>
        {state.revealed && (
          <span
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--app-line)',
              fontSize: 'calc(16px * var(--text-scale, 1))',
              lineHeight: 1.5,
              textWrap: 'pretty',
              display: 'block',
            }}
          >
            {card.a}
          </span>
        )}
      </button>

      {/* Committing to an answer before turning the card over is the whole
          difference between recall and recognition. Nothing scores it — see
          `components/SayIt.tsx`. */}
      <SayIt said={said} onSaid={setSaid} revealed={state.revealed} />

      {!state.revealed && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            opacity: 0.45,
            marginTop: 12,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Tap the card to answer
        </div>
      )}

      <div style={{ flex: 1, minHeight: 18 }} />

      {/*
        Two rows rather than two buttons.

        To the scheduler a lucky guess and a settled fact were the same answer,
        and so were a confident miss and a shrug. They are not remotely the
        same: a wrong answer you were certain about is a *belief* and you will
        carry it into the room, and a right answer you guessed at should not
        start a three-day interval. See `lib/sure.ts`.

        The confidence is optional at the level of the tap — "Got it" and
        "Again" still work on their own — because a drill that demands two taps
        per card is a drill people stop doing, and half a signal beats none.
      */}
      {state.revealed && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'markCard', got: false, key: card.key })}
              style={{ flex: 1, height: 52, fontSize: 'calc(15px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'markCard', got: true, key: card.key })}
              style={{ flex: 1, height: 52, fontSize: 'calc(15px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Got it
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 9,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'calc(11px * var(--text-scale, 1))',
                opacity: 0.5,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Or say how sure
            </span>
            {SURES.map((s) => (
              <button
                key={`wrong-${s.id}`}
                type="button"
                className="bare tappable"
                onClick={() =>
                  dispatch({ type: 'markCard', got: false, key: card.key, sure: s.id, courseId: state.guideId })
                }
                style={{
                  width: 'auto',
                  padding: '6px 9px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--app-line)',
                  fontSize: 'calc(10.5px * var(--text-scale, 1))',
                  opacity: 0.85,
                }}
              >
                ✗ {s.short}
              </button>
            ))}
            {SURES.map((s) => (
              <button
                key={`right-${s.id}`}
                type="button"
                className="bare tappable"
                onClick={() =>
                  dispatch({ type: 'markCard', got: true, key: card.key, sure: s.id, courseId: state.guideId })
                }
                style={{
                  width: 'auto',
                  padding: '6px 9px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--app-accent)',
                  fontSize: 'calc(10.5px * var(--text-scale, 1))',
                }}
              >
                ✓ {s.short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ten multiple choice, with the full answer revealed after each pick. */
export function Quiz() {
  const { state, dispatch } = useStore();
  const { guide } = useLive(state.guideId);
  const over = state.quiz.length > 0 && state.quizIdx >= state.quiz.length;
  const current = state.quiz[state.quizIdx];

  if (over) {
    const score = state.quizScore;
    const n = state.quiz.length;
    const verdict =
      score >= n - 1 ? 'Exam-ready.' : score >= n * 0.6 ? 'Nearly there.' : 'Read the units again.';
    return (
      <div style={{ padding: 18 }}>
        <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
          <div className="chrome-text" style={{ fontSize: 'calc(60px * var(--text-scale, 1))', lineHeight: 1 }}>
            {score}/{n}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(24px * var(--text-scale, 1))', marginTop: 4 }}>
            {verdict}
          </div>
          <div
            style={{
              fontSize: 'calc(14px * var(--text-scale, 1))',
              opacity: 0.65,
              marginTop: 8,
              maxWidth: '32ch',
              marginInline: 'auto',
              textWrap: 'pretty',
            }}
          >
            Ten questions pulled at random from {guide.code}. Re-run it and you get a different ten.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 26 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'go', screen: 'guide' })}
              style={{ flex: 1, height: 48, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Guide
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'startQuiz', quiz: buildQuiz(guide, state.quizSeed) })}
              style={{ flex: 1, height: 48, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              New ten
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return <div style={{ padding: 18, fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.6 }}>Building the quiz…</div>;
  }

  const answered = state.quizPicked !== null;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--app-track)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((state.quizIdx / state.quiz.length) * 100)}%`,
              background: 'var(--chrome)',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            opacity: 0.55,
          }}
        >
          {state.quizIdx + 1} / {state.quiz.length}
        </div>
      </div>

      <div className="kicker" style={{ marginTop: 18 }}>
        {current.unit}
      </div>
      <div
        className="chrome-text"
        style={{
          fontSize: 'calc(24px * var(--text-scale, 1))',
          lineHeight: 1.16,
          letterSpacing: '-0.01em',
          marginTop: 6,
          textWrap: 'pretty',
        }}
      >
        {current.q}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
        {current.opts.map((o, i) => {
          const chosen = state.quizPicked === i;
          const reveal = answered;
          return (
            <button
              key={i}
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'pickAnswer', index: i })}
              disabled={answered}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '12px 13px',
                border: `1px solid ${
                  reveal && o.ok
                    ? 'var(--app-accent)'
                    : chosen
                      ? 'rgba(233,235,239,.55)'
                      : 'var(--app-line)'
                }`,
                background: reveal && o.ok ? 'var(--app-accent-wash)' : chosen ? 'var(--app-track)' : 'transparent',
                opacity: reveal && !o.ok && !chosen ? 0.5 : 1,
                cursor: answered ? 'default' : 'pointer',
              }}
            >
              <span
                style={{
                  width: 16,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(14px * var(--text-scale, 1))',
                  lineHeight: 1.35,
                  color: 'var(--app-accent)',
                }}
              >
                {reveal && o.ok ? '✓' : chosen ? '✕' : ''}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.4, textWrap: 'pretty' }}>
                {o.text}
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <Blueprint style={{ padding: '13px 14px', marginTop: 16 }}>
            <div className="kicker">In full</div>
            <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
              {current.full}
            </div>
          </Blueprint>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'nextQuestion' })}
            style={{
              height: 48,
              fontSize: 'calc(15px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            Next
          </button>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
