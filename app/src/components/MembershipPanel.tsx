import { useEffect, useRef, useState } from 'react';
import { ALWAYS_INCLUDED, INDIVIDUAL_PAID_ACQUISITION_ENABLED, NOT_ON_SALE_HERE, PLANS, plan, priceLine, type PlanId } from '../lib/plans';
import { cloud, cloudConfigured, currentSession } from '../lib/cloud';
import { formatDate } from '../lib/locale';
import {
  cancelMembership,
  checkoutReturn,
  consentText,
  currentSubscription,
  fetchOwnSubscriptions,
  fetchPlusPrices,
  hasPaidBefore,
  openBillingPortal,
  priceWords,
  takeOpenUpgrade,
  startCheckout,
  type PlusPrice,
  type Subscription,
} from '../lib/membership';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';

/**
 * Membership, on the Account screen.
 *
 * Which plan you are on, what each plan includes, how to upgrade and how to
 * cancel, what you have paid, and where your export and deletion are — which
 * are on every plan, always.
 *
 * Plus is bought here once the catalog answers with a Plus price and the
 * build has an account service (D-128, superseding D-009 for this one plan).
 * The price on the button is the catalog's, the consent names amount,
 * interval, renewal and the way to cancel, and it is recorded server-side by
 * `billing-checkout` before Stripe is ever asked. The card is typed into
 * Stripe's page. Without a catalog — a device-only build, or a network that
 * has gone — the panel says what it always said: nothing is for sale in this build.
 *
 * "Upgrade" and "Cancel" are real buttons that explain rather than disabled
 * ones that do not: a disabled control says "not now" without saying why, and
 * a screen reader skips it entirely.
 */

const WHY: Record<'upgrade' | 'cancel', string> = {
  upgrade: 'Nothing has been charged, and nothing will be without a checkout you see and confirm.',
  cancel: 'You are on Semester Free, so there is nothing to cancel. Your data stays yours on every plan.',
};

const RETURNED: Record<'success' | 'cancel', string> = {
  success: 'Payment sent to Stripe. Your plan changes to Plus as soon as Stripe confirms it, usually within a minute.',
  cancel: 'Checkout was closed before paying. Nothing was charged.',
};

/** After `?checkout=success`: look every 3 s for a minute for the webhook's row. */
const SUCCESS_POLLS = 20;
const SUCCESS_POLL_MS = 3000;

