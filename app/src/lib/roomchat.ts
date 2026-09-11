/**
 * The shape of a class conversation: everything about a room that is a
 * decision rather than a request.
 *
 * `lib/classmates.ts` is the wire — profiles, rooms, messages, the policies
 * they land against. This is what the screen needs on top of it and none of it
 * touches the network, because all of it is the part that goes wrong quietly:
 * a run of messages grouped one minute too tightly, an unread count that
 * includes your own messages, a mention that matches a name inside a word.
 * Those are bugs you find by reading the screen, which is the worst way, so
 * they are functions with tests instead.
 *
 * Nothing in here knows about React, Supabase or the clock. Every function
 * that needs the time is handed it.
 */

/** A message, as little of one as any of this needs. */
export interface Say {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/** Somebody in the room, as little of them as any of this needs. */
export interface Who {
  user_id: string;
  handle: string;
}

/** One person's one tap on one message. */
export interface Reacted {
  message_id: string;
  user_id: string;
  emoji: string;
}

/**
 * The faces the picker offers.
 *
 * Six, and no more. A reaction is meant to be the answer you give without
 * writing one, and a grid of forty is a second decision to make — by the time
 * you have found the right face you could have typed "yes". These are the six
 * an answer to a classmate is actually made of: agreement, thanks, that helped,
 * that is funny, I feel that, and I am as lost as you.
 */
export const FACES = ['👍', '🙏', '🎯', '😄', '😮', '😕'] as const;

// ── The clock ─────────────────────────────────────────────────────────────

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3:42p" — the clock on a message, in the app's own short form. */
export function clockAt(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const h = at.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(at.getMinutes()).padStart(2, '0')}${h >= 12 ? 'p' : 'a'}`;
}

/**
 * The stamp at the end of a row in the list of chats.
 *
 * Four forms, narrowing as the message gets older: the clock today, the word
 * yesterday, the weekday inside a week, the date beyond it. A list where every
 * row says "Tue" is a list you read twice — the point of the stamp is to be
 * the thing your eye skips until it needs it.
 */
export function listStamp(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  if (sameDay(at, now)) return clockAt(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return 'Yesterday';
  const week = new Date(now);
  week.setDate(now.getDate() - 6);
  if (at.getTime() >= week.setHours(0, 0, 0, 0)) return DAYS[at.getDay()];
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The rule above the first message of a day: Today, Yesterday, or the date. */
export function dayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  if (sameDay(at, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return 'Yesterday';
  return `${DAYS[at.getDay()]}, ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

// ── Mentions ──────────────────────────────────────────────────────────────

/**
 * The whole room, addressed at once.
 *
 * Spelled without the `@` here because that is how it is stored and matched;
 * the screen writes it with one. A separate word rather than a handle so it
 * cannot collide with somebody who called themselves "class".
 */
export const EVERYONE = 'class';

/** One piece of a message: plain text, or a name somebody was called by. */
export interface Piece {
  text: string;
  /** The handle this piece addresses — `EVERYONE` for the whole room. */
  mention?: string;
}

/**
 * A message body, cut into the text and the names in it.
 *
 * Matched against the handles actually in the room, longest first, and that is
 * the whole reason this is not a regular expression over `@\w+`. Names here
 * have spaces in them: "Kayo Miwa" typed as `@Kayo Miwa` has to match the
 * person and not a person called "Kayo" followed by the word "Miwa". Longest
 * first is what decides that when both exist.
 *
 * An `@` that matches nobody is left as text. A mention is a claim that a
 * specific person will see this, and painting an unmatched one blue would make
 * that claim falsely — the message reads as addressed to somebody who will
 * never be told.
 */
export function pieces(body: string, handles: string[]): Piece[] {
  const names = [...handles, EVERYONE]
    .map((h) => h.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const out: Piece[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) out.push({ text: plain });
    plain = '';
  };

  while (i < body.length) {
    if (body[i] === '@' && (i === 0 || /[\s([]/.test(body[i - 1]))) {
      const rest = body.slice(i + 1);
      const hit = names.find(
        (n) =>
          rest.slice(0, n.length).toLowerCase() === n.toLowerCase() &&
          // Not in the middle of a longer word: "@Ray" must not match inside
          // "@Rayan". The character after the name has to end it.
          !/[A-Za-z0-9]/.test(rest.slice(n.length, n.length + 1)),
      );
      if (hit) {
        flush();
        out.push({ text: `@${rest.slice(0, hit.length)}`, mention: hit });
        i += 1 + hit.length;
        continue;
      }
    }
    plain += body[i];
    i += 1;
  }
  flush();
  return out;
}

/** Whether a message is addressed to you, by name or as the whole room. */
export function mentionsMe(body: string, myHandle: string, handles: string[]): boolean {
  if (!myHandle.trim()) return false;
  return pieces(body, handles).some(
    (p) =>
      p.mention !== undefined &&
      (p.mention === EVERYONE || p.mention.toLowerCase() === myHandle.trim().toLowerCase()),
  );
}

/**
 * The `@` being typed right now, if one is.
 *
 * Looks back from the caret to the nearest `@` and gives up at a newline or at
 * a space that already has a space before it — a picker that stays open while
 * somebody types a sentence after an unmatched `@` is a picker in the way.
 */
export function mentionQuery(text: string, caret: number): { at: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/[\s([]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes('\n')) return null;
  // One space is fine — it is how a two-part name is typed. Two means the
  // sentence moved on.
  if (query.split(' ').length > 2) return null;
  return { at, query };
}

/** Who the picker should offer for what has been typed so far. */
export function mentionable(people: Who[], query: string, limit = 6): Who[] {
  const q = query.trim().toLowerCase();
  const ranked = people
    .filter((p) => p.handle.trim())
    .filter((p) => !q || p.handle.toLowerCase().includes(q))
    // The ones that start with what was typed first: typing "ka" and being
    // offered "Oskar" above "Kayo" is a list that has to be read rather than
    // taken.
    .sort((a, b) => {
      const sa = a.handle.toLowerCase().startsWith(q) ? 0 : 1;
      const sb = b.handle.toLowerCase().startsWith(q) ? 0 : 1;
      return sa - sb || a.handle.localeCompare(b.handle);
    });
  return ranked.slice(0, limit);
}

/** The draft with the half-typed `@` replaced by a whole name, and where the caret goes. */
export function withMention(
  text: string,
  at: number,
  caret: number,
  handle: string,
): { text: string; caret: number } {
  const name = `@${handle.trim()} `;
  const next = text.slice(0, at) + name + text.slice(caret);
  return { text: next, caret: at + name.length };
}

// ── The transcript ────────────────────────────────────────────────────────

/** Messages from one person, said close enough together to read as one turn. */
export interface Run {
  user_id: string;
  /** When the first of them was said — the one time the run shows. */
  at: string;
  says: Say[];
}

/** A day of the conversation. */
export interface Day {
  label: string;
  runs: Run[];
}

/**
 * The transcript, in the shape it is read in.
 *
 * Two groupings, and both of them are about the same thing: a message is not a
 * row in a table. Four messages from one person in one minute are one person
 * talking, so they carry one name, one avatar and one time between them.
 * Anything longer than a few minutes apart is a new turn even from the same
 * person, because the gap is the thing that says they went away and came back.
 *
 * Days get a rule across them. Without one, "3:42p" above "9:15a" is a
 * conversation that appears to run backwards.
 */
export function conversation(says: Say[], now: Date, gapMinutes = 5): Day[] {
  const days: Day[] = [];
  const gap = gapMinutes * 60_000;

  for (const say of says) {
    const at = new Date(say.created_at).getTime();
    const label = dayLabel(say.created_at, now);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    const last = run?.says[run.says.length - 1];
    const near = last ? at - new Date(last.created_at).getTime() <= gap : false;
    if (run && run.user_id === say.user_id && near) run.says.push(say);
    else day.runs.push({ user_id: say.user_id, at: say.created_at, says: [say] });
  }
  return days;
}

/**
 * What arrived since you last looked, and where the line goes.
 *
 * Your own messages are never unread — a count that goes up when you say
 * something is a count nobody trusts again. Neither is anything at or before
 * the mark, so opening a room twice does not show the line twice.
 */
export function unread(
  says: Say[],
  lastRead: string,
  me: string,
  myHandle = '',
  handles: string[] = [],
): { count: number; firstId: string | null; mentions: number } {
  const mark = lastRead ? new Date(lastRead).getTime() : 0;
  let count = 0;
  let mentions = 0;
  let firstId: string | null = null;
  for (const say of says) {
    if (say.user_id === me) continue;
    const at = new Date(say.created_at).getTime();
    if (Number.isNaN(at) || at <= mark) continue;
    count += 1;
    if (firstId === null) firstId = say.id;
    if (myHandle && mentionsMe(say.body, myHandle, handles)) mentions += 1;
  }
  return { count, firstId, mentions };
}

/** The badge on a row. Nine is the point past which the number stops being read. */
export function badge(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

// ── The list of chats ─────────────────────────────────────────────────────

/** One room's worth of device-local state: pinned, muted, and where you got to. */
export interface Mark {
  pinned: boolean;
  muted: boolean;
  /** ISO of the last message you had seen when you last had the room open. */
  read: string;
}

export const NO_MARK: Mark = { pinned: false, muted: false, read: '' };

/** A row in the list beside the conversation. */
export interface Listed {
  key: string;
  code: string;
  joined: boolean;
  pinned: boolean;
  muted: boolean;
  /** The last thing said, already written the way the row shows it. */
  preview: string;
  /** When that was. Empty for a room nobody has said anything in. */
  when: string;
  /** Milliseconds, for ordering. 0 where nothing has been said. */
  at: number;
  unread: number;
  mentions: number;
}

/**
 * The list, in the order it is read.
 *
 * Pinned first and then by what happened last, which is the order every chat
 * app settles on for the same reason: the rooms you chose to keep at hand, then
 * the rooms that moved. Alphabetical is only right for a list nothing happens
 * in.
 *
 * A room you have not joined sorts with the rest but says so, because the list
 * is also how you join one — hiding the classes you are not in yet would mean a
 * second screen to find them.
 */
export function listed(
  rooms: { key: string; code: string; joined: boolean }[],
  says: Record<string, Say[]>,
  marks: Record<string, Mark>,
  me: string,
  who: (id: string) => string,
  now: Date,
  myHandle = '',
  handles: string[] = [],
): Listed[] {
  const rows = rooms.map((room) => {
    const said = says[room.key] ?? [];
    const last = said[said.length - 1] ?? null;
    const mark = marks[room.key] ?? NO_MARK;
    const seen = unread(said, mark.read, me, myHandle, handles);
    return {
      key: room.key,
      code: room.code,
      joined: room.joined,
      pinned: mark.pinned,
      muted: mark.muted,
      preview: last ? preview(last, me, who) : room.joined ? 'No messages yet' : 'Not in it yet',
      when: last ? listStamp(last.created_at, now) : '',
      at: last ? new Date(last.created_at).getTime() || 0 : 0,
      unread: seen.count,
      mentions: seen.mentions,
    };
  });

  return rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.at !== b.at) return b.at - a.at;
    return a.code.localeCompare(b.code);
  });
}

/**
 * The last message, on one line.
 *
 * Named, because "is it due Friday?" with no name in front of it is a line you
 * have to open the room to understand. Yours says "You:", which is the one
 * piece of a list row that tells you whether you are waiting on a reply or
 * somebody is waiting on you.
 */
export function preview(say: Say, me: string, who: (id: string) => string, max = 90): string {
  const body = say.body.replace(/\s+/g, ' ').trim();
  const name = say.user_id === me ? 'You' : who(say.user_id);
  const line = name ? `${name}: ${body}` : body;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** The search over the list of rooms. Matches the code, not the messages. */
export function findRooms(rows: Listed[], query: string): Listed[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.code.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q));
}

/** Find in chat: the messages with a run of characters in them, newest first. */
export function findSaid(says: Say[], query: string): Say[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return says.filter((s) => s.body.toLowerCase().includes(q)).reverse();
}

// ── Reactions ─────────────────────────────────────────────────────────────

/** One face on one message, and who put it there. */
export interface Tally {
  emoji: string;
  count: number;
  /** Whether one of them is yours — the tap that would take it back. */
  mine: boolean;
  /** The names, for the tooltip. Yours reads "You". */
  who: string[];
}

/**
 * Every reaction in a room, arranged per message.
 *
 * Ordered by the picker rather than by count, so a face does not jump sideways
 * under somebody's finger the moment a second person taps it.
 */
export function tally(
  rows: Reacted[],
  me: string,
  who: (id: string) => string,
): Record<string, Tally[]> {
  const out: Record<string, Map<string, Tally>> = {};
  for (const row of rows) {
    const per = (out[row.message_id] ??= new Map());
    const seen = per.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false, who: [] };
    seen.count += 1;
    if (row.user_id === me) seen.mine = true;
    seen.who.push(row.user_id === me ? 'You' : who(row.user_id));
    per.set(row.emoji, seen);
  }
  const order = (e: string) => {
    const at = (FACES as readonly string[]).indexOf(e);
    return at === -1 ? FACES.length : at;
  };
  const per: Record<string, Tally[]> = {};
  for (const [id, map] of Object.entries(out)) {
    per[id] = [...map.values()].sort((a, b) => order(a.emoji) - order(b.emoji));
  }
  return per;
}

