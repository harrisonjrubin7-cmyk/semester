/**
 * The screen for the week that went wrong.
 *
 * Every planner assumes you are on track. When you are not, the app turns into
 * a wall of red you stop opening — and not opening it is what makes next week
 * worse, so the moment it is most needed is the moment it becomes unusable.
 *
 * Three deliberate choices, all of them arguments with how these screens
 * normally look.
 *
 * **No red.** The palette is the ordinary one. A screen that shouts is a
 * screen somebody already knows the contents of and does not need shouted at
 * about.
 *
 * **No encouragement.** Software cannot know whether it will be all right, and
 * saying so is the fastest way to lose somebody who can already tell the app
 * has no idea what is happening to them. What it offers instead is a number,
 * an order, and some moves.
 *
 * **Nothing hidden.** Everything outstanding is here. A triage screen that
 * quietly dropped half the list would be the same wall of red with better
 * manners.
 */

import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { datedItems } from '../lib/select';
import { WAKING_HOURS, hoursOn } from '../lib/windows';
import { behindLine, howBehind, moves, movesLine, triage, type Step } from '../lib/behind';
import type { Screen } from '../lib/types';
import { misses, missesLine } from '../lib/misses';

const GROUPS: { where: Step['where']; label: string; note: string }[] = [
  {
    where: 'gone',
    label: 'Already gone',
    note: 'Here first because it is the part being avoided, and because it is the part with a move attached that is not working harder.',
  },
  { where: 'today', label: 'Today', note: '' },
  { where: 'fits', label: 'Fits in the hours you have', note: '' },
  {
    where: 'tight',
    label: 'Past the hours you have',
    note: 'Shown rather than dropped. What to do about these is yours to decide — the app has the arithmetic and not the late policy, the professor, or the rest of your week.',
  },
];

export function Behind() {
  const { state, dispatch, now, catalog, courseCode } = useStore();
  if (catalog.empty) return <FirstRun where="to sort out a bad week" />;

  // The hours are the student's own, from their work windows. Where they have
  // set none the app falls back to a waking day and says so in `moves` — every
  // figure here rests on this number.
  const week = state.windows.length > 0
    ? [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + hoursOn(state.windows, d), 0)
    : WAKING_HOURS * 7;

  const items = datedItems(catalog, now);
  const b = howBehind(items, state.done, state.spent, week);
  const steps = triage(items, state.done, state.spent, week);
  const attendance = misses(
    catalog.courses.map((c) => c.id),
    state.attendPolicy,
    state.attendance,
    courseCode,
    now,
  );

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">Where it actually stands</div>
        <div
          className="chrome-text"
          style={{
            marginTop: 6,
            fontSize: 'calc(15px * var(--text-scale, 1))',
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {behindLine(b)}
        </div>
      </Blueprint>

      {/*
        Before the deadlines, because a percentage already gone outranks a
        busy Thursday even though the Thursday is sooner — see `lib/misses.ts`
        for why these are their own group rather than rows in the list below.
      */}
      {attendance.length > 0 && (
        <div>
          <SectionLabel style={{ margin: '22px 0 8px' }}>Turning up</SectionLabel>
          <div
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.55,
              marginBottom: 9,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {missesLine(attendance)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attendance.map((m) => (
              <button
                key={`${m.kind}-${m.courseId}`}
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'openCourse', id: m.courseId })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 13px',
                  border: '1px solid var(--app-line)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'calc(13px * var(--text-scale, 1))',
                  lineHeight: 1.5,
                  textWrap: 'pretty',
                }}
              >
                {m.says}
              </button>
            ))}
          </div>
        </div>
      )}

      {GROUPS.map(({ where, label, note }) => {
        const group = steps.filter((s) => s.where === where);
        if (group.length === 0) return null;
        return (
          <div key={where}>
            <SectionLabel style={{ margin: '22px 0 8px' }}>{label}</SectionLabel>
            {note ? (
              <div
                style={{
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.55,
                  marginBottom: 9,
                  lineHeight: 1.5,
                  textWrap: 'pretty',
                }}
              >
                {note}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="bare tappable"
                  onClick={() => dispatch({ type: 'openItem', id: s.id })}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 13px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--app-line)',
                    opacity: where === 'tight' ? 0.72 : 1,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(13.5px * var(--text-scale, 1))',
                      lineHeight: 1.35,
                      textWrap: 'pretty',
                    }}
                  >
                    {s.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.62,
                      marginTop: 3,
                      textWrap: 'pretty',
                    }}
                  >
                    {[catalog.byId[s.courseId]?.code, s.says, s.minutes ? `about ${s.minutes} min` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <SectionLabel style={{ margin: '26px 0 8px' }}>Other moves</SectionLabel>
      <div
        style={{
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.7,
          marginBottom: 10,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {movesLine(b)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {moves(b).map((m) => (
          <button
            key={m.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: m.screen as Screen })}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'calc(13.5px * var(--text-scale, 1))',
                lineHeight: 1.35,
              }}
            >
              {m.what}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.62,
                marginTop: 4,
                lineHeight: 1.5,
                textWrap: 'pretty',
              }}
            >
              {m.why}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
