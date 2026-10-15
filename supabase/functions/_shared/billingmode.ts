/** Payment environments must never share entitlements by accident. */
export function stripeMode(key: string | undefined): 'live' | 'test' | null {
  if (/^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(key ?? '')) return 'live';
  if (/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key ?? '')) return 'test';
  return null;
}

export function checkoutSessionMatches(session: { id?: unknown; url?: unknown; livemode?: unknown }, key: string | undefined): boolean {
  const mode = stripeMode(key);
  if (!mode || session.livemode !== (mode === 'live') || typeof session.id !== 'string'
    || !session.id.startsWith(`cs_${mode}_`) || typeof session.url !== 'string') return false;
  try {
    const url = new URL(session.url);
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com'
      && !url.username && !url.password && !url.port;
  } catch { return false; }
}
