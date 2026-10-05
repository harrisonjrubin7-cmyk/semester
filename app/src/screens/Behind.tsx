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

import { lazy, Suspense } from 'react';
import { useAccountId, useNow, useStore } from '../state/store';
import { DIMMED_ROW } from '../lib/dim';
import { Page } from '../components/Page';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { datedItems } from '../lib/select';
import { WAKING_HOURS, hoursOn } from '../lib/windows';
import { behindLine, howBehind, moves, movesLine, triage, type Step } from '../lib/behind';
import type { Screen } from '../lib/types';
import { misses, missesLine } from '../lib/misses';
import { INSTITUTIONAL_PREVIEW } from '../lib/institutional-preview';
import { LifeEvents } from '../components/LifeEvents';
import { LIFE_EVENTS_KEY, dayOf, lifeEventsOn } from '../lib/lifeevents';
import { seedHelp } from '../lib/help-routes';

const FlightPlanRecovery = lazy(() =>
  import('../components/institutional/FlightPlanRecovery').then((module) => ({
    default: module.FlightPlanRecovery,
  })),
);

function FlightPlanRecoverySlot() {
  if (!INSTITUTIONAL_PREVIEW) return null;
  return <Suspense fallback={null}><FlightPlanRecovery /></Suspense>;
}

const GROUPS: { where: Step['where']; label: string; note: string }[] = [
  {
    where: 'gone',
    label: 'Already gone',
    note: 'Here first because it is the part being avoided, and because it is the part with a move attached that is not working harder.',
  },
  { where: 'today', label: 'Today', note: '' },
  { where: 'fits', label: 'Fits in the hours you have', note: '' },
  { where: 'available', label: 'Other unfinished work', note: 'Available to choose for a short first pass; its full effort has not been compared with this week.' },
  {
    where: 'tight',
    label: 'Past the hours you have',
    note: 'Shown rather than dropped. What to do about these is yours to decide — the app has the arithmetic and not the late policy, the professor, or the rest of your week.',
  },
];

export function Behind() {
  const { state, dispatch, catalog, courseCode } = useStore();
  const now = useNow();
  const accountId = useAccountId();
  if (catalog.empty) return <FirstRun where="to sort out a bad week" />;

  // The hours are the student's own, from their work windows. Where they have
  // set none the app falls back to a waking day and says so in `moves` — every
  // figure here rests on this number.
  const week = state.windows.length > 0
    ? [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + hoursOn(state.windows, d), 0)
    : WAKING_HOURS * 7;

  const items = datedItems(catalog, now);
  const b = howBehind(items, state.done, state.spent, week);
  const triageSteps = triage(items, state.done, state.spent, week);
  const shortTaskFallback = state.recoveryIntent === 'short_task' && triageSteps.length === 0;
  const steps = shortTaskFallback
    ? items
      .filter((item) => !state.done[item.id])
      .sort((a, b) => Math.abs(a.daysAway) - Math.abs(b.daysAway))
      .map((item): Step => ({
        id: item.id,
        title: item.title,
        courseId: item.c,
        where: item.daysAway < 0 ? 'gone' : item.daysAway === 0 ? 'today' : 'available',
        minutes: null,
        daysAway: item.daysAway,
        worth: 0,
        says: `${item.dueShort}; outside the usual one-week triage window.`,
      }))
    : triageSteps;
  const attendance = misses(
    catalog.courses.map((c) => c.id),
    state.attendPolicy,
    state.attendance,
    courseCode,
    now,
  );

  return (
    <Page>
      <Blueprint style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(16px * var(--density, 1))' }}>
        <div className="kicker">Where it actually stands</div>
        <div
          className="chrome-text"
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--type-lg)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {shortTaskFallback && steps.length > 0
            ? `Showing ${steps.length} unfinished ${steps.length === 1 ? 'item' : 'items'} to choose a short first pass, including work outside the usual one-week triage window.`
            : behindLine(b)}
        </div>
      </Blueprint>

      <FlightPlanRecoverySlot />

      {state.recoveryIntent === 'short_task' ? (
        <Blueprint style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-5)' }}>
          <div className="kicker">Your 2–25 minute start</div>
          {steps.length > 0 ? (
            <p style={{ marginBottom: 0 }}>Choose one item below. The item will keep this recovery choice visible so you can timebox a first pass without changing its official requirement or due date.</p>
          ) : (
            <>
              <p>No unfinished coursework is available here. Nothing needs to be reopened to fill this time.</p>
              <button type="button" className="bare tappable" onClick={() => dispatch({ type: 'go', screen: 'home' })}>Open Today for another action</button>
            </>
          )}
        </Blueprint>
      ) : null}

      {/*
        Before the deadlines, because a bad week is often not about the
        deadlines: an availability that changed, somebody to look after, a
        place to live. It asks for no reason and sends nothing — see
        `lib/lifeevents.ts`. Off unless `VITE_ME_LIFE_EVENTS` is set.
      */}
      {lifeEventsOn() && (
        <LifeEvents
          storageKey={`${LIFE_EVENTS_KEY}:${accountId || 'device'}`}
          today={dayOf(now)}
          onGo={(screen) => dispatch({ type: 'go', screen })}
          onHelp={(need) =>
            seedHelp(
              { need, from: 'You said something has changed. Nothing else is filled in.', fields: {} },
              () => dispatch({ type: 'go', screen: 'university' }),
            )
          }
        />
      )}

      {/*
        Before the deadlines, because a percentage already gone outranks a
        busy Thursday even though the Thursday is sooner — see `lib/misses.ts`
        for why these are their own group rather than rows in the list below.
      */}
      {attendance.length > 0 && (
        <div>
          <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>Turning up</SectionLabel>
          <div
            style={{
              fontSize: 'var(--type-xs-plus)',
              color: 'var(--app-dim)',
              marginBottom: 'calc(9px * var(--density, 1))',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {missesLine(attendance)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
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
                  paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
                  border: '1px solid var(--app-line)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-relaxed)',
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
            <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>{label}</SectionLabel>
            {note ? (
              <div
                style={{
                  fontSize: 'var(--type-xs-plus)',
                  color: 'var(--app-dim)',
                  marginBottom: 'calc(9px * var(--density, 1))',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {note}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
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
                    paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--app-line)',
                    opacity: where === 'tight' ? DIMMED_ROW : 1,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-base-plus)',
                      lineHeight: 'var(--leading-tight-plus)',
                      textWrap: 'pretty',
                    }}
                  >
                    {s.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-xs-plus)',
                      color: 'var(--app-dim)',
                      marginTop: 'calc(3px * var(--density, 1))',
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

      <SectionLabel style={{ marginTop: 'calc(26px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>Other moves</SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          marginBottom: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {movesLine(b)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(9px * var(--density, 1))' }}>
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
              paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-base-plus)',
                lineHeight: 'var(--leading-tight-plus)',
              }}
            >
              {m.what}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-xs-plus)',
                color: 'var(--app-dim)',
                marginTop: 'var(--sp-2)',
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {m.why}
            </span>
          </button>
        ))}
      </div>
    </Page>
  );
}
