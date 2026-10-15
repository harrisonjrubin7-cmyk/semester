/**
 * The status history: what the hourly check writes down, what the status pages
 * read back, and what the incident feed says.
 *
 * Plain JavaScript on purpose, like the other scripts here: the workflow runs it
 * with nothing built, and `src/lib/statushistory.test.ts` calls into it through
 * `status-history.d.mts`.
 *
 * Three rules this file exists to hold:
 *
 *  1. A day with no check on it is `nodata`, never `up`. History starts the day
 *     the first check is recorded; nothing before it is filled in, and an hour
 *     the scheduler skipped records nothing rather than a success.
 *  2. Uptime is `ok / total` over the checks that were made, and is `null` when
 *     none were. It is never a round number for a day nobody looked at.
 *  3. What the record says is what was measured. The AI and checkout rows only
 *     say the function answered a browser preflight; no model is called and no
 *     payment is attempted, and the page says so beside them.
 */

/** Days of history kept and shown. */
export const DAYS = 90;

/** The rows on the status pages, in order. `id` is the key in the history file. */
export const COMPONENTS = [
  { id: 'app', name: 'The app', detail: 'the page students open' },
  { id: 'signin', name: 'Sign-in', detail: 'accounts' },
  { id: 'sync', name: 'Your saved work', detail: 'saving and sync' },
  { id: 'ai', name: 'The AI assistant', detail: 'the function answers; no model is called' },
  { id: 'checkout', name: 'Plus checkout', detail: 'the function answers; no payment is attempted' },
];

export const COMPONENT_IDS = COMPONENTS.map((c) => c.id);

/** UTC calendar day, `YYYY-MM-DD`. */
export const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

export const emptyHistory = () => ({ version: 1, since: null, days: {} });

/**
 * One day's bar. `up` only when every check that day passed, `down` only when
 * none did, and `nodata` when nobody looked.
 * @param {number|undefined} ok
 * @param {number|undefined} total
 */
export function barState(ok, total) {
  if (!total || total <= 0) return 'nodata';
  if (ok === total) return 'up';
  if (!ok) return 'down';
  return 'partial';
}

/**
 * Add one hourly result to the history. Pure: returns a new object.
 * @param {{version:number, since:string|null, days:Record<string, Record<string,{ok:number,total:number}>>}} history
 * @param {Record<string, boolean>} results component id -> did it answer
 * @param {Date|string|number} now
 */
export function record(history, results, now = new Date()) {
  const day = dayKey(now);
  const days = { ...history.days };
  const today = { ...(days[day] ?? {}) };
  for (const id of COMPONENT_IDS) {
    if (!(id in results)) continue; // a component not probed this hour records nothing
    const prior = today[id] ?? { ok: 0, total: 0 };
    today[id] = { ok: prior.ok + (results[id] ? 1 : 0), total: prior.total + 1 };
  }
  days[day] = today;
  return prune({ version: 1, since: history.since ?? new Date(now).toISOString(), days }, now);
}

/** Drop days older than the window. */
export function prune(history, now = new Date(), keep = DAYS) {
  const cutoff = dayKey(new Date(new Date(now).getTime() - (keep - 1) * 86_400_000));
  const days = {};
  for (const [day, value] of Object.entries(history.days)) if (day >= cutoff) days[day] = value;
  return { ...history, days };
}

/**
 * The bars for each component, oldest first, ending on `now`'s day.
 * @returns {Record<string, { bars: {day:string, state:string, ok:number, total:number}[], ok:number, total:number, percent:number|null, daysWithData:number }>}
 */
