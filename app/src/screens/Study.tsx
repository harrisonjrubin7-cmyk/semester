import {StudyJournal} from '../components/StudyJournal';
import { StudyStudio } from '../components/StudyStudio';
import { allCards } from '../data/catalog';
import { useMemo, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { TermSwitch } from '../components/TermSwitch';
import { FirstRun } from './FirstRun';
import { extraFigures, forCourse, liveGuide, mergeFigures } from '../lib/live';
import { modesFor } from '../lib/modes';
import { secondLine } from '../lib/dim';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, SectionLabel, Segmented } from '../components/ui';
import { Standing } from '../components/Standing';
import { Plan } from '../components/Plan';
import { today as todayKey } from '../lib/sessions';
import { knowingOf } from '../lib/knowing';
import { ChevronRight } from '../components/Icons';
import { AppGrid } from '../components/nav/AppGrid';
import { nextExam, testedIn } from '../lib/select';
import { beside, nextStep, rest } from '../lib/nextstep';
import { anyAnswered, cardKey, comeRound, neverMet } from '../lib/review';
import { inTime, missingCount, testsNear } from '../lib/intime';
import { DESTINATIONS, destinationsIn } from '../lib/nav';
import { suggest, type Coming } from '../lib/toolnow';
import { codeOf } from '../data/catalog';
import { upcomingItems } from '../lib/select';
import {
  MIN_STRETCH_MINUTES,
  counted,
  countedLine,
  warmedLine,
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
  const { state, dispatch, catalog, tint } = useStore();
  const now = useNow();
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
  const [studio, setStudio] = useState(false);
  const [studioCourse, setStudioCourse] = useState(state.guideId);
  const selectedStudioCourse = catalog.courses.find(c=>c.id===studioCourse)?.id ?? catalog.courses[0]?.id;
  const rowTwelve = useRowStyle(12);
  const exam = nextExam(catalog, now);
  /*
   * Each course's next test, and the card schedule read against it.
   *
   * `lib/intime.ts`: SM-2 sends a card that has been answered right three
   * times away for sixteen days, which is longer than most exams are away, so
   * the counts on this screen were quietly excluding most of a revised deck
   * from the revision it was for. Computed once for the whole list — walking
   * the catalogue four times to draw four rows is four times the work for the
   * same answer.
   */
  const tests = useMemo(() => testsNear(catalog, now), [catalog, now]);
  const schedule = useMemo(
    () => inTime(state.reviews, tests, now.getTime()),
    [state.reviews, tests, now],
  );

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
  // The evening described rather than totalled, over whichever courses are in
  // play — so the summary and the plan under it never disagree about which
  // evening is on. See `counted` in `lib/revise.ts`.
  const tally = counted(mine, state.reviews, now);
  const warmed = warmedLine(tally);
  /**
   * Open the cards for one stretch.
   *
   * `lib/revise.ts` keeps course ids as plain strings so it can be tested
   * without the catalogue; they came out of `catalog.courses` and are course
   * ids, so this is where that is said once rather than at four call sites.
   */
  const startStretch = (s: { courseId: string; index: number }, session?: string) =>
    dispatch({
      type: 'startDrill',
      unit: s.index,
      courseId: s.courseId as CourseId,
      // Named only when the run was opened from the committed plan, which is
      // what decides whether the answers count towards a sitting. See
      // `liveSession` in `state/shape.ts`.
      ...(session === undefined ? {} : { session }),
    });
  // Mixing needs more than one course with cards in it, and it contradicts a
  // course the student has just chosen — below either, the button offers a
  // shuffle of one deck, which is a shuffle of nothing.
  const mixable = !only && new Set(ranked.map((s) => s.courseId)).size > 1;

  /*
   * The fortnight in front of the student, in the shape `lib/toolnow.ts`
   * wants: what, whose, what kind, how far off. Everything it decides comes
   * off these rows, so a suggestion can always be checked against a syllabus.
   */
  const outstanding = useMemo<Coming[]>(
    () =>
      upcomingItems(catalog, now)
        .filter((i) => !state.done[i.id])
        .map((i) => ({
          id: i.id,
          title: i.title,
          kind: i.kind,
          code: codeOf(catalog, i.c),
          courseId: i.c,
          daysAway: i.daysAway,
          when: i.dueShort,
        })),
    [catalog, now, state.done],
  );
  const picks = suggest(outstanding, { sources: state.sources.length });
  /** Every tool this tab offers, minus Study itself — this is Study. */
  /* The audited tree kept a separate `Create` shelf; here the creation
     destinations already sit on `Make`, so that shelf alone covers them. */
  const tools = [...destinationsIn('Study'), ...destinationsIn('Make')].filter(
    (d) => d.screen !== 'study',
  );
  /*
   * The whole registry, for the cards above the grid — and the grid's two
   * shelves are deliberately not reused here.
   *
   * The cards used to be named out of `tools`, and a suggestion for anything
   * outside those two shelves hit `if (!d) return null` and vanished. Two of
   * the ten screens `lib/toolnow.ts` can suggest are outside them: `work`
   * sits on Semester and `sources` on Courses, both by an argument written
   * into `lib/nav.ts` when those shelves were last balanced.
   *
   * Measured against the sample semester, one evening per day for 120 days:
   * 341 suggestions were produced and **122 were thrown away** — `work` on
   * 112 of those days and `sources` on 10. `work` scores `3 + soon * 1.5`,
   * the joint-highest in the file, so the one being dropped was usually the
   * strongest. Worse, `suggest` caps its list at `AT_MOST` before the screen
   * filtered it, so the wasted slots were never refilled: on four of the 120
   * days every surviving card was dropped and "Because of this fortnight"
   * drew as a heading with nothing under it.
   *
   * The shelf is the wrong question to ask here and `lib/nav.ts` says so in
   * as many words — *"`group` is a shelf and a screen sits on exactly one; a
   * task is an intention and a screen can serve several"*. The grid below is
   * a shelf (positional, stable, two shelves' worth); these cards are an
   * intention, and the intention engine already decided. All this map does is
   * find the name and the blurb for what it decided.
   */
  const named = new Map(DESTINATIONS.map((d) => [d.screen, d]));
  /* Only what can actually be drawn, so the heading cannot outlive its list.
     Nothing is droppable today — the guard in `screens/toolcards.test.tsx`
     pins that every screen `toolnow` names is a registered destination — and
     this is what keeps a rule added next year for an unregistered screen from
     printing an empty section instead of failing. */
  const shown = picks.filter((p) => named.has(p.screen));
  if (catalog.empty) return <FirstRun where="to study" />;
  const tab = state.studyTab;

  if(studio && selectedStudioCourse) return <><div className="studio-course-picker"><label>Course<select value={selectedStudioCourse} onChange={e=>setStudioCourse(e.target.value)}>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label></div><StudyStudio key={selectedStudioCourse} courseId={selectedStudioCourse} onClose={()=>setStudio(false)}/></>;
  return (
    <Page>
      {/*
        The standing offer, and it steps back on the one tab that has an
        offer of its own.

        This block sits above the tab strip, so it is on the screen whatever
        tab you are on — which is right: building a guide is what this screen
        is for and it should not hide. What it cannot also be is *the* action
        on a tab that already has one. Revise draws a plan and one button that
        starts it (`Start — PSCI 1104, 3 min`), and two filled buttons on one
        phone screen is the defect `scripts/wallsweep.mjs` was written for,
        two deep instead of five.

        Guides and Tools have no competing action, so it stays filled there.
        Only the emphasis moves; the button is in the same place, the same
        size, saying the same thing.
      */}
      <div className="studio-entry"><div><strong>One course. Eleven study formats.</strong><p>Choose sources, create a guide, and save it with your course.</p></div><button className={`portal-primary${tab === 'revise' ? ' is-quiet' : ''}`} onClick={()=>setStudio(true)}>Create study guide</button></div>
      {/*
        Six buttons used to sit here, and removing them is the hierarchy pass
        the UI audit asked for rather than a deletion for its own sake.

        `AI Tutor · Practice exam · Exam planner · New course note · Study
        groups · Citations & evidence` — a hand-written row, in one unbroken
        line, wrapping 3-2-1 at 420px, every pill the same weight, directly
        under the one filled action on the screen. That is what flattened the
        top of Study: not that the six were badly ordered, but that they were
        drawn at the same weight as each other immediately below the thing
        that is not their equal.

        ## They were aliases, and five of six answered to a different name

        Every one had another home already, and the labels did not match the
        homes:

        | said here | screen | where it lives | called there |
        | --- | --- | --- | --- |
        | AI Tutor | `ask` | Tools tab | **Ask Claude** |
        | Practice exam | `exam` | Tools tab | **Practice paper** |
        | Exam planner | `runway` | Tools tab | **Exam runway** |
        | Study groups | `groupwork` | nav, Campus | **Group work** |
        | Citations & evidence | `sources` | nav, Courses | **Sources** |
        | New course note | — | `Mine.tsx`, `ForThis.tsx` | — |

        Three of them named a destination that the Tools tab, one tap away on
        this same screen, was already drawing under a different word. "Ask
        Claude" and "AI Tutor" are one screen with two names, eighty pixels
        apart.

        ## The Tools tab is this row, done properly

        It is generated from `lib/nav.ts`, so a tool added next year appears
        without anybody remembering to come back — which this row could not do
        and did not do. It is a grid, so twelve fit where four fitted. And
        `lib/toolnow.ts` puts two or three of them above the rest *with the
        deadline that asked for them*, because "at eleven at night four days
        before a midterm, 'Practice paper' and 'Draw it' are not equally
        likely, and the app holds every fact needed to know which".

        A fixed row of six cannot say that and never did. Keeping both meant
        the screen answered "what can I do" twice, once well.

        ## What went with it

        Nothing that was only here. The three tools are in the grid below, the
        two screens are in the directory and in search under their own names,
        and `newNote` is offered by `Mine.tsx` and by `ForThis.tsx` — both of
        which pass the course the student is actually looking at. This row
        passed `selectedStudioCourse`, which falls back to
        `catalog.courses[0]`, so "New course note" filed against whichever
        course happened to be first whatever you had open.

        `screens/studyhierarchy.test.tsx` holds the two halves together: the
        row is gone, and every destination it named is still reachable.
      */}
      <StudyJournal/>
      {exam && (
        <Blueprint
          style={{
            padding: 'var(--sp-7)',
            background: 'var(--app-hero)',
            // The whole card is one course's exam — the countdown, the title,
            // the units that are cold are all its. So it wears that course's
            // colour, like the next-class card on Today does.
            borderLeft: `3px solid ${tint(exam.item.c).edge}`,
          }}
        >
          <div className="kicker">Exam radar</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
            <div className="chrome-text" style={{ fontSize: 'calc(38px * var(--text-scale, 1))', lineHeight: 'var(--leading-none)' }}>
              {exam.days}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display-sm)', lineHeight: 'var(--leading-display-lg)' }}>
                {exam.days === 1 ? 'day' : 'days'} to {exam.code} {exam.item.title}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
                {exam.item.mon} {exam.item.day} · {exam.item.dueTime} · {exam.item.weight}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 'var(--sp-6)',
              paddingTop: 'calc(11px * var(--density, 1))',
              borderTop: '1px solid var(--app-line)',
              fontSize: 'var(--type-base)',
              color: 'var(--app-dim)',
              textWrap: 'pretty',
            }}
          >
            {(() => {
              const guide = liveGuide(catalog, exam.item.c, state.updates, state.reviews);
              /*
               * Which units are cold is a real question with a real answer,
               * and only once there is one.
               *
               * A unit's mastery is `unitMastery`'s blend, and before the
               * first answer in a course the blend is entirely the figure the
               * guide declared. So this sentence — the one telling somebody
               * what to drill the week of an exam — was ranking units by
               * numbers nobody had earned: "4 are cold, drill those first" for
               * a course never opened, and, for a course whose declared
               * figures all sit above the line, "all 11 units are above 40%,
               * keep them warm" about units nobody has ever seen. The second
               * is the one that would cost somebody a grade.
               *
               * Nothing is measured until something is answered, so until then
               * this says the true thing instead, which is also the useful
               * one: it is all ahead of you, and where you start matters less
               * than starting.
               */
              const keys = allCards(guide).map((card) => cardKey(exam.item.c, card.q));
              const cards = keys.length;
              if (!anyAnswered(keys, state.reviews)) {
                return `${guide.units.length} units on it and ${cards} cards, none of them answered yet. Nothing here knows what you know until you drill some — start with the first unit.`;
              }
              /*
                Cold by evidence, not by the guide's estimate.
                 
                This filtered on the blended figure being under forty, and the
                guard above only half fixed it. `anyAnswered` asks about the *course*: answer one card in
                unit 1 and the branch opens, and the other ten units are then
                sorted by a number that is still entirely `unitMastery`'s
                seeded stand-in — so the screen would name four units as warm
                on the strength of a figure nobody had earned, which is the
                exact contradiction the comment above describes.

                A unit is cold here when its own answers do not yet say
                otherwise: `retained` is warm, everything else is work. That
                includes `unseen`, which is the honest reading — a unit nobody
                has opened before an exam is the first place to go, not a unit
                that has been graded 49% by nothing at all.
              */
              const coldUnits = guide.units.filter(
                (u) =>
                  knowingOf(
                    u.cards.map((card) => cardKey(exam.item.c, card.q)),
                    state.reviews,
                    now.getTime(),
                  ).state !== 'retained',
              );
              if (coldUnits.length === 0) {
                return `Every one of the ${guide.units.length} units in ${guide.code} is holding. Keep them warm.`;
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
        style={{ marginTop: 'calc(16px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(4px * var(--density, 1))' }}
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

            What neither fixed is that a grid, like the list before it, says
            what each tool *is* and never what it is *for, now*. At eleven at
            night four days before a midterm, "Practice paper" and "Draw it"
            are not equally likely, and the app holds every fact needed to
            know which — so two or three tiles are said out loud above the
            grid, with the deadline that asked for them. See `lib/toolnow.ts`.
          */}
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(14px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(2px * var(--density, 1))', lineHeight: 'var(--leading-relaxed)' }}>
            Everything the app can do with a course. What is at the top is picked from what you
            actually have due.
          </div>

          {shown.length > 0 && (
            <>
              <SectionLabel>Because of this fortnight</SectionLabel>
              {shown.map((p) => {
                const d = named.get(p.screen)!;
                return (
                  <Blueprint
                    plain
                    key={p.screen}
                    onClick={() => dispatch({ type: 'go', screen: p.screen, courseId: p.courseId })}
                    style={{
                      padding: 'var(--sp-6) var(--sp-7)',
                      marginTop: 'var(--sp-5)',
                      display: 'flex',
                      gap: 'var(--sp-6)',
                      alignItems: 'center',
                    }}
                  >
                    {/* The course's own colour when the reason belongs to one
                        course, so the card and the deadline it came from are
                        the same thing on the eye. */}
                    <span
                      style={{
                        width: 8,
                        height: 34,
                        background: p.courseId ? tint(p.courseId).edge : 'var(--chrome)',
                        flex: 'none',
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="kicker" style={{ display: 'block' }}>
                        {d.label}
                      </span>
                      {/* The reason, not the blurb. What the tool is matters
                          less here than which deadline sent you to it, and the
                          deadline is quoted so it can be checked. */}
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--type-base)',
                          lineHeight: 'var(--leading-normal)',
                          marginTop: 'var(--sp-2)',
                          textWrap: 'pretty',
                        }}
                      >
                        {p.why}
                      </span>
                    </span>
                    <ChevronRight size={16} style={{ color: 'var(--app-dim)', flex: 'none' }} />
                  </Blueprint>
                );
              })}
            </>
          )}

          {/*
            The grid keeps every tool, including the two or three said above
            it. That is deliberate and it is the one place this tab does not
            follow "one thing, one door": a grid's value is positional — Email
            is bottom-left and stays bottom-left — and a tile that moves
            because a deadline moved is a grid you have to read again every
            night. So the cards above are a shortcut past the grid, never a
            hole in it.
          */}
          <AppGrid
            apps={tools}
            onOpen={(d) => dispatch({ type: 'go', screen: d.screen })}
          />
        </>
      )}


      {tab === 'guides' && (
        <>
      <SectionLabel>Your courses</SectionLabel>
      {/*
        Each course's next test, and the schedule read against it.

        Computed once for the whole list rather than per row: `testsNear`
        walks the catalogue, and doing that four times to draw four rows is
        four times the work for the same answer. See `lib/intime.ts`.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(11px * var(--density, 1))' }}>
        {catalog.courses.map((c) => {
          const g = liveGuide(catalog, c.id, state.updates, state.reviews);
          const cards = allCards(g).length;
          const mine = forCourse(state.updates, c.id);
          // Every way into this course that actually has something in it. They
          // used to be reachable only by opening the guide and then finding a
          // chip row that scrolled sideways, so most of them went unused.
          const every = modesFor(catalog, c.id, {
            guide: g,
            lessons: catalog.lessons[c.id] ?? {},
            figures: mergeFigures(catalog.figures[c.id] ?? {}, mine),
            extras: extraFigures(catalog.extraFigures[c.id] ?? [], mine, catalog.figures[c.id] ?? {}),
          });
          const ways = every.filter((m) => m.ready);

          /*
           * Read rather than guessed: cards whose review has come round, this
           * course's own next test, and whether anything has been answered.
           *
           * `testedIn` rather than `nextExam`, which is the radar's question
           * and the wrong one here — it is the nearest exam in the semester,
           * so whichever course held it got a countdown and the other three
           * were told they had none, however close their own was. It also only
           * counted exams, so a quiz on Thursday changed nothing.
           */
          const keys = allCards(g).map((card) => cardKey(c.id, card.q));
          /*
           * Counted against a schedule that knows about the test — see
           * `lib/intime.ts`. Without it this number is the one the drill
           * would have dealt, and the drill was quietly dropping most of a
           * revised deck before the exam it was being revised for.
           */
          const due = comeRound(keys, schedule, now.getTime());
          /** What the card's own interval brought round, with no test involved. */
          const dueOwn = comeRound(keys, state.reviews, now.getTime());
          /** Every card the test pulled back into its run-up, across all its days. */
          const forTest = missingCount(keys, state.reviews, tests[c.id]);
          const fresh = neverMet(keys, state.reviews);
          const started = anyAnswered(keys, state.reviews);
          // Where the course stands, off the answers alone. `due`, `fresh` and
          // `started` above are the same evidence counted three other ways;
          // this is the one that gets a word put to it.
          const standing = knowingOf(keys, state.reviews, now.getTime());
          const test = testedIn(catalog, now, c.id);
          const step = nextStep({
            ways,
            guide: g,
            // For the sentence only — the ranking inside still uses the
            // blend. See `standings` on `StepInput`.
            standings: g.units.map(
              (u) =>
                knowingOf(
                  u.cards.map((card) => cardKey(c.id, card.q)),
                  state.reviews,
                  now.getTime(),
                ).state,
            ),
            due,
            dueOwn,
            testIn: test?.days ?? null,
            testKind: test?.kind ?? null,
            started,
          });
          return (
            <Blueprint
              plain
              key={c.id}
              style={{
                paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))',
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
                  style={{ fontSize: 'var(--type-display-sm)', flex: 'none', whiteSpace: 'nowrap' }}
                >
                  {g.code}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--app-dim)',
                    textAlign: 'right',
                    minWidth: 0,
                  }}
                >
                  {g.units.length} units · {cards} cards
                </div>
              </div>
              <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>{g.blurb}</div>
              {/*
                Nothing measured, nothing claimed — now all the way down.

                This was a meter of `g.mastery`: `unitMastery`'s blend of what
                you have answered with the figure a person wrote into the
                guide, where the written figure stands in for every card you
                have not answered. Before the first answer that is all of them,
                so the meter read 49% for a course nobody had opened, three
                lines above the recommendation on the same card saying
                "Nothing answered in this course yet." Both were drawn from the
                same state and they disagreed.

                Zeroing the bar until the first answer fixed the worst case and
                left the rest: after one answer the bar went back to being
                mostly somebody's estimate, and a percentage cannot say which
                part of itself was measured. So the bar is now a count — cards
                holding, out of cards — and the state above it is read off the
                answers only. See `lib/knowing.ts`. The blend is untouched and
                still does the job it was built for, which is ranking units in
                `lib/revise.ts`; it is no longer printed as if it were a
                measurement.
              */}
              <div style={{ marginTop: 'calc(11px * var(--density, 1))' }}>
                <Standing state={standing.state} evidence={standing.evidence} name={c.code} />
              </div>
              {/*
                What is true of this course today, beside what is true of it
                always. The size of the guide is in the corner above and does
                not change all term; these three do, and every one of them was
                already being computed here and thrown away.

                Due and new are counted apart, because they are different
                work and the lumped number is a lie in one direction: a card
                you have never met has not "come round", and calling it due
                turned the first answer in a course into a hundred-card
                backlog. See `comeRound` and `neverMet` in `lib/review.ts`.
              */}
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  color: 'var(--app-dim)',
                  marginTop: 'calc(5px * var(--density, 1))',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {/*
                  The counts that change day to day, and nothing the standing
                  above already said.

                  This line used to open with the mastery percentage, and
                  replacing that with the answered count printed the same
                  sentence twice — "Introduced · 4 of 68 cards answered"
                  directly above "4 OF 68 ANSWERED · NOTHING DUE · 64 UNSEEN".
                  Caught by looking at it rather than by any test: both halves
                  were individually right.

                  So coverage is said once, up there, and this line is now due,
                  unseen and added only. Joined rather than concatenated with
                  leading separators, because dropping the first segment turned
                  "· 64 unseen" into a line that began with a bullet.
                */}
                {[
                  /*
                    What is up tonight, and why.

                    Two wordings, because "due" and "come round" mean the same
                    thing to a reader and the standing sentence three lines
                    above this one says "nothing come round". Where every card
                    up tonight was pulled back by the test rather than by its
                    own interval, saying "4 due" there contradicts it — caught
                    by looking at the screen with every test passing, both
                    halves individually right. So that case says what it is:
                    four tonight, sixty-eight in all, because of the exam.

                    Where intervals brought some round on their own the first
                    wording is the honest one, and the second clause then earns
                    its place only when there is more coming than is already
                    up. On the morning of the quiz itself everything is due at
                    once and "107 due · 107 coming back before the quiz" says
                    one number twice. See `lib/intime.ts`.
                  */
                  due > 0 && dueOwn === 0 && forTest > 0 && test
                    ? `${due} of ${forTest} up for the ${test.kind.toLowerCase()}`
                    : due > 0
                      ? `${due} due`
                      : started
                        ? 'nothing due'
                        : null,
                  dueOwn > 0 && forTest > due && test
                    ? `${forTest} coming back before the ${test.kind.toLowerCase()}`
                    : null,
                  fresh > 0 ? `${fresh} unseen` : null,
                  mine.length > 0 ? `${mine.length} added` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
                  paddingTop: 'calc(11px * var(--density, 1))',
                  borderTop: '1px solid var(--app-line)',
                }}
              >
                {/*
                  A course with no way into it — added by hand, or imported
                  from a syllabus that listed no readings — used to draw this
                  card with a meter at nothing, no recommendation, no chips and
                  no explanation: the one card on the screen you could look at
                  and not act on. `lib/modes.ts` has always known what is
                  missing and what would fill it, so it says so, and the button
                  is the thing that fixes it, on this course rather than on
                  whichever guide was open last.
                */}
                {ways.length === 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 'var(--type-base)',
                        color: 'var(--app-dim)',
                        marginBottom: 'var(--sp-5)',
                        lineHeight: 'var(--leading-normal)',
                        textWrap: 'pretty',
                      }}
                    >
                      {every.find((m) => m.id === 'cards')?.missing ??
                        'Nothing to study in this course yet.'}
                    </div>
                    <ActionButton
                      onClick={() => dispatch({ type: 'openUpdate', courseId: c.id, unit: null })}
                    >
                      Add material to {g.code}
                    </ActionButton>
                  </>
                )}

                {step && (
                  <>
                    {/*
                      Filled within a card is a claim about the screen, and
                      four cards cannot all make it.

                      This was `tone="primary"`, which is right about one card
                      and wrong about the screen the moment there are two: a
                      term of four courses drew four filled buttons under the
                      filled offer at the top, and because `nextstep` gives a
                      course with nothing started the same answer as the next
                      one, all four said **Start reading**. Five filled
                      actions, four of them the same words — which is the
                      audit's "six identical buttons" back in the tier above
                      the one PR #503 emptied. A filled button that appears
                      five times is not an emphasis, it is a texture.

                      Nothing is lost by going a step down. Inside the card
                      this is still the first thing and still the widest: the
                      recommendation, full width at 44px, its reason directly
                      under it, and the alternatives below in small uppercase
                      chips. The ranking `lib/nextstep.ts` computes is intact —
                      it just no longer competes with the one offer the screen
                      itself makes.
                    */}
                    <ActionButton
                      onClick={() => dispatch({ type: 'openGuide', id: c.id, mode: step.id })}
                      spacing="0.08em"
                    >
                      {step.label}
                    </ActionButton>
                    {/* The fact it rests on. A recommendation with no reason
                        is an instruction, and an instruction from software
                        about how to study is worth nothing. */}
                    {step.why && (
                      <div
                        style={{
                          fontSize: 'var(--type-xs-plus)',
                          color: 'var(--app-dim)',
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
                        paddingBlock: 'calc(5px * var(--density, 1))', paddingInline: 'calc(10px * var(--density, 1))',
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
                        paddingBlock: 'calc(5px * var(--density, 1))', paddingInline: 'calc(10px * var(--density, 1))',
                        fontSize: 'var(--type-xs)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: 'transparent',
                        color: 'var(--app-dim)',
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
        style={{ height: 44, marginTop: 'calc(14px * var(--density, 1))' }}
      >
        + Add a reading to a course
      </button>
      <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        A chapter, a handout, a lecture — paste or attach it and the cards, the quiz, the guide
        and the cram sheet all take it in.
      </div>

        </>
      )}

      {tab === 'revise' && (
        <>
      {/*
        The committed plan, above the live ranking that feeds it.

        Above rather than below because it is the part with a yesterday. The
        ranking answers "what is worth an evening"; this answers "what did I
        say I would do, and what did I not do" — and the second question is the
        one that goes unanswered every other night. See `lib/sessions.ts`.
      */}
      <Plan
        sessions={state.sessions}
        ranked={ranked}
        now={now}
        dayMinutes={minutes}
        onPlan={(sessions, from) => dispatch({ type: 'planSessions', sessions, from })}
        onMove={() => dispatch({ type: 'moveMissed', today: todayKey(now), dayMinutes: minutes })}
        /*
          Opening a sitting opens the deck. It does not finish it.

          This used to stamp `doneAt` here, one line above the drill, on the
          argument that a sitting you open is a sitting you did some of. The
          argument is about a student and the line is about a record, and the
          record could not tell the two apart: tapping a row and pressing back
          wrote the same "done" as answering every card in it, so the plan's
          only real measurement was which rows had been tapped.

          Now one dispatch does one thing — it starts the run and says which
          sitting the run is for — and the answers do the rest. `markCard` in
          `state/slices/study.ts` counts them and writes `doneAt` on the last
          one. A sitting opened and abandoned stays exactly what it is: open,
          resumable, and not done.
        */
        onOpen={(session) => startStretch(session, session.id)}
        onClear={() => dispatch({ type: 'clearPlan' })}
      />

      <SectionLabel style={{ marginTop: 'calc(20px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(4px * var(--density, 1))' }}>Tonight’s sitting</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginBottom: 'var(--sp-6)', textWrap: 'pretty' }}>
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

      {/*
        What the plan rests on, above the plan.

        This sat at the foot of the tab, under the button that mixes every
        course — near enough that the summary read as that button's caption
        rather than as the evening's. It belongs with the controls it
        describes: the minutes and the courses are what produce these numbers,
        and somebody who has just set both should not have to reach the bottom
        of a nine-unit plan to see what they add up to.
      */}
      <div
        style={{
          marginBottom: 'var(--sp-6)',
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {/*
          The same work, described rather than totalled.

          This line used to read "N cards waiting", and `dueIn` builds that N
          by counting two unrelated states as one: cards that have come round
          again, and cards nobody has ever met. `lib/review.ts` spends a
          docstring on why the lump is the wrong thing to call due — a course
          you have answered one card of was being told a hundred had come
          round for review — and the sentence on the screen was the place that
          argument had never reached. See `counted` in `lib/revise.ts`, which
          also says why none of this is a streak.
        */}
        {countedLine(tally)}
        {warmed ? ` · ${warmed}` : ''}
        {/*
          The course filter names itself *below* the chips that set it, which
          is why this block sits under the whole control cluster rather than
          directly beneath the minutes: "· ECON only" printed above those
          chips would explain a control the reader has not met yet.
        */}
        {only ? ` · ${catalog.short[only as CourseId] ?? ''} only` : ''}
      </div>

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
            <ActionButton onClick={() => startStretch(mine[0])} style={{ marginTop: 'var(--sp-6)' }}>
              Drill {mine[0].code} anyway
            </ActionButton>
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
                    color: 'var(--app-dim)',
                  }}
                >
                  {s.minutes}m
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-display-xs)' }}>{s.name}</span>
                  {/* The code is set like every other code in the app; the
                      reason is a sentence and is set like one. Three clauses
                      of tracked capitals is a wall nobody reads, which would
                      waste the only part of the row that justifies it. */}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-xs)',
                      color: 'var(--app-dim)',
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
                <ChevronRight size={16} style={{ color: 'var(--app-dim)', flex: 'none' }} />
              </button>
            ))}
          </div>

          {plan.length > PLAN_ROWS && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                color: 'var(--app-dim)',
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
                color: 'var(--app-dim)',
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
          <ActionButton
            onClick={() => {
              dispatch({ type: 'mixCourses', on: true });
              dispatch({ type: 'startDrill', unit: null });
            }}
            style={{ marginTop: 'var(--sp-6)' }}
          >
            Mix every course in one run
          </ActionButton>
          <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            Cards from all your courses, shuffled together, due ones first. Harder than one
            course at a time, and closer to what an exam asks of you.
          </div>
        </>
      )}

      {/* The ranking, past the point the time ran out. Kept behind a tap: the
          plan is the answer, and this is the working. */}
      {alsoRanked.length > 0 && (
        <>
          <ActionButton
            tone="ghost"
            onClick={() => setShowRest((was) => !was)}
            aria-expanded={showRest}
            style={{ marginTop: 'var(--sp-5)' }}
          >
            {showRest ? 'Hide what did not fit' : `What did not fit (${alsoRanked.length})`}
          </ActionButton>
          {showRest &&
            alsoRanked.map((s) => (
              <button
                key={`${s.courseId}-${s.index}`}
                type="button"
                className="bare tappable"
                onClick={() => startStretch(s)}
                // The same edge the rows above carry. They are one list read
                // in one go — the split is only how many fit before "more" —
                // and a list that colours its first four rows and not its
                // fifth looks like the colour means something it does not.
                style={{
                  display: 'flex',
                  gap: 'var(--sp-6)',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  borderLeft: `3px solid ${tint(s.courseId).edge}`,
                  paddingLeft: 'var(--sp-5)',
                  ...rowTwelve,
                }}
              >
                <span style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', fontSize: 'var(--type-md)', ...secondLine() }}>
                  {s.minutes}m
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-base)', lineHeight: 'var(--leading-tight)' }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
                    {s.code} · {s.why}
                  </span>
                </span>
                <ChevronRight size={14} style={{ color: 'var(--app-dim)', flex: 'none' }} />
              </button>
            ))}
        </>
      )}
        </>
      )}
    </Page>
  );
}
