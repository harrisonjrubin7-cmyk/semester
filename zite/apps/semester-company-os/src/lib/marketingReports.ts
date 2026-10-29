// Aggregate marketing reports over inbound requests (site_inbound_requests + the Company OS inbox status). Pure; tested in
// tests/marketingReports.test.ts. Each person counts once per bucket (by contact key, never the address); outputs are counts and
// rates only, so a report can be exported (mka_exports refuses anything address-like).
export type Lead = { key: string; kind: string; createdAt: string; status: string; source: string | null; campaign: string | null };
export type FunnelStep = { stage: string; people: number; ofPrevious: number | null };

const STAGES = ['New', 'Contacted', 'Qualified'] as const;
const reached = (status: string, stage: (typeof STAGES)[number]) => STAGES.indexOf(stage) <= Math.max(STAGES.indexOf(status as never), status === 'Closed' ? 1 : -1);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Best status per person: a person who reached Qualified on any request counts as qualified. */
function people(leads: Lead[]) {
  const rank = (s: string) => (s === 'Qualified' ? 3 : s === 'Closed' ? 2 : s === 'Contacted' ? 1 : 0);
  const m = new Map<string, Lead>();
  for (const l of leads) { const p = m.get(l.key); if (!p || rank(l.status) > rank(p.status) || (rank(l.status) === rank(p.status) && l.createdAt < p.createdAt)) m.set(l.key, l); }
  return [...m.values()];
}

/** New -> Contacted -> Qualified. "Closed" counts as contacted (someone replied) but not qualified. */
export function funnel(leads: Lead[]): FunnelStep[] {
  const ps = people(leads);
  let prev: number | null = null;
  return STAGES.map((stage) => { const n = ps.filter((p) => reached(p.status, stage)).length; const step = { stage, people: n, ofPrevious: prev === null ? null : pct(n, prev) }; prev = n; return step; });
}

/** Leads and qualified people by campaign tag and source tag ("(untagged)" when none). */
export function attribution(leads: Lead[]) {
  const groups = new Map<string, Lead[]>();
  for (const l of leads) { const k = `${l.campaign ?? '(untagged)'}|${l.source ?? '(untagged)'}`; groups.set(k, [...(groups.get(k) ?? []), l]); }
  return [...groups.entries()].map(([k, ls]) => { const [campaign, source] = k.split('|'); const ps = people(ls); const q = ps.filter((p) => p.status === 'Qualified').length;
    return { campaign, source, people: ps.length, qualified: q, rate: pct(q, ps.length) }; }).sort((a, b) => b.people - a.people || a.campaign.localeCompare(b.campaign));
}

/** Cohorts by the month of each person's first request: people, and how many are qualified so far. */
export function cohorts(leads: Lead[]) {
  const first = new Map<string, string>();
  for (const l of leads) { const f = first.get(l.key); if (!f || l.createdAt < f) first.set(l.key, l.createdAt); }
  const best = new Map(people(leads).map((p) => [p.key, p.status]));
  const byMonth = new Map<string, { people: number; qualified: number }>();
  for (const [key, at] of first) { const m = at.slice(0, 7); const c = byMonth.get(m) ?? { people: 0, qualified: 0 }; c.people++; if (best.get(key) === 'Qualified') c.qualified++; byMonth.set(m, c); }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, c]) => ({ month, ...c, rate: pct(c.qualified, c.people) }));
}