export function summarise(history, now = new Date(), days = DAYS) {
  const end = new Date(dayKey(now) + 'T00:00:00Z').getTime();
  const out = {};
  for (const id of COMPONENT_IDS) {
    const bars = [];
    let ok = 0;
    let total = 0;
    let withData = 0;
    for (let i = days - 1; i >= 0; i--) {
      const day = dayKey(new Date(end - i * 86_400_000));
      const cell = history.days[day]?.[id];
      const state = barState(cell?.ok, cell?.total);
      if (cell && cell.total > 0) {
        ok += cell.ok;
        total += cell.total;
        withData += 1;
      }
      bars.push({ day, state, ok: cell?.ok ?? 0, total: cell?.total ?? 0 });
    }
    out[id] = { bars, ok, total, percent: total > 0 ? Math.round((ok / total) * 10_000) / 100 : null, daysWithData: withData };
  }
  return out;
}

// ── the probes ──────────────────────────────────────────────────────────────

/**
 * A function that is deployed answers a browser preflight with 200 or 204, or
 * 403 if it does not know the origin; a function that is not deployed is a 404
 * from the gateway. So those three mean "running" and nothing else does.
 */
export const FUNCTION_ANSWERS = new Set([200, 204, 403]);

/**
 * Probe every component once. Never throws: a component that cannot be reached
 * is `false`, and every component is tried whatever the others did.
 * @param {{app:string, supabase:string, key:string, origin?:string}} config
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Record<string, boolean>>}
 */
export async function probeAll(config, fetchImpl = fetch) {
  const { app, supabase, key } = config;
  const origin = config.origin ?? new URL(app).origin;
  const timeout = () => AbortSignal.timeout(10_000);
  const answers = async (url, init, accept) => {
    try {
      const r = await fetchImpl(url, { ...init, redirect: 'manual', signal: timeout() });
      return accept(r.status);
    } catch {
      return false;
    }
  };
  const ok2xx = (s) => s >= 200 && s < 300;
  const preflight = { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } };
  const [appUp, signin, sync, ai, checkout] = await Promise.all([
    answers(`${app}/?monitor=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } }, ok2xx),
    answers(`${supabase}/auth/v1/health`, { headers: { apikey: key } }, ok2xx),
    answers(`${supabase}/rest/v1/schools?select=id&limit=1`, { headers: { apikey: key, authorization: `Bearer ${key}` } }, ok2xx),
    answers(`${supabase}/functions/v1/claude`, preflight, (s) => FUNCTION_ANSWERS.has(s)),
    answers(`${supabase}/functions/v1/billing-checkout`, preflight, (s) => FUNCTION_ANSWERS.has(s)),
  ]);
  return { app: appUp, signin, sync, ai, checkout };
}

// ── incidents ───────────────────────────────────────────────────────────────

export const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved', 'scheduled'];
export const INCIDENT_IMPACTS = ['down', 'partial', 'maintenance'];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const realIso = (value) => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === value;
};

/** Everything wrong with the incident file, as sentences; empty when nothing is. */
export function incidentProblems(data) {
  const out = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.incidents)) return ['The file has no incidents list.'];
  if (!ISO.test(data.updated ?? '')) out.push('`updated` is not an ISO time ending in Z.');
  const seen = new Set();
  let newest = '';
  for (const x of data.incidents) {
    const id = x?.id ?? '(no id)';
    if (!/^[a-z0-9-]+$/.test(x?.id ?? '')) out.push(`${id} is not a slug.`);
    if (seen.has(x?.id)) out.push(`${id} appears twice.`);
    seen.add(x?.id);
    if (!String(x?.title ?? '').trim()) out.push(`${id} has no title.`);
    if (!Array.isArray(x?.components) || x.components.length === 0) out.push(`${id} names no component.`);
    for (const c of x?.components ?? []) if (!COMPONENT_IDS.includes(c)) out.push(`${id} names ${c}, which is not a component.`);
    if (!INCIDENT_IMPACTS.includes(x?.impact)) out.push(`${id} has impact ${x?.impact}.`);
    if (!ISO.test(x?.started ?? '')) out.push(`${id} has no start time.`);
    if (x?.resolved !== null && !ISO.test(x?.resolved ?? '')) out.push(`${id} has a resolved time that is neither null nor ISO.`);
    if (x?.resolved && x.resolved < x.started) out.push(`${id} was resolved before it started.`);
    const updates = Array.isArray(x?.updates) ? x.updates : [];
    if (updates.some((u) => u?.status === 'scheduled') &&
      (x?.impact !== 'maintenance' || !realIso(x?.started) || !realIso(x?.until) || x.until <= x.started)) {
      out.push(`${id} is scheduled without a valid maintenance start/end window.`);
    }
    if (updates.length === 0) out.push(`${id} has no updates.`);
    let prior = '';
    for (const u of updates) {
      if (!ISO.test(u?.at ?? '')) out.push(`${id} has an update with no time.`);
      if (!INCIDENT_STATUSES.includes(u?.status)) out.push(`${id} has an update with status ${u?.status}.`);
      if (!String(u?.body ?? '').trim()) out.push(`${id} has an empty update.`);
      if (prior && u?.at < prior) out.push(`${id}'s updates are out of order.`);
      prior = u?.at ?? prior;
      if ((u?.at ?? '') > newest) newest = u.at;
    }
    const last = updates[updates.length - 1];
    if (x?.resolved && last?.status !== 'resolved') out.push(`${id} is resolved but its last update is ${last?.status}.`);
    if (!x?.resolved && last?.status === 'resolved') out.push(`${id} says resolved but has no resolved time.`);
  }
  if (newest && ISO.test(data.updated ?? '') && data.updated < newest) out.push('`updated` is earlier than the newest update.');
  return out;
}

