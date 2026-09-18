import { useEffect, useMemo, useState } from 'react';
import { allCards } from '../data/catalog';
import { useNow, useStore } from '../state/store';
import { SURES, beliefs, calibration, calibrationLine } from '../lib/sure';
import { SayIt } from '../components/SayIt';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { buildQuiz } from '../lib/quiz';
import { ladderFor, nextRungLabel, scoreLine } from '../lib/ladder';
import { A_SITTING, aSitting, catching, dueCount } from '../lib/review';
import { inTime, testsNear } from '../lib/intime';
import { mixLine, worthMixing } from '../lib/interleave';
import { guideDeck, mixedDeck } from '../lib/drilldeck';
import { useKeepAwake } from '../lib/awake';
import { unitName } from '../lib/unit';
import { ActionButton, EmptyState, Toggle } from '../components/ui';
import { secondLine } from '../lib/dim';

/** Tap-to-flip drill, with Again / Got it and an end-of-run score. */
export function Drill() {
  const { state, dispatch, catalog, courseCode, say } = useStore();
  const now = useNow();
  const { guide } = useLive(state.guideId);

  // A drill has pauses in it while you try to remember, which is exactly what
  // a phone reads as idling. See `lib/awake.ts`.
  useKeepAwake();

  // Order is the point of keeping records: what is overdue comes first, then
  // what you have never seen, then what you already know — weakest first
  // inside each band. The run is fixed when it starts so answering a card does
  // not reshuffle the deck under your thumb.
  /*
   * The schedule, with a test in the next three weeks taken into account.
   *
   * SM-2 does not know what a semester is: a card answered right three times
   * goes away for sixteen days, and the exam is in ten. `lib/intime.ts` brings
   * those back for one last look before the test without touching what is
   * stored, so this deck is dealt against a schedule that knows what the
   * revision is *for*. Identity is preserved when nothing moved, which is what
   * keeps the memo below from re-sorting the deck under your thumb.
   */
  const schedule = useMemo(
    () => inTime(state.reviews, testsNear(catalog, now), now.getTime()),
    // Same dependencies as the deck itself, and deliberately not `state.reviews`:
    // see the note in the memo below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, state.guideId, state.drillUnit, state.drillMix],
  );

  const ordered = useMemo(() => {
    // What is in the deck, and in what order, is `lib/drilldeck` — including
    // why a mixed run reads the whole catalogue and a scoped one reads its
    // unit's own cards. Dealt against `schedule` rather than `state.reviews`,
    // so a card the exam is close enough to have brought forward is dealt
    // where the test wants it. What is left here is the React question: when
    // to rebuild it.
    return state.drillMix
      ? mixedDeck(catalog.modules, schedule, now.getTime())
      : guideDeck(guide, state.guideId, state.drillUnit, schedule, now.getTime());
    // Deliberately NOT depending on `guide` or `state.reviews`. Both change on
    // every answer now that mastery is measured, and re-sorting the deck under
    // your thumb mid-run skips cards and repeats others — a full pass of 68
    // recorded 34. The order is decided when the run starts and then held.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.guideId, state.drillUnit, state.drillMix, schedule]);

  /*
   * One sitting off the front, and the rest counted rather than dropped.
   *
   * The cap goes on *after* the ordering, so a run always takes the cards
   * that matter most and never a different set — see `A_SITTING`. Derived in
   * render rather than inside the memo above because the end-of-run screen
   * has to count what is due across the whole deck, and a memo that returned
   * only the 25 would have made "nothing is due" sit directly above "43 more
   * are waiting". It did, for one build.
   */
  const sitting = aSitting(ordered);
  const pool = sitting.cards;

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

  /*
   * A deck with nothing left in it finishes the sitting it was opened for.
   *
   * The other half of the rule in `markCard`, which finishes a sitting on its
   * last planned card. A unit can have fewer cards than the sitting was sized
   * for a fortnight ago — answered in a gap run, or deleted with the reading
   * they came from — and without this the sitting would stop one short of
   * done and be reported as a missed evening on the night it was emptied.
   *
   * Safe to fire more than once: the reducer returns the state it was given
   * when there is no open sitting or it is already stamped, so this cannot
   * loop. `pool.length` guards the empty-unit case, which is handled below by
   * a screen saying so rather than by a sitting that was never studied.
   */
  useEffect(() => {
    if (finished && pool.length > 0) dispatch({ type: 'sessionSpent', at: Date.now() });
  }, [finished, pool.length, dispatch]);

  if (pool.length === 0) {
    return (
      <EmptyState
        title="Nothing to drill yet"
        body="This unit has no cards in it. Adding a reading, a lecture or a set of slides to the course puts them here."
        action={{ label: 'Add a reading', onClick: () => dispatch({ type: 'go', screen: 'update' }) }}
      />
    );
  }

  if (finished) {
    const got = state.drillGot;
    // A key back to its question, from the deck in hand. Cards from other
    // courses cannot be resolved here and are left out rather than shown as a
    // hash, which would be worse than saying nothing.
    const cardText = (key: string) => pool.find((c) => c.key === key)?.q ?? '';
    const waiting = dueCount(
      // The whole deck, not the sitting: what is due in this course does not
      // stop at the twenty-fifth card.
      ordered.map((c) => c.key),
      schedule,
      now.getTime(),
    );
    const stubborn = catching(pool, state.reviews);
    const verdict =
      got === pool.length
        ? 'Cold locked.'
        : got >= pool.length * 0.6
          ? 'Solid.'
          : 'Come back tonight.';
    return (
      <div style={{ padding: 'var(--page-pad)' }}>
        <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
          <div className="chrome-text" style={{ fontSize: 'calc(60px * var(--text-scale, 1))', lineHeight: 1 }}>
            {got}/{pool.length}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(24px * var(--text-scale, 1))', marginTop: 'var(--sp-2)' }}>
            {verdict}
          </div>
          <div
            style={{
              fontSize: 'var(--type-md)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
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
            <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
              {waiting === 0
                ? 'Nothing in this course is due right now. Come back tomorrow.'
                : `${waiting} ${waiting === 1 ? 'card is' : 'cards are'} due again in ${guide.code}.`}
            </div>
            <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
              Missed cards return in ten minutes. A card you get right three times running moves out
              to weeks.
            </div>
            {/*
              What the cap held back, said out loud.
              A run that silently dropped two hundred cards would be lying by
              omission — and the number is what makes going again a decision
              rather than a guess. See `A_SITTING` in `lib/review.ts`.
            */}
            {sitting.left > 0 && (
              <div style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                {`${sitting.left} more ${sitting.left === 1 ? 'card was' : 'cards were'} waiting and held back for the next run. A sitting is ${A_SITTING} cards so it stays finishable.`}
              </div>
            )}
          </Blueprint>

          {/*
            The cards that keep catching you out.

            A miss puts a card back in ten minutes, which is right for one you
            nearly knew and a treadmill for one you do not — the schedule has
            no way of ever concluding that the *card* is the problem. So this
            names them and stops there: they are generated from the student's
            own course material, and hiding part of a syllabus to make a
            number go up is the wrong trade. See `keepsCatching`.
          */}
          {stubborn.length > 0 && (
            <Blueprint plain style={{ padding: 'var(--sp-7)', marginTop: 'var(--sp-7)', textAlign: 'left' }}>
              <div className="kicker">These keep catching you</div>
              <div style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                {stubborn.slice(0, 3).map((c) => c.q).join(' · ')}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
                Pressing Again a ninth time is not going to do it. Go back to the reading these came
                from — the answer is usually that the card asks two things at once.
              </div>
            </Blueprint>
          )}

          {/*
            How well you know what you know.

            Students are systematically overconfident about anything they have
            reread, and being shown the gap is what breaks the reread habit.
            Two facts about the same person, no grade and no target — see
            `lib/sure.ts` for why a graded calibration destroys its own signal.
          */}
          <Blueprint plain style={{ padding: 14, marginTop: 14, textAlign: 'left' }}>
            <div className="kicker">How sure you were</div>
            <div style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
              {calibrationLine(calibration(state.answers))}
            </div>
            {beliefs(state.answers).length > 0 ? (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-4)',
                  lineHeight: 'var(--leading-relaxed)',
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

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 22 }}>
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

  /*
   * No `<Page>` here, deliberately.
   *
   * Drilling is a card filling the height with a progress bar above it, and
   * the branches around it — the empty state, the score at the end — belong to
   * the same view. A frame on some of them and not the drill itself would move
   * the card down by the height of a search box halfway through a deck, which
   * is worse than the inconsistency it would be fixing.
   */
  return (
    <div
      style={{
        padding: 'var(--page-pad)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 620,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
        <div style={{ flex: 1, height: 3, background: 'var(--app-track)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((state.drillIdx / pool.length) * 100)}%`,
              background: 'var(--chrome)',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          {/*
            Taking back the card just answered.
            Only while there is one to take back, and only within this run.
            Recording answers is what made this necessary: a mis-tapped
            "Again" halves the ease, zeroes the interval and puts the card
            back in ten minutes, and this was the one screen in the app that
            writes to a scheduler and could not be corrected.
          */}
          {state.lastAnswer && (
            <button
              type="button"
              className="bare"
              onClick={() => {
                dispatch({ type: 'undoCard' });
                say('Took back the last answer.');
              }}
              style={{ width: 'auto', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}
            >
              Undo
            </button>
          )}
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.12em',
              /* Main's, kept: the token rather than a hand-written opacity —
                 `lib/dim.ts` says why one drifts below readable and the other
                 cannot. The same swap is applied to the Undo beside it. */
              color: 'var(--app-dim)',
            }}
          >
            {state.drillIdx + 1} / {pool.length}
          </div>
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
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <Toggle
            label="Mix the courses"
            on={state.drillMix}
            onChange={() => dispatch({ type: 'mixCourses', on: !state.drillMix })}
          />
          <div
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
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
          marginTop: 'var(--sp-5)',
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
            fontSize: 'var(--type-xl)',
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
              marginTop: 'var(--sp-7)',
              paddingTop: 14,
              borderTop: '1px solid var(--app-line)',
              fontSize: 'calc(16px * var(--text-scale, 1))',
              lineHeight: 'var(--leading-relaxed)',
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
            fontSize: 'var(--type-sm)',
            opacity: 0.45,
            marginTop: 'var(--sp-6)',
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
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({ type: 'markCard', got: false, key: card.key });
                say('Marked again. Next card.');
              }}
              style={{ flex: 1, height: 52, fontSize: 'var(--type-lg)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'markCard', got: true, key: card.key });
                say('Marked got it. Next card.');
              }}
              style={{ flex: 1, height: 52, fontSize: 'var(--type-lg)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Got it
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--sp-3)',
              marginTop: 9,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--type-xs)',
                color: 'var(--app-dim)',
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
                  {
                    dispatch({ type: 'markCard', got: false, key: card.key, sure: s.id, courseId: state.guideId });
                    say(`Marked wrong, ${s.short.toLowerCase()}. Next card.`);
                  }
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
                  {
                    dispatch({ type: 'markCard', got: true, key: card.key, sure: s.id, courseId: state.guideId });
                    say(`Marked right, ${s.short.toLowerCase()}. Next card.`);
                  }
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

  /*
   * A quiz that is not in memory is built here rather than waited for.
   *
   * Starting one writes `#/quiz/econ` into the address bar, which makes it a
   * refresh, a bookmark and a link somebody sent — see `lib/route.ts`. But the
   * ten questions are ephemeral state, so all three arrive with `state.quiz`
   * empty, and this screen used to sit on "Building the quiz…" forever with
   * nothing on it to press: no back, no retry, no tenth question ever coming.
   *
   * The two entry points build the deck the same way, so building it here is
   * the same screen arrived at differently rather than a new behaviour. The
   * questions differ from the ones that were on screen before the refresh, and
   * that is the honest answer — they are drawn at random every run by design,
   * and there is nothing recorded to restore them from.
   */
  useEffect(() => {
    if (state.quiz.length === 0 && allCards(guide).length > 0) {
      dispatch({ type: 'startQuiz', quiz: buildQuiz(guide, state.quizSeed) });
    }
    // Only ever on arriving at an empty quiz. Depending on the seed would
    // rebuild the deck under the answer being read, since `startQuiz` moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.quiz.length, guide]);

  if (over) {
    const score = state.quizScore;
    const n = state.quiz.length;
    const verdict =
      score >= n - 1 ? 'Exam-ready.' : score >= n * 0.6 ? 'Nearly there.' : 'Read the units again.';
    return (
      <div style={{ padding: 'var(--page-pad)' }}>
        <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
          <div className="chrome-text" style={{ fontSize: 'calc(60px * var(--text-scale, 1))', lineHeight: 1 }}>
            {score}/{n}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(24px * var(--text-scale, 1))', marginTop: 'var(--sp-2)' }}>
            {verdict}
          </div>
          {/*
            What the score cost, said beside it and only when it cost
            something.

            A run where three answers came after a hint is a different run from
            one where none did, and a number that cannot tell them apart is a
            number about the quiz rather than about the student — which is the
            thing `lib/knowing.ts` was written to stop one screen along. The
            hinted ones are not deducted: getting there with help beats not
            getting there, and a rule that punishes asking teaches people not
            to ask.
          */}
          {state.quizHelped > 0 && (
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-sm)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--app-dim)',
                marginTop: 'var(--sp-3)',
              }}
            >
              {scoreLine(score, n, state.quizHelped)}
            </div>
          )}
          <div
            style={{
              fontSize: 'var(--type-md)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
              maxWidth: '32ch',
              marginInline: 'auto',
              textWrap: 'pretty',
            }}
          >
            Ten questions pulled at random from {guide.code}. Re-run it and you get a different ten.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 26 }}>
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

  /*
   * The effect above has a deck for anything with cards in it, so reaching
   * here means the guide has none — a course uploaded from a syllabus the
   * cards have not been written from yet. Say that, and offer the guide,
   * rather than leaving a screen that says it is working when it is not.
   */
  if (!current) {
    return (
      <EmptyState
        title="No questions yet"
        body={`${guide.code || 'This course'} has no cards to build ten questions from. Its guide is the place to start.`}
        action={{ label: 'Open the guide', onClick: () => dispatch({ type: 'go', screen: 'guide' }) }}
      />
    );
  }

  const answered = state.quizPicked !== null;

  /*
   * The hints this question can offer, and the ones already taken.
   *
   * Built from the guide's own key terms and the question's own options — see
   * `lib/ladder.ts`. Nothing is generated and nothing is fetched, which is the
   * point: the moment a student needs a hint is eleven at night, and a hint
   * that needs a configured model is a hint that is not there.
   */
  const rungs = ladderFor(current, guide.terms ?? []);
  const taken = rungs.slice(0, state.quizRungs);
  // Options a `narrow` rung has struck out. Struck through rather than
  // removed: an option that vanishes takes the student's place on the list
  // with it, and the answer they were half-considering disappears without
  // their having decided anything about it.
  const struck = new Set(taken.flatMap((r) => r.out ?? []));
  const nextHint = answered ? null : nextRungLabel(rungs, state.quizRungs);

  return (
    <div style={{ padding: 'var(--page-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
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
            fontSize: 'var(--type-sm)',
            letterSpacing: '0.12em',
            color: 'var(--app-dim)',
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
          marginTop: 'var(--sp-3)',
          textWrap: 'pretty',
        }}
      >
        {current.q}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'var(--sp-7)' }}>
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
                gap: 'var(--sp-5)',
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
                opacity: (reveal && !o.ok && !chosen) || struck.has(i) ? 0.5 : 1,
                textDecoration: struck.has(i) && !reveal ? 'line-through' : undefined,
                cursor: answered ? 'default' : 'pointer',
              }}
            >
              <span
                style={{
                  width: 16,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-md)',
                  lineHeight: 1.35,
                  color: 'var(--app-accent)',
                }}
              >
                {reveal && o.ok ? '✓' : chosen ? '✕' : ''}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 1.4, textWrap: 'pretty' }}>
                {o.text}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The ladder. Rungs already taken stay on screen — a hint you have to
        remember is a hint you read once and then re-read the question wishing
        you had it, and the whole point is to leave the student climbing.
      */}
      {taken.length > 0 && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          {taken.map((rung, i) => (
            <div
              /*
                By position, not by `rung.kind`. There are two `narrow` rungs
                now that options are struck one at a time, and keying by kind
                gave React two children with the same key — which it warns
                about and then resolves by dropping one. Caught in the browser;
                no test sees a key.
              */
              key={i}
              style={{
                fontSize: 'var(--type-base)',
                color: 'var(--app-dim)',
                lineHeight: 'var(--leading-relaxed)',
                marginTop: 'var(--sp-3)',
                textWrap: 'pretty',
              }}
            >
              {rung.says}
            </div>
          ))}
        </div>
      )}

      {nextHint && (
        <button
          type="button"
          className="bare tappable tap-y standing-clear"
          onClick={() => dispatch({ type: 'takeHint' })}
          style={{ marginTop: 'var(--sp-6)' }}
        >
          {nextHint}
        </button>
      )}

      {answered && (
        <>
          <Blueprint style={{ padding: '13px 14px', marginTop: 'var(--sp-7)' }}>
            <div className="kicker">In full</div>
            <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)', marginTop: 5, textWrap: 'pretty' }}>
              {current.full}
            </div>
          </Blueprint>
          <ActionButton
            onClick={() => dispatch({ type: 'nextQuestion' })}
            tone="primary"
            style={{ fontSize: 'var(--type-lg)', marginTop: 14 }}
          >
            Next
          </ActionButton>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
