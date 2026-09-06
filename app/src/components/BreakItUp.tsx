/**
 * One deadline, broken into the evenings it takes.
 *
 * This sits under the deadline rather than on a planning screen of its own,
 * because the moment somebody wants a paper broken up is the moment they are
 * looking at the paper and realising how big it is. A separate screen would be
 * a place to go and decide to plan, which is not a thing anybody does.
 *
 * What it makes is ordinary tasks — see `lib/steps.ts` for why that is the
 * whole design. Once made they are the person's, and this panel stops having
 * an opinion about them: it will not re-plan, re-date, or tidy up after edits.
 * It only knows whether it has been used, so it does not offer twice.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { planFor, planLine } from '../lib/steps';
import type { DatedItem } from '../lib/types';

/** How a step is titled, and the prefix that finds it again afterwards. */
function stepTitle(item: DatedItem, step: string): string {
  return `${item.title} — ${step}`;
}

export function BreakItUp({ item }: { item: DatedItem }) {
  const { state, dispatch, now, say } = useStore();
  const [shown, setShown] = useState(false);

  const prefix = `${item.title} — `;
  const already = state.tasks.filter((t) => t.title.startsWith(prefix));
  const done = !!state.done[item.id];
  const steps = planFor(item.kind, item.date, now);

  // Nothing to offer for work that is finished, already broken up, or too
  // close to break up. The last is the useful refusal: a plan made the night
  // before is five things to do this evening dressed as a schedule.
  if (done) return null;

  if (already.length > 0) {
    const left = already.filter((t) => !t.done).length;
    return (
      <div
        style={{
          marginTop: 10,
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          lineHeight: 1.5,
        }}
      >
        Broken into {already.length} {already.length === 1 ? 'step' : 'steps'}
        {left === 0 ? ', all ticked off' : `, ${left} still to do`}. They are in your list, on their
        own days.
      </div>
    );
  }

  if (steps.length === 0) return null;

  if (!shown) {
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setShown(true)}
        style={{
          width: 'auto',
          padding: '8px 0 2px',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        Break this into steps
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 13px',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div className="kicker">{planLine(steps, item.title)}</div>

      {/* Shown before they are made, because a plan somebody disagrees with is
          worse than none — and the way to disagree with this one is to not
          press the button, which costs nothing. */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {steps.map((s) => (
          <div key={s.title} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(11px * var(--text-scale, 1))',
                letterSpacing: '0.08em',
                opacity: 0.55,
                width: 46,
                flex: 'none',
              }}
            >
              {s.date.slice(5).replace('-', '/')}
            </span>
            <span style={{ fontSize: 'calc(13px * var(--text-scale, 1))', flex: 1, minWidth: 0 }}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => {
            for (const s of steps) {
              dispatch({
                type: 'addTask',
                task: {
                  title: stepTitle(item, s.title),
                  date: s.date,
                  time: '',
                  // Where it came from, in the row itself, so a step found in
                  // the task list three weeks later says what it is for.
                  note: `Step towards ${item.title}, due ${item.dueShort}.`,
                  courseId: item.c,
                },
              });
            }
            say(
              `${steps.length} steps added to your list, the first on ${steps[0].date.slice(5)}. Edit or delete them like any other.`,
            );
          }}
          style={{
            width: 'auto',
            padding: '9px 13px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-accent)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
          }}
        >
          Put these in my list
        </button>
        <button
          type="button"
          className="bare"
          onClick={() => setShown(false)}
          style={{ width: 'auto', padding: '9px 4px', fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.5 }}
        >
          Not now
        </button>
      </div>

      {/* Said once, here, rather than implied by silence. The app knows how
          long kinds of work take this student — `lib/pace.ts` — and does not
          know how long "gather sources" takes, so it does not guess. */}
      <div
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.5,
          marginTop: 10,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        Dates only. How long each step takes is your call — the app has no way to know, and a made-up
        hour figure per step would read as a schedule.
      </div>
    </div>
  );
}
