import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { NUDGE, invite, pick, verdict } from '../lib/pretest';
import { unitName } from '../lib/unit';

/**
 * Guess first, then read.
 *
 * A drill asks what you know. This asks what you do not, on purpose, before
 * the unit has been read — see `lib/pretest.ts` for why being wrong here is
 * the mechanism rather than a failure of it.
 *
 * Which means the screen has one job beyond asking the questions: it has to
 * hold somebody through four answers they cannot give. Every piece of copy on
 * it is doing that, and nothing on it keeps a score.
 */
export function Guess() {
  const { state, dispatch, now } = useStore();
  const { guide } = useLive(state.guideId);

  const unit = guide.units[state.guessUnit];
  const asked = useMemo(() => pick(unit?.cards ?? []), [unit]);

  // Typed rather than tapped. Committing to words is the attempt, and the
  // attempt is the part that works — a multiple choice would let somebody
  // recognise their way past having one.
  const [said, setSaid] = useState('');

  if (!unit || asked.length === 0) {
    return (
      <div style={{ padding: 18, fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.6 }}>
        Nothing to guess at in this unit.
      </div>
    );
  }

  const done = state.guessIdx >= asked.length;
  const card = asked[Math.min(state.guessIdx, asked.length - 1)];

  if (done) {
    return (
      <div style={{ padding: 18 }}>
        <div className="kicker">Before you read it</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.1, marginTop: 8, textWrap: 'pretty' }}
        >
          {state.guessRight} of {asked.length}
        </div>
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.78, marginTop: 10, lineHeight: 1.55, textWrap: 'pretty' }}>
          {verdict(state.guessRight, asked.length)}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() =>
            dispatch({
              type: 'guessDone',
              courseId: state.guideId,
              unit: state.guessUnit,
              at: now.getTime(),
            })
          }
          style={{ height: 48, marginTop: 22, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Now read the unit
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', minHeight: 620 }}>
      <div className="kicker">
        {unitName(unit.name)} · {state.guessIdx + 1} of {asked.length}
      </div>

      {state.guessIdx === 0 && !state.guessSaid && (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 8, lineHeight: 1.5, textWrap: 'pretty' }}>
          {invite(asked.length, unitName(unit.name))}
        </div>
      )}

      <div
        className="chrome-text"
        style={{
          fontSize: 'calc(24px * var(--text-scale, 1))',
          lineHeight: 1.16,
          marginTop: 16,
          textWrap: 'pretty',
        }}
      >
        {card.q}
      </div>

      {!state.guessSaid ? (
        <>
          <textarea
            className="input"
            value={said}
            onChange={(e) => setSaid(e.target.value)}
            placeholder="What do you think?"
            aria-label={`Your guess at: ${card.q}`}
            rows={3}
            style={{ marginTop: 14, fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.5 }}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45, textWrap: 'pretty' }}>
            {NUDGE}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'guessShow' })}
            style={{ height: 48, marginTop: 14, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Show me
          </button>
        </>
      ) : (
        <>
          <Blueprint plain style={{ padding: 14, marginTop: 14 }}>
            <div className="kicker">The answer</div>
            <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 6, textWrap: 'pretty' }}>
              {card.a}
            </div>
          </Blueprint>
          {said.trim() && (
            <Blueprint plain style={{ padding: 14, marginTop: 10 }}>
              <div className="kicker">What you said</div>
              <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 6, opacity: 0.8, textWrap: 'pretty' }}>
                {said}
              </div>
            </Blueprint>
          )}
          {/*
            Marked by the person, not by the app.

            Nothing here can judge a sentence against an answer, and a wrong
            judgement on a guess somebody was told to make would be worse than
            no judgement. It is two taps and it counts towards a sentence, not
            a score — see `lib/pretest.ts`.
          */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSaid('');
                dispatch({ type: 'guessNext', right: false });
              }}
              style={{ flex: 1, height: 48, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Nowhere near
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSaid('');
                dispatch({ type: 'guessNext', right: true });
              }}
              style={{ flex: 1, height: 48, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Close enough
            </button>
          </div>
        </>
      )}
      <div style={{ flex: 1, minHeight: 12 }} />
    </div>
  );
}
