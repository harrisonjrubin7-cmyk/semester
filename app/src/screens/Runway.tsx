import { useMemo, useState } from 'react';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { useNow, useStore } from '../state/store';
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
import {
  coverage,
  coverageLine,
  readProposal,
  scopePrompt,
  worthSaying,
  type Proposal,
} from '../lib/covers';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
import { ActionButton } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
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
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  // See `useRowStyle`: spread rather than wrapped, so a button row stays
  // one tap target.
  const rowStyle = useRowStyle(10);

  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);
  const exams = useMemo(() => examsAhead(items, state.done), [items, state.done]);
  const [pick, setPick] = useState(0);
  /**
   * A reading of the deadline's own words, offered and not applied.
   *
   * Held here, in the screen, rather than in the store — which is the point
   * rather than a convenience. A proposal that survived a reload would be a
   * proposal that starts to look like a setting; this one exists between the
   * tap that asked for it and the tap that accepts it, and accepting writes
   * the student's box. Nothing else in the app ever sees it.
   */
  const [proposed, setProposed] = useState<Proposal | null>(null);
  const [reading, setReading] = useState(false);
  const scopeTrouble = useTrouble();
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

  /** The deadline's own words, which is all the reading below ever sees. */
  const said = exam ? [exam.title, exam.detail ?? '', exam.quote ?? ''].filter(Boolean).join(' · ') : '';

  /**
   * Ask what the line says, when nothing here could read it.
   *
   * Offered only where `coverage` fell through to the whole course: the two
   * parsers in `lib/covers.ts` are narrow on purpose, and where one of them
   * did fire it has already answered better than a model can, from words a
   * person can check at a glance. This is for the sentence that says the scope
   * in prose — "everything up to and including the Fisher paper" — which
   * matches no span and is exactly what a reader is for.
   */
  const readScope = async () => {
    if (reading || !exam || !said) return;
    setReading(true);
    setProposed(null);
    scopeTrouble.clear();
    let sofar = '';
    try {
      await ask({
        about: 'exam runway',
        maxTokens: 400,
        system: scopePrompt(guide.units),
        messages: [{ role: 'user', content: said }],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      let parsed: unknown = null;
      try {
        // The JSON out of the prose, because a model asked for JSON alone
        // returns it wrapped often enough to be worth surviving.
        const m = /\{[\s\S]*\}/.exec(sofar);
        parsed = m ? JSON.parse(m[0]) : null;
      } catch {
        parsed = null;
      }
      setProposed(readProposal(parsed, guide.units, said));
    } catch (e) {
      scopeTrouble.failed(e, () => void readScope());
    } finally {
      setReading(false);
    }
  };

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
        <Blueprint style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(16px * var(--density, 1))' }}>
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
          style={{ marginBottom: 'calc(14px * var(--density, 1))' }}
        />
      )}

      <Blueprint style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(16px * var(--density, 1))' }}>
        <div className="kicker">
          {code(exam.c)} · {exam.title}
        </div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 'var(--leading-display)', marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {headline(r)}
        </div>
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
          {r.stage.label}. {r.stage.shape}
        </div>
        {r.daysAway > 0 ? (
          <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', marginTop: 'calc(7px * var(--density, 1))', lineHeight: 'var(--leading-normal)' }}>
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
        <Blueprint style={{ paddingBlock: 'calc(13px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginTop: 'var(--sp-5)' }}>
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
                marginTop: 'calc(9px * var(--density, 1))',
                fontSize: 'var(--type-sm-plus)',
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
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>{paperLine(r)}</div>

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
          style={{ height: 52, marginTop: 'calc(14px * var(--density, 1))', display: 'block', textAlign: 'center' }}
        >
          {/*
            `--app-dim` is wrong here, and main is right about why: it is the
            ground's ink at the ground's dim strength, and this sits on
            `.btn-primary`, whose fill is bright and whose ink is therefore
            near-black by design. Handing it the ground's ink paints
            light-on-light — measured at 218/255 on one channel, a kicker that
            all but disappeared. See `ENGINEERING-AUDIT.md` §7.

            The `opacity: 0.75` that stood here instead does not work either,
            and no other number does. Sampling the button's real fill on all
            thirteen grounds, the light ones put light ink (247,245,240) on a
            mid-dark fill with very little headroom: at full strength Paper
            reaches 4.55:1, Industry 4.82 and Parchment 4.88, against the 4.5
            an 11px line needs. At 0.75 they are 3.34, 3.50 and 3.53, which is
            what `scripts/paint.mjs` reports as a failure by sampling pixels.
            The lowest step of 0.05 that clears the bar on every ground is 1.

            So the kicker keeps the button's own ink, undimmed, and reads as a
            kicker from its size and letter-spacing — which is how `.kicker`
            does it everywhere else in the app.
          */}
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', letterSpacing: '0.12em' }}>
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
              /* One rung, not two. The assumed reading used to be fainter than
                 the stated one, and at 11px neither value cleared the bar. The
                 wording already says which it is. */
              ...secondLine(),
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

          {/*
            The reader, offered only where nothing could be read.

            `covers.source` is 'whole' exactly when both parsers declined and
            the box is empty, which is the one case a sentence in prose is
            going unread. Where the syllabus stated a span, or where the
            student has typed one, there is nothing here to improve on and a
            button offering to re-read it would invite somebody to replace a
            fact with a guess.
          */}
          {covers.source === 'whole' && said && configured() ? (
            <div style={{ marginTop: 'var(--sp-5)' }}>
              {!proposed ? (
                <ActionButton onClick={() => void readScope()} disabled={reading}>
                  {reading ? 'Reading the line…' : 'Read what the syllabus says'}
                </ActionButton>
              ) : null}

              <Trouble said={scopeTrouble.said} onRetry={scopeTrouble.again} />

              {proposed ? (
                <Blueprint plain style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-4)' }}>
                  <div className="kicker">Read from the deadline, not decided</div>
                  <div
                    style={{
                      fontSize: 'var(--type-md)',
                      lineHeight: 'var(--leading-tight)',
                      marginTop: 'var(--sp-3)',
                    }}
                  >
                    {proposed.units.length} of {guide.units.length} units — {proposed.text}.
                  </div>
                  {/*
                    The sentence it read, shown. `readProposal` has already
                    checked that these words are in the deadline, so this is
                    the evidence rather than a summary of it — and it is what
                    makes confirming a decision rather than a leap of faith.
                  */}
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-relaxed)',
                      marginTop: 'var(--sp-4)',
                      paddingLeft: 'var(--sp-5)',
                      borderLeft: '1px solid var(--app-line)',
                      textWrap: 'pretty',
                    }}
                  >
                    “{proposed.because}”
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
                    <ActionButton
                      tone="primary"
                      onClick={() => {
                        /*
                         * Confirming writes the box, and nothing else.
                         *
                         * From here it is `yours` — the source that already
                         * means "you said so" — so the count changes because a
                         * person said it does, through the same path as
                         * anything they typed themselves, and is editable and
                         * clearable in the same place. No fourth source, and
                         * the app still never infers what an exam covers.
                         */
                        dispatch({ type: 'setExamCovers', id: exam.id, text: proposed.text });
                        setProposed(null);
                      }}
                      style={{ flex: 1 }}
                    >
                      Use {proposed.text}
                    </ActionButton>
                    <ActionButton onClick={() => setProposed(null)} style={{ flex: 1 }}>
                      No
                    </ActionButton>
                  </div>
                </Blueprint>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {r.units.length === 0 ? (
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
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
              opacity: u.cards === 0 ? DIMMED_ROW : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-tight-plus)' }}>{u.name}</span>
            <span
              style={{
                flex: 'none',
                fontSize: 'var(--type-sm)',
                /* Colour rather than opacity, which is what let a `--app-warn`
                   count render at 4.40:1 — the token is audited, the 0.9 over
                   it was not. */
                color: u.seen === 0 && u.cards > 0 ? 'var(--app-warn)' : 'var(--app-dim)',
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
              className="bare tappable on-paper"
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
                  fontSize: 'var(--type-xs-plus)',
                  color: 'var(--app-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {i.dueShort}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-tight-plus)' }}>
                {i.title}
                <span style={{ color: 'var(--app-dim)' }}> · {code(i.c)}</span>
              </span>
            </button>
          ))}
        </>
      )}

      <PrintButton label="Print the runway" style={{ marginTop: 'calc(14px * var(--density, 1))' }} />
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        Every number here is counted from your own drilling and your own deadlines. There is no
        readiness score and there will not be one — it would be believed, and the app cannot know.
      </div>
    </Page>
  );
}