/**
 * The UTC days an incident touches, first to last. An incident still open
 * runs to `now`, so one that crosses midnight is on every day it was open.
 */
export function incidentDays(incident, now = new Date()) {
  const start = new Date(dayKey(incident.started) + 'T00:00:00Z').getTime();
  const end = new Date(dayKey(incident.resolved ?? now) + 'T00:00:00Z').getTime();
  const days = [];
  for (let t = start; t <= end; t += 86_400_000) days.push(dayKey(t));
  return days;
}

// ── the feed ────────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COMPONENT_NAME = Object.fromEntries(COMPONENTS.map((c) => [c.id, c.name]));

/**
 * An Atom feed of the incident file. Deterministic: `updated` is the file's own,
 * so the same file always makes the same feed and a test can hold them together.
 * @param {{updated:string, incidents:any[]}} data
 * @param {{site:string, feedUrl:string}} where
 */
export function incidentFeed(data, where) {
  const entries = [...data.incidents]
    .sort((a, b) => (b.updates.at(-1).at > a.updates.at(-1).at ? 1 : -1))
    .map((x) => {
      const last = x.updates.at(-1);
      const affected = x.components.map((c) => COMPONENT_NAME[c] ?? c).join(', ');
      const body = x.updates.map((u) => `${u.at} — ${u.status}: ${u.body}`).join('\n');
      return [
        '  <entry>',
        `    <id>${esc(`${where.site}#incident-${x.id}`)}</id>`,
        `    <title>${esc(`${x.title} (${last.status})`)}</title>`,
        `    <updated>${esc(last.at)}</updated>`,
        `    <published>${esc(x.started)}</published>`,
        `    <link rel="alternate" href="${esc(where.site)}"/>`,
        `    <summary type="text">${esc(`Affects: ${affected}. Impact: ${x.impact}.`)}</summary>`,
        `    <content type="text">${esc(body)}</content>`,
        '  </entry>',
      ].join('\n');
    });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>Semester status: incidents</title>',
    `  <id>${esc(where.feedUrl)}</id>`,
    `  <link rel="self" href="${esc(where.feedUrl)}"/>`,
    `  <link rel="alternate" href="${esc(where.site)}"/>`,
    `  <updated>${esc(data.updated)}</updated>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
}
