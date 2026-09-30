import { useEffect } from 'react';
import { ActionButton, SectionLabel } from './ui';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import type { NeedId } from '../lib/help-routes';
import type { Screen } from '../lib/types';
import {
  EMPTY_LIFE_EVENTS,
  LIFE_EVENTS,
  MAX_ACTIVE,
  activePlans,
  chooseEvent,
  clearEvent,
  pruneLapsed,
  readLifeEvents,
  type LifeEventId,
} from '../lib/lifeevents';

/**
 * "If something has changed", on the Behind screen.
 *
 * Twelve plain sentences and no field to type in. Choosing one shows a
 * temporary plan: things to look at (all optional), people who can help, the
 * day it clears on its own, and one follow-up. Nothing is sent, nothing is
 * asked, and what is kept — the event and the day — stays on this device
 * under `storageKey`. See `lib/lifeevents.ts` for why that is the rule.
 *
 * It takes a key, today's date and two ways to go somewhere, and nothing
 * else: no store, no profile, no record.
 */
export function LifeEvents({
  storageKey,
  today,
  onGo,
  onHelp,
}: {
  storageKey: string;
  today: string;
  onGo: (screen: Screen) => void;
  onHelp: (need: NeedId) => void;
}) {
  const lib = useDeviceLibrary(storageKey, readLifeEvents, EMPTY_LIFE_EVENTS, 20_000);
  const plans = activePlans(lib.value, today);

  // A plan that has lapsed is not drawn; this also lets go of it in storage.
  useEffect(() => {
    const kept = pruneLapsed(lib.value, today);
    if (kept !== lib.value) lib.update(kept);
    // `lib.update` is stable for a given key; the value and the day are the triggers.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.value, today]);

  const choose = (id: LifeEventId) => lib.update((s) => chooseEvent(s, id, today));
  const clear = (id: LifeEventId) => lib.update((s) => clearEvent(s, id));

  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;
  const small = { fontSize: 'var(--type-sm)', ...secondLine() } as const;
  const chosen = new Set(plans.map((p) => p.plan.event.id));

  return (
    <section aria-labelledby="life-events-heading">
      <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>
        <span id="life-events-heading">If something has changed</span>
      </SectionLabel>
      <p style={body}>
        Pick the sentence that is closest. You never have to say why, and nothing is sent to anyone. What you pick stays on
        this device, and the plan clears itself after four weeks.
      </p>

      {lib.error && (
        <p role="alert" style={small}>
          {lib.error}
        </p>
      )}

      <div role="group" aria-label="What has changed" style={{ display: 'flex', flexDirection: 'column', gap: 'calc(9px * var(--density, 1))', marginTop: 'var(--sp-4)' }}>
        {LIFE_EVENTS.map((e) => (
          <button
            key={e.id}
            type="button"
            className="bare tappable"
            aria-pressed={chosen.has(e.id)}
            disabled={lib.blocked}
            onClick={() => choose(e.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              paddingBlock: 'calc(12px * var(--density, 1))',
              paddingInline: 'calc(14px * var(--density, 1))',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-base-plus)',
              lineHeight: 'var(--leading-tight-plus)',
            }}
          >
            {e.says}
          </button>
        ))}
      </div>
      {plans.length >= MAX_ACTIVE && (
        <p style={{ ...small, marginTop: 'var(--sp-4)' }}>
          Up to {MAX_ACTIVE} can be open at once. Choosing another lets go of the oldest.
        </p>
      )}

      {plans.map(({ plan, followUpDue }) => (
        <div key={plan.event.id} role="region" aria-label={`Plan: ${plan.event.says}`} style={{ marginTop: 'var(--sp-6)' }}>
          <SectionLabel style={{ marginBlock: 'var(--sp-4)' }}>{plan.event.says}</SectionLabel>
          <p style={small}>{plan.line}</p>

          <p style={{ ...small, marginTop: 'var(--sp-4)' }}>Things you could look at, if you want to:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
            {plan.adjustments.map((a) => (
              <ActionButton key={a.id} onClick={() => onGo(a.screen)} style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}>
                {a.label}
              </ActionButton>
            ))}
          </div>

          <p style={{ ...small, marginTop: 'var(--sp-4)' }}>People who can help. Nothing is filled in for you:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
            {plan.routes.map((r) => (
              <ActionButton
                key={r.need}
                onClick={() => onHelp(r.need)}
                aria-label={r.directoryOnly ? `Find who to talk to about: ${r.label}` : `Ask for help with: ${r.label}`}
                style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}
              >
                {r.label}
              </ActionButton>
            ))}
          </div>

          {followUpDue ? (
            <div role="group" aria-label="Is this still what you need?" style={{ marginTop: 'var(--sp-5)' }}>
              <p style={body}>Two weeks on. Is this still what you need?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <ActionButton onClick={() => choose(plan.event.id)} style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}>
                  Keep it another four weeks
                </ActionButton>
                <ActionButton onClick={() => clear(plan.event.id)} style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}>
                  I’m fine now
                </ActionButton>
              </div>
            </div>
          ) : (
            <p style={{ ...small, marginTop: 'var(--sp-4)' }}>{`One reminder on ${plan.followUp}. It clears itself on ${plan.expires}.`}</p>
          )}

          {!followUpDue && (
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <ActionButton onClick={() => clear(plan.event.id)} aria-label={`Clear this plan now: ${plan.event.says}`} style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}>
                Clear it now
              </ActionButton>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
