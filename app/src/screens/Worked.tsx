import { useMemo } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { TermSwitch } from '../components/TermSwitch';
import { download } from '../lib/deliver';
import { allCards } from '../data/catalog';
import { datedItems } from '../lib/select';
import { tallyBy } from '../lib/review';
import { calibrate, calibrationLine, guessLine } from '../lib/worth';
import { pattern } from '../lib/postmortem';
import { readTerm } from '../lib/term';
import { basis, document as asDocument, findings, nothingLine, type TermInput } from '../lib/worked';

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
 */
export function Worked() {
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
  const said = guessLine(guesses, bias);
  const marks = pattern(
    state.returned.map((r) => r.mortem).filter((m): m is NonNullable<typeof m> => Boolean(m)),
  );
  const label = readTerm(state.term).label;
  const nothing = nothingLine(input);

  return (
    <div style={{ padding: 18 }}>
      <TermSwitch />

      <Blueprint style={{ padding: '15px 16px', marginTop: 12 }}>
        <div className="kicker">{label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}
        >
          {found.length === 0
            ? 'Nothing this term will support.'
            : `${found.length} ${found.length === 1 ? 'thing' : 'things'} the term will support.`}
        </div>
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>
          {basis(input)}
        </div>
      </Blueprint>

      {/*
        How wrong your own guesses have been, which is a different finding from
        everything below and does not go through `findings`.

        It is here rather than only behind the scenes because the correction is
        already applied to every start date in the app — see `lib/worth.ts` —
        and a number quietly adjusted is a number nobody can check. Silent
        below five recent guesses.
      */}
      {said ? (
        <>
          <SectionLabel style={{ margin: '22px 0 6px' }}>Your own estimates</SectionLabel>
          <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.45, textWrap: 'pretty' }}>
            {said}
          </div>
          {calibrationLine(bias) ? (
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
              {calibrationLine(bias)}
            </div>
          ) : null}
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
          <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.45, textWrap: 'pretty' }}>
            {marks}
          </div>
        </>
      ) : null}

      {found.length === 0 ? (
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 16, lineHeight: 1.55 }}>
          {nothing || 'Nothing stood out far enough above the noise to be worth saying.'}
        </div>
      ) : (
        <>
          <SectionLabel>What the term shows</SectionLabel>
          {found.map((f) => (
            <div
              key={f.said}
              style={{ padding: '12px 0', borderBottom: '1px solid var(--app-line)' }}
            >
              <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.45, textWrap: 'pretty' }}>{f.said}</div>
              <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 5 }}>
                from {f.from} observation{f.from === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
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
      <PrintButton label="Print it" style={{ marginTop: 8 }} />

      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 12, lineHeight: 1.45 }}>
        Every line is counted from what this app recorded, and anything it could not support with
        enough observations was left out rather than softened. There is no score for the term, and
        no comparison with anybody else.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
