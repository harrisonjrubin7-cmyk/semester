import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { Group, ItemRow } from '../../components/shell/Rows';
import { Blueprint } from '../../components/Blueprint';
import { SectionLabel } from '../../components/ui';
import { TermSwitch } from '../../components/TermSwitch';
import { InsightCards } from '../../components/InsightCards';
import { insights } from '../../insights';
import { factsFrom } from '../../insights/facts';
import { download } from '../../lib/deliver';
import { allCards } from '../../data/catalog';
import { datedItems } from '../../lib/select';
import { tallyBy } from '../../lib/review';
import { calibrate, calibrationLine } from '../../lib/worth';
import { pattern } from '../../lib/postmortem';
import { readTerm } from '../../lib/term';
import { basis, document as asDocument, findings, nothingLine, type TermInput } from '../../lib/worked';
import { Folding } from '../../components/Fold';

/**
 * What actually worked, at the end of a term.
 *
 * Four months of evidence about how you study gets thrown away every
 * December, which is the moment it becomes worth something. The app knows one
 * thing nobody else does — which way of working preceded your good results,
 * and how far ahead the things that went well got started.
 *
 * Every claim has a floor under it and a claim that does not clear its floor
 * is not made. A quiet term produces an empty report that says exactly which
 * thing was too thin, which is more use than four manufactured insights and
 * is the only version of this worth reading twice.
 *
 * The coarsest grain of `screens/Reports.tsx`.
 *
 * ## One thing was given up in the merge
 *
 * As its own screen this had a "Find a finding" box that filtered the list in
 * place. The frame's search adapter belongs to the screen, and the screen is
 * now three grains — so honouring it would mean computing the term's findings
 * on every render of the day report, and the engine walks every card in every
 * guide to do it. The box is still there and still reaches the whole-app
 * search; it no longer filters. Findings are few by construction — each one
 * has to clear a floor before it is made at all — so what is lost is a filter
 * over about four rows.
 */
export function TermReport() {
  const { state, now, catalog, courseCode } = useStore();

  const input: TermInput = useMemo(() => {
    const items = datedItems(catalog, now);

    // A deadline counts once it is ticked. Where the tick predates the app
    // recording when — see `tickedAt` — the due date stands in, which makes
    // the lead zero rather than dropping the row.
    const ticks = items
      .filter((i) => state.done[i.id])
      .map((i) => ({
        id: i.id,
        courseId: i.c,
        dueAt: i.date.getTime(),
        tickedAt: state.tickedAt[i.id] ?? i.date.getTime(),
      }));

    const drilled = tallyBy(
      state.reviews,
      catalog.modules.map((m) => ({
        courseId: m.course.id,
        questions: allCards(m.guide).map((c) => c.q),
      })),
    );

    const ours = new Set(catalog.courses.map((c) => c.id));
    return {
      sittings: state.sittings.filter((s) => ours.has(s.courseId)),
      ticks,
      spent: state.spent.filter((s) => ours.has(s.courseId)),
      drilled,
      codeOf: courseCode,
    };
  }, [catalog, now, state.done, state.tickedAt, state.reviews, state.sittings, state.spent, courseCode]);

  const found = findings(input);
  // Only reports that carry a guess made before the work started — the app's
  // own estimate is the median of these very reports, so scoring that against
  // them measures nothing. See `lib/worth.ts`.
  const guesses = state.spent
    .filter((s) => typeof s.guess === 'number')
    .map((s) => ({ guess: s.guess ?? 0, minutes: s.minutes, at: s.at }));
  const bias = calibrate(guesses);
  const marks = pattern(
    state.returned.map((r) => r.mortem).filter((m): m is NonNullable<typeof m> => Boolean(m)),
  );
  /*
   * Recomputed when the state it reads changes, and not otherwise.
   *
   * These screens must not lag, and the engine walks every card in every
   * guide to work out which unit an answer belongs to.
   */
  const supported = useMemo(() => insights(factsFrom(state, catalog, now)), [state, catalog, now]);

  const label = readTerm(state.term).label;
  const nothing = nothingLine(input);

  return (
    <Folding name="Term">
      <TermSwitch />

      {/*
        The engine's read of the term, above this screen's own.

        The term report is the deep read — the one surface that takes
        everything rather than a handful — so it is where the engine lands
        first. It computes nothing itself: every number below came from
        `src/insights/`, which is a pure function of state.
      */}
      {supported.length > 0 && (
        <>
          <SectionLabel>What the records support</SectionLabel>
          <InsightCards list={supported} />
        </>
      )}

      <Blueprint style={{ padding: '15px 16px', marginTop: 'var(--sp-6)' }}>
        <div className="kicker">{label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.2, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {found.length === 0
            ? 'Nothing this term will support.'
            : `${found.length} ${found.length === 1 ? 'thing' : 'things'} the term will support.`}
        </div>
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
          {basis(input)}
        </div>
      </Blueprint>

      {/*
        What the correction does, not what it is.

        How wrong your own guesses have been is a different finding from
        everything below and does not go through `findings`. It is here rather
        than only behind the scenes because the correction is already applied
        to every start date in the app — see `lib/worth.ts` — and a number
        quietly adjusted is a number nobody can check. Silent below five
        recent guesses.

        It says what the app does about the ratio rather than restating it:
        the insight card above states it, and two statements of one fact is
        worse than either, because the reader has to decide which to believe.
      */}
      {calibrationLine(bias) ? (
        <>
          <SectionLabel style={{ margin: '22px 0 6px' }}>Your own estimates</SectionLabel>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
            {calibrationLine(bias)}
          </div>
        </>
      ) : null}

      {/*
        Where the marks actually went, across the term.

        Separate from the estimates above and from `findings` below, because it
        rests on something the student typed rather than on anything the app
        measured. Silent under two post-mortems: one paper is one morning.
      */}
      {marks ? (
        <>
          <SectionLabel style={{ margin: '22px 0 6px' }}>Where the marks went</SectionLabel>
          <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
            {marks}
          </div>
        </>
      ) : null}

      {found.length === 0 ? (
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 'var(--sp-7)', lineHeight: 1.55 }}>
          {nothing || 'Nothing stood out far enough above the noise to be worth saying.'}
        </div>
      ) : (
        <Group header="What the term shows" framed={false}>
          {found.map((f) => (
            <ItemRow
              key={f.said}
              title={f.said}
              meta={`from ${f.from} observation${f.from === 1 ? '' : 's'}`}
            />
          ))}
        </Group>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-7)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            download({
              name: `${label.toLowerCase().replace(/\s+/g, '-')}-what-worked.md`,
              body: asDocument(label, input),
              mime: 'text/markdown',
            })
          }
          style={{ flex: 1, height: 42 }}
        >
          Save it
        </button>
      </div>

      <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-6)', lineHeight: 'var(--leading-normal)' }}>
        Every line is counted from what this app recorded, and anything it could not support with
        enough observations was left out rather than softened. There is no score for the term, and no
        comparison with anybody else.
      </div>
    </Folding>
  );
}
