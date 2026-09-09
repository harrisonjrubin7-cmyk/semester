import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { useRowStyle } from '../../components/shell/useShell';
import { Blueprint } from '../../components/Blueprint';
import { EmptyState, Meter, SectionLabel } from '../../components/ui';
import { Folding } from '../../components/Fold';
import { Insights } from '../../components/Insights';
import { CourseTag } from '../../components/CourseTag';
import { allCards } from '../../data/catalog';
import { DOW, DOW_INITIALS, dateToIso } from '../../lib/date';
import { liveGuide } from '../../lib/live';
import { learned, showSpan } from '../../lib/pace';
import { cardKey, comeRound, neverMet, tallyKeys } from '../../lib/review';
import { datedItems, loadByCourse } from '../../lib/select';
import {
  doors,
  nextUp,
  standLine,
  weekLine,
  weekShape,
  whereYouStand,
  type Day,
  type Door,
} from '../../lib/you';
import type { DatedItem, Screen } from '../../lib/types';

/**
 * Progress, on the tab somebody actually lands on.
 *
 * This is the first thing the Progress tab draws, and for most of the app's
 * life it was a report: four numbers in a row, a list of findings, three
 * meters and a table of medians. Every figure on it was true, none of them was
 * wrong, and there was nothing on the screen you could *do* — the numbers were
 * doors to nowhere, and reading "40 ahead" and then having to work out which
 * forty is the app asking somebody to do its job.
 *
 * Three things changed, and the arithmetic for all three is in `lib/you.ts`
 * where it can be tested and quoted:
 *
 * **It answers first.** One sentence at the top saying what the numbers add
 * up to — what is late, what the week is carrying — before any of them are
 * shown. `standLine`.
 *
 * **It offers the two or three things worth doing right now.** Not advice:
 * buttons, each naming a count the screen is already showing, going to the
 * screen that count belongs to. `doors`.
 *
 * **The week has a shape rather than a share.** "2 of 5 done" is the same
 * week whether the five are spread across seven days or all land on Thursday,
 * and those are not the same week. Seven columns, one per day, each one a way
 * into that day on the calendar. `weekShape`.
 *
 * ## Why it is its own file
 *
 * `Me.tsx` held three tabs and eight hundred lines, and this one is the half
 * of it that is about the semester rather than about the app's own index. The
 * one visible consequence is that its sections fold under a scope of their own
 * — `<Folding name="You">` — so anybody who had folded "Cards" shut here finds
 * it open once. That is a per-device memory of a tap, which is the cheapest
 * thing in the app to lose.
 */

/** One cell of the strip: a number, what it is, and where it goes. */
interface Stat {
  n: number;
  /** The caps label under the number. */
  l: string;
  /**
   * The same fact as a sentence, for a screen reader.
   *
   * "40" and "AHEAD" stacked read as two unrelated fragments out loud, and the
   * cell is a button, so what the reader announces is the whole of what
   * somebody has to decide from. Written here rather than assembled from the
   * label because "8 done" and "4 courses" want different words.
   */
  say: string;
  to?: Screen;
}

