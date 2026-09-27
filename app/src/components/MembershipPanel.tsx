import { useState } from 'react';
import { ALWAYS_INCLUDED, PILOT_NOTE, PLANS, plan, priceLine, type PlanId } from '../lib/plans';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';

/**
 * Membership, on the Account screen.
 *
 * What a membership page has to answer, answered honestly for a product that
 * sells nothing yet (DECISION-LOG D-009): which plan you are on (Free), what
 * each plan would include, what upgrading or cancelling would do (nothing can
 * be bought, so nothing can be cancelled), what you have paid (nothing), and
 * where your export and deletion are — which are on every plan, always.
 *
 * "Upgrade" and "Cancel" are real buttons that explain rather than disabled
 * ones that do not: a disabled control says "not now" without saying why, and
 * a screen reader skips it entirely.
 */

const CURRENT: PlanId = 'free';

const WHY: Record<'upgrade' | 'cancel', string> = {
  upgrade: 'Nothing has been charged, and nothing will be without a checkout you see and confirm.',
  cancel: 'You are on Semester Free, so there is nothing to cancel. Your data stays yours on every plan.',
};

export function MembershipPanel() {
  const { dispatch } = useStore();
  const [said, setSaid] = useState<'upgrade' | 'cancel' | null>(null);
  const current = plan(CURRENT);

  return (
    <section aria-labelledby="membership-title" style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>
        <span id="membership-title">Membership</span>
      </SectionLabel>
      <p style={{ fontSize: 'var(--type-md)', margin: '0 0 var(--sp-2)' }}>
        You are on <strong>{current.name}</strong>.
      </p>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: '0 0 var(--sp-4)' }}>{PILOT_NOTE}</p>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
        <button type="button" className="btn btn-secondary" aria-expanded={said === 'upgrade'} onClick={() => setSaid(said === 'upgrade' ? null : 'upgrade')}>
          Upgrade
        </button>
        <button type="button" className="btn btn-ghost" aria-expanded={said === 'cancel'} onClick={() => setSaid(said === 'cancel' ? null : 'cancel')}>
          Cancel membership
        </button>
      </div>
      {said && (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          {WHY[said]}
        </p>
      )}

      <details style={{ marginBottom: 'var(--sp-4)' }}>
        <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--type-sm-plus)' }}>
          Compare plans
        </summary>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-4)' }}>
          {PLANS.map((p) => (
            <li key={p.id} style={{ border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
              <div style={{ fontSize: 'var(--type-base)' }}>
                <strong>{p.name}</strong>
                {p.id === CURRENT ? ' · your plan' : ''}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>{priceLine(p)}</div>
              <ul style={{ fontSize: 'var(--type-sm)', margin: 'var(--sp-2) 0 0', paddingInlineStart: '1.2em' }}>
                {p.includes.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </details>

      <p style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-2)' }}><strong>On every plan, always</strong></p>
      <ul style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', paddingInlineStart: '1.2em' }}>
        {ALWAYS_INCLUDED.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'go', screen: 'export' })}>
          Export your data
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'go', screen: 'privacy' })}>
          Delete your data
        </button>
      </div>

      <p style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-1)' }}><strong>Payment history</strong></p>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 0 }}>
        No payments. Semester has never charged you and holds no card or bank details.
      </p>
    </section>
  );
}