const when = (iso: string) => (iso ? formatDate(iso, { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of the period you paid for');

export function MembershipPanel() {
  const { dispatch, account } = useStore();
  // Opened already when Today's "See Plus" brought the person here.
  const [handedOver] = useState(() => takeOpenUpgrade());
  const [said, setSaid] = useState<'upgrade' | 'cancel' | null>(handedOver ? 'upgrade' : null);
  // Membership is the last thing on a long Account page: arriving from
  // Today's "See Plus" at the top of it would look like nothing happened.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!handedOver || !section.current) return;
    section.current.scrollIntoView?.({ block: 'start' });
    section.current.focus({ preventScroll: true });
  }, [handedOver]);
  const [prices, setPrices] = useState<PlusPrice[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [returned] = useState(() => (typeof location === 'undefined' ? null : checkoutReturn(location.search)));
  const signedIn = cloudConfigured && !!account;
  const accountId = signedIn ? account.id : '';
  const [paidBefore, setPaidBefore] = useState(false);
  // The account whose subscription could not be read. For that account the
  // panel cannot tell Free from Plus, so it sells nothing and says so; it is
  // kept by account so a switch on a shared device never inherits it.
  const [uncheckedFor, setUncheckedFor] = useState<string | null>(null);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const unchecked = accountId !== '' && uncheckedFor === accountId;
  // Until the read answers, a signed-in person's plan is not known either.
  const checking = accountId !== '' && !unchecked && checkedFor !== accountId;
  const unknown = unchecked || checking;

  useEffect(() => {
    if (!cloudConfigured) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const db = await cloud();
        const found = INDIVIDUAL_PAID_ACQUISITION_ENABLED ? await fetchPlusPrices(db) : [];
        if (!accountId) {
          if (live) setPrices(found);
          return;
        }
        // Only this person's own, individual billing account.
        const read = async () => ({ data: await fetchOwnSubscriptions(db, accountId) });
        // Stripe can send the buyer back before its webhook has written the
        // subscription, so after a successful return keep looking for a
        // minute rather than showing Free until the next reload.
        let tries = returned === 'success' ? SUCCESS_POLLS : 1;
        const look = async () => {
          const own = await read();
          if (!live) return;
          const found = currentSubscription(own.data);
          setSub(found);
          setPaidBefore(hasPaidBefore(own.data));
          tries -= 1;
          if (!found && tries > 0) timer = setTimeout(() => void look().catch(() => {}), SUCCESS_POLL_MS);
        };
        // The prices are shown only once the person's own subscription has
        // been read: before that, or if the read fails, a subscriber would be
        // shown Free and offered what they already pay for.
        try {
          await look();
        } catch {
          if (live) setUncheckedFor(accountId);
          return;
        }
        if (live) {
          setPrices(found);
          setCheckedFor(accountId);
        }
      } catch {
        // No catalog, no sale. Signed in, the subscription was not read either,
        // so the plan is not known: say so, rather than "Checking" for ever.
        if (live && accountId) setUncheckedFor(accountId);
      }
    })();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [accountId, returned]);

  const onSale = prices.length > 0;
  const chosen = prices.find((p) => p.id === choice) ?? prices[0];
  const current = sub ? { ...plan('plus'), name: 'Semester Plus' } : plan('free');
  const currentId: PlanId = sub ? 'plus' : 'free';

  const toggle = (which: 'upgrade' | 'cancel') => {
    setError('');
    setSaid(said === which ? null : which);
  };

  const checkout = async () => {
    if (busy || !chosen) return;
    if (!agreed) {
      setError('Tick the box to agree to the recurring charge first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = (await currentSession())?.access_token;
      if (!token) {
        setError('Sign in again to upgrade. Nothing was charged.');
        return;
      }
      const r = await startCheckout(token, chosen.id);
      if (r.kind === 'redirect') {
        window.location.assign(r.url);
        return;
      }
      setError(r.said);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy || !sub) return;
    setBusy(true);
    setError('');
    try {
      const token = (await currentSession())?.access_token;
      if (!token) {
        setError('Sign in again to cancel. Nothing has changed yet.');
        return;
      }
      const r = await cancelMembership(token, sub.id);
      if (r.kind === 'refused') {
        setError(r.said);
        return;
      }
      setSub({ ...sub, cancelAtPeriodEnd: true, periodEnd: r.endsAt || sub.periodEnd });
      setNote(`Cancelled. You keep Plus until ${when(r.endsAt || sub.periodEnd)}, and you will not be charged again.`);
    } finally {
      setBusy(false);
    }
  };

  const billingHistory = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const token = (await currentSession())?.access_token;
      if (!token) {
        setError('Sign in again to view billing history.');
        return;
      }
      const r = await openBillingPortal(token);
      if (r.kind === 'redirect') {
        window.location.assign(r.url);
        return;
      }
      setError(r.said);
    } finally {
      setBusy(false);
    }
  };

  const statusLine = unchecked
    ? 'Nothing has changed and nothing will be charged. Try again in a moment.'
    : checking
    ? 'Checking your plan…'
    : sub
    ? sub.cancelAtPeriodEnd
      ? `Cancelled. Plus stays on until ${when(sub.periodEnd)}.`
      : sub.status === 'past_due' || sub.status === 'grace'
        ? sub.billingIssue === 'address_required'
          ? 'Your last payment did not go through, and another invoice needs your current billing address. Update your card from Stripe’s email, then open billing history below to update your address.'
          : 'Your last payment did not go through. Stripe will try again; update your card from the link in Stripe’s email.'
        : sub.billingIssue === 'address_required'
          ? 'Stripe needs your current billing address to calculate tax. Open billing history below and update your address; your card has not failed.'
        : `Renews on ${when(sub.periodEnd)}.`
    : onSale
      ? `Plus is ${prices.map(priceWords).join(' or ')}. Free stays free.`
      : NOT_ON_SALE_HERE;

  return (
    <section ref={section} tabIndex={-1} aria-labelledby="membership-title" style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>
        <span id="membership-title">Membership</span>
      </SectionLabel>
      {returned && (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-3)', textWrap: 'pretty' }}>
          {RETURNED[returned]}
        </p>
      )}
      <p style={{ fontSize: 'var(--type-md)', margin: '0 0 var(--sp-2)' }}>
        {unchecked ? 'Semester could not check your membership just now.' : checking ? 'Your membership' : <>You are on <strong>{current.name}</strong>.</>}
      </p>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: '0 0 var(--sp-4)' }}>{statusLine}</p>

      {!unknown && <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
        {!sub && (
          <button type="button" className="btn btn-secondary" aria-expanded={said === 'upgrade'} onClick={() => toggle('upgrade')}>
            View planned Plus
          </button>
        )}
        {!(sub && sub.cancelAtPeriodEnd) && (
          <button type="button" className="btn btn-ghost" aria-expanded={said === 'cancel'} onClick={() => toggle('cancel')}>
            Cancel membership
          </button>
        )}
      </div>}

      {said === 'upgrade' && !sub && !unknown && (!onSale ? (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          {WHY.upgrade}
        </p>
      ) : !signedIn ? (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          Sign in above to upgrade. Plus belongs to your account, so it follows you to every device.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--sp-3)' }}>
            <legend style={{ fontSize: 'var(--type-sm-plus)', marginBottom: 'var(--sp-2)' }}>Semester Plus</legend>
            {prices.map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minHeight: 44, fontSize: 'var(--type-base)' }}>
                <input
                  type="radio"
                  name="plus-price"
                  value={p.id}
                  checked={chosen?.id === p.id}
                  onChange={() => {
                    setChoice(p.id);
                    setAgreed(false);
                  }}
                />
                {priceWords(p)}
              </label>
            ))}
          </fieldset>
          {chosen && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-3)', textWrap: 'pretty' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 'var(--sp-2)' }} />
              <span>{consentText(chosen)}</span>
            </label>
          )}
          <button type="button" className="btn btn-block" aria-busy={busy} onClick={() => void checkout()}>
            {busy ? 'Opening checkout…' : 'Continue to secure checkout'}
          </button>
          <p style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', margin: 'var(--sp-2) 0 0', textWrap: 'pretty' }}>
            You pay on Stripe’s page. Semester never sees or stores your card.
          </p>
        </div>
      ))}

      {said === 'cancel' && !unknown && (!sub ? (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          {WHY.cancel}
        </p>
      ) : !sub.cancelAtPeriodEnd && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-3)', textWrap: 'pretty' }}>
            Plus stops at the end of the period you have paid for, {when(sub.periodEnd)}. Nothing you made is taken away.
          </p>
          <button type="button" className="btn btn-secondary" aria-busy={busy} onClick={() => void cancel()}>
            {busy ? 'Cancelling…' : 'Cancel Plus'}
          </button>
        </div>
      ))}

      {note && (
        <p role="status" style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          {note}
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: 'var(--type-sm)', color: 'var(--app-accent)', margin: '0 0 var(--sp-4)', textWrap: 'pretty' }}>
          {error}
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
                {p.id === currentId ? ' · your plan' : ''}
              </div>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
                {p.id === 'plus' && onSale ? prices.map(priceWords).join(' or ') : priceLine(p)}
              </div>
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
        {unknown
          ? 'Not checked just now. Stripe emails a receipt for every payment it takes. Semester holds no card or bank details.'
          : sub || paidBefore
          ? 'Stripe takes your payments and emails a receipt for each one. Semester holds no card or bank details.'
          : 'No payments. Semester has never charged you and holds no card or bank details.'}
      </p>
      {!unknown && (sub || paidBefore) && (
        <button type="button" className="btn btn-ghost" aria-busy={busy} onClick={() => void billingHistory()} style={{ marginTop: 'var(--sp-3)' }}>
          {busy ? 'Opening billing history…' : 'Receipts, invoices and payment method'}
        </button>
      )}
    </section>
  );
}
