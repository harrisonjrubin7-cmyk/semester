/**
 * The people in your classes.
 *
 * This is the first thing in the app where one person's data is shown to
 * another, so what it does and does not claim is written down here and said
 * again on the screen.
 *
 * **Verification proves an address, not an enrolment.** A confirmed
 * @vanderbilt.edu address means somebody controls a Vanderbilt mailbox. It
 * does not mean they are in ECON 1020, because nothing here can read the
 * registrar — no student-usable API exposes a class roster, and there will not
 * be one. So a room is people who say they are in that class, and the screen
 * says exactly that rather than implying a roster.
 *
 * **Blocking happens in the database.** A blocked person's messages are
 * removed by a row-level policy, so they never reach the device. Filtering in
 * the client would leave the words sitting in the browser.
 *
 * **Reports are stored, not moderated.** Nobody is watching a queue. Saying
 * otherwise would be the worst kind of lie in a feature like this — somebody
 * would rely on it. Blocking is the remedy that works, and it is immediate.
 *
 * Everything above the network line here is pure and tested: normalising a
 * course code is what decides whether two people are in the same room at all,
 * and getting it wrong splits a lecture into "ECON 1020", "econ1020" and
 * "Econ 1020" with one person in each.
 */

import { cloud } from './cloud';

/** Only these addresses may take part, and only once confirmed. */
export const DOMAIN = 'vanderbilt.edu';

