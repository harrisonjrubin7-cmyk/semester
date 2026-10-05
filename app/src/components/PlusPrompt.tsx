import { useEffect, useState } from 'react';
import { cloud, cloudConfigured } from '../lib/cloud';
import { INDIVIDUAL_PAID_ACQUISITION_ENABLED, plan } from '../lib/plans';
import {
  askToOpenUpgrade,
  currentSubscription,
  fetchOwnSubscriptions,
  fetchPlusPrices,
  priceWords,
  type PlusPrice,
} from '../lib/membership';
import { useStore } from '../state/store';

/** "Not now" keeps the card away on this device for thirty days. */
export const SNOOZE_MS = 30 * 86_400_000;
const snoozeKey = (accountId: string) => `semester.plus-prompt:${accountId}`;

function snoozedUntil(accountId: string): number {
  try {
    const v = Number(localStorage.getItem(snoozeKey(accountId)));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Plus, offered once on Today, at the bottom of the briefing.
 *
 * Below the day's own next step rather than above it, so it never competes
 * with the thing Today is for. Not on the first-run screen Today shows before
 * a student has added anything: nobody is sold to before they have set up a
 * semester. It is shown the same way to every signed-in
 * student on Free — never chosen from what they study, how often, or how
 * well (D-133: study activity is never used to label or target anyone) — and
 * only while the catalog has a Plus price to name. The price is the
 * catalog's, read by the same helper the Membership panel charges from.
 *
 * "See Plus" opens Account with the upgrade already open; nothing is bought
 * from here. "Not now" hides it on this device for thirty days. A student who
 * has Plus never sees it.
 */
export function PlusPrompt({ now = Date.now }: { now?: () => number } = {}) {
  const { account, dispatch } = useStore();
  const accountId = cloudConfigured && account ? account.id : '';
  // What the card knows, per account. Nothing here is decided on the first
  // paint: the account usually arrives after it, and a "hidden" latched then
  // would hide the card from every real student for good.
  const [offer, setOffer] = useState<{ accountId: string; prices: PlusPrice[] } | null>(null);
  const [notNow, setNotNow] = useState('');
  const snoozed = accountId !== '' && (notNow === accountId || snoozedUntil(accountId) > now());

  useEffect(() => {
    if (!INDIVIDUAL_PAID_ACQUISITION_ENABLED || !accountId || snoozed) return;
    let live = true;
    void (async () => {
      try {
        const db = await cloud();
        const [found, own] = await Promise.all([fetchPlusPrices(db), fetchOwnSubscriptions(db, accountId)]);
        if (!live) return;
        // Someone with Plus is offered nothing.
        setOffer({ accountId, prices: currentSubscription(own) ? [] : found });
      } catch {
        /* No catalog, or no way to tell whether they already pay: no card. */
      }
    })();
    return () => {
      live = false;
    };
  }, [accountId, snoozed]);

  const prices = offer && offer.accountId === accountId ? offer.prices : [];
  if (!INDIVIDUAL_PAID_ACQUISITION_ENABLED || !accountId || snoozed || prices.length === 0) return null;

  const later = () => {
    try {
      localStorage.setItem(snoozeKey(accountId), String(now() + SNOOZE_MS));
    } catch {
      /* Storage refused: hidden for this visit only. */
    }
    setNotNow(accountId);
  };
  const see = () => {
    askToOpenUpgrade();
    dispatch({ type: 'go', screen: 'account' });
  };

  return (
    <section
      aria-labelledby="plus-prompt-title"
      style={{ border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', marginTop: 'var(--sp-7)' }}
    >
      <p id="plus-prompt-title" style={{ fontSize: 'var(--type-base)', margin: '0 0 var(--sp-1)' }}>
        <strong>Semester Plus</strong> · {prices.map(priceWords).join(' or ')}
      </p>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: '0 0 var(--sp-3)', textWrap: 'pretty' }}>
        {plan('plus').includes.join(', ')}. Free stays free, and your export and deletion are on every plan.
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={see}>
          See Plus
        </button>
        <button type="button" className="btn btn-ghost" onClick={later}>
          Not now
        </button>
      </div>
    </section>
  );
}
