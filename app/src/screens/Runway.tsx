import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { EmptyState } from '../components/ui';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { datedItems } from '../lib/select';
import { cardKey } from '../lib/review';
import { forCourse } from '../lib/sitting';
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

  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);
  const exams = useMemo(() => examsAhead(items, state.done), [items, state.done]);
  const [pick, setPick] = useState(0);
  const exam = exams[Math.min(pick, Math.max(0, exams.length - 1))];

  const { guide } = useLive(exam?.c ?? state.guideId);

  // What has been done to each unit, as counts rather than as a percentage.
  const units: UnitState[] = useMemo(() => {
    if (!exam) return [];
    // The store's clock, not the wall clock: `now` ticks on the minute and is
    // the same value every other screen counts against.
    const at = now.getTime();
    return guide.units.map((u) => {
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
  }, [guide, exam, state.reviews, now]);

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
      <div style={{ padding: 18 }}>
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
      </div>
    );
  }

  const code = (id: string) => catalog.byId[id]?.code ?? id;
  const worst = weakest(r);
  const book = bookBy(exam, state.accessLeadDays);
  const accessUrl = state.linkUrls.access || CAMPUS_LINKS.find((l) => l.id === 'access')?.url || '';

  return (
    <div style={{ padding: 18 }}>
      {exams.length > 1 && (
        // The next few. A runway more than a term away is "far" in every band,
        // so a chip for it is a chip that says nothing.
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14 }}>
          {exams.slice(0, 6).map((e, i) => {
            const on = e.id === exam.id;
            return (
              <button
                key={e.id}
                type="button"
                className="btn"
                aria-pressed={on}
                onClick={() => setPick(i)}
                style={{
                  flex: 'none',
                  padding: '6px 11px',
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                }}
              >
                {code(e.c)} · {e.daysAway}d
              </button>
            );
          })}
        </div>
      )}

      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">
          {code(exam.c)} · {exam.title}
        </div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.15, marginTop: 6, textWrap: 'pretty' }}
        >
          {headline(r)}
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
          {r.stage.label}. {r.stage.shape}
        </div>
        {r.daysAway > 0 ? (
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 7, lineHeight: 1.45 }}>
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
        <Blueprint style={{ padding: '13px 14px', marginTop: 10 }}>
          <div className="kicker">Student Access</div>
          <div
            style={{
              fontSize: 'calc(14px * var(--text-scale, 1))',
              lineHeight: 1.45,
              marginTop: 6,
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
          <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>
            Weekends only — the app has no holiday calendar and will not invent one, so a lead
            time crossing a public holiday is a day short.
          </div>
        </Blueprint>
      )}

      <SectionLabel>Where you stand</SectionLabel>
      <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.5 }}>{standing(r)}</div>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 6, lineHeight: 1.5 }}>{paperLine(r)}</div>

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
          <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.12em', opacity: 0.75 }}>
            {worst.seen === 0 ? 'NEVER OPENED' : 'FURTHEST BEHIND'}
          </span>
          {/* The unit's own name, which in most guides carries its number. */}
          <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 2 }}>{worst.name}</span>
        </button>
      ) : null}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'sitPaper', minutes: 30, formatId: 'mixed' })}
        style={{ height: 44, marginTop: 8 }}
      >
        Sit a practice paper
      </button>

      <SectionLabel>Unit by unit</SectionLabel>
      {r.units.length === 0 ? (
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5 }}>
          This course has no study guide yet, so there is nothing to count. Add the readings and
          the guide builds itself.
        </div>
      ) : (
        r.units.map((u) => (
          <div
            key={u.name}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline',
              padding: '10px 0',
              borderBottom: '1px solid var(--app-line)',
              opacity: u.cards === 0 ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>{u.name}</span>
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(12px * var(--text-scale, 1))',
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
                gap: 12,
                alignItems: 'baseline',
                width: '100%',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
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
      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
        Every number here is counted from your own drilling and your own deadlines. There is no
        readiness score and there will not be one — it would be believed, and the app cannot know.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
