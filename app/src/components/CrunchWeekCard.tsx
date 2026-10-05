import { useMemo, useState } from 'react';
import {
  ACTIONS_PREFIX,
  EMPTY_ACTION_CHOICES,
  effectiveStatus,
  readActionChoices,
  transition,
  type ActionEvent,
} from '../lib/actions';
import { useDeviceLibrary } from '../lib/device-library';
import { crunchAction, crunchForecast } from '../lib/life-balance';
import { useLifeBalance } from '../lib/life-balance.hook';
import { goCal } from '../lib/opencal';
import { useStore } from '../state/store';
import { ExplanationSheet } from './ExplanationSheet';
import { SourceBadge } from './SourceBadge';

const WEEK = 7 * 86_400_000;

const SAYS: Partial<Record<ActionEvent, string>> = {
  snooze: 'Snoozed for a week.',
  dismiss: 'Hidden — it will not come back for these deadlines.',
  correct: 'Noted on this device. Fix a wrong date on the course itself, and this updates.',
};

/**
 * The Crunch Week Forecast on Today (`crunch_week_forecast`, Phase E).
 *
 * One line, when a stretch one to four weeks out has three or more major
 * deadlines within six days: "The week of Nov 2 has four major deadlines in
 * six days. Want to start two earlier?" Plan earlier opens that week in Plan,
 * where the suggested blocks are and where each one is added only after a
 * confirmation. Nothing is placed from here.
 *
 * The crunch is an `Action`, so it has the same explanation sheet and the
 * same snooze, dismiss and correct as everything in the Action Center, stored
 * in the same choices library. Renders nothing when there is no crunch.
 */
export function CrunchWeekCard() {
  const { dispatch, account } = useStore();
  const { input, now } = useLifeBalance();
  const library = useDeviceLibrary(`${ACTIONS_PREFIX}:${account?.id || 'device'}`, readActionChoices, EMPTY_ACTION_CHOICES);
  const choices = library.value.choices;
  const [why, setWhy] = useState(false);
  const [said, setSaid] = useState('');

  const forecast = useMemo(() => crunchForecast(input, now).map((c) => ({ c, action: crunchAction(c, now) })), [input, now]);
  const crunch = forecast.find(({ action }) => effectiveStatus(action, choices[action.id], now.getTime()) === 'open') ?? null;

  if (!crunch) return said ? <p role="status" className="balance-said">{said}</p> : null;
  const { c, action } = crunch;

  const act = (event: ActionEvent) => {
    const t = now.getTime();
    const moved = transition(choices[action.id], event, t, { until: t + WEEK });
    if (!moved.ok) return;
    if (library.update((v) => ({ ...v, choices: { ...v.choices, [action.id]: moved.choice } }))) {
      setSaid(SAYS[event] ?? '');
      setWhy(false);
    }
  };

  const first = c.suggestions.find((s) => s.slot)?.slot?.iso ?? c.start;

  return (
    <section className="crunch-card" aria-label="Crunch week forecast">
      <p className="crunch-card-line">
        {c.line} {c.ask}
      </p>
      <p className="balance-muted">
        {c.deadlines.map((d) => `${d.code} ${d.title}`).join(' · ')} <SourceBadge label={action.source.label} />
      </p>
      <div className="crunch-card-actions">
        <button type="button" className="balance-button" onClick={() => goCal(dispatch, first, 'week')}>
          Plan earlier starts
        </button>
        <button type="button" className="balance-button" onClick={() => setWhy(true)}>
          Why this?
        </button>
        <button type="button" className="balance-button" onClick={() => act('snooze')}>
          Snooze a week
        </button>
        <button type="button" className="balance-button" onClick={() => act('dismiss')}>
          Dismiss
        </button>
      </div>
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {why ? (
        <ExplanationSheet action={action} onClose={() => setWhy(false)}>
          <button type="button" className="balance-button" onClick={() => act('correct')}>
            A date here is wrong
          </button>
        </ExplanationSheet>
      ) : null}
    </section>
  );
}
