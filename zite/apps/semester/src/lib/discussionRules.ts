// Course discussion (Semester Faculty "discussions"; S-60 §5). Posts are Zite Messages on the section's discussion group;
// replies and moderation live in dis-001 (lib/disMigration.ts). Pure; unit-tested in tests/discussion.test.ts.
export const MAX_BODY = 4000;
export const MAX_DEPTH = 1; // a post and its replies; replies to replies attach to the same top post

export type Post = { id: string; parentId: string | null; at: string; hidden: { by: string; reason: string } | null; authorId: string };
export type ViewPost = Post & { replies: ViewPost[]; shownBody: 'full' | 'removed' };

export function validateBody(body: string): string | null {
  const t = body.trim();
  if (!t) return 'Write something first.';
  if (t.length > MAX_BODY) return `Keep posts under ${MAX_BODY} characters.`;
  return null;
}
/** Course staff (instructors of record and live grading delegates) moderate; students do not. */
export const canModerate = (role: 'instructor' | 'delegate' | 'student') => role !== 'student';

/** Threads, oldest first; a reply to a reply hangs off the same top post. Hidden posts keep their place but not their text,
 *  except for their author and course staff. */
export function threads(posts: Post[], viewer: string, staff: boolean): ViewPost[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const topOf = (p: Post): string => { let cur = p; const seen = new Set<string>(); while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parentId)!; } return cur.id; };
  const view = (p: Post): ViewPost => ({ ...p, replies: [], shownBody: !p.hidden || staff || p.authorId === viewer ? 'full' : 'removed' });
  const tops = posts.filter((p) => !p.parentId || !byId.has(p.parentId)).sort((a, b) => a.at.localeCompare(b.at)).map(view);
  const index = new Map(tops.map((t) => [t.id, t]));
  for (const p of posts.filter((x) => x.parentId && byId.has(x.parentId)).sort((a, b) => a.at.localeCompare(b.at))) index.get(topOf(p))?.replies.push(view(p));
  return tops;
}
