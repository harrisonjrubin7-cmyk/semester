import { useState } from 'react';
import { Blueprint } from './Blueprint';
import { useStore } from '../state/store';
import type { Insight } from '../insights';

/**
 * Insights, drawn.
 *
 * Not `components/Insights.tsx`, which already exists and renders
 * `lib/insight.ts` on Brief and Weekly. That layer predates this one and does
 * the same job in a smaller way — findings with an action and a "based on"
 * line, but no evidence you can open and no declared sample size. Absorbing it
 * into this engine is stage 3 of the plan, where the other three surfaces move
 * over; doing it now would change two screens this stage is not meant to
 * touch. Until then the two coexist and only `worked` reads this one.
 *
 * Presentation only. Every number here was computed by `src/insights/`, which
 * is a pure function of state — this file decides nothing and works nothing
 * out, which is what stops four screens quoting four versions of the same
 * figure.
 *
 * ## Why the evidence control is not optional
 *
 * "Most of your real work happens between 8 and 11pm" is a claim about
 * somebody's life. What makes it fair to put on a screen is that the twelve
 * sittings behind it are one tap away, and that the count is visible before
 * anybody taps. An insight whose records cannot be shown does not ship, and
 * this is the half of that rule that lives on screen.
 */
export function InsightCards({ list }: { list: Insight[] }) {
  if (list.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {list.map((i) => (
        <One key={i.id} insight={i} />
      ))}
    </div>
  );
}

function One({ insight }: { insight: Insight }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <Blueprint style={{ padding: '13px 14px' }}>
      <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)', textWrap: 'pretty' }}>
        {insight.headline}
      </div>

      {insight.detail && (
        <div
          style={{
            fontSize: 'var(--type-base)',
            opacity: 0.72,
            marginTop: 'var(--sp-3)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {insight.detail}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--sp-4)',
          marginTop: 'var(--sp-5)',
          paddingTop: 'var(--sp-4)',
          borderTop: '1px solid var(--app-line)',
        }}
      >
        {/*
          The count, always visible.

          "From 12 sittings" before anybody asks is what separates this from a
          horoscope — and where the sample is thin the card says so in the same
          breath rather than in a footnote.
        */}
        <button
          type="button"
          // 193×17 as a line of caps. `tap-y`: it is a full-width row of its
          // own inside the card, with the detail below it, so up and down is
          // where the room is.
          className="bare tappable tap-y"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          style={{
            width: 'auto',
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          {open ? 'HIDE' : 'WHY THIS'} · from {insight.evidence.length}{' '}
          {insight.evidence.length === 1 ? 'record' : 'records'}
          {insight.confidence === 'tentative' ? ', so this may shift' : ''}
        </button>

        {insight.action && (
          <button
            type="button"
            /* The card's one way out, at 108×17 — the size of two caps words.
               `tap-y` like the toggle it shares this row with: the row is
               `space-between`, so they sit at opposite ends and the room a
               thumb needs is above and below. */
            className="bare tappable tap-y"
            onClick={() => dispatch({ type: 'go', screen: insight.action!.screen })}
            style={{
              width: 'auto',
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--app-accent)',
            }}
          >
            {insight.action.label}
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          {insight.evidence.map((e) => (
            <button
              key={`${e.says}-${e.at ?? e.id ?? ''}`}
              type="button"
              className="bare tappable"
              disabled={!e.screen}
              onClick={() => e.screen && dispatch({ type: 'go', screen: e.screen })}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 0 6px 11px',
                borderLeft: '2px solid var(--app-line)',
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
                opacity: e.screen ? 0.8 : 0.6,
              }}
            >
              {e.says}
            </button>
          ))}
        </div>
      )}
    </Blueprint>
  );
}
