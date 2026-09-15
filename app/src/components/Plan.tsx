import { useMemo } from 'react';
import { isoToDate, longLabel } from '../lib/date';
import {
  daysOf,
  layOut,
  minutesOn,
  missed,
  onDay,
  today as todayKey,
  willMove,
  type Session,
} from '../lib/sessions';
import type { Stretch } from '../lib/revise';
import { ActionButton, SectionLabel } from './ui';
import { Blueprint } from './Blueprint';
import { ChevronRight } from './Icons';

/**
 * The week's plan, and the one button for the evenings that did not happen.
 *
 * Everything else on this tab is computed on render — `rank` orders the units,
 * `planFor` fills tonight's minutes, both fresh every time. That is why
 * nothing in this app could be *missed* until now: a plan that only exists
 * while the screen is open has no yesterday, so the evening nobody studied
 * leaves no trace and tomorrow offers the same four units as though the
 * skipped night had not happened.
 *
 * ## The missed banner is the whole feature
 *
 * Not the week grid. Laying sittings across days is the easy half and it is
 * not what makes a study plan survive contact with a term — what does is
 * what happens on the fourth missed evening, when a plan that conserves
 * everything says four hours on a Thursday and gets deleted.
 *
 * So the button says what it will do *before* it is pressed, dropping
 * included, and the sentence comes from `willMove`, which calls the same
 * `moveOn` the press does. Two counts of one thing, taken two ways, is how
 * this repository has produced most of its wrong numbers; a preview that can
 * disagree with the action is worse than none, because it is a promise.
 *
 * ## Why there is no tick box
 *
 * A sitting is finished by doing it. The row opens the drill, and `Study.tsx`
 * marks the sitting done when the drill is started from it — a checkbox beside
 * it would be a second, easier way to make the plan say you had studied, and a
 * plan you can satisfy without studying is a plan that measures nothing. It is
 * the same argument `lib/knowing.ts` makes about the mastery percentage: the
 * app should report what happened.
 */
export function Plan({
  sessions,
  ranked,
  now,
  dayMinutes,
  onPlan,
  onMove,
  onOpen,
  onClear,
}: {
  sessions: Session[];
  /** Every unit worth an evening, best first — `rank`'s output. */
  ranked: Stretch[];
  now: Date;
  /** The ceiling for one evening. The student's own chip, not a constant. */
  dayMinutes: number;
  onPlan: (sessions: Session[], from: string) => void;
  onMove: () => void;
  onOpen: (session: Session) => void;
  onClear: () => void;
}) {
  const today = todayKey(now);
  const late = useMemo(() => missed(sessions, today), [sessions, today]);
  const days = useMemo(() => daysOf(sessions, today), [sessions, today]);
  const preview = useMemo(
    () => willMove(sessions, { today, dayMinutes }),
    [sessions, today, dayMinutes],
  );

  const lay = () => onPlan(layOut(ranked, { from: today, dayMinutes }), today);

  if (sessions.length === 0) {
    return (
      <>
        <SectionLabel style={{ marginTop: 'calc(20px * var(--density, 1))', marginBottom: 'var(--sp-2)' }}>The week ahead</SectionLabel>
        <div
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            marginBottom: 'var(--sp-6)',
            textWrap: 'pretty',
          }}
        >
          {/*
            Says what a committed plan buys, because it is not obvious: the
            ranking below already tells you what to do tonight. What it cannot
            do is notice that you did not.
          */}
          Lay tonight’s ranking across the evenings ahead. Once it is on days it can be behind —
          and an evening you miss is something the app can offer to move, rather than something
          it quietly forgets.
        </div>
        <ActionButton onClick={lay} disabled={ranked.length === 0}>
          Plan the fortnight
        </ActionButton>
      </>
    );
  }

  return (
    <>
      <SectionLabel style={{ marginTop: 'calc(20px * var(--density, 1))', marginBottom: 'var(--sp-2)' }}>The week ahead</SectionLabel>

      {late.length > 0 && (
        <Blueprint
          plain
          style={{
            paddingBlock: 'var(--sp-6)',
            paddingInline: 'var(--sp-7)',
            marginBottom: 'var(--sp-6)',
            display: 'block',
          }}
        >
          <div className="kicker" style={{ color: 'var(--app-fg)' }}>
            {late.length} {late.length === 1 ? 'sitting' : 'sittings'} missed
          </div>
          <div
            style={{
              fontSize: 'var(--type-base)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-2)',
              textWrap: 'pretty',
            }}
          >
            {/*
              The preview, and it is allowed to say the unwelcome half. An app
              that only mentions the moving and then silently drops eleven
              sittings has told you the plan is fine when it is not.
            */}
            {preview}
          </div>
          <ActionButton onClick={onMove} style={{ marginTop: 'var(--sp-5)' }}>
            Move them
          </ActionButton>
        </Blueprint>
      )}

      {days.length === 0 ? (
        <div
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            marginBottom: 'var(--sp-6)',
            textWrap: 'pretty',
          }}
        >
          Nothing left in the plan from today. Lay a new one down whenever you want it.
        </div>
      ) : (
        days.map((day) => {
          const rows = onDay(sessions, day);
          const spent = minutesOn(sessions, day);
          return (
            <div key={day} style={{ marginBottom: 'var(--sp-6)' }}>
              <div
                className="kicker"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)' }}
              >
                <span>{day === today ? 'Today' : longLabel(isoToDate(day))}</span>
                <span style={{ color: 'var(--app-dim)' }}>{spent} min</span>
              </div>
              {rows.length === 0 ? (
                <div
                  style={{
                    fontSize: 'var(--type-xs)',
                    color: 'var(--app-dim)',
                    marginTop: 'var(--sp-3)',
                  }}
                >
                  All done.
                </div>
              ) : (
                rows.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="bare tappable tap-x"
                    onClick={() => onOpen(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-5)',
                      width: '100%',
                      textAlign: 'left',
                      paddingBlock: 'var(--sp-4)',
                    }}
                  >
                    <span
                      style={{
                        width: 44,
                        flex: 'none',
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'var(--type-md)',
                        color: 'var(--app-dim)',
                      }}
                    >
                      {s.minutes}m
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--type-base)',
                          lineHeight: 'var(--leading-tight)',
                        }}
                      >
                        {s.name}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--type-xs)',
                          color: 'var(--app-dim)',
                          marginTop: 'var(--sp-1)',
                        }}
                      >
                        {s.code}
                        {/*
                          A sitting moved more than once is the only number
                          that says the plan is not working, and it is worth
                          more than the plan's own optimism. Said from twice
                          on, because once is an evening and twice is a
                          pattern.
                        */}
                        {(s.moved ?? 0) > 1 && ` · moved ${s.moved} times`}
                      </span>
                    </span>
                    {/* Dimmed with the audited token rather than a hand-written
                        opacity — see `lib/dim.ts` and `styles/rules.ts`. */}
                    <ChevronRight size={14} style={{ color: 'var(--app-dim)', flex: 'none' }} />
                  </button>
                ))
              )}
            </div>
          );
        })
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}>
        <button type="button" className="bare tappable tap-y standing-clear" onClick={lay}>
          Plan it again
        </button>
        <button type="button" className="bare tappable tap-y standing-clear" onClick={onClear}>
          Drop the plan
        </button>
      </div>
    </>
  );
}
