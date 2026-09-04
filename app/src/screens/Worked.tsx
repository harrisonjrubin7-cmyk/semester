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
  const label = readTerm(state.term).label;
  const nothing = nothingLine(input);

  return (
    <div style={{ padding: 18 }}>
      <TermSwitch />

      <Blueprint style={{ padding: '15px 16px', marginTop: 12 }}>
        <div className="kicker">{label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 22, lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}
        >
          {found.length === 0
            ? 'Nothing this term will support.'
            : `${found.length} ${found.length === 1 ? 'thing' : 'things'} the term will support.`}
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>
          {basis(input)}
        </div>
      </Blueprint>

      {found.length === 0 ? (
        <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 16, lineHeight: 1.55 }}>
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
              <div style={{ fontSize: 15, lineHeight: 1.45, textWrap: 'pretty' }}>{f.said}</div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 5 }}>
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

      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 12, lineHeight: 1.45 }}>
        Every line is counted from what this app recorded, and anything it could not support with
        enough observations was left out rather than softened. There is no score for the term, and
        no comparison with anybody else.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
