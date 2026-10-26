// Degree-path comparison for transfer credit. Pure; unit-tested. Three layers that are never merged: official completed work,
// registrar-evaluated transfer decisions, and provisional matches from published rules for courses not yet evaluated.
export type Req = { id: string; name: string; required: number };
export type Course = { code: string; credits: number; satisfies: string[] };
export type Line = { outcome: string | null; code: string | null; awarded: number | null; credits: number; rule: { outcome: string; code: string | null } | null };
const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toUpperCase();

export function pathComparison(reqs: Req[], done: Course[], requests: { state: string; lines: Line[] }[], catalog: Course[]) {
  const byCode = new Map(catalog.map((c) => [norm(c.code), c]));
  const evaluated: { code: string; credits: number }[] = [], provisional: { code: string; credits: number }[] = [];
  let electiveEvaluated = 0, electiveProvisional = 0;
  for (const q of requests) {
    if (q.state === 'withdrawn') continue;
    for (const l of q.lines) {
      if (l.outcome) {
        if (l.outcome === 'equivalent' && l.code) evaluated.push({ code: l.code, credits: l.awarded ?? l.credits });
        else if (l.outcome === 'elective') electiveEvaluated += l.awarded ?? l.credits;
      } else if (l.rule) {
        if (l.rule.outcome === 'equivalent' && l.rule.code) provisional.push({ code: l.rule.code, credits: l.credits });
        else if (l.rule.outcome === 'elective') electiveProvisional += l.credits;
      }
    }
  }
  const sat = (code: string) => byCode.get(norm(code))?.satisfies ?? [];
  const sum = (xs: { code: string; credits: number }[], id: string) => xs.filter((x) => sat(x.code).includes(id)).reduce((n, x) => n + x.credits, 0);
  return {
    requirements: reqs.map((r) => {
      const official = Math.min(r.required, done.filter((c) => c.satisfies.includes(r.id)).reduce((n, c) => n + c.credits, 0));
      const withEvaluated = Math.min(r.required, official + sum(evaluated, r.id));
      const withProvisional = Math.min(r.required, withEvaluated + sum(provisional, r.id));
      return { ...r, official, withEvaluated, withProvisional };
    }),
    electiveEvaluated, electiveProvisional,
    unmatched: [...evaluated, ...provisional].filter((x) => !byCode.has(norm(x.code))).map((x) => x.code),
  };
}