export function eligible(email: string | undefined | null): boolean {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${DOMAIN}`);
}

/**
 * "econ1020", "ECON-1020", "Econ 1020 " → "ECON 1020".
 *
 * The single most important function in the file. A room is keyed by this
 * string, so any disagreement about spacing or case does not produce a
 * warning — it produces three rooms with one person in each, and everyone
 * concludes nobody else is in the class.
 *
 * Returns an empty string for anything that is not a course code, rather than
 * a best guess, because a room called "MYECON HW3" that one person can find is
 * worse than being told to type it again.
 */
export function normaliseCode(text: string): string {
  const cleaned = (text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  const m = /^([A-Z]{2,4})\s*([0-9]{3,4}[A-Z]?)\b/.exec(cleaned);
  return m ? `${m[1]} ${m[2]}` : '';
}

/**
 * "2026FA" — which term a date falls in.
 *
 * Rooms are per term as well as per course, so last year's ECON 1020 is not
 * the same room as this year's. The boundaries are the ordinary American
 * academic ones: autumn from August, spring from January, and the short
 * stretch between them is summer.
 */
export function termOf(date = new Date()): string {
  const month = date.getMonth();
  const part = month >= 7 ? 'FA' : month >= 4 ? 'SU' : 'SP';
  return `${date.getFullYear()}${part}`;
}

/** A readable label for a term. */
export function termLabel(term: string): string {
  const m = /^(\d{4})(FA|SP|SU)$/.exec(term);
  if (!m) return term;
  const season = m[2] === 'FA' ? 'Fall' : m[2] === 'SP' ? 'Spring' : 'Summer';
  return `${season} ${m[1]}`;
}

/** A handle worth showing. Never an email, and never blank. */
export function cleanHandle(text: string): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 40);
}

export function handleProblem(text: string): string {
  const handle = cleanHandle(text);
  if (handle.length < 2) return 'A name needs at least two characters.';
  if (handle.includes('@')) {
    // The one input people paste an address into without thinking.
    return 'Not your email — classmates see this, and your address is not something to publish.';
  }
  return '';
}

/** The two letters on an avatar, from whatever they called themselves. */
export function initials(handle: string): string {
  const parts = cleanHandle(handle).split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "3:42p" or "Tue 3:42p" once it is not today. */
export function whenSaid(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const h24 = at.getHours();
  const clock = `${h24 % 12 === 0 ? 12 : h24 % 12}:${String(at.getMinutes()).padStart(2, '0')}${
    h24 >= 12 ? 'p' : 'a'
  }`;
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) return clock;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()];
  return `${day} ${clock}`;
}

export interface Profile {
  user_id: string;
  handle: string;
  about: string;
}

export interface Enrollment {
  user_id: string;
  term: string;
  code: string;
}

export interface Message {
  id: string;
  term: string;
  code: string;
  user_id: string;
  body: string;
  created_at: string;
}

/**
 * The rooms your own courses suggest.
 *
 * Offered rather than joined: appearing in a room is telling other people you
 * are in that class, and that should be a thing you did, not a thing that
 * happened while you were importing a syllabus.
 */
export function roomsFor(codes: string[], joined: string[]): { code: string; joined: boolean }[] {
  const seen = new Set<string>();
  const out: { code: string; joined: boolean }[] = [];
  for (const raw of codes) {
    const code = normaliseCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, joined: joined.includes(code) });
  }
  for (const code of joined) {
    if (!seen.has(code)) {
      seen.add(code);
      out.push({ code, joined: true });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

// ── The network ───────────────────────────────────────────────────────────
// Everything below needs Supabase. The tables and their policies are in
// supabase/classmates.sql; the policies are the security, not these calls.

export async function myProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await (await cloud())
    .from('profiles')
    .select('user_id, handle, about')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function saveProfile(userId: string, handle: string, about: string): Promise<void> {
  const problem = handleProblem(handle);
  if (problem) throw new Error(problem);
  const { error } = await (await cloud())
    .from('profiles')
    .upsert({ user_id: userId, handle: cleanHandle(handle), about: about.slice(0, 140) });
  if (error) throw new Error(explain(error.message));
}

export async function myRooms(userId: string, term: string): Promise<string[]> {
  const { data, error } = await (await cloud())
    .from('enrollments')
    .select('code')
    .eq('user_id', userId)
    .eq('term', term);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { code: string }[]).map((r) => r.code).sort();
}

export async function join(userId: string, term: string, code: string): Promise<void> {
  const clean = normaliseCode(code);
  if (!clean) throw new Error('That is not a course code. "ECON 1020", with the number.');
  const { error } = await (await cloud())
    .from('enrollments')
    .upsert({ user_id: userId, term, code: clean }, { onConflict: 'user_id,term,code' });
  if (error) throw new Error(explain(error.message));
}

export async function leave(userId: string, term: string, code: string): Promise<void> {
  const { error } = await (await cloud())
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('term', term)
    .eq('code', code);
  if (error) throw new Error(explain(error.message));
}

/**
 * Everyone who says they are in this class. Not a roster; see the header.
 *
 * Two queries rather than one embedded select. PostgREST can only embed a
 * table it has a foreign key path to, and `enrollments` has none to
 * `profiles` — both point at `auth.users` instead, which is not a path it can
 * follow. Adding an FK between them would work and would also mean you could
 * not join a class before choosing a display name, which is a worse rule than
 * running one more query.
 */
export async function whoIsIn(term: string, code: string): Promise<Profile[]> {
  const { data: rows, error } = await (await cloud())
    .from('enrollments')
    .select('user_id')
    .eq('term', term)
    .eq('code', code);
  if (error) throw new Error(explain(error.message));

  const ids = [...new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const { data, error: second } = await (await cloud())
    .from('profiles')
    .select('user_id, handle, about')
    .in('user_id', ids);
  if (second) throw new Error(explain(second.message));

  // Somebody in the class who has not chosen a name yet simply is not listed,
  // rather than appearing as a blank row.
  return ((data ?? []) as Profile[]).sort((a, b) => a.handle.localeCompare(b.handle));
}

export async function recent(term: string, code: string, limit = 60): Promise<Message[]> {
  const { data, error } = await (await cloud())
    .from('messages')
    .select('id, term, code, user_id, body, created_at')
    .eq('term', term)
    .eq('code', code)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  // Newest first from the database, because that is the cheap index; oldest
  // first on screen, because that is how a conversation reads.
  return ((data ?? []) as Message[]).reverse();
}

export async function say(userId: string, term: string, code: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const { error } = await (await cloud())
    .from('messages')
    .insert({ user_id: userId, term, code, body: text.slice(0, 2000) });
  if (error) throw new Error(explain(error.message));
}

export async function unsay(id: string): Promise<void> {
  const { error } = await (await cloud()).from('messages').delete().eq('id', id);
  if (error) throw new Error(explain(error.message));
}

/**
 * New messages, as they arrive.
 *
 * Realtime honours row-level security, so a subscriber receives only what the
 * select policy would have handed them anyway — including the blocking rule.
 * Returns the unsubscribe.
 */
export function listen(
  term: string,
  code: string,
  onMessage: (m: Message) => void,
): () => void {
  // The client loads on demand, so the channel is opened once it arrives and
  // the canceller has to handle being called before that — a room opened and
  // closed quickly would otherwise leave a live channel with nobody listening.
  let close: (() => void) | null = null;
  let cancelled = false;

  void cloud().then((db) => {
    if (cancelled) return;
    const channel = db
      .channel(`room:${term}:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.term === term && m.code === code) onMessage(m);
        },
      )
      .subscribe();
    close = () => void db.removeChannel(channel);
  });

  return () => {
    cancelled = true;
    close?.();
  };
}

export async function block(userId: string, blocked: string): Promise<void> {
  const { error } = await (await cloud())
    .from('blocks')
    .upsert({ user_id: userId, blocked }, { onConflict: 'user_id,blocked' });
  if (error) throw new Error(explain(error.message));
}

export async function unblock(userId: string, blocked: string): Promise<void> {
  const { error } = await (await cloud())
    .from('blocks')
    .delete()
    .eq('user_id', userId)
    .eq('blocked', blocked);
  if (error) throw new Error(explain(error.message));
}

export async function blocked(userId: string): Promise<string[]> {
  const { data, error } = await (await cloud()).from('blocks').select('blocked').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { blocked: string }[]).map((r) => r.blocked);
}

