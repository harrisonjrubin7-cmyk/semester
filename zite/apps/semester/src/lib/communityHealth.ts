// Community health (role app "Community Manager": health). Pure. Counts from the group's posts and its moderation reports only:
// no post text, no names, nothing about any individual member. Windows are 30 days for activity and 90 days for moderation speed.
export type HealthPost = { id: string; sender: string; sentAt: string | null };
export type HealthReport = { messageId: string; createdAt: string; decidedAt: string | null; state: string };
export type Health = { members: number; posts30: number; posters30: number; reports30: number; openReports: number; medianHoursToDecision: number | null; hiddenNow: number; flags: string[] };

const DAY = 86400000;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function communityHealth(members: number, posts: HealthPost[], reports: HealthReport[], hidden: Set<string>, now = Date.now()): Health {
  const recent = posts.filter((p) => p.sentAt && now - Date.parse(p.sentAt) <= 30 * DAY);
  const ids = new Set(posts.map((p) => p.id));
  const mine = reports.filter((r) => ids.has(r.messageId));
  const reports30 = mine.filter((r) => now - Date.parse(r.createdAt) <= 30 * DAY).length;
  const openReports = mine.filter((r) => r.state === 'open' || r.state === 'appealed').length;
  const hours = mine.filter((r) => r.decidedAt && now - Date.parse(r.createdAt) <= 90 * DAY).map((r) => (Date.parse(r.decidedAt!) - Date.parse(r.createdAt)) / 3600000);
  const med = median(hours);
  const h: Health = { members, posts30: recent.length, posters30: new Set(recent.map((p) => p.sender)).size, reports30, openReports, medianHoursToDecision: med === null ? null : Math.round(med * 10) / 10, hiddenNow: posts.filter((p) => hidden.has(p.id)).length, flags: [] };
  if (members > 0 && h.posts30 === 0) h.flags.push('No posts in 30 days');
  if (h.posts30 >= 10 && h.reports30 / h.posts30 >= 0.2) h.flags.push('1 in 5 recent posts reported');
  if (h.openReports > 0 && med !== null && med > 72) h.flags.push('Reports take over 3 days to decide');
  if (h.openReports >= 5) h.flags.push('5+ reports waiting');
  return h;
}
