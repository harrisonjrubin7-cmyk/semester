/**
 * One card on Today when the day does not fit, and nothing when it does.
 *
 * `lib/dayplan.ts` derives every line from times the student or a syllabus
 * stated. This only draws it. Recovery lines are moves the data supports — skip
 * what was marked optional, move what was marked flexible — and where neither
 * exists the card says rescheduling cannot fix it rather than offering one.
 *
 * Silent when nothing overlaps and in the sample semester, where a clash would
 * be about somebody else's term.
 */

import { useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';
import { Folding } from './Fold';
import { lengthOf, railFor } from '../lib/select';
import { clock } from '../lib/activities';
import { dayPlan, itemsFromRail } from '../lib/dayplan';

export function DayPlanNote() {
  const { state, catalog } = useStore();
  const now = useNow();
  const plan = useMemo(() => {
    if (state.sample) return null;
    const rail = railFor(catalog, now, state.appointments, state.commitments);
    return dayPlan(itemsFromRail(rail, (b) => lengthOf(catalog, b as never)));
  }, [state.sample, catalog, now, state.appointments, state.commitments]);
  const clashing = plan?.slots.filter((s) => s.state === 'overlaps') ?? [];
  if (!plan || clashing.length === 0) return null;

  return (
    <Folding name="DayPlanNote">
      <div style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
        <SectionLabel style={{ marginTop: '0', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>Today does not fit</SectionLabel>
        <div
          style={{
            paddingBlock: 'calc(10px * var(--density, 1))',
            paddingInline: 'calc(13px * var(--density, 1))',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--app-warn-line)',
            background: 'var(--app-warn-wash)',
            fontSize: 'var(--type-xs-plus)',
          }}
        >
          <ul aria-label="Items that overlap today" style={{ margin: 0, paddingLeft: '1.1em' }}>
            {clashing.map((s) => (
              <li key={s.item.id}>
                {clock(s.item.start as number)} {s.item.title} — {s.item.required ? 'required' : 'optional'}
              </li>
            ))}
          </ul>
          <ul aria-label="What you can do" style={{ margin: 0, marginTop: 'calc(6px * var(--density, 1))', paddingLeft: '1.1em', color: 'var(--app-dim)' }}>
            {plan.recovery.map((r) => (
              <li key={`${r.itemId}:${r.kind}`}>{r.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </Folding>
  );
}