// ── What has been shared ──────────────────────────────────────────────────

/** Something in the conversation that is not only words. */
export interface Shared {
  /** The message it came from, so tapping it can go there. */
  id: string;
  kind: 'link' | 'paper';
  /** What the row is called: the host and path, or the paper's code. */
  label: string;
  url?: string;
  code?: string;
  by: string;
  at: string;
}

/** Every http(s) address in a message. */
export function linksIn(body: string): string[] {
  return [...body.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((m) => m[0].replace(/[.,;]+$/, ''));
}

/** A link, as short as it can be while still saying where it goes. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const host = u.hostname.replace(/^www\./, '');
    return tail ? `${host}/${decodeURIComponent(tail)}` : host;
  } catch {
    return url;
  }
}

/**
 * The Files tab, from the conversation itself.
 *
 * There is nowhere to upload a file to — see the note in `lib/cloud.ts` about
 * what does not sync — so this tab is not a promise of storage. It is the
 * answer to "somebody posted the link to the problem set last week", which is
 * the question a Files tab is actually opened for, and it is already in the
 * room. Papers shared from the Exam screen are here too: the code reproduces
 * the questions, so a shared paper is a thing you can open, which is the test
 * for whether it belongs in this list.
 */
export function shared(
  says: Say[],
  who: (id: string) => string,
  paperOf: (body: string) => string | null,
): Shared[] {
  const out: Shared[] = [];
  for (const say of says) {
    const by = who(say.user_id);
    for (const url of linksIn(say.body)) {
      out.push({ id: say.id, kind: 'link', label: linkLabel(url), url, by, at: say.created_at });
    }
    const code = paperOf(say.body);
    if (code) out.push({ id: say.id, kind: 'paper', label: code, code, by, at: say.created_at });
  }
  return out.reverse();
}

// ── Everything said, per room ─────────────────────────────────────────────

/**
 * One query's worth of messages, split into the rooms they belong to.
 *
 * The list needs the last line and an unread count for every room somebody is
 * in, and asking per room is one request per class on every open. One request
 * for all of them and a split here is the same answer for the cost of one.
 */
export function bucket<T extends Say>(says: T[], keyOf: (say: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const say of says) (out[keyOf(say)] ??= []).push(say);
  for (const list of Object.values(out)) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return out;
}
