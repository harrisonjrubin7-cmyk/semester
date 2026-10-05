/**
 * The one UTM convention (GTM plan §11.7).
 *
 *   utm_campaign = {tenant}_{cycle}_{audience}_{objective}
 *
 * Every campaign link is built here, so a dashboard can split a campaign name
 * back into its four parts without guessing. A part may not contain the
 * separator, and nothing identifying a person may ride in a link: the plan's
 * deep links "share no data by default", so parameters outside the five UTM
 * keys and a location code are refused rather than dropped silently.
 */

export interface UtmParts {
  source: string;
  medium: string;
  tenant: string;
  cycle: string;
  audience: string;
  objective: string;
  content?: string;
  term?: string;
}

/** Lower-case, ASCII, digits and hyphens only; `_` is the campaign separator. */
export function slugPart(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Same as slugPart but keeps `_` inside a free-text part such as utm_content. */
function slugFree(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function campaignName(p: Pick<UtmParts, 'tenant' | 'cycle' | 'audience' | 'objective'>): string {
  const parts = [p.tenant, p.cycle, p.audience, p.objective].map(slugPart);
  const empty = parts.findIndex((x) => x.length === 0);
  if (empty !== -1) throw new Error(`UTM ${['tenant', 'cycle', 'audience', 'objective'][empty]} is empty.`);
  return parts.join('_');
}

export function parseCampaignName(name: string): Pick<UtmParts, 'tenant' | 'cycle' | 'audience' | 'objective'> | null {
  const parts = name.split('_');
  if (parts.length !== 4 || parts.some((x) => x.length === 0 || x !== slugPart(x))) return null;
  const [tenant, cycle, audience, objective] = parts;
  return { tenant, cycle, audience, objective };
}

/** Parameters a campaign link may carry. `loc` is the QR/deep-link placement code (§15 phase 3). */
const ALLOWED_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'loc']);

export function campaignUrl(base: string, p: UtmParts, location?: string): string {
  const url = new URL(base);
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_PARAMS.has(key)) throw new Error(`Campaign links carry no other parameters (found "${key}").`);
  }
  const source = slugFree(p.source);
  const medium = slugFree(p.medium);
  if (!source || !medium) throw new Error('UTM source and medium are required.');
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaignName(p));
  if (p.content) url.searchParams.set('utm_content', slugFree(p.content));
  if (p.term) url.searchParams.set('utm_term', slugFree(p.term));
  if (location) url.searchParams.set('loc', slugPart(location));
  return url.toString();
}

/** Whether a link meets the acceptance criterion "all campaign links include standardized attribution". */
export function hasStandardAttribution(link: string): boolean {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  const q = url.searchParams;
  for (const key of q.keys()) if (!ALLOWED_PARAMS.has(key)) return false;
  return Boolean(q.get('utm_source') && q.get('utm_medium') && parseCampaignName(q.get('utm_campaign') ?? ''));
}