export function You() {
  const { state, dispatch, now, catalog, courseCode, tint } = useStore();
  const rowNine = useRowStyle(9);
  const rowTen = useRowStyle(10);

  /*
   * One pass over the deadlines, and every figure on this tab comes out of it.
   *
   * The arithmetic is in `lib/you.ts` rather than here, and the header of that
   * file says why at length. The short version is that this screen has now got
   * a headline number wrong twice, and both times inline: `Credits` was once
   * the literal string '11', and `Done` counted the whole `state.done` map,
   * which keeps the ticks of courses you have since removed and so could
   * report more finished deadlines than the app holds.
   */
  const dated = useMemo(() => datedItems(catalog, now), [catalog, now]);
  const where = useMemo(
    () => whereYouStand({ courses: catalog.courses, items: dated, done: state.done, now }),
    [catalog.courses, dated, state.done, now],
  );
  const days = useMemo(() => weekShape(dated, state.done, now), [dated, state.done, now]);

  const bars = loadByCourse(catalog, now, state.done);
  const pace = learned(state.spent);

  /*
   * The two shares the meters below draw, rounded once.
   *
   * Named rather than inlined because each is wanted twice — to decide
   * whether the bar is worth drawing at all, and then to draw it — and the
   * term's is wanted a third time in the sentence under it. Rounding it in
   * three places is how a bar and the number beside it come to disagree.
   */
  const termPct = where.through === null ? 0 : Math.round(where.through * 100);

  /*
   * The drilling record, counted against the decks that actually exist.
   *
   * `tally` over the whole review map would have had the same fault `Done`
   * had — an answer given to a course you removed in September is not part of
   * this term's record — so every deck's keys are recomputed and `tallyKeys`
   * is handed those, which is what it was added for.
   *
   * Two counts of what is waiting rather than one, and this is the fix to a
   * row that read "2 of 325 seen · 0% right · 325 due". `dueCount` calls a
   * card nobody has ever met "due", so a full deck was dressed as a backlog
   * somebody had fallen behind on. `comeRound` is what has genuinely come
   * round for review; `neverMet` is the rest of the deck, which is a different
   * sentence and a different invitation.
   */
  const cards = useMemo(() => {
    const keys = catalog.courses.flatMap((c) =>
      allCards(liveGuide(catalog, c.id, state.updates, state.reviews)).map((q) => cardKey(c.id, q.q)),
    );
    const t = tallyKeys(keys, state.reviews);
    return {
      deck: keys.length,
      seen: t.cards,
      pct: t.pct,
      round: comeRound(keys, state.reviews, now.getTime()),
      unmet: neverMet(keys, state.reviews),
    };
  }, [catalog, state.updates, state.reviews, now]);

  /**
   * The soonest unticked thing in each course, for the load bars.
   *
   * A bar reading "9 left" says how much of a course is in front of you and
   * nothing about when any of it lands, which is the half people plan on. One
   * pass over deadlines already sorted by date, so the first hit per course is
   * the next one.
   */
  const nextIn = useMemo(() => {
    const out = new Map<string, DatedItem>();
    for (const i of dated) {
      if (i.isPast || state.done[i.id] || out.has(i.c)) continue;
      out.set(i.c, i);
    }
    return out;
  }, [dated, state.done]);

  const open = useMemo(
    () => doors({ where, cards: cards.round, next: nextUp(dated, state.done) }),
    [where, cards.round, dated, state.done],
  );

  /*
   * Four cells, the same four every week.
   *
   * There was a fifth that came and went — Late, which appeared when something
   * was and pushed Credits out when it did, so the strip changed shape between
   * one Tuesday and the next and a number moved column under somebody reading
   * it. What is late is now said twice above this: in the sentence, and as the
   * first door. A third copy in a cell you have learnt to skim is not a
   * warning, and a strip that stands still is worth more than one that
   * rearranges itself.
   */
  const stats: Stat[] = [
    { n: where.ahead, l: 'Ahead', say: `${where.ahead} still ahead of you`, to: 'ahead' },
    { n: where.done, l: 'Done', say: `${where.done} ticked off this term` },
    ...(where.credits > 0
      ? [{ n: where.credits, l: 'Credits', say: `${where.credits} credits this term` }]
      : []),
    { n: where.courses, l: 'Courses', say: `${where.courses} courses`, to: 'courses' },
  ];

  /** A door's one press. Most open a screen; the next-thing door opens a thing. */
  const press = (d: Door) => {
    if (d.item) dispatch({ type: 'openItem', id: d.item });
    else dispatch({ type: 'go', screen: d.screen });
  };

  /*
    Nothing imported yet, so there is nothing to report.

    This tab used to answer a fresh install with four zeroes and then stop —
    no chart, no pace, no advice, because every one of those sections hides
    itself when it has nothing. Four zeroes and white space is the app's own
    progress screen telling somebody it is broken, when what is actually true
    is that it has not been given a syllabus yet. So it says that, and offers
    the one thing that would fix it.

    `EmptyState` rather than the `FirstRun` the eight other empty screens
    return, and not by preference: `FirstRun` opens its own `<Page>`, and this
    is a tab inside one that already has the Everything directory in its other
    half. A screen that swapped itself wholesale for the first run would take
    the app's index off the tab that holds it.
  */
  if (catalog.empty)
    return (
      <EmptyState
        title="Nothing to report yet"
        body="This is where the semester gets counted back to you — what is left, what is late, how the drilling is going and how long things actually take you. All of it comes off a syllabus."
        action={{ label: 'Add a course', onClick: () => dispatch({ type: 'go', screen: 'import' }) }}
      />
    );

  return (
    <Folding name="You">
      {/*
        The answer, then the doors, then the numbers behind them.

        One framed object rather than three, because they are one thought: this
        is where you stand, here is what to do about it, and here is the
        arithmetic if you want to check.
      */}
      <Blueprint style={{ padding: 'var(--sp-7)' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xl)',
            lineHeight: 'var(--leading-tight)',
            textWrap: 'pretty',
          }}
        >
          {standLine(where)}
        </p>

        {open.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-6)',
            }}
          >
            {open.map((d, i) => (
              <button
                key={d.id}
                type="button"
                // The first door is the one the day is asking for, so it is
                // the one that looks like a button you press. `.btn` is 44px
                // tall in this app, so none of these needs a tap overlay.
                className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => press(d)}
                style={{
                  width: 'auto',
                  // Shrinks before it wraps its own words, and the label is a
                  // deadline's title on the third door, which can be long.
                  flex: '0 1 auto',
                  minWidth: 0,
                  maxWidth: '100%',
                  paddingBlock: 0,
                  paddingInline: 'var(--sp-6)',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/*
          The strip, as a grid that wraps rather than four columns that crush.

          It was a flex row with a hairline between each cell and a 30px
          figure over a 10px caps label — which fits at the default text size
          and at no other. Somebody reading at 200% got four columns of
          clipped capitals. `auto-fit` reads as one row on a phone at the
          default, two rows of two when the words need the room, and the
          hairlines went with it: a divider that lands in the middle of a
          wrapped row is worse than no divider.
        */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(66px, 1fr))',
            gap: 'var(--sp-5)',
            marginTop: 'var(--sp-7)',
            paddingTop: 'var(--sp-6)',
            borderTop: '1px solid var(--app-line)',
          }}
        >
          {stats.map((s) => {
            const cell = (
              <>
                <div
                  className="chrome-text"
                  style={{ fontSize: 'var(--type-xl)', lineHeight: 'var(--leading-tight)' }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    // 11px rather than the 10 it was: this is the smallest
                    // type in the app and it is the only thing saying what the
                    // number over it means.
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                    fontFamily: 'var(--font-heading)',
                    marginTop: 'var(--sp-2)',
                  }}
                >
                  {s.l}
                </div>
              </>
            );
            // A cell with somewhere to go is a button; one without stays a div
            // rather than becoming a button that does nothing when pressed.
            return s.to ? (
              <button
                key={s.l}
                type="button"
                className="bare tappable"
                // "42" over "AHEAD" reads as two unrelated fragments out loud,
                // and this one is a button: what it announces is the whole of
                // what somebody has to decide from.
                aria-label={s.say}
                onClick={() => dispatch({ type: 'go', screen: s.to as Screen })}
                style={{ width: 'auto', textAlign: 'center' }}
              >
                {cell}
              </button>
            ) : (
              // `aria-label` on a plain `div` is ignored by every reader worth
              // supporting, so the sentence is real text and the drawing of it
              // is hidden — the same trick the skip link uses.
              <div key={s.l} style={{ textAlign: 'center' }}>
                <span className="sr-only">{s.say}</span>
                <span aria-hidden>{cell}</span>
              </div>
            );
          })}
        </div>
      </Blueprint>

      {/*
        What the app noticed, and the one thing to do about each.

        The engine lives in `src/insights/`. `Insights` renders nothing when it
        has nothing, so no placeholder arrives with it.
      */}
      <Insights most={3} />

      {/*
        The week, day by day, and the term around it.

        One heading over both because they are one question asked at two zooms,
        and because a screen of six headings is a screen you scroll past.
      */}
      <SectionLabel
        aside={
          <button
            type="button"
            // 44×17 as two caps words, in a row with a heading beside it: the
            // room is above and below, which is what `tap-y` grows into.
            className="bare tappable tap-y"
            onClick={() => dispatch({ type: 'go', screen: 'ahead' })}
            style={{
              flex: 'none',
              width: 'auto',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--app-accent)',
            }}
          >
            In hours
          </button>
        }
      >
        Where you stand
      </SectionLabel>

      <div style={rowTen}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 'var(--sp-5)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
            This week
          </div>
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>{weekLine(where.week)}</div>
        </div>
        <WeekStrip days={days} />
      </div>

      {where.through !== null && (
        <div style={rowTen}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 'var(--sp-5)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
              The term
            </div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>
              {where.done} of {where.total} done
            </div>
          </div>
          {/* A meter with nothing in it is a hairline, not a chart: before the
              first deadline the term is 0% through, which is a fact the
              sentence below states and a bar cannot draw. */}
          {termPct > 0 && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              {/* The sentence under it reads "{termPct}% of the way…". */}
              <Meter pct={termPct} label={null} />
            </div>
          )}
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.45,
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            {termPct}% of the way from the first deadline on your syllabi to the last. The app has
            not been told a term's dates, so that span is the term it knows.
          </div>
        </div>
      )}

      {/*
        The drilling, told back in numbers that do not flatter or scold.

        Coverage first: 90% right across nine of three hundred cards is not a
        report on the term, and putting the coverage first is what stops it
        reading as one. The percentage is every answer ever given rather than a
        rolling window, which is why it moves slowly and why it is worth
        trusting.
      */}
      {cards.deck > 0 && (
        <>
          <SectionLabel>Cards</SectionLabel>
          <button
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: 'study' })}
            style={{ ...rowTen, display: 'block', textAlign: 'left', width: '100%' }}
          >
            <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'baseline' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'var(--type-lg)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {cards.seen === 0
                  ? `${cards.deck} cards, none answered yet`
                  : `${cards.seen} of ${cards.deck} seen · ${cards.pct}% right`}
              </div>
              {/*
                What is actually waiting, which is two different things — and
                silent until it can say something the headline has not.

                A card that has come round is one you have met and the spacing
                has brought back; the rest of the deck is unmet, which is not a
                backlog. "325 cards, none answered yet · 325 due" was one
                number twice, the second copy dressed as a debt somebody had
                fallen behind on. It is a full deck, which is what a full deck
                looks like.
              */}
              {cards.seen > 0 && (
                <div style={{ flex: 'none', fontSize: 'var(--type-sm)', opacity: 0.55 }}>
                  {cards.round > 0
                    ? `${cards.round} to review`
                    : cards.unmet > 0
                      ? `${cards.unmet} unmet`
                      : 'None due'}
                </div>
              )}
            </div>
            {/*
              The bar is coverage, not accuracy. Accuracy is already the second
              half of the line above it, and a bar drawn at 73% beside "73%
              right" is the same fact twice. What the line does not show is how
              much of the deck that 73% rests on.
            */}
            {cards.seen > 0 && (
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <Meter
                  pct={Math.round((cards.seen / cards.deck) * 100)}
                  label="Share of the deck seen"
                />
              </div>
            )}
          </button>
        </>
      )}

      {/* An empty section headed "Load by course" is worse than no section. */}
      {bars.length > 0 && (
        <SectionLabel
          style={{
            marginTop: 'calc(24px * var(--density, 1))',
            marginBottom: 'calc(6px * var(--density, 1))',
          }}
        >
          Load by course
        </SectionLabel>
      )}
      {/*
        A bar per course, what is left on it, and when the next of it lands.

        The bars were the only chart in the app you could not press, and they
        were also the only place a course's load appeared without a date on it
        — "9 left" reads the same whether the next one is tomorrow or in three
        weeks.
      */}
      {bars.map((b) => {
        const next = nextIn.get(b.id);
        return (
          <button
            key={b.code}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'openCourse', id: b.id })}
            style={{ ...rowTen, display: 'block', textAlign: 'left', width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-md)' }}>
                {b.code}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>{b.n} left</div>
            </div>
            <div style={{ marginTop: 'var(--sp-3)' }}>
              {/* Four bars in one metal are four bars you have to read the
                  label of. In their courses' colours they are the same four
                  facts, comparable at a glance and matched to every other
                  list. */}
              <Meter pct={b.pct} fill={tint(b.id).fill} label={`Share of what is left, ${b.code}`} />
            </div>
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.45,
                marginTop: 'var(--sp-3)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              {/* `dueShort` is already the words a person would say — "Tomorrow",
                  "Tue Sep 15" — and lowercasing it turned a date into "wed sep 30". */}
              {next ? `Next: ${next.title} · ${next.dueShort}` : 'Nothing dated ahead.'}
            </div>
          </button>
        );
      })}

      {/*
        What the app has learned about your pace, shown back to you.

        Only appears once there is something in it, and every row says how many
        reports it rests on — a median of one is a data point wearing a median's
        clothes, and hiding that would make the list look surer than it is.
        There is no comparison with anybody else and no score: it is your own
        arithmetic, told back.
      */}
      {pace.length > 0 && (
        <>
          <SectionLabel>How long things take you</SectionLabel>
          {pace.map((r) => (
            <div
              key={`${r.courseId}-${r.kind}`}
              style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline', ...rowNine }}
            >
              <CourseTag id={r.courseId} style={{ flex: 'none' }}>
                {courseCode(r.courseId)}
              </CourseTag>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}>{r.kind}</span>
              <span style={{ flex: 'none', fontSize: 'var(--type-base)' }}>
                {showSpan(r.minutes / 60)}
              </span>
              <span
                style={{
                  flex: 'none',
                  fontSize: 'var(--type-xs)',
                  opacity: 0.45,
                  minWidth: 46,
                  textAlign: 'right',
                }}
              >
                {r.from === 1 ? 'from 1' : `from ${r.from}`}
              </span>
            </div>
          ))}
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.45,
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            The middle figure of what you reported, so one all-nighter does not move it. Tick
            something off and the app asks once — it stops asking a kind of work after five.
          </div>
        </>
      )}
    </Folding>
  );
}

