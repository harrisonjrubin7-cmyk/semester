/**
 * Where tonight's hours actually go.
 *
 * The app knew each item's weight, how long that kind of work takes this
 * student, and what is due when. At eleven at night it showed a list and left
 * the arithmetic to the person least able to do it.
 *
 * The ordering is by points of final grade per hour, which is uncomfortable
 * and true: an hour on a twenty-per-cent paper and an hour on a two-per-cent
 * quiz are not worth the same, and refusing to say so does not make it less
 * true — it leaves somebody to work it out at the worst possible hour.
 *
 * ## What it will not do
 *
 * It will not tell anybody to abandon anything. Everything outstanding stays
 * in the list, including what it could not weigh, and the reason for each
 * position is shown so it can be disagreed with. A reading worth nothing
 * towards a grade is still the reading the seminar is about, and an app that
 * quietly dropped it would be making an academic judgement it has no standing
 * to make.
 *
 * Anything due today goes first regardless. A thing due tonight is not a
 * trade.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { datedItems } from '../lib/select';
import { bestBuys, calibrate, calibrationLine, eveningLine, fits, overHours } from '../lib/worth';

const HOURS = [1, 2, 3, 4, 6, 8];

export function Tonight() {
  const { state, dispatch, now, catalog } = useStore();
  const [hours, setHours] = useState(3);
  if (catalog.empty) return <FirstRun where="to plan an evening" />;

  const outstanding = datedItems(catalog, now)
    .filter((i) => !state.done[i.id] && i.daysAway >= 0 && i.daysAway <= 7)
    .map((i) => ({
      id: i.id,
      title: i.title,
      courseId: i.c,
      kind: i.kind,
      weight: i.weight,
      daysAway: i.daysAway,
    }));

  // Only the reports that carry a guess. Most do not, and that is fine — the
  // bias is null until there are four, and a null bias changes nothing.
  const bias = calibrate(
    state.spent
      .filter((s) => typeof s.guess === 'number')
      .map((s) => ({ guess: s.guess ?? 0, minutes: s.minutes })),
  );
  const list = bestBuys(outstanding, state.spent, bias);
  const { taken, over } = fits(list, hours);
  const said = calibrationLine(bias);

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">Tonight</div>
        <div
          className="chrome-text"
          style={{ marginTop: 5, fontSize: 'calc(14px * var(--text-scale, 1))', textWrap: 'pretty' }}
        >
          {eveningLine(list, hours)}
        </div>
        {said ? (
          <div
            style={{
              fontSize: 'calc(12px * var(--text-scale, 1))',
              opacity: 0.72,
              marginTop: 8,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {said}
          </div>
        ) : null}
      </Blueprint>

      <SectionLabel style={{ margin: '18px 0 8px' }}>How long have you got?</SectionLabel>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {HOURS.map((h) => (
          <button
            key={h}
            type="button"
            className="bare tappable"
            aria-pressed={hours === h}
            onClick={() => setHours(h)}
            style={{
              width: 'auto',
              padding: '9px 15px',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${hours === h ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(13px * var(--text-scale, 1))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {h}h
          </button>
        ))}
      </div>

      {taken.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '22px 0 8px' }}>In that time</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {taken.map((b, i) => (
              <Row key={b.id} b={b} n={i + 1} onOpen={() => dispatch({ type: 'openItem', id: b.id })} />
            ))}
          </div>
        </>
      ) : (
        <p
          style={{
            marginTop: 20,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.6,
            lineHeight: 1.5,
          }}
        >
          Nothing due in the next week that is not already ticked off.
        </p>
      )}

      {over.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '22px 0 8px' }}>
            {overHours(over) > 0
              ? `Another ${overHours(over)} hours, not tonight`
              : 'Not tonight'}
          </SectionLabel>
          {/* Shown rather than hidden. What did not fit is the half of the
              answer somebody has to make a decision about. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.62 }}>
            {over.map((b) => (
              <Row key={b.id} b={b} n={0} onOpen={() => dispatch({ type: 'openItem', id: b.id })} />
            ))}
          </div>
        </>
      ) : null}

      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.5,
          marginTop: 22,
          lineHeight: 1.55,
          textWrap: 'pretty',
        }}
      >
        Ordered by points of final grade an hour, from the weights in your syllabi and how long
        that kind of work has taken you. It is not advice about what matters — a reading worth
        nothing towards a grade can still be the reading the seminar is about, which is why
        nothing here is dropped.
      </p>
    </div>
  );
}

function Row({
  b,
  n,
  onOpen,
}: {
  b: ReturnType<typeof bestBuys>[number];
  n: number;
  onOpen: () => void;
}) {
  const { catalog } = useStore();
  const code = catalog.byId[b.courseId]?.code ?? '';
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onOpen}
      style={{
        display: 'flex',
        gap: 11,
        alignItems: 'baseline',
        width: '100%',
        textAlign: 'left',
        padding: '11px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
      }}
    >
      {n > 0 ? (
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(15px * var(--text-scale, 1))',
            opacity: 0.45,
            minWidth: 14,
          }}
        >
          {n}
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(13.5px * var(--text-scale, 1))',
            lineHeight: 1.35,
            textWrap: 'pretty',
          }}
        >
          {b.title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.62,
            marginTop: 3,
          }}
        >
          {[code, b.why, b.daysAway === 0 ? 'due today' : `${b.daysAway}d`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {b.perHour !== null ? (
        <span
          style={{
            fontSize: 'calc(12px * var(--text-scale, 1))',
            opacity: 0.7,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {b.perHour}/h
        </span>
      ) : null}
    </button>
  );
}
