import { allCards } from '../data/catalog';
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { TermSwitch } from '../components/TermSwitch';
import { FirstRun } from './FirstRun';
import { extraFigures, forCourse, liveGuide, mergeFigures } from '../lib/live';
import { modesFor } from '../lib/modes';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, Meter, SectionLabel, Segmented } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { AppGrid } from '../components/nav/AppGrid';
import { nextExam, testedIn } from '../lib/select';
import { beside, nextStep, rest } from '../lib/nextstep';
import { cardKey, dueCount } from '../lib/review';
import { destinationsIn } from '../lib/nav';
import {
  MIN_STRETCH_MINUTES,
  doneToday,
  planFor,
  planTotals,
  rank,
  type UnitFacts,
} from '../lib/revise';
import type { CourseId } from '../lib/types';

/**
 * The evenings a student actually has.
 *
 * Ten is the walk to the library, twenty-five a sitting before bed, forty-five
 * a real block. Three, because a slider over a number nobody can feel is a
 * decision handed back to the person who opened the app to be told what to do.
 */
const BUDGETS = [10, 25, 45];

/**
 * How many stretches are drawn before the rest are summarised.
 *
 * Forty-five minutes of two-minute units is a truthful plan and an unreadable
 * one — eighteen rows nobody scrolls to the end of. The whole plan is still
 * the plan, and the minutes above the rows still count all of it; past this
 * many the screen stops listing and says how many are left, next to the one
 * button that does a run that long without a decision between every unit.
 */
const PLAN_ROWS = 8;

/**
 * Study, in the shape Calendar and Mine already use.
 *
 * It was one long scroll: exam radar, two Claude cards, the guides, then the
 * revision plan at the very bottom where nobody reached it. The three are
 * different errands — pick a course to work through, be told what to revise,
 * ask something — so they are three views of the same subject rather than a
 * queue you scroll past.
 *
 * The middle one was called Tonight until the app had a screen of that name
 * doing something else: ordering everything outstanding by points of final
 * grade per hour. This one is about cards — it ranks every unit in every
 * course by what has come round, how cold it is and what is tested soon, sizes
 * the result to the time you say you have, and starts it. Both are real and
 * neither is the other, so only one keeps the word. See `lib/revise.ts`.
 *
 * The exam countdown stays above the switcher, because it is true whichever
 * view you are on and it is the thing you want to see without looking.
 */