/**
 * The next seven days as seven columns, each one a way into that day.
 *
 * A flat meter reading "2 of 5 done" was the only thing this screen said about
 * the week, and a fraction cannot say *when*. Here the height of a column is
 * how much falls on that day against the busiest day of the seven, and the
 * filled part at its foot is how much of that day is ticked. Empty days keep
 * their baseline so seven days still read as seven days.
 *
 * ## Pressing one
 *
 * Opens the calendar on that date. Every column going to the same week screen
 * would be seven copies of one button; this is the one gesture that turns
 * "Thursday looks bad" into Thursday.
 *
 * ## What a screen reader gets
 *
 * The bars are `aria-hidden` — they are a length, and the length is the
 * number. Each button is named with its date and its counts in words, so the
 * whole strip reads as seven dates with what falls on each, in order.
 */
function WeekStrip({ days }: { days: Day[] }) {
  const { dispatch } = useStore();
  const most = Math.max(1, ...days.map((d) => d.due));

  const open = (day: Day) => {
    dispatch({ type: 'setCalDay', date: dateToIso(day.date) });
    dispatch({ type: 'setCalView', view: 'day' });
    dispatch({ type: 'go', screen: 'calendar' });
  };

  return (
    <div
      role="group"
      aria-label="The next seven days, and what falls on each"
      style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}
    >
      {days.map((d) => (
        <button
          key={d.date.toISOString()}
          type="button"
          className="bare tappable"
          aria-label={saidDay(d)}
          onClick={() => open(d)}
          style={{
            flex: 1,
            minWidth: 0,
            width: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            paddingBlock: 'var(--sp-3)',
            paddingInline: 0,
          }}
        >
          <span
            style={{
              fontSize: 'var(--type-xs)',
              fontFamily: 'var(--font-heading)',
              opacity: d.due > 0 ? 0.75 : 0.3,
            }}
          >
            {d.due > 0 ? d.due : '·'}
          </span>
          <div
            aria-hidden
            style={{
              width: '68%',
              height: 34,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              /*
               * Today is marked on the baseline rather than by shading the
               * column, which was the first draft and read as a bar: a filled
               * block behind a day with nothing due is the loudest mark in the
               * strip on the emptiest day in it.
               */
              borderBottom: d.today
                ? '2px solid var(--app-accent)'
                : '1px solid var(--app-line)',
            }}
          >
            <div
              style={{
                height: `${Math.round((d.due / most) * 100)}%`,
                background: 'var(--app-track)',
                // The track is faint by design — it is the empty half of every
                // meter in the app — so on a day of its own it takes an edge.
                boxShadow: 'inset 0 0 0 1px var(--app-line)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              {/* The ticked share of that day, at its foot — the same reading
                  as every other meter in the app, drawn upwards. */}
              <div
                style={{
                  height: d.due > 0 ? `${Math.round((d.done / d.due) * 100)}%` : '0%',
                  background: 'var(--chrome)',
                }}
              />
            </div>
          </div>
          <span
            style={{
              fontSize: 'var(--type-xs)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.08em',
              opacity: d.today ? 0.9 : 0.45,
            }}
          >
            {DOW_INITIALS[d.dow]}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * One day of the strip, in words.
 *
 * Here rather than inline because it is the only thing a screen reader gets
 * from that column, and a label assembled in a style block is a label nobody
 * reads twice.
 */
function saidDay(d: Day): string {
  const when = `${DOW[d.dow]} ${d.date.getDate()}${d.today ? ', today' : ''}`;
  if (d.due === 0) return `${when}: nothing due`;
  const due = `${d.due} due`;
  return d.done > 0 ? `${when}: ${due}, ${d.done} done` : `${when}: ${due}`;
}