/** The copy is kept because a report about a deleted message reads as nothing. */
export async function report(
  reporter: string,
  message: Message,
  reason: string,
): Promise<void> {
  const { error } = await (await cloud()).from('reports').insert({
    reporter,
    message_id: message.id,
    about: message.user_id,
    reason: reason.trim().slice(0, 500),
    copy: message.body.slice(0, 2000),
  });
  if (error) throw new Error(explain(error.message));
}

/**
 * A Postgres error, in words.
 *
 * A row-level-security refusal comes back as a bare "new row violates
 * row-level security policy", which tells a student nothing. Almost always it
 * means the one thing the whole feature is gated on.
 */
export function explain(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('row-level security') || text.includes('violates row-level')) {
    return (
      'The database would not accept that. Almost always this means the account is not a ' +
      `confirmed @${DOMAIN} address, or you have not joined that class yet.`
    );
  }
  if (text.includes('check constraint') && text.includes('code')) {
    return 'That course code is not in the form "ECON 1020".';
  }
  if (text.includes('check constraint') && text.includes('handle')) {
    return 'A display name has to be between 2 and 40 characters.';
  }
  if (text.includes('duplicate key')) return 'You are already in that class.';
  if (text.includes('relation') && text.includes('does not exist')) {
    return 'The classmates tables are not set up on this project yet — run supabase/classmates.sql.';
  }
  return message;
}

// ── Group work ────────────────────────────────────────────────────────────
//
// A group is smaller than a room and outlives a conversation: members who are
// a subset of the class, a deliverable with a date, and a list of parts with
// owners. None of that fits in a message stream, and a message stream cannot
// answer "what is unclaimed". `supabase/groups.sql` holds the policies; the
// arithmetic is in `lib/groupwork.ts`.

export interface GroupRow {
  id: string;
  term: string;
  code: string;
  name: string;
  about: string;
  due: string;
  created_by: string;
}

export interface PartRow {
  id: string;
  group_id: string;
  title: string;
  owner: string | null;
  done: boolean;
  due: string;
  created_at: string;
}

/** Every group in a room. Visible to the class, so you can find yours. */
export async function groupsIn(term: string, code: string): Promise<GroupRow[]> {
  const { data, error } = await (await cloud())
    .from('groups')
    .select('id, term, code, name, about, due, created_by')
    .eq('term', term)
    .eq('code', code)
    .order('created_at', { ascending: true });
  if (error) throw new Error(explain(error.message));
  return (data ?? []) as GroupRow[];
}

export async function startGroup(
  userId: string,
  term: string,
  code: string,
  name: string,
): Promise<string> {
  const { data, error } = await (await cloud())
    .from('groups')
    .insert({ term, code, name: name.trim().slice(0, 120), created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(explain(error.message));
  const id = (data as { id: string }).id;
  // Starting a group puts you in it. Nobody means to create one and stand
  // outside it, and a group with no members cannot be edited by anyone.
  await joinGroup(userId, id);
  return id;
}

export async function setGroup(id: string, patch: Partial<Pick<GroupRow, 'name' | 'about' | 'due'>>) {
  const { error } = await (await cloud()).from('groups').update(patch).eq('id', id);
  if (error) throw new Error(explain(error.message));
}

export async function joinGroup(userId: string, groupId: string): Promise<void> {
  const { error } = await (await cloud())
    .from('group_members')
    .upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id' });
  if (error) throw new Error(explain(error.message));
}

export async function leaveGroup(userId: string, groupId: string): Promise<void> {
  const { error } = await (await cloud())
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(explain(error.message));
}

/** Who is in a group, as profiles. Unnamed members are simply not listed. */
export async function membersOf(groupId: string): Promise<Profile[]> {
  const { data: rows, error } = await (await cloud())
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  if (error) throw new Error(explain(error.message));

  const ids = ((rows ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const { data, error: second } = await (await cloud())
    .from('profiles')
    .select('user_id, handle, about')
    .in('user_id', ids);
  if (second) throw new Error(explain(second.message));
  return ((data ?? []) as Profile[]).sort((a, b) => a.handle.localeCompare(b.handle));
}

export async function partsOf(groupId: string): Promise<PartRow[]> {
  const { data, error } = await (await cloud())
    .from('group_tasks')
    .select('id, group_id, title, owner, done, due, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(explain(error.message));
  return (data ?? []) as PartRow[];
}

export async function addPart(userId: string, groupId: string, title: string): Promise<void> {
  const text = title.trim();
  if (!text) return;
  const { error } = await (await cloud())
    .from('group_tasks')
    .insert({ group_id: groupId, title: text.slice(0, 200), created_by: userId });
  if (error) throw new Error(explain(error.message));
}

/** Any member may claim, tick or retitle. See the policy for why. */
export async function setPart(
  id: string,
  patch: Partial<Pick<PartRow, 'title' | 'owner' | 'done' | 'due'>>,
): Promise<void> {
  const { error } = await (await cloud()).from('group_tasks').update(patch).eq('id', id);
  if (error) throw new Error(explain(error.message));
}

export async function dropPart(id: string): Promise<void> {
  const { error } = await (await cloud()).from('group_tasks').delete().eq('id', id);
  if (error) throw new Error(explain(error.message));
}