export function Study() {
  const { state, dispatch, now, catalog, tint } = useStore();
  /**
   * Courses whose full list of ways has been asked for.
   *
   * Per course rather than one flag, and not persisted: opening the drawer is
   * a thing you do to one card in one sitting, not a preference about the app.
   */
  const [openWays, setOpenWays] = useState<Record<string, boolean>>({});
  /** How long tonight is. Not persisted: it is a fact about this evening. */
  const [minutes, setMinutes] = useState(25);
  /** One course, when the student has said so, or every course. */
  const [only, setOnly] = useState<CourseId | null>(null);
  /** Whether the ranking below the plan is showing. */
  const [showRest, setShowRest] = useState(false);
  const rowTwelve = useRowStyle(12);
  const exam = nextExam(catalog, now);

  /*
   * Every unit in every course, with what is known about it: the live guide's
   * mastery, its cards' review keys, and how soon that course is tested.
   *
   * Built here rather than in `lib/revise.ts` because it is the only part that
   * needs the catalogue — the ranking itself is arithmetic over these facts
   * and is tested without any of this. Memoised on the four things that can
   * change it, `now` included: it ticks once a minute, and a card coming round
   * at 9:31 should be in the plan at 9:31.
   */
  const units = useMemo<UnitFacts[]>(
    () =>
      catalog.courses.flatMap((c) => {
        const g = liveGuide(catalog, c.id, state.updates, state.reviews);
        const test = testedIn(catalog, now, c.id);
        return g.units.map((u, index) => ({
          courseId: c.id,
          code: g.code,
          index,
          name: u.name,
          mastery: u.mastery,
          keys: u.cards.map((card) => cardKey(c.id, card.q)),
          testInDays: test?.days ?? null,
          testKind: test?.kind ?? null,
        }));
      }),
    [catalog, state.updates, state.reviews, now],
  );
  const ranked = useMemo(() => rank(units, state.reviews, now.getTime()), [units, state.reviews, now]);
  /** The ranking as the course chips have narrowed it. */
  const mine = ranked.filter((s) => !only || s.courseId === only);
  const plan = planFor(ranked, minutes, only);
  const totals = planTotals(plan);
  const inPlan = new Set(plan.map((s) => `${s.courseId}-${s.index}`));
  const alsoRanked = mine.filter((s) => !inPlan.has(`${s.courseId}-${s.index}`)).slice(0, 6);
  const waiting = mine.reduce((n, s) => n + s.due, 0);
  const answeredToday = doneToday(state.reviews, now);
  /**
   * Open the cards for one stretch.
   *
   * `lib/revise.ts` keeps course ids as plain strings so it can be tested
   * without the catalogue; they came out of `catalog.courses` and are course
   * ids, so this is where that is said once rather than at four call sites.
   */
  const startStretch = (s: { courseId: string; index: number }) =>
    dispatch({ type: 'startDrill', unit: s.index, courseId: s.courseId as CourseId });
  // Mixing needs more than one course with cards in it, and it contradicts a
  // course the student has just chosen — below either, the button offers a
  // shuffle of one deck, which is a shuffle of nothing.
  const mixable = !only && new Set(ranked.map((s) => s.courseId)).size > 1;

  if (catalog.empty) return <FirstRun where="to study" />;
  const tab = state.studyTab;

  return (
    <Page>
      {exam && (
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Exam radar</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
            <div className="chrome-text" style={{ fontSize: 'calc(38px * var(--text-scale, 1))', lineHeight: 1 }}>
              {exam.days}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(19px * var(--text-scale, 1))', lineHeight: 1.1 }}>
                {exam.days === 1 ? 'day' : 'days'} to {exam.code} {exam.item.title}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.7 }}>
                {exam.item.mon} {exam.item.day} · {exam.item.dueTime} · {exam.item.weight}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 'var(--sp-6)',
              paddingTop: 11,
              borderTop: '1px solid var(--app-line)',
              fontSize: 'var(--type-base)',
              opacity: 0.85,
              textWrap: 'pretty',
            }}
          >
            {(() => {
              const guide = liveGuide(catalog, exam.item.c, state.updates, state.reviews);
              const coldUnits = guide.units.filter((u) => u.mastery < 40);
              if (coldUnits.length === 0) {
                return `All ${guide.units.length} units in ${guide.code} are above 40%. Keep them warm.`;
              }
              const coldCards = coldUnits.reduce((n, u) => n + u.cards.length, 0);
              return `${guide.units.length} units on it, and ${coldUnits.length} ${
                coldUnits.length === 1 ? 'is' : 'are'
              } cold — ${coldCards} cards. Drill those first.`;
            })()}
          </div>
        </Blueprint>
      )}

      <Segmented
        options={[
          { id: 'guides', label: 'Guides' },
          // Not "Tonight": that is a screen of its own, and it answers a
          // different question — which of tonight's hours are worth most
          // against a grade, across everything outstanding. This is one short
          // sitting on the unit you are weakest at. Two jobs sharing a word
          // meant the tab and the screen were a coin toss from the directory.
          { id: 'revise', label: 'Revise' },
          { id: 'ask', label: 'Tools' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setStudyTab', tab: next })}
        style={{ margin: '16px 0 4px' }}
      />

      {/*
        Here as well as on Courses, because reading last semester's guide is
        the main reason a finished term is kept at all — and Study is where a
        person goes to read one.
      */}
      {tab === 'guides' && <TermSwitch />}

      {tab === 'ask' && (
        <>
          {/*
            A home screen, generated from the directory.

            Two changes, and the second is what the first was for. Generated:
            this tab used to be two hand-written cards, Ask Claude and Work on
            it, and every tool added afterwards — the diagram drawer, the
            problem solver, the data analysis, the deck builder, the drafting
            tool, the practice paper — was reachable only through search or
            three taps into Me. Reading the list from `lib/nav.ts` means the
            next one appears here the day it is added, without anybody
            remembering to come back.

            And drawn as a grid rather than a column, because generating the
            list made it thirteen rows and a row of a card each is 68px — four
            tools on screen and nine below the fold, which is the same
            unfindability the tab was built to end. Icons with names under
            them put twelve in the space four were using, and give each one a
            position you can point at rather than read for. See
            `components/nav/AppGrid.tsx`.
          */}
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, margin: '14px 0 2px', lineHeight: 'var(--leading-relaxed)' }}>
            Everything the app can do with a course, in one place.
          </div>
          <AppGrid
            apps={[...destinationsIn('Study'), ...destinationsIn('Make')].filter((d) => d.screen !== 'study')}
            onOpen={(d) => dispatch({ type: 'go', screen: d.screen })}
          />
        </>
      )}

      {tab === 'guides' && (
        <>
      <SectionLabel>Your courses</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {catalog.courses.map((c) => {
          const g = liveGuide(catalog, c.id, state.updates, state.reviews);
          const cards = allCards(g).length;
          const mine = forCourse(state.updates, c.id);
          // Every way into this course that actually has something in it. They
          // used to be reachable only by opening the guide and then finding a
          // chip row that scrolled sideways, so most of them went unused.
          const ways = modesFor(catalog, c.id, {
            guide: g,
            lessons: catalog.lessons[c.id] ?? {},
            figures: mergeFigures(catalog.figures[c.id] ?? {}, mine),
            extras: extraFigures(catalog.extraFigures[c.id] ?? [], mine, catalog.figures[c.id] ?? {}),
          }).filter((m) => m.ready);

          // Read rather than guessed: cards whose review has come round, this
          // course's own next exam, and whether anything has been answered.
          const keys = allCards(g).map((card) => cardKey(c.id, card.q));
          const due = dueCount(keys, state.reviews, now.getTime());
          const mine_exam = nextExam(catalog, now);
          const step = nextStep({
            ways,
            guide: g,
            due,
            examIn: mine_exam && mine_exam.item.c === c.id ? mine_exam.days : null,
            started: keys.some((k) => state.reviews[k]),
          });
          return (
            <Blueprint
              plain
              key={c.id}
              style={{
                padding: '14px 15px',
                display: 'block',
                // The same stripe as the Courses list, for the same reason:
                // this is the other screen where four codes have to be told
                // apart at a glance.
                borderLeft: `3px solid ${tint(c.id).edge}`,
                paddingLeft: 'var(--sp-6)',
              }}
            >
              <button
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'openGuide', id: c.id })}
                style={{ display: 'block', width: '100%', textAlign: 'left' }}
              >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--sp-5)',
                }}
              >
                {/* The code is the name of the thing and never wraps; the
                    counts give way to it. */}
                <div
                  className="chrome-text"
                  style={{ fontSize: 'calc(20px * var(--text-scale, 1))', flex: 'none', whiteSpace: 'nowrap' }}
                >
                  {g.code}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.55,
                    textAlign: 'right',
                    minWidth: 0,
                  }}
                >
                  {g.units.length} units · {cards} cards
                </div>
              </div>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-1)' }}>{g.blurb}</div>
              <div style={{ marginTop: 11 }}>
                <Meter pct={g.mastery} fill={tint(c.id).fill} />
              </div>
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  opacity: 0.5,
                  marginTop: 5,
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {g.mastery}% mastered
              </div>
              </button>

              {/*
                One recommendation, then a few, then the rest.

                This was eleven chips of identical weight, which made somebody
                decide *how* to study before the app had helped them decide
                *what* — and at 11pm the honest answer to "cards or slides or
                cram" matters far less than starting. So the app answers first
                and nothing is taken away: every mode is still one or two taps
                off, in the same order. See `lib/nextstep.ts`.
              */}
              <div
                style={{
                  marginTop: 'var(--sp-6)',
                  paddingTop: 11,
                  borderTop: '1px solid var(--app-line)',
                }}
              >
                {step && (
                  <>
                    <ActionButton
                      onClick={() => dispatch({ type: 'openGuide', id: c.id, mode: step.id })}
                      tone="primary" spacing="0.08em"
                    >
                      {step.label}
                    </ActionButton>
                    {/* The fact it rests on. A recommendation with no reason
                        is an instruction, and an instruction from software
                        about how to study is worth nothing. */}
                    {step.why && (
                      <div
                        style={{
                          fontSize: 'calc(11.5px * var(--text-scale, 1))',
                          opacity: 0.55,
                          marginTop: 'var(--sp-3)',
                          lineHeight: 'var(--leading-normal)',
                          textWrap: 'pretty',
                        }}
                      >
                        {step.why}
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: step ? 10 : 0 }}>
                  {(openWays[c.id] ? ways.filter((m) => m.id !== step?.id) : beside(ways, step)).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn"
                      title={m.blurb}
                      onClick={() => dispatch({ type: 'openGuide', id: c.id, mode: m.id })}
                      style={{
                        flex: 'none',
                        padding: '5px 10px',
                        fontSize: 'var(--type-xs)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: 'transparent',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                  {rest(ways, step).length > 0 && !openWays[c.id] && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setOpenWays((was) => ({ ...was, [c.id]: true }))}
                      aria-expanded={false}
                      style={{
                        flex: 'none',
                        padding: '5px 10px',
                        fontSize: 'var(--type-xs)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: 'transparent',
                        opacity: 0.7,
                      }}
                    >
                      All {ways.length} ways
                    </button>
                  )}
                </div>
              </div>
            </Blueprint>
          );
        })}
      </div>

      {/* Adding a reading used to be reachable only from inside a guide, two
          screens down, so the thing that keeps a course current was the
          hardest thing in it to find. */}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'openUpdate', courseId: state.guideId, unit: null })}
        style={{ height: 44, marginTop: 14 }}
      >
        + Add a reading to a course
      </button>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        A chapter, a handout, a lecture — paste or attach it and the cards, the quiz, the guide
        and the cram sheet all take it in.
      </div>

        </>
      )}

      {tab === 'revise' && (
        <>
      <SectionLabel style={{ margin: '20px 0 4px' }}>Tonight’s sitting</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-6)', textWrap: 'pretty' }}>
        Say how long you have. The app ranks every unit in every course by what is due, how
        cold it is and what is being tested soon, then fills the time — and says why each one
        is there.
      </div>

      {/*
        The time available, which is the one thing only the student knows.
        Everything below is computed from it: an evening is not a fixed
        twenty-five minutes, and a plan that cannot be sized is a plan that
        gets abandoned the first night it does not fit.
      */}
      <Segmented
        options={BUDGETS.map((m) => ({ id: String(m), label: `${m} min` }))}
        value={String(minutes)}
        onChange={(next) => setMinutes(Number(next))}
        style={{ marginBottom: 'var(--sp-5)' }}
      />

      {/* And which courses are in play. "Tomorrow is all ECON" is a real
          evening, and it used to be unsayable — the plan always gave you one
          unit of each of four courses whether or not that made any sense. */}
      {catalog.courses.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
          {[
            { id: null as CourseId | null, label: 'All courses' },
            ...catalog.courses.map((c) => ({
              id: c.id as CourseId | null,
              label: catalog.short[c.id] ?? c.code,
            })),
          ].map((choice) => {
              const on = only === choice.id;
              return (
                <button
                  key={choice.id ?? 'all'}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  onClick={() => setOnly(on && choice.id !== null ? null : choice.id)}
                  style={{
                    flex: 'none',
                    padding: 'var(--sp-3) var(--sp-5)',
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--on-chrome)' : undefined,
                    borderLeft: choice.id ? `3px solid ${tint(choice.id).edge}` : undefined,
                  }}
                >
                  {choice.label}
                </button>
            );
          })}
        </div>
      )}

      {plan.length === 0 ? (
        /*
          Nothing to do is a real answer and gets said plainly. It used to be
          unreachable — four rows appeared every night whether or not there
          was anything behind them, so the app could never be believed when it
          said something was due.
        */
        <Blueprint style={{ padding: 'var(--sp-7)' }}>
          <div className="kicker">Nothing waiting</div>
          <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
            {mine.length === 0
              ? only
                ? 'No cards in this course yet. Add a reading to it and they appear here.'
                : 'No cards in any course yet. Add a reading to a course and they appear here.'
              : 'Everything here is answered and scheduled ahead. Come back when something comes round — or drill it anyway, below.'}
          </div>
          {mine.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => startStretch(mine[0])}
              style={{ height: 42, marginTop: 'var(--sp-6)' }}
            >
              Drill {mine[0].code} anyway
            </button>
          )}
        </Blueprint>
      ) : (
        <Blueprint style={{ padding: 'var(--sp-7)' }}>
          <div className="kicker">
            {totals.minutes} min · {totals.cards} cards · {plan.length}{' '}
            {plan.length === 1 ? 'unit' : 'units'}
          </div>

          {/* One tap to the first card. The rows below are the same plan
              entered anywhere in the middle, for a student who disagrees. */}
          <ActionButton
            tone="primary"
            onClick={() => startStretch(plan[0])}
            style={{ marginTop: 'var(--sp-5)' }}
          >
            Start — {plan[0].code}, {plan[0].minutes} min
          </ActionButton>

          <div style={{ marginTop: 'var(--sp-5)' }}>
            {plan.slice(0, PLAN_ROWS).map((s, i) => (
              <button
                key={`${s.courseId}-${s.index}`}
                type="button"
                className="bare tappable"
                onClick={() => startStretch(s)}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-6)',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  borderLeft: `3px solid ${tint(s.courseId).edge}`,
                  paddingLeft: 'var(--sp-5)',
                  ...rowTwelve,
                  ...(i === 0 ? { borderTop: 'none' } : null),
                }}
              >
                <span
                  style={{
                    width: 44,
                    flex: 'none',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-lg)',
                    opacity: 0.5,
                  }}
                >
                  {s.minutes}m
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.25 }}>{s.name}</span>
                  {/* The code is set like every other code in the app; the
                      reason is a sentence and is set like one. Three clauses
                      of tracked capitals is a wall nobody reads, which would
                      waste the only part of the row that justifies it. */}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-xs)',
                      opacity: 0.6,
                      marginTop: 'var(--sp-1)',
                      lineHeight: 'var(--leading-normal)',
                      textWrap: 'pretty',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.code}
                    </span>{' '}
                    · {s.why}
                  </span>
                </span>
                <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
              </button>
            ))}
          </div>

          {plan.length > PLAN_ROWS && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.55,
                marginTop: 'var(--sp-5)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              And {plan.length - PLAN_ROWS} more units after those, in the same order — they
              are in the {totals.minutes} minutes above. An evening that long is easier as one
              mixed run than as {plan.length} decisions.
            </div>
          )}

          {/* When the work runs out before the time does, say so rather than
              padding the evening with units that do not need it. */}
          {totals.minutes < minutes - MIN_STRETCH_MINUTES && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.55,
                marginTop: 'var(--sp-5)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              That is everything worth doing tonight — {minutes - totals.minutes} of your{' '}
              {minutes} minutes are yours. Reviewing ahead of schedule buys less than it costs.
            </div>
          )}
        </Blueprint>
      )}

      {/*
        Interleaving, which the evidence likes and which was reachable only
        from a toggle inside a drill you had already started in one course.
        It is a different exercise — working out which kind of question this
        is, which is most of what an exam asks — so it is offered as its own
        way to spend the same time rather than a switch.
      */}
      {mixable && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              dispatch({ type: 'mixCourses', on: true });
              dispatch({ type: 'startDrill', unit: null });
            }}
            style={{ height: 42, marginTop: 'var(--sp-6)' }}
          >
            Mix every course in one run
          </button>
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.5, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            Cards from all your courses, shuffled together, due ones first. Harder than one
            course at a time, and closer to what an exam asks of you.
          </div>
        </>
      )}

      {/*
        What the plan rests on. Both numbers are read off your own answers, so
        the tab can be checked rather than believed.
      */}
      <div
        style={{
          marginTop: 'var(--sp-7)',
          paddingTop: 'var(--sp-6)',
          borderTop: '1px solid var(--app-line)',
          fontSize: 'var(--type-xs)',
          opacity: 0.6,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {waiting} cards waiting{only ? ` in ${catalog.short[only as CourseId] ?? ''}` : ''} ·{' '}
        {answeredToday} answered today
      </div>

      {/* The ranking, past the point the time ran out. Kept behind a tap: the
          plan is the answer, and this is the working. */}
      {alsoRanked.length > 0 && (
        <>
          <button
            type="button"
            className="btn btn-block"
            onClick={() => setShowRest((was) => !was)}
            aria-expanded={showRest}
            style={{ height: 40, marginTop: 'var(--sp-5)', background: 'transparent' }}
          >
            {showRest ? 'Hide what did not fit' : `What did not fit (${alsoRanked.length})`}
          </button>
          {showRest &&
            alsoRanked.map((s) => (
              <button
                key={`${s.courseId}-${s.index}`}
                type="button"
                className="bare tappable"
                onClick={() => startStretch(s)}
                style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center', width: '100%', textAlign: 'left', ...rowTwelve }}
              >
                <span style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', fontSize: 'var(--type-md)', opacity: 0.45 }}>
                  {s.minutes}m
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-base)', lineHeight: 'var(--leading-tight)' }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.5, marginTop: 'var(--sp-1)' }}>
                    {s.code} · {s.why}
                  </span>
                </span>
                <ChevronRight size={14} style={{ opacity: 0.35, flex: 'none' }} />
              </button>
            ))}
        </>
      )}
        </>
      )}
    </Page>
  );
}
