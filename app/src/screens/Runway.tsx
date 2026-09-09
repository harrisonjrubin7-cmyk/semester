import { useMemo, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { useLive } from '../lib/live';
import { ChipRow, EmptyState } from '../components/ui';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { datedItems } from '../lib/select';
import { cardKey } from '../lib/review';
import { forCourse } from '../lib/sitting';
import { coverage, coverageLine, worthSaying } from '../lib/covers';
import { CAMPUS_LINKS } from '../data/campus';
import { longLabel } from '../lib/date';
import {
  bookBy,
  bookingLate,
  examsAhead,
  headline,
  paperLine,
  runway,
  standing,
  weakest,
  type UnitState,
} from '../lib/runway';

/**
 * The exam, and the weeks between here and it.
 *
 * The week ahead answers "what does this week ask of me". This answers the
 * other question, the one every semester turns on: it is three weeks to the
 * midterm, four other things are due first, and which of those weeks was
 * actually mine.
 *
 * Every figure is counted in `lib/runway.ts` from data the app already holds —
 * cards never answered, units never opened, papers sat, deadlines in the way.
 * There is no readiness score, for the same reason there is none anywhere else
 * in this app: it would be believed, and it cannot be known.
 */
export function Runway() {
  const { state, dispatch, now, catalog } = useStore();
  // See `useRowStyle`: spread rather than wrapped, so a button row stays
  // one tap target.
  const rowStyle = useRowStyle(10);

  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);
  const exams = useMemo(() => examsAhead(items, state.done), [items, state.done]);
  const [pick, setPick] = useState(0);
  const exam = exams[Math.min(pick, Math.max(0, exams.length - 1))];

  const { guide } = useLive(exam?.c ?? state.guideId);

  /*
   * What is actually on the paper.
   *
   * Every count below is over these units and not over the course, which is
   * the difference between a midterm the syllabus scopes to eight units and
   * the fourteen this screen used to count. `lib/covers.ts` decides, and says
   * on whose authority — the syllabus's words, yours, or nobody's.
   */
  const covers = useMemo(
    () =>
      exam
        ? coverage({
            exam: { title: exam.title, detail: exam.detail, quote: exam.quote },
            units: guide.units,
            yours: state.examCovers[exam.id],
          })
        : null,
    [exam, guide, state.examCovers],
  );

  // What has been done to each unit, as counts rather than as a percentage.
  const units: UnitState[] = useMemo(() => {
    if (!exam || !covers) return [];
    // The store's clock, not the wall clock: `now` ticks on the minute and is
    // the same value every other screen counts against.
    const at = now.getTime();
    const on = new Set(covers.units);
    return guide.units.filter((_, i) => on.has(i)).map((u) => {
      let seen = 0;
      let due = 0;
      for (const card of u.cards) {
        const r = state.reviews[cardKey(exam.c, card.q)];
        if (!r || r.seen === 0) continue;
        seen += 1;
        if (r.due <= at + exam.daysAway * 86_400_000) due += 1;
      }
      return { name: u.name, cards: u.cards.length, seen, due };
    });
  }, [guide, exam, covers, state.reviews, now]);

  const r = useMemo(
    () =>
      exam
        ? runway({
            exam,
            units,
            papers: forCourse(state.sittings, exam.c),
            others: items.filter((i) => !state.done[i.id]),
          })
        : null,
    [exam, units, state.sittings, items, state.done],
  );

  if (!exam || !r) {
    return (
      <Page>
        <Blueprint style={{ padding: '15px 16px' }}>
          <EmptyState
            inline
            title="Nothing to count down to"
            body="No exam ahead in this term — or nothing the app recognises as one. It counts anything named as an exam, a midterm, a final or a test, and anything else worth a quarter of the grade or more."
            action={{
              label: 'Import a syllabus',
              onClick: () => dispatch({ type: 'go', screen: 'import' }),
            }}
          />
        </Blueprint>
      </Page>
    );
  }

  const code = (id: string) => catalog.byId[id]?.code ?? id;
  // Six, as it has always been: past that a chip is a date nobody is
  // steering by yet. Named because the row and its labels and the index
  // the pick writes back all have to be the same list.
  const next = exams.slice(0, 6);
  const worst = weakest(r);
  const book = bookBy(exam, state.accessLeadDays);
  const accessUrl = state.linkUrls.access || CAMPUS_LINKS.find((l) => l.id === 'access')?.url || '';

  return (
    <Page bottom={26}>
      {/*
        The next few. A runway more than a term away is "far" in every band,
        so a chip for it is a chip that says nothing.

        `ChipRow` rather than the copy of it this drew by hand: the same
        `.btn`, the same chrome fill when chosen, the same `flex: none`, at
        6px 11px instead of 5px 12px — the shape the note on `PickChips`
        describes, where the fastest way to write a chip is to copy the
        nearest one. It is also the row in the app most likely to overflow,
        being one chip per exam, and it was the one row with no hidden
        scrollbar and no fade: at four courses the fourth chip was cut through
        the middle of a course code at the screen edge, with nothing saying
        there was a fifth.
      */}
      {exams.length > 1 && (
        <ChipRow
          options={next.map((e) => e.id)}
          value={exam.id}
          labels={Object.fromEntries(next.map((e) => [e.id, `${code(e.c)} · ${e.daysAway}d`]))}
          onChange={(id) => setPick(next.findIndex((e) => e.id === id))}
          style={{ marginBottom: 14 }}
        />
      )}

      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">
          {code(exam.c)} · {exam.title}
        </div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.15, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {headline(r)}
        </div>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
          {r.stage.label}. {r.stage.shape}
        </div>
        {r.daysAway > 0 ? (
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 7, lineHeight: 'var(--leading-normal)' }}>
            {r.clearDays} of those days have nothing else standing on them.
          </div>
        ) : null}
      </Blueprint>

      {/*
        A testing-centre booking has a lead time, and counting business days
        backwards over a weekend is the arithmetic somebody gets wrong at
        eleven at night. Silent for everybody who has not set one.
      */}
      {book && (
        <Blueprint style={{ padding: '13px 14px', marginTop: 'var(--sp-5)' }}>
          <div className="kicker">Student Access</div>
          <div
            style={{
              fontSize: 'var(--type-md)',
              lineHeight: 'var(--leading-normal)',
              marginTop: 'var(--sp-3)',
              color: bookingLate(book, now) ? 'var(--app-warn)' : undefined,
            }}
          >
            {bookingLate(book, now)
              ? `The ${state.accessLeadDays}-business-day window for a testing-centre booking closed on ${longLabel(book)}.`
              : `Book the testing centre by ${longLabel(book)} — ${state.accessLeadDays} business days out.`}
          </div>
          {accessUrl ? (
            <a
              href={accessUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-block"
              style={{
                height: 38,
                marginTop: 9,
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              Open Student Access →
            </a>
          ) : null}
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            Weekends only — the app has no holiday calendar and will not invent one, so a lead
            time crossing a public holiday is a day short.
          </div>
        </Blueprint>
      )}

      <SectionLabel>Where you stand</SectionLabel>
      <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)' }}>{standing(r)}</div>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>{paperLine(r)}</div>

      {worst ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() =>
            dispatch({
              type: 'openGuide',
              id: exam.c,
              mode: 'cards',
              unit: r.units.indexOf(worst),
            })
          }
          style={{ height: 52, marginTop: 14, display: 'block', textAlign: 'center' }}
        >
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', letterSpacing: '0.12em', opacity: 0.75 }}>
            {worst.seen === 0 ? 'NEVER OPENED' : 'FURTHEST BEHIND'}
          </span>
          {/* The unit's own name, which in most guides carries its number. */}
          <span style={{ display: 'block', fontSize: 'var(--type-md)', marginTop: 'var(--sp-1)' }}>{worst.name}</span>
        </button>
      ) : null}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'sitPaper', minutes: 30, formatId: 'mixed' })}
        style={{ height: 44, marginTop: 'var(--sp-4)' }}
      >
        Sit a practice paper
      </button>

      <SectionLabel>Unit by unit</SectionLabel>
      {covers && worthSaying(guide.units.length) ? (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: covers.source === 'whole' ? 0.6 : 0.75,
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {coverageLine(covers, guide.units.length)}
          </div>
          {/*
            One box, and it takes what a person would say out loud — "1 to 8",
            "5-9", "all". Parsed by the same reader that reads the syllabus, so
            there is one place where a span is understood rather than two that
            can disagree. Blank puts it back to the default and stores nothing.
          */}
          <input
            className="input"
            type="text"
            value={state.examCovers[exam.id] ?? ''}
            onChange={(e) =>
              dispatch({ type: 'setExamCovers', id: exam.id, text: e.target.value })
            }
            placeholder="What it covers — “units 1 to 8”, “5-9”, “all”"
            aria-label={`What ${exam.title} covers`}
            style={{ width: '100%', marginTop: 'var(--sp-4)', fontSize: 'var(--type-base)' }}
          />
        </div>
      ) : null}
      {r.units.length === 0 ? (
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.6, lineHeight: 'var(--leading-relaxed)' }}>
          This course has no study guide yet, so there is nothing to count. Add the readings and
          the guide builds itself.
        </div>
      ) : (
        r.units.map((u) => (
          <div
            key={u.name}
            style={{
              display: 'flex',
              gap: 'var(--sp-5)',
              alignItems: 'baseline',
              ...rowStyle,
              opacity: u.cards === 0 ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>{u.name}</span>
            <span
              style={{
                flex: 'none',
                fontSize: 'var(--type-sm)',
                opacity: u.seen === 0 ? 0.9 : 0.55,
                color: u.seen === 0 && u.cards > 0 ? 'var(--app-warn)' : undefined,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {u.cards === 0
                ? 'no cards'
                : u.seen === 0
                  ? `${u.cards} untouched`
                  : `${u.seen}/${u.cards} seen${u.due > 0 ? ` · ${u.due} due` : ''}`}
            </span>
          </div>
        ))
      )}

      {r.between.length > 0 && (
        <>
          <SectionLabel>In the way, first</SectionLabel>
          {r.between.slice(0, 8).map((i) => (
            <button
              key={i.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: i.id })}
              style={{
                display: 'flex',
                gap: 'var(--sp-6)',
                alignItems: 'baseline',
                width: '100%',
                textAlign: 'left',
                ...rowStyle,
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 58,
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.55,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {i.dueShort}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                {i.title}
                <span style={{ opacity: 0.5 }}> · {code(i.c)}</span>
              </span>
            </button>
          ))}
        </>
      )}

      <PrintButton label="Print the runway" style={{ marginTop: 14 }} />
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        Every number here is counted from your own drilling and your own deadlines. There is no
        readiness score and there will not be one — it would be believed, and the app cannot know.
      </div>
    </Page>
  );
}
