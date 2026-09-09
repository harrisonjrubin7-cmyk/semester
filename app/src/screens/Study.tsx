import { allCards } from '../data/catalog';
import { useState } from 'react';
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
import { nextExam, tonightPlan } from '../lib/select';
import { beside, nextStep, rest } from '../lib/nextstep';
import { cardKey, dueCount } from '../lib/review';
import { destinationsIn } from '../lib/nav';

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
 * grade per hour. This one picks the unit you are weakest at and opens its
 * cards. Both are real and neither is the other, so only one keeps the word.
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
  const rowTwelve = useRowStyle(12);
  const exam = nextExam(catalog, now);
  const plan = tonightPlan(catalog, state.updates, state.reviews);
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
            Generated from the directory rather than written out here.
            This tab used to be two hand-written cards, Ask Claude and Work on
            it, and every tool added afterwards — the diagram drawer, the
            problem solver, the data analysis, the deck builder, the drafting
            tool, the practice paper — was reachable only through search or
            three taps into Me. Six features nobody would ever find. Reading
            the list from `lib/nav.ts` means the next one appears here the day
            it is added, without anybody remembering to come back.
          */}
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, margin: '14px 0 2px', lineHeight: 'var(--leading-relaxed)' }}>
            Everything the app can do with a course, in one place.
          </div>
          {[...destinationsIn('Study'), ...destinationsIn('Make')]
            .filter((d) => d.screen !== 'study')
            .map((d) => (
              <Blueprint
                plain
                key={d.screen}
                onClick={() => dispatch({ type: 'go', screen: d.screen })}
                style={{
                  padding: '13px 15px',
                  marginTop: 'var(--sp-5)',
                  display: 'flex',
                  gap: 'var(--sp-6)',
                  alignItems: 'center',
                }}
              >
                <span style={{ width: 8, height: 34, background: 'var(--chrome)', flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="kicker" style={{ display: 'block' }}>
                    {d.label}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(13.5px * var(--text-scale, 1))',
                      lineHeight: 1.35,
                      marginTop: 3,
                      textWrap: 'pretty',
                    }}
                  >
                    {d.blurb}
                  </span>
                </span>
                <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
              </Blueprint>
            ))}
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
                      tone="primary" height={42} spacing="0.08em"
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
      <SectionLabel style={{ margin: '20px 0 4px' }}>Tonight’s 25 minutes</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-6)', textWrap: 'pretty' }}>
        Your weakest unit in each course, and what’s on the next quiz — one short sitting rather
        than a plan you will not keep.
      </div>
      {plan.map((p) => (
        <button
          key={p.courseId}
          type="button"
          className="bare tappable"
          onClick={() => dispatch({ type: 'openGuide', id: p.courseId, mode: 'cards' })}
          style={{
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'center',
            ...rowTwelve,
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
            {catalog.planMinutes[p.courseId]}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.25 }}>{p.unit.name}</span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-xs)',
                opacity: 0.55,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 'var(--sp-1)',
              }}
            >
              {p.code} · {p.unit.mastery}% mastered
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </button>
      ))}
        </>
      )}
    </Page>
  );
}
