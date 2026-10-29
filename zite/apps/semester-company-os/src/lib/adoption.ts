// Aggregate adoption for one customer institution (Customer Success). Pure. Inputs are counts the server already scoped to
// the linked tenant; outputs never contain a person. Any count from 1 to 4 is shown as "fewer than 5" so a small group
// cannot be singled out; zero stays zero.
export const MIN_GROUP = 5;
export type Shown = number | 'fewer than 5';
export const show = (n: number): Shown => (n > 0 && n < MIN_GROUP ? 'fewer than 5' : n);

export type Member = { roles: string[]; status: string };
export type Usage = { module: string; day: string; calls: number };

export function adoption(members: Member[], modulesOn: string[], usage: Usage[], today: string) {
  const active = members.filter((m) => m.status === 'Active');
  const roles = new Map<string, number>();
  for (const m of active) for (const r of new Set(m.roles)) roles.set(r, (roles.get(r) ?? 0) + 1);
  const t = Date.parse(today);
  const age = (d: string) => Math.floor((t - Date.parse(d)) / 86_400_000);
  const mods = new Map<string, { last30: number; prior30: number }>();
  for (const u of usage) {
    const a = age(u.day);
    if (a < 0 || a >= 60) continue;
    const m = mods.get(u.module) ?? { last30: 0, prior30: 0 };
    if (a < 30) m.last30 += u.calls; else m.prior30 += u.calls;
    mods.set(u.module, m);
  }
  return {
    activeMembers: show(active.length),
    pending: show(members.filter((m) => m.status === 'Pending').length),
    byRole: [...roles.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([role, n]) => ({ role, members: show(n) })),
    modulesOn: [...modulesOn].sort(),
    usage: [...mods.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([module, m]) => ({
      module, last30: m.last30, prior30: m.prior30,
      trend: m.prior30 === 0 ? (m.last30 > 0 ? 'new' : 'none') : m.last30 > m.prior30 * 1.1 ? 'up' : m.last30 < m.prior30 * 0.9 ? 'down' : 'flat',
    })),
  };
}
