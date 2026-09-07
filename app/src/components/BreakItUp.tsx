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
import { Panel } from './Produced';
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

  // `from` is the reliable half; the title prefix is how tasks made before
  // that field existed are still recognised.
  const prefix = `${item.title} — `;
  const already = state.tasks.filter((t) => t.from === item.id || (!t.from && t.title.startsWith(prefix)));
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
          marginTop: 'var(--sp-5)',
          fontSize: 'var(--type-sm)',
          opacity: 0.6,
          lineHeight: 'var(--leading-relaxed)',
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
          fontSize: 'var(--type-sm)',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        Break this into steps
      </button>
    );
  }

  return (
    <Panel style={{ marginTop: 'var(--sp-5)' }}>
      <div className="kicker">{planLine(steps, item.title)}</div>

      {/* Shown before they are made, because a plan somebody disagrees with is
          worse than none — and the way to disagree with this one is to not
          press the button, which costs nothing. */}
      <div style={{ marginTop: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {steps.map((s) => (
          <div key={s.title} style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.08em',
                opacity: 0.55,
                width: 46,
                flex: 'none',
              }}
            >
              {s.date.slice(5).replace('-', '/')}
            </span>
            <span style={{ fontSize: 'var(--type-base)', flex: 1, minWidth: 0 }}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)', flexWrap: 'wrap' }}>
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
                  from: item.id,
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
            fontSize: 'var(--type-sm)',
          }}
        >
          Put these in my list
        </button>
        <button
          type="button"
          className="bare"
          onClick={() => setShown(false)}
          style={{ width: 'auto', padding: '9px 4px', fontSize: 'var(--type-sm)', opacity: 0.5 }}
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
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        Dates only. How long each step takes is your call — the app has no way to know, and a made-up
        hour figure per step would read as a schedule.
      </div>
    </Panel>
  );
}
