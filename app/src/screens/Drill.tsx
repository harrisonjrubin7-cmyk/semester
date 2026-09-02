import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { GUIDES, allCards } from '../data/guides';
import { buildQuiz } from '../lib/quiz';

/** Tap-to-flip drill, with Again / Got it and an end-of-run score. */
export function Drill() {
  const { state, dispatch } = useStore();
  const guide = GUIDES[state.guideId];
  const everything = allCards(guide);

  const pool =
    state.drillUnit === null
      ? everything
      : everything.filter((c) => c.ui === state.drillUnit);

  const finished = state.drillIdx >= pool.length;
  const card = pool[state.drillIdx] ?? pool[0];

  if (pool.length === 0) {
    return (
      <div style={{ padding: 18, fontSize: 14, opacity: 0.6 }}>
        Nothing to drill in this unit yet.
      </div>
    );
  }

  if (finished) {
    const got = state.drillGot;
    const verdict =
      got === pool.length
        ? 'Cold locked.'
        : got >= pool.length * 0.6
          ? 'Solid.'
          : 'Come back tonight.';
    return (
      <div style={{ padding: 18 }}>
        <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
          <div className="chrome-text" style={{ fontSize: 60, lineHeight: 1 }}>
            {got}/{pool.length}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginTop: 4 }}>
            {verdict}
          </div>
          <div
            style={{
              fontSize: 14,
              opacity: 0.65,
              marginTop: 8,
              maxWidth: '32ch',
              marginInline: 'auto',
              textWrap: 'pretty',
            }}
          >
            You reviewed {pool.length} cards in {guide.code}. Missed ones come back first tomorrow.
          </div>

          <Blueprint style={{ padding: 14, marginTop: 26, textAlign: 'left' }}>
            <div className="kicker">Queued for tomorrow</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              {pool.length - got} cards, plus whatever units are still under 40%.
            </div>
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
            fontSize: 12,
            letterSpacing: '0.12em',
            opacity: 0.55,
          }}
        >
          {state.drillIdx + 1} / {pool.length}
        </div>
      </div>

      <div className="kicker" style={{ marginTop: 18 }}>
        {card.unit}
      </div>

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
            fontSize: 26,
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
              fontSize: 16,
              lineHeight: 1.5,
              textWrap: 'pretty',
              display: 'block',
            }}
          >
            {card.a}
          </span>
        )}
      </button>

      {!state.revealed && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
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

      {state.revealed && (
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'markCard', got: false })}
            style={{ flex: 1, height: 52, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Again
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'markCard', got: true })}
            style={{ flex: 1, height: 52, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

/** Ten multiple choice, with the full answer revealed after each pick. */
export function Quiz() {
  const { state, dispatch } = useStore();
  const guide = GUIDES[state.guideId];
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
          <div className="chrome-text" style={{ fontSize: 60, lineHeight: 1 }}>
            {score}/{n}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginTop: 4 }}>
            {verdict}
          </div>
          <div
            style={{
              fontSize: 14,
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
    return <div style={{ padding: 18, fontSize: 14, opacity: 0.6 }}>Building the quiz…</div>;
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
            fontSize: 12,
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
          fontSize: 24,
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
                  fontSize: 14,
                  lineHeight: 1.35,
                  color: 'var(--app-accent)',
                }}
              >
                {reveal && o.ok ? '✓' : chosen ? '✕' : ''}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, textWrap: 'pretty' }}>
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
            <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
              {current.full}
            </div>
          </Blueprint>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'nextQuestion' })}
            style={{
              height: 48,
              fontSize: 15,
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
